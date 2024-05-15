import axios from "axios";
import {
  EpochAccount,
  JsonEpochAccount,
  QueryAccountId,
  QueryAccounts,
  QueryDecodedAccounts,
} from "../";

export class Accounts {
  constructor() {}

  public static async accountId(
    baseUrl: string,
    apiKey: string,
    body: QueryAccountId,
  ): Promise<EpochAccount> {
    try {
      let headers = {
        "Content-Type": "application/json",
        epoch_api_key: apiKey,
      };

      const response = await axios.post(`${baseUrl}/account-id`, body, {
        headers,
      });
      const epochAccount: EpochAccount = response.data;
      return epochAccount;
    } catch (e: any) {
      console.error("Failed to query account by id:", e);
      throw e;
    }
  }

  public static async accounts(
    baseUrl: string,
    apiKey: string,
    body: QueryAccounts,
  ): Promise<EpochAccount[]> {
    try {
      let headers = {
        "Content-Type": "application/json",
        epoch_api_key: apiKey,
      };

      const response = await axios.post(`${baseUrl}/accounts`, body, {
        headers,
      });
      const epochAccounts: EpochAccount[] = response.data;
      return epochAccounts;
    } catch (e: any) {
      console.error("Failed to query raw accounts:", e);
      throw e;
    }
  }

  public static async decodedAccounts(
    baseUrl: string,
    apiKey: string,
    body: QueryDecodedAccounts,
  ): Promise<JsonEpochAccount[]> {
    try {
      let headers = {
        "Content-Type": "application/json",
        epoch_api_key: apiKey,
      };

      const response = await axios.post(`${baseUrl}/decoded-accounts`, body, {
        headers,
      });
      const jsonEpochAccounts: JsonEpochAccount[] = response.data;
      return jsonEpochAccounts;
    } catch (e: any) {
      console.error("Failed to query decoded accounts:", e);
      throw e;
    }
  }
}
