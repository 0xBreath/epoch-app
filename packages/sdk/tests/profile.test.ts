import { AnchorProvider, Wallet } from "@staratlas/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { keypairToAsyncSigner } from "@cosmic-lab/data-source";
import {
  PlayerProfileIDLProgram,
  PlayerProfileProgram,
} from "@cosmic-lab/player-profile";
import {
  basisPointsToDecimal,
  createEpochProfile,
  CreateProfileConfig,
  createTransferFeeMint,
  createVault,
  CreateVaultConfig,
  creditVault,
  debitVault,
  EpochClient,
  getAssociatedToken2022Address,
  mintTransferFeeToken,
  PLAYER_PROFILE_PROGRAM_ID,
  PROFILE_VAULT_PROGRAM_ID,
  tokenAmountToDecimal,
} from "../src";
import {
  ProfileVault,
  ProfileVaultIDLProgram,
  ProfileVaultProgram,
} from "@cosmic-lab/profile-vault";
import dotenv from "dotenv";
import { describe, expect } from "@jest/globals";

dotenv.config();

describe("Tokenized API Credits", function () {
  const connection = new Connection("http://localhost:8899", "confirmed");
  const walletKeypair = Keypair.generate();
  const walletSigner = keypairToAsyncSigner(walletKeypair);
  const provider = new AnchorProvider(
    connection,
    new Wallet(walletKeypair),
    AnchorProvider.defaultOptions(),
  );

  const playerProfileProgram: PlayerProfileIDLProgram =
    PlayerProfileProgram.buildProgram(PLAYER_PROFILE_PROGRAM_ID, provider);

  const profileVaultProgram: ProfileVaultIDLProgram =
    ProfileVaultProgram.buildProgram(PROFILE_VAULT_PROGRAM_ID, provider);

  // epoch token
  const mintDecimals = 2;
  const epochMint = EpochClient.readKeypairFromEnv("EPOCH_MINT");
  const mint = keypairToAsyncSigner(epochMint);
  // const mint = keypairToAsyncSigner(Keypair.generate());
  const epochProtocol = EpochClient.readKeypairFromEnv("EPOCH_PROTOCOL");
  const protocolAdmin = keypairToAsyncSigner(epochProtocol);
  // const protocolAdmin = keypairToAsyncSigner(Keypair.generate());
  const feeBasisPoints = 15_00; // 10%, 1% = 100 basis points
  let tokenTransferAmount = 100_00; // tokens to transfer, multiplied by decimals of mint (2)

  // profile keys
  const user = keypairToAsyncSigner(Keypair.generate());
  const userProfile = keypairToAsyncSigner(Keypair.generate());
  // 0 is profile auth, 1 is vault auth, 2 is vault drainer
  const profileAuthKeyIndex = 0;
  const vaultAuthKeyIndex = 1;
  const vaultDrainerKeyIndex = 2;

  beforeAll(async () => {
    try {
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          user.publicKey(),
          100_000_000_000,
        ),
      );
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          protocolAdmin.publicKey(),
          100_000_000_000,
        ),
      );

      await createTransferFeeMint(
        provider.connection,
        mint,
        protocolAdmin,
        protocolAdmin.publicKey(),
        protocolAdmin.publicKey(),
        feeBasisPoints,
        mintDecimals,
      );
      console.log("created transfer fee mint");

      await mintTransferFeeToken(
        provider.connection,
        mint,
        protocolAdmin,
        protocolAdmin.publicKey(),
        protocolAdmin,
        tokenTransferAmount,
      );
      console.log("minted tokens for protocol admin");
    } catch (e: any) {
      // if error contains "already in use" then ignore
      if (!e.message.includes("custom program error: 0x0")) {
        console.log("message:", e.message);
        console.error("Failed to setup tests:", e);
        throw e;
      }
    }
  });

  it("Create epoch profile", async function () {
    try {
      const cfg: CreateProfileConfig = {
        connection: provider.connection,
        playerProfileProgram,
        profileVaultProgram,
        profileId: userProfile,
        profileAuth: user,
        protocolKey: protocolAdmin.publicKey(),
      };
      await createEpochProfile(cfg);
    } catch (e: any) {
      console.error("Failed to create Epoch profile:", e);
      throw e;
    }
  });

  it("Create user vault", async function () {
    try {
      const cfg: CreateVaultConfig = {
        connection: provider.connection,
        profileVaultProgram,
        playerProfileProgram,
        profile: userProfile,
        profileKey: user,
        vaultOwner: user.publicKey(),
        tokenVaultSeed: mint.publicKey(),
        mint: mint.publicKey(),
        vaultAuthKeyIndex,
        funder: user,
      };
      await createVault(cfg);
    } catch (e: any) {
      console.error("Failed to create user vault:", e);
      throw e;
    }
  });

  it("Credit user vault", async function () {
    try {
      const vaultAuth = ProfileVault.findVaultSigner(
        profileVaultProgram,
        userProfile.publicKey(),
        mint.publicKey(),
      )[0];
      console.log("user profile:", userProfile.publicKey().toString());
      const userVault = getAssociatedToken2022Address(
        mint.publicKey(),
        vaultAuth,
      );
      const protocolVault = getAssociatedToken2022Address(
        mint.publicKey(),
        protocolAdmin.publicKey(),
      );

      await creditVault({
        connection: provider.connection,
        mint: mint.publicKey(),
        originSigner: protocolAdmin,
        originTokenAccount: protocolVault,
        vaultTokenAccount: userVault,
        amount: tokenTransferAmount,
        feeBasisPoints,
        decimals: mintDecimals,
        funder: user,
      });

      const userVaultAcct = (await connection.getTokenAccountBalance(userVault))
        .value;
      expect(userVaultAcct.uiAmount).toEqual(
        tokenAmountToDecimal(tokenTransferAmount, mintDecimals) *
          (1 - basisPointsToDecimal(feeBasisPoints)),
      );
      tokenTransferAmount = userVaultAcct.uiAmount! * 10 ** mintDecimals;
      console.log("user vault after user credit:", userVaultAcct.uiAmount);

      const protocolVaultAcct = (
        await connection.getTokenAccountBalance(protocolVault)
      ).value;
      expect(protocolVaultAcct.uiAmount).toEqual(0);
      console.log(
        "protocol vault after user credit:",
        protocolVaultAcct.uiAmount,
      );
    } catch (e: any) {
      console.error("Failed to credit user vault:", e);
      throw e;
    }
  });

  it("Debit user vault", async function () {
    try {
      await debitVault({
        connection: provider.connection,
        playerProfileProgram,
        profileVaultProgram,

        mint: mint.publicKey(),
        mintDecimals,
        amount: tokenTransferAmount,

        user: user.publicKey(),
        drainer: protocolAdmin.publicKey(),

        profile: userProfile.publicKey(),
        profileKey: protocolAdmin,
        drainVaultKeyIndex: vaultDrainerKeyIndex,
        funder: protocolAdmin,
      });

      const vaultAuth = ProfileVault.findVaultSigner(
        profileVaultProgram,
        userProfile.publicKey(),
        mint.publicKey(),
      )[0];
      const userVault = getAssociatedToken2022Address(
        mint.publicKey(),
        vaultAuth,
      );
      const protocolVault = getAssociatedToken2022Address(
        mint.publicKey(),
        protocolAdmin.publicKey(),
      );

      const userVaultAcct = (await connection.getTokenAccountBalance(userVault))
        .value;
      expect(userVaultAcct.uiAmount).toEqual(0);
      console.log("user vault after user debit:", userVaultAcct.uiAmount);

      const protocolVaultAcct = (
        await connection.getTokenAccountBalance(protocolVault)
      ).value;
      expect(protocolVaultAcct.uiAmount).toEqual(
        tokenAmountToDecimal(tokenTransferAmount, mintDecimals) *
          (1 - basisPointsToDecimal(feeBasisPoints)),
      );
      console.log(
        "protocol vault after user debit:",
        protocolVaultAcct.uiAmount,
      );
    } catch (e: any) {
      console.error("Failed to debit user vault:", e);
      throw e;
    }
  });
});
