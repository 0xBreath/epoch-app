import { BN } from "@staratlas/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { AsyncSigner } from "@cosmic-lab/data-source";
import {
  PermissionType,
  PlayerProfileIDLProgram,
} from "@cosmic-lab/player-profile";
import { ProfileVaultIDLProgram } from "@cosmic-lab/profile-vault";

export type CreateProfileKeysInput = {
  key: PublicKey | AsyncSigner;
  expireTime: BN | null;
  scope: PublicKey;
  permissions: PermissionType<unknown>;
}[];

export interface CreateProfileConfig {
  connection: Connection;
  playerProfileProgram: PlayerProfileIDLProgram;
  profileVaultProgram: ProfileVaultIDLProgram;
  profileId: AsyncSigner;
  profileAuth: AsyncSigner;
  protocolKey: PublicKey;
  keyThreshold?: number;
}

export interface CreateVaultConfig {
  connection: Connection;
  profileVaultProgram: ProfileVaultIDLProgram;
  playerProfileProgram: PlayerProfileIDLProgram;
  profile: AsyncSigner;
  profileKey: AsyncSigner;
  vaultOwner: PublicKey;
  tokenVaultSeed: PublicKey;
  mint: PublicKey;
  vaultAuthKeyIndex: number;
  funder: AsyncSigner;
}

export interface CreditVaultConfig {
  connection: Connection;
  mint: PublicKey;
  originSigner: AsyncSigner;
  originTokenAccount: PublicKey;
  vaultTokenAccount: PublicKey;
  amount: number;
  feeBasisPoints: number;
  decimals: number;
  funder: AsyncSigner;
}

export interface DebitVaultConfig {
  connection: Connection;
  playerProfileProgram: PlayerProfileIDLProgram;
  profileVaultProgram: ProfileVaultIDLProgram;

  mint: PublicKey;
  mintDecimals: number;
  amount: number;

  user: PublicKey;
  drainer: PublicKey;

  profile: PublicKey;
  profileKey: AsyncSigner;
  drainVaultKeyIndex: number;
  funder: AsyncSigner;
}
