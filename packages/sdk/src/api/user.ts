import axios from "axios";
import {
  AuthenticateSignature,
  EpochProfile,
  RequestAirdrop,
  RequestChallenge,
  VaultBalance,
} from "../";
import { PublicKey } from "@solana/web3.js";

export class User {
  constructor() {}

  public static async requestChallenge(
    baseUrl: string,
    key: PublicKey,
  ): Promise<string> {
    try {
      let headers = {
        "Content-Type": "application/json",
      };
      let body: RequestChallenge = {
        key: key.toString(),
      };
      const res = await axios.post(`${baseUrl}/challenge`, body, {
        headers,
      });
      const msgToSign: string = res.data;
      return msgToSign;
    } catch (e: any) {
      console.error("Failed to request challenge:", e);
      throw e;
    }
  }

  public static async authenticateSignature(
    baseUrl: string,
    key: PublicKey,
    signature: string,
  ): Promise<string | null> {
    try {
      let headers = {
        "Content-Type": "application/json",
      };
      let body: AuthenticateSignature = {
        key: key.toString(),
        signature,
      };
      const res = await axios.post(`${baseUrl}/authenticate`, body, {
        headers,
      });
      const apiKey: string | null = res.data;
      return apiKey;
    } catch (e: any) {
      console.error("Failed to authenticate signature:", e);
      throw e;
    }
  }

  public static async airdrop(baseUrl: string, key: PublicKey): Promise<void> {
    try {
      let headers = {
        "Content-Type": "application/json",
      };
      let body: RequestAirdrop = {
        key: key.toString(),
      };
      await axios.post(`${baseUrl}/airdrop`, body, {
        headers,
      });
    } catch (e: any) {
      console.error("Failed to airdrop:", e);
      throw e;
    }
  }

  public static async createUser(
    baseUrl: string,
    profile: PublicKey,
    apiKey: string,
  ): Promise<{
    profile: PublicKey;
    apiKey: string;
  }> {
    try {
      let headers = {
        "Content-Type": "application/json",
        epoch_api_key: apiKey,
      };
      let body: EpochProfile = {
        profile: profile.toString(),
      };

      const response = await axios.post(`${baseUrl}/create-user`, body, {
        headers,
      });
      const userProfile: PublicKey = new PublicKey(response.data);
      return {
        profile: userProfile,
        apiKey,
      };
    } catch (e: any) {
      console.error("Failed to create user:", e);
      throw e;
    }
  }

  public static async updateUser(
    baseUrl: string,
    profile: PublicKey,
    apiKey: string,
  ): Promise<{
    profile: PublicKey;
    apiKey: string;
  }> {
    try {
      let headers = {
        "Content-Type": "application/json",
        epoch_api_key: apiKey,
      };
      let body: EpochProfile = {
        profile: profile.toString(),
      };

      const response = await axios.post(`${baseUrl}/update-user`, body, {
        headers,
      });
      const userProfile: PublicKey = new PublicKey(response.data);
      return {
        profile: userProfile,
        apiKey,
      };
    } catch (e: any) {
      console.error("Failed to create user:", e);
      throw e;
    }
  }

  public static async deleteUser(
    baseUrl: string,
    apiKey: string,
    profile: PublicKey,
  ): Promise<string> {
    try {
      let headers = {
        "Content-Type": "application/json",
        epoch_api_key: apiKey,
      };
      let body: EpochProfile = {
        profile: profile.toString(),
      };
      const response = await axios.post(`${baseUrl}/delete-user`, body, {
        headers,
      });
      const msg: string = response.data;
      return msg;
    } catch (e: any) {
      console.error("Failed to delete user:", e);
      throw e;
    }
  }

  public static async readUser(
    baseUrl: string,
    apiKey: string,
  ): Promise<PublicKey | null> {
    try {
      let headers = {
        "Content-Type": "application/json",
        epoch_api_key: apiKey,
      };

      const response = await axios.get(`${baseUrl}/read-user`, {
        headers,
      });
      const rawProfile: string | null = response.data;
      if (rawProfile) {
        return new PublicKey(rawProfile);
      } else {
        return null;
      }
    } catch (e: any) {
      console.error("Failed to create user:", e);
      throw e;
    }
  }

  public static async userBalance(
    baseUrl: string,
    apiKey: string,
  ): Promise<VaultBalance> {
    try {
      let headers = {
        "Content-Type": "application/json",
        epoch_api_key: apiKey,
      };
      const response = await axios.get(`${baseUrl}/user-balance`, {
        headers,
      });
      const vaultBalance: VaultBalance = response.data;
      return vaultBalance;
    } catch (e: any) {
      console.error("Failed to get user balance:", e);
      throw e;
    }
  }
}
