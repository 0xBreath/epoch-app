import { DEV_EPOCH_ENDPOINT, PROD_EPOCH_ENDPOINT } from "../constants";
import { PublicKey } from "@solana/web3.js";

export enum Env {
  Dev = "dev",
  Prod = "prod",
}

export function epochEndpoint(env: Env): string {
  return env === "dev" ? DEV_EPOCH_ENDPOINT : PROD_EPOCH_ENDPOINT;
}

export interface VaultBalance {
  amount: number;
  ui_amount: number;
  withheld_amount: number;
  ui_withheld_amount: number;
  decimals: number;
}

export interface EpochProfile {
  profile: string;
}

export interface EpochUser {
  profile: PublicKey;
  apiKey: string;
  vault: PublicKey;
  balance: VaultBalance;
}

export interface QueryAccountId {
  id: number;
}

export interface QueryAccounts {
  key: string | null;
  slot: number | null;
  min_slot: number | null;
  max_slot: number | null;
  owner: string | null;
  limit: number | null;
  offset: number | null;
}

export interface EpochAccount {
  id: number;
  key: string;
  slot: number;
  lamports: number;
  owner: string;
  executable: boolean;
  rent_epoch: number;
  discriminant: Buffer | null;
  data: Buffer;
}

export interface QueryDecodedAccounts {
  key: string | null;
  slot: number | null;
  min_slot: number | null;
  max_slot: number | null;
  owner: string;
  discriminant: string;
  limit: number | null;
  offset: number | null;
}

export interface JsonEpochAccount {
  key: string;
  slot: number;
  owner: string;
  decoded: any;
}

export interface QueryRegisteredTypes {
  program_name: string | null;
  program: string | null;
  discriminant: string | null;
}

export interface RegisteredType {
  program_name: string;
  program: string;
  account_discriminant: string;
  account_type: any;
}

export interface RequestAirdrop {
  key: string;
}

export interface RequestChallenge {
  key: string;
}

export interface AuthenticateSignature {
  key: string;
  signature: string;
}
