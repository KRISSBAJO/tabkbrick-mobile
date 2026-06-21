import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMe, login, logoutSession, refreshSession, register, verifyMfaLogin, type LoginPayload, type RegisterPayload } from "@/lib/api";
import { clearPersistedSession, persistAuthResponse, readPersistedSession } from "@/lib/auth/secureSession";
import type { AuthResponse, AuthUser, MfaChallengeResponse } from "@/lib/types";

type SignInResult =
  | { status: "authenticated" }
  | { status: "mfa"; challenge: MfaChallengeResponse };

type SignUpResult =
  | { status: "authenticated" }
  | { devLink?: string; message: string; status: "verification" };

type AuthSessionContextValue = {
  accessToken: string | null;
  cancelMfa: () => void;
  initializing: boolean;
  mfaChallenge: MfaChallengeResponse | null;
  refresh: () => Promise<void>;
  signIn: (payload: Omit<LoginPayload, "trustedDeviceToken">) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<SignUpResult>;
  user: AuthUser | null;
  verifyMfa: (code: string, rememberDevice: boolean) => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeResponse | null>(null);
  const [initializing, setInitializing] = useState(true);

  const applyAuthResponse = useCallback(async (auth: AuthResponse) => {
    await persistAuthResponse(auth);
    setAccessToken(auth.accessToken);
    setUser(auth.user);
    setMfaChallenge(null);
  }, []);

  const refresh = useCallback(async () => {
    const persisted = await readPersistedSession();
    if (!persisted.refreshToken) {
      setAccessToken(null);
      setUser(null);
      return;
    }

    const refreshed = await refreshSession(persisted.refreshToken);
    await applyAuthResponse(refreshed);
  }, [applyAuthResponse]);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      try {
        const persisted = await readPersistedSession();
        if (persisted.user && alive) {
          setUser(persisted.user);
        }
        if (persisted.refreshToken) {
          const refreshed = await refreshSession(persisted.refreshToken);
          if (alive) {
            await applyAuthResponse(refreshed);
          }
        }
      } catch {
        await clearPersistedSession();
        if (alive) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (alive) setInitializing(false);
      }
    }

    void bootstrap();

    return () => {
      alive = false;
    };
  }, [applyAuthResponse]);

  const signIn = useCallback(async (payload: Omit<LoginPayload, "trustedDeviceToken">): Promise<SignInResult> => {
    const persisted = await readPersistedSession();
    const result = await login({
      ...payload,
      trustedDeviceToken: persisted.trustedDeviceToken ?? undefined,
    });

    if (isMfaChallenge(result)) {
      setMfaChallenge(result);
      return { status: "mfa", challenge: result };
    }

    await applyAuthResponse(result);
    return { status: "authenticated" };
  }, [applyAuthResponse]);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const result = await register(payload);
    if (!("accessToken" in result)) {
      return {
        devLink: result.devLink,
        message: result.message,
        status: "verification" as const,
      };
    }

    await applyAuthResponse(result);
    return { status: "authenticated" as const };
  }, [applyAuthResponse]);

  const cancelMfa = useCallback(() => {
    setMfaChallenge(null);
  }, []);

  const verifyMfa = useCallback(async (code: string, rememberDevice: boolean) => {
    if (!mfaChallenge) {
      throw new Error("No MFA challenge is active.");
    }

    const result = await verifyMfaLogin({
      code,
      deviceName: "TaskBricks Mobile",
      mfaToken: mfaChallenge.mfaToken,
      rememberDevice,
    });
    await applyAuthResponse(result);
  }, [applyAuthResponse, mfaChallenge]);

  const signOut = useCallback(async () => {
    const persisted = await readPersistedSession();
    try {
      await logoutSession(persisted.refreshToken ?? undefined, accessToken ?? undefined);
    } finally {
      await clearPersistedSession();
      setAccessToken(null);
      setUser(null);
      setMfaChallenge(null);
    }
  }, [accessToken]);

  useEffect(() => {
    let alive = true;
    if (!accessToken) return undefined;
    const token = accessToken;

    async function validate() {
      try {
        const nextUser = await getMe(token);
        if (alive) setUser(nextUser);
      } catch {
        try {
          await refresh();
        } catch {
          await clearPersistedSession();
          if (alive) {
            setAccessToken(null);
            setUser(null);
          }
        }
      }
    }

    void validate();

    return () => {
      alive = false;
    };
  }, [accessToken, refresh]);

  const value = useMemo<AuthSessionContextValue>(() => ({
    accessToken,
    cancelMfa,
    initializing,
    mfaChallenge,
    refresh,
    signIn,
    signOut,
    signUp,
    user,
    verifyMfa,
  }), [accessToken, cancelMfa, initializing, mfaChallenge, refresh, signIn, signOut, signUp, user, verifyMfa]);

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used inside AuthSessionProvider.");
  }

  return context;
}

function isMfaChallenge(value: AuthResponse | MfaChallengeResponse): value is MfaChallengeResponse {
  return "requiresMfa" in value && value.requiresMfa === true;
}
