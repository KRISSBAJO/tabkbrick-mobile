import * as SecureStore from "expo-secure-store";
import type { AuthResponse, AuthUser } from "@/lib/types";

const REFRESH_TOKEN_KEY = "taskbricks.mobile.refreshToken";
const TRUSTED_DEVICE_TOKEN_KEY = "taskbricks.mobile.trustedDeviceToken";
const USER_KEY = "taskbricks.mobile.user";

export type PersistedMobileSession = {
  refreshToken: string | null;
  trustedDeviceToken: string | null;
  user: AuthUser | null;
};

export async function readPersistedSession(): Promise<PersistedMobileSession> {
  const [refreshToken, trustedDeviceToken, userText] = await Promise.all([
    readPersistedValue(REFRESH_TOKEN_KEY),
    readPersistedValue(TRUSTED_DEVICE_TOKEN_KEY),
    readPersistedValue(USER_KEY),
  ]);

  return {
    refreshToken,
    trustedDeviceToken,
    user: parseUser(userText),
  };
}

export async function persistAuthResponse(auth: AuthResponse) {
  if (!auth.refreshToken) {
    throw new Error("Mobile auth response did not include a refresh token.");
  }

  const writes = [
    writePersistedValue(REFRESH_TOKEN_KEY, auth.refreshToken),
    writePersistedValue(USER_KEY, JSON.stringify(auth.user)),
  ];

  if (auth.trustedDeviceToken) {
    writes.push(writePersistedValue(TRUSTED_DEVICE_TOKEN_KEY, auth.trustedDeviceToken));
  }

  await Promise.all(writes);
}

export async function clearPersistedSession() {
  await Promise.all([
    deletePersistedValue(REFRESH_TOKEN_KEY),
    deletePersistedValue(TRUSTED_DEVICE_TOKEN_KEY),
    deletePersistedValue(USER_KEY),
  ]);
}

async function readPersistedValue(key: string) {
  try {
    const value = await SecureStore.getItemAsync(key);
    return value || null;
  } catch {
    return null;
  }
}

async function writePersistedValue(key: string, value: string) {
  await SecureStore.setItemAsync(key, value);
}

async function deletePersistedValue(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    try {
      await SecureStore.setItemAsync(key, "");
    } catch {
      // SecureStore can be partially unavailable in Expo Go/native version mismatches.
      // Session cleanup should never block the app from booting.
    }
  }
}

function parseUser(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}
