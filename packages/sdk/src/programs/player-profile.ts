import { AnchorProvider } from "@staratlas/anchor";
import {
  KeyEntry,
  PlayerProfile,
  PlayerProfileIDLProgram,
  PlayerProfileProgram,
  ProfilePermissions,
} from "@cosmic-lab/player-profile";
import {
  AsyncSigner,
  InstructionReturn,
  readAllFromRPC,
} from "@cosmic-lab/data-source";
import { Connection, PublicKey } from "@solana/web3.js";
import { sendTransactionWithSnack, SnackInfo } from "../";
import { PLAYER_PROFILE_PROGRAM_ID } from "../constants";
import { VaultPermissions } from "@cosmic-lab/profile-vault";
import { CreateProfileConfig } from "@cosmic-lab/epoch-sdk";

export function playerProfileProgram(): PlayerProfileIDLProgram {
  const playerProfileProgram: PlayerProfileIDLProgram =
    PlayerProfileProgram.buildProgram(
      PLAYER_PROFILE_PROGRAM_ID,
      {} as AnchorProvider,
    );

  return playerProfileProgram;
}

export async function createProfileIxs(
  program: PlayerProfileIDLProgram,
  profileId: AsyncSigner,
  funder: AsyncSigner,
  keys: KeyEntry<unknown>[],
  connection: Connection,
  profileAuth?: AsyncSigner,
  walletSigner?: AsyncSigner,
  keyThreshold = 1,
): Promise<InstructionReturn[]> {
  if (profileAuth) {
    const key = {
      key: profileAuth,
      expireTime: null,
      permissions: ProfilePermissions.all(),
      scope: program.programId,
    } as unknown as KeyEntry<ProfilePermissions>;
    keys.unshift(key);
  }
  const existingProfile = await connection.getAccountInfo(
    profileId.publicKey(),
  );
  if (existingProfile) {
    throw new Error(
      `Profile already exists: ${profileId.publicKey().toString()}`,
    );
  }

  const createIx = PlayerProfile.createProfile(
    program,
    profileId,
    keys,
    keyThreshold,
  );
  return [createIx];
}

export async function createProfile(
  program: PlayerProfileIDLProgram,
  profileId: AsyncSigner,
  funder: AsyncSigner,
  keys: KeyEntry<unknown>[],
  connection: Connection,
  profileAuth?: AsyncSigner,
  walletSigner?: AsyncSigner,
  keyThreshold = 1,
): Promise<SnackInfo> {
  const ixs = await createProfileIxs(
    program,
    profileId,
    funder,
    keys,
    connection,
    profileAuth,
    walletSigner,
    keyThreshold,
  );
  return await sendTransactionWithSnack(ixs, funder, connection);
}

/*
 * Fetches all profiles for a given key
 * @param connection - Connection object
 * @param auth - Public key of the user/auth of the profile (0th index profile key)
 * @param searchKey - Optional signing key to search for in auth's profiles
 */
export async function profilesForKey(
  connection: Connection,
  auth: PublicKey,
  searchKey?: PublicKey,
): Promise<PlayerProfile[]> {
  const response = await readAllFromRPC(
    connection,
    playerProfileProgram(),
    PlayerProfile,
    "confirmed",
  );
  const profiles: PlayerProfile[] | any = response.map(
    (e) => e.type === "ok" && e.data,
  );
  const validProfiles: PlayerProfile[] = profiles.filter(
    (p: any) => p instanceof PlayerProfile,
  );
  // filter if PlayerProfile owned by key
  const authProfiles = validProfiles.filter((p: PlayerProfile) =>
    p.profileKeys[0].key.equals(auth),
  );

  if (!searchKey) {
    return authProfiles;
  } else {
    return authProfiles.filter((p: PlayerProfile) =>
      p.profileKeys.some((key) => key.key.equals(searchKey)),
    );
  }
}

export async function createEpochProfile(
  cfg: CreateProfileConfig,
): Promise<InstructionReturn[]> {
  const {
    connection,
    playerProfileProgram,
    profileVaultProgram,
    profileId,
    profileAuth,
    protocolKey,
  } = cfg;
  try {
    const keys = [
      {
        key: profileAuth,
        expireTime: null,
        scope: profileVaultProgram.programId,
        permissions: VaultPermissions.all(),
      },
      {
        key: protocolKey,
        expireTime: null,
        scope: profileVaultProgram.programId,
        permissions: VaultPermissions.drainVaultPermissions(),
      },
    ];

    return await createProfileIxs(
      playerProfileProgram,
      profileId,
      profileAuth,
      keys,
      connection,
      profileAuth,
    );
  } catch (e: any) {
    console.error(e);
    throw e;
  }
}
