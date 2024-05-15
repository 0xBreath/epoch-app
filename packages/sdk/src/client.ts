import {
  CreateProfileConfig,
  CreateVaultConfig,
  CreditVaultConfig,
  DebitVaultConfig,
  Env,
  EpochAccount,
  epochEndpoint,
  EpochUser,
  JsonEpochAccount,
  QueryAccountId,
  QueryAccounts,
  QueryDecodedAccounts,
  QueryRegisteredTypes,
  RegisteredType,
  VaultBalance,
} from "./types";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  Accounts,
  createEpochProfile,
  createVault,
  createVaultIxs,
  creditVault,
  debitVault,
  EPOCH_MINT,
  EPOCH_PROTOCOL,
  getAssociatedToken2022Address,
  playerProfileProgram,
  profilesForKey,
  profileVaultProgram,
  RegisteredTypes,
  sendTransactionWithSnack,
  User,
} from ".";
import { ProfileVault } from "@cosmic-lab/profile-vault";
import {
  AsyncSigner,
  keypairToAsyncSigner,
  walletAdapterToAsyncSigner,
} from "@cosmic-lab/data-source";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { PlayerProfile } from "@cosmic-lab/player-profile";
import { makeAutoObservable } from "mobx";
import base58 from "bs58";

export class EpochClient {
  private static _instance: EpochClient | null = null;
  baseUrl: string;
  conn: Connection;
  apiKey: string | null = null;
  epochUser: EpochUser | null = null;

  constructor(env: Env, conn: Connection) {
    makeAutoObservable(this);

    this.baseUrl = epochEndpoint(env);
    this.conn = conn;

    this.getOrCreateProfile = this.getOrCreateProfile.bind(this);
    this.epochProfile = this.epochProfile.bind(this);
    this.createProfile = this.createProfile.bind(this);
    this.connect = this.connect.bind(this);
    this.createUser = this.createUser.bind(this);
    this.readUser = this.readUser.bind(this);
    this.deleteUser = this.deleteUser.bind(this);
    this.userBalance = this.userBalance.bind(this);
    this.accountId = this.accountId.bind(this);
    this.accounts = this.accounts.bind(this);
    this.decodedAccounts = this.decodedAccounts.bind(this);
    this.registeredTypes = this.registeredTypes.bind(this);
    this.filteredRegisteredTypes = this.filteredRegisteredTypes.bind(this);
  }

  static get instance(): EpochClient {
    if (!this._instance) {
      if (!process.env.ENV) {
        throw new Error("ENV not found in process.env");
      }
      if (!process.env.RPC_URL) {
        throw new Error("RPC_URL not found in process.env");
      }
      const env: Env = process.env.ENV as unknown as Env;
      const rpcUrl: string = process.env.RPC_URL;
      const conn = new Connection(rpcUrl, "confirmed");
      this._instance = new EpochClient(env, conn);
    }
    return this._instance;
  }

  public async airdrop(key: PublicKey) {
    await User.airdrop(this.baseUrl, key);
    await this.refreshBalance();
    return;
  }

  async refreshBalance() {
    if (!this.epochUser) {
      console.log("Epoch user not set for refreshBalance");
      return;
    }
    this.epochUser.balance = await this.userBalance(this.epochUser.profile);
  }

  public static readKeypairFromEnv(key: string): Keypair {
    try {
      const raw = process.env[key];
      if (!raw) throw new Error(`${key} not found in env`);
      const byteArray = JSON.parse(raw);
      const buffer = Buffer.from(byteArray);
      return Keypair.fromSecretKey(buffer);
    } catch (e: any) {
      console.error(`${key} not found in env`);
      throw e;
    }
  }

  /**
   * Helper method to convert a connected Solana wallet adapter to AsyncSigner.
   * For clients directly using the SDK within a React app that uses `@solana/wallet-adapter-react` to connect to a wallet.
   */
  public static walletAdapterToAsyncSigner(
    wallet: WalletContextState,
  ): AsyncSigner {
    return walletAdapterToAsyncSigner(wallet);
  }

  /**
   * Helper method to convert a Keypair to AsyncSigner.
   * For clients directly using the SDK outside of a React app (such as developers or a bot)
   * For most the Keypair would be read from a local file or environment variable.
   */
  public static keypairToAsyncSigner(key: Keypair): AsyncSigner {
    return keypairToAsyncSigner(key);
  }

  //
  //
  // Manage Epoch profile and vault
  //
  //

  public async getOrCreateProfile(user: AsyncSigner): Promise<PublicKey> {
    const profile = await this.epochProfile(user);
    if (profile) {
      return profile;
    }
    return (await this.createProfile(user)).publicKey();
  }

  public async epochProfile(user: AsyncSigner): Promise<PublicKey | null> {
    const profiles = await profilesForKey(
      this.conn,
      user.publicKey(),
      EPOCH_PROTOCOL,
    );
    if (profiles.length > 0) {
      return profiles[0].key;
    } else {
      return null;
    }
  }

  public async createProfile(user: AsyncSigner): Promise<AsyncSigner> {
    const profileId = keypairToAsyncSigner(Keypair.generate());
    const profileCfg: CreateProfileConfig = {
      connection: this.conn,
      playerProfileProgram: playerProfileProgram(),
      profileVaultProgram: profileVaultProgram(),
      profileId,
      profileAuth: user,
      protocolKey: EPOCH_PROTOCOL,
    };
    const vaultCfg: CreateVaultConfig = {
      connection: this.conn,
      profileVaultProgram: profileVaultProgram(),
      playerProfileProgram: playerProfileProgram(),
      profile: profileId,
      profileKey: user,
      vaultOwner: user.publicKey(),
      tokenVaultSeed: EPOCH_MINT,
      mint: EPOCH_MINT,
      vaultAuthKeyIndex: 1,
      funder: user,
    };

    const profileIxs = await createEpochProfile(profileCfg);
    const { instructions: vaultIxs } = await createVaultIxs(vaultCfg);
    await sendTransactionWithSnack(
      [...profileIxs, ...vaultIxs],
      user,
      this.conn,
    );
    return profileId;
  }

  public async profilesForKey(
    auth: PublicKey,
    searchKey?: PublicKey,
  ): Promise<PlayerProfile[]> {
    return await profilesForKey(this.conn, auth, searchKey);
  }

  public static async createVault(
    connection: Connection,
    user: AsyncSigner,
    profileId: AsyncSigner,
  ) {
    try {
      const cfg: CreateVaultConfig = {
        connection,
        profileVaultProgram: profileVaultProgram(),
        playerProfileProgram: playerProfileProgram(),
        profile: profileId,
        profileKey: user,
        vaultOwner: user.publicKey(),
        tokenVaultSeed: EPOCH_MINT,
        mint: EPOCH_MINT,
        vaultAuthKeyIndex: 1,
        funder: user,
      };
      await createVault(cfg);
    } catch (e: any) {
      console.error("Failed to create vault:", e);
      throw e;
    }
  }

  public static async creditVault(cfg: CreditVaultConfig) {
    try {
      await creditVault(cfg);
    } catch (e: any) {
      console.error("Failed to debit vault:", e);
      throw e;
    }
  }

  public static async debitVault(cfg: DebitVaultConfig) {
    try {
      await debitVault(cfg);
    } catch (e: any) {
      console.error("Failed to debit vault:", e);
      throw e;
    }
  }

  public static vaultAuth(profile: PublicKey, mint = EPOCH_MINT): PublicKey {
    return ProfileVault.findVaultSigner(
      profileVaultProgram(),
      profile,
      mint,
    )[0];
  }

  public static vault(profile: PublicKey, mint = EPOCH_MINT): PublicKey {
    const vaultAuth = EpochClient.vaultAuth(profile);
    return getAssociatedToken2022Address(mint, vaultAuth);
  }

  //
  //
  // Log in
  //
  //

  public async verifyWallet(signer: AsyncSigner): Promise<{ apiKey: string }> {
    try {
      if (!signer.signMessage) {
        throw new Error("Wallet does not support signMessage");
      }
      if (!signer.publicKey()) {
        throw new Error("Wallet missing public key");
      }
      const msgToSign = await this.requestChallenge(signer.publicKey());
      const msg = new TextEncoder().encode(msgToSign);
      const sigBytes = await signer.signMessage(msg);
      const sig = base58.encode(sigBytes);
      const apiKey = await this.authenticateSignature(signer.publicKey(), sig);
      console.debug("apiKey:", apiKey);

      if (apiKey) {
        return { apiKey };
      } else {
        throw new Error("Signature verification failed");
      }
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Connect to the Epoch API using a Solana wallet adapter
   * @param signer - the Solana WalletContextState or Keypair converted to an AsyncSigner.
   * AsyncSigner can be constructed from a Solana wallet (e.g. Phantom, Sollet) by calling the hook `useWallet()` from `@solana/wallet-adapter-react`
   * which returns type WalletContextState.
   * Call EpochClient.walletAdapterToAsyncSigner(walletContextState) to convert to AsyncSigner.
   * AsyncSigner can be constructed from a Keypair read from a local file, environment variable, or generated using Keypair.generate().
   * Call EpochClient.keypairToAsyncSigner(keypair) to convert to AsyncSigner.
   * @returns the EpochUser object
   */
  public async connect(signer: AsyncSigner): Promise<EpochUser | null> {
    try {
      // prompts user to sign message to prove ownership of wallet
      // the signed message acts as the API key
      const { apiKey } = await this.verifyWallet(signer);

      // await this.deleteUser(apiKey);
      const existingProfile = await this.epochProfile(signer);
      const existingUser = await this.readUser(apiKey);
      console.debug("existing profile:", !!existingProfile?.toString());
      console.debug("existing user:", !!existingUser);

      if (!existingProfile && !existingUser) {
        // no user and no profile -> createProfile and createUser
        const newProfile = await this.createProfile(signer);
        const epochUser = await this.createUser(newProfile.publicKey(), apiKey);
        this.epochUser = epochUser;
        return epochUser;
      } else if (existingProfile && !existingUser) {
        // profile and no user -> createUser
        const epochUser = await this.createUser(existingProfile, apiKey);
        this.epochUser = epochUser;
        return epochUser;
      } else if (existingUser && !existingProfile) {
        // user and no profile -> createProfile
        const newProfile = await this.createProfile(signer);
        const epochUser = await this.updateUser(newProfile.publicKey(), apiKey);
        this.epochUser = epochUser;
        return epochUser;
      } else if (
        existingProfile &&
        existingUser &&
        existingProfile.equals(existingUser)
      ) {
        // profile and user -> return
        const epochUser = await this.readEpochUser(apiKey);
        this.epochUser = epochUser;
        return epochUser;
      } else if (
        existingProfile &&
        existingUser &&
        !existingProfile.equals(existingUser)
      ) {
        await this.deleteUser(apiKey);
        const newProfile = await this.createProfile(signer);
        const epochUser = await this.updateUser(newProfile.publicKey(), apiKey);
        this.epochUser = epochUser;
        return epochUser;
      } else {
        throw new Error("Unexpected state");
      }
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  //
  //
  // User API methods
  //
  //

  public async requestChallenge(wallet: PublicKey): Promise<string> {
    try {
      return await User.requestChallenge(this.baseUrl, wallet);
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  public async authenticateSignature(
    wallet: PublicKey,
    signature: string,
  ): Promise<string | null> {
    try {
      return await User.authenticateSignature(this.baseUrl, wallet, signature);
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  /*
   * Register user with API
   * @param profile - the user's profile
   * @returns If successful the returned PublicKey should match the input profile
   */
  public async createUser(
    profile: PublicKey,
    apiKey: string,
  ): Promise<EpochUser> {
    try {
      this.apiKey = apiKey;
      await User.createUser(this.baseUrl, profile, apiKey);
      return {
        profile,
        apiKey,
        vault: EpochClient.vault(profile),
        balance: await this.userBalance(profile),
      };
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  /*
   * Update an existing user with API
   * @param profile - the user's profile
   * @returns If successful the returned PublicKey should match the input profile
   */
  public async updateUser(
    profile: PublicKey,
    apiKey: string,
  ): Promise<EpochUser> {
    try {
      this.apiKey = apiKey;
      await User.updateUser(this.baseUrl, profile, apiKey);
      return {
        profile,
        apiKey,
        vault: EpochClient.vault(profile),
        balance: await this.userBalance(profile),
      };
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  /*
   * Read user profile from the API
   * @param apiKey - the user's API key
   * @returns the user's profile
   */
  public async readEpochUser(apiKey: string): Promise<EpochUser | null> {
    try {
      this.apiKey = apiKey;
      const profile = await User.readUser(this.baseUrl, apiKey);
      if (profile) {
        return {
          profile,
          apiKey,
          vault: EpochClient.vault(profile),
          balance: await this.userBalance(profile),
        };
      } else {
        return null;
      }
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  /*
   * Read user profile from the API
   * @param apiKey - the user's API key
   * @returns the user's profile
   */
  public async readUser(apiKey: string): Promise<PublicKey | null> {
    try {
      this.apiKey = apiKey;
      const profile = await User.readUser(this.baseUrl, apiKey);
      return profile;
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  /*
   * Delete user profile from the API
   * @param profile - the user's profile
   * @returns success message "User deleted"
   */
  public async deleteUser(apiKey: string): Promise<void> {
    try {
      const profile = await User.readUser(this.baseUrl, apiKey);
      if (profile) {
        await User.deleteUser(this.baseUrl, apiKey, profile);
      }
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  /*
   * Fetch the balance of the user's Epoch vault
   * @returns Returns the VaultBalance of the user's Epoch vault
   */
  public async userBalance(profile: PublicKey): Promise<VaultBalance> {
    try {
      if (!this.apiKey) throw new Error("API key not set");
      return await User.userBalance(this.baseUrl, this.apiKey);
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  //
  //
  // Account API methods
  //
  //

  /*
   * Query a single raw account by id
   * @param body - the query parameters
   * @returns If successful, returns the raw account
   */
  public async accountId(body: QueryAccountId): Promise<EpochAccount> {
    try {
      if (!this.apiKey) throw new Error("API key not set");
      const res = await Accounts.accountId(this.baseUrl, this.apiKey, body);
      await this.refreshBalance();
      return res;
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  /*
   * Query many raw accounts by various parameters
   * @param body - the query parameters
   * @returns If successful, returns the raw accounts
   */
  public async accounts(body: QueryAccounts): Promise<EpochAccount[]> {
    try {
      if (!this.apiKey) throw new Error("API key not set");
      const res = await Accounts.accounts(this.baseUrl, this.apiKey, body);
      await this.refreshBalance();
      return res;
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  /*
   * Query many decoded account by various parameters
   * @param body - the query parameters
   * @returns If successful, returns the decoded accounts
   */
  public async decodedAccounts(
    body: QueryDecodedAccounts,
  ): Promise<JsonEpochAccount[]> {
    try {
      if (!this.apiKey) throw new Error("API key not set");
      const res = await Accounts.decodedAccounts(
        this.baseUrl,
        this.apiKey,
        body,
      );
      await this.refreshBalance();
      return res;
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  //
  //
  // Registered Types API methods
  //
  //

  /*
   * Query all registered types, which are type/schema definitions
   * of every decoded account supported by the API.
   * @param body - the query parameters
   * @returns If successful, returns the types
   */
  public async registeredTypes(): Promise<RegisteredType[]> {
    try {
      if (!this.apiKey) throw new Error("API key not set");
      const res = await RegisteredTypes.registeredTypes(
        this.baseUrl,
        this.apiKey,
      );
      await this.refreshBalance();
      return res;
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  /*
   * Query a subset of the registered types, which are type/schema definitions
   * of the decoded accounts supported by the API.
   * @param body - the query parameters
   * @returns If successful, returns the types
   */
  public async filteredRegisteredTypes(
    body: QueryRegisteredTypes,
  ): Promise<RegisteredType[]> {
    try {
      if (!this.apiKey) throw new Error("API key not set");
      const res = await RegisteredTypes.filteredRegisteredTypes(
        this.baseUrl,
        this.apiKey,
        body,
      );
      await this.refreshBalance();
      return res;
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }
}
