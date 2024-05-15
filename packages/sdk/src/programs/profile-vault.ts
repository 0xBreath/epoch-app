import { PublicKey } from "@solana/web3.js";
import {
  ProfileVault,
  ProfileVaultIDLProgram,
  ProfileVaultProgram,
} from "@cosmic-lab/profile-vault";
import BN from "bn.js";
import {
  createAssociatedToken2022Account,
  getAssociatedToken2022Address,
  transferTokenWithFee,
} from "./token";
import { PROFILE_VAULT_PROGRAM_ID } from "../constants";
import { AnchorProvider } from "@staratlas/anchor";
import {
  CreateVaultConfig,
  CreditVaultConfig,
  DebitVaultConfig,
  sendTransactionWithSnack,
} from "@cosmic-lab/epoch-sdk";
import { InstructionReturn } from "@cosmic-lab/data-source";

export function profileVaultProgram(): ProfileVaultIDLProgram {
  const profileVaultProgram: ProfileVaultIDLProgram =
    ProfileVaultProgram.buildProgram(
      PROFILE_VAULT_PROGRAM_ID,
      {} as AnchorProvider,
    );
  return profileVaultProgram;
}

export async function createVaultIxs(
  cfg: CreateVaultConfig,
): Promise<{ vaultSigner: PublicKey; instructions: InstructionReturn[] }> {
  const {
    connection,
    profileVaultProgram,
    playerProfileProgram,
    profile,
    profileKey,
    tokenVaultSeed,
    mint,
    vaultAuthKeyIndex,
    funder,
  } = cfg;
  console.debug(
    "find vault signer with program:",
    profileVaultProgram.programId.toString(),
  );
  const vaultAuth = ProfileVault.findVaultSigner(
    profileVaultProgram,
    profile.publicKey(),
    mint,
  )[0];
  const vault = getAssociatedToken2022Address(mint, vaultAuth, true);

  const ixs: InstructionReturn[] = [];

  // create vault token account
  // vault token account is owned by vaultSigner
  const { instructions: createIx, address } = createAssociatedToken2022Account(
    mint,
    vaultAuth,
    true,
  );
  if (address.toString() !== vault.toString()) {
    throw new Error("Calculated vault does not match created vault");
  }
  console.debug("vault auth:", vaultAuth.toString());
  console.debug("create ATA:", vault.toString());
  ixs.push(createIx);

  // create vault
  // vaultSigner is PDA based on arbitrary seeds, so that profile can have multiple vaults
  const { instructions: vaultInitIx, vaultSigner } = ProfileVault.createVault(
    profileVaultProgram,
    tokenVaultSeed,
    {
      playerProfileProgram,
      key: profileKey,
      profileKey: profile.publicKey(),
      keyIndex: vaultAuthKeyIndex,
    },
  );
  ixs.push(vaultInitIx);

  return {
    vaultSigner: vaultSigner[0],
    instructions: ixs,
  };
}

export async function createVault(
  cfg: CreateVaultConfig,
): Promise<{ vaultSigner: PublicKey }> {
  const { connection, funder } = cfg;
  const { vaultSigner, instructions } = await createVaultIxs(cfg);
  try {
    await sendTransactionWithSnack(instructions, funder, connection);
  } catch (e: any) {
    console.error("Failed to create vault:", e);
    throw e;
  }

  return {
    vaultSigner,
  };
}

export async function creditVault(cfg: CreditVaultConfig): Promise<void> {
  const {
    connection,
    mint,
    originSigner,
    originTokenAccount,
    vaultTokenAccount,
    amount,
    feeBasisPoints,
    decimals,
    funder,
  } = cfg;
  try {
    const transferIx = await transferTokenWithFee(
      mint,
      originSigner,
      originTokenAccount,
      vaultTokenAccount,
      amount,
      feeBasisPoints,
      decimals,
    );
    await sendTransactionWithSnack([transferIx], funder, connection);
  } catch (e: any) {
    console.error(e);
    throw e;
  }
}

export async function debitVault(cfg: DebitVaultConfig): Promise<void> {
  const {
    connection,
    playerProfileProgram,
    profileVaultProgram,
    mint,
    mintDecimals,
    amount,
    drainer,
    profile,
    profileKey,
    drainVaultKeyIndex,
    funder,
  } = cfg;

  try {
    const vaultAuth = ProfileVault.findVaultSigner(
      profileVaultProgram,
      profile,
      mint,
    )[0];
    const userVault = getAssociatedToken2022Address(mint, vaultAuth);
    const tokensTo = getAssociatedToken2022Address(mint, drainer);
    console.log("debit user vault:", userVault.toString());
    console.log("credit protocol vault:", tokensTo.toString());

    const tokensToAccount = await connection.getAccountInfo(tokensTo);
    if (!tokensToAccount) {
      try {
        const { instructions } = createAssociatedToken2022Account(
          mint,
          drainer,
        );
        await sendTransactionWithSnack([instructions], funder, connection);
      } catch (e: any) {
        console.error(
          "Failed to create token account for Epoch protocol admin:",
          e,
        );
        throw e;
      }
    }

    const drainIx = ProfileVault.drainVault(
      profileVaultProgram,
      mint,
      mintDecimals,
      userVault,
      vaultAuth,
      tokensTo,
      new BN(amount),
      {
        playerProfileProgram,
        key: profileKey,
        profileKey: profile,
        keyIndex: drainVaultKeyIndex,
      },
    );

    await sendTransactionWithSnack([drainIx], funder, connection);
  } catch (e: any) {
    console.error(e);
    throw e;
  }
}
