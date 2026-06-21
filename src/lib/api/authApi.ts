import { openApiRequest, type OpenApiJsonBody } from "@/lib/api/request";

export type LoginPayload = OpenApiJsonBody<"/api/v1/auth/login", "post">;
export type VerifyMfaPayload = OpenApiJsonBody<"/api/v1/auth/mfa/verify-login", "post">;
export type RegisterPayload = OpenApiJsonBody<"/api/v1/auth/register", "post">;
export type ForgotPasswordPayload = OpenApiJsonBody<"/api/v1/auth/forgot-password", "post">;
export type ResendVerificationPayload = OpenApiJsonBody<"/api/v1/auth/resend-verification", "post">;
export type RefreshPayload = OpenApiJsonBody<"/api/v1/auth/refresh", "post">;
export type LogoutPayload = OpenApiJsonBody<"/api/v1/auth/logout", "post">;

export function login(payload: LoginPayload) {
  return openApiRequest("/api/v1/auth/login", "post", {
    pathParams: {},
    body: payload,
  });
}

export function verifyMfaLogin(payload: VerifyMfaPayload) {
  return openApiRequest("/api/v1/auth/mfa/verify-login", "post", {
    pathParams: {},
    body: payload,
  });
}

export function register(payload: RegisterPayload) {
  return openApiRequest("/api/v1/auth/register", "post", {
    pathParams: {},
    body: payload,
  });
}

export function discoverSso(query: { email?: string; tenantSlug?: string }) {
  return openApiRequest("/api/v1/auth/sso/discovery", "get", {
    pathParams: {},
    query,
  });
}

export function startSso(query: { providerId: string; redirectUri?: string; tenantSlug: string }) {
  return openApiRequest("/api/v1/auth/sso/start", "get", {
    pathParams: {},
    query,
  });
}

export function forgotPassword(payload: ForgotPasswordPayload) {
  return openApiRequest("/api/v1/auth/forgot-password", "post", {
    pathParams: {},
    body: payload,
  });
}

export function resendVerification(payload: ResendVerificationPayload) {
  return openApiRequest("/api/v1/auth/resend-verification", "post", {
    pathParams: {},
    body: payload,
  });
}

export function refreshSession(refreshToken: string) {
  const body: RefreshPayload = { refreshToken };
  return openApiRequest("/api/v1/auth/refresh", "post", {
    pathParams: {},
    body,
  });
}

export function logoutSession(refreshToken?: string, token?: string) {
  const body: LogoutPayload = refreshToken ? { refreshToken } : {};
  return openApiRequest("/api/v1/auth/logout", "post", {
    token,
    pathParams: {},
    body,
  });
}

export function getMe(token: string) {
  return openApiRequest("/api/v1/auth/me", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}
