import axios from "axios";
import { QueryRegisteredTypes, RegisteredType } from "../";

export class RegisteredTypes {
  constructor() {}

  public static async registeredTypes(
    baseUrl: string,
    apiKey: string,
  ): Promise<RegisteredType[]> {
    try {
      let headers = {
        "Content-Type": "application/json",
        epoch_api_key: apiKey,
      };

      const response = await axios.get(`${baseUrl}/registered-types`, {
        headers,
      });
      const types: RegisteredType[] = response.data;
      return types;
    } catch (e: any) {
      console.error("Failed to query all registered types:", e);
      throw e;
    }
  }

  public static async filteredRegisteredTypes(
    baseUrl: string,
    apiKey: string,
    body: QueryRegisteredTypes,
  ): Promise<RegisteredType[]> {
    try {
      let headers = {
        "Content-Type": "application/json",
        epoch_api_key: apiKey,
      };

      const response = await axios.post(`${baseUrl}/registered-types`, body, {
        headers,
      });
      const types: RegisteredType[] = response.data;
      return types;
    } catch (e: any) {
      console.error("Failed to query filtered registered types:", e);
      throw e;
    }
  }
}
