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
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(TRUSTED_DEVICE_TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
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
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, auth.refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(auth.user)),
  ];

  if (auth.trustedDeviceToken) {
    writes.push(SecureStore.setItemAsync(TRUSTED_DEVICE_TOKEN_KEY, auth.trustedDeviceToken));
  }

  await Promise.all(writes);
}

export async function clearPersistedSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(TRUSTED_DEVICE_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

function parseUser(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}
