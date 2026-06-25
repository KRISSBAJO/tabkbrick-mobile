import {
  openApiRequest,
  type OpenApiJsonBody,
  type OpenApiQuery,
} from "@/lib/api/request";

export type SetupTotpPayload = OpenApiJsonBody<"/api/v1/identity-security/mfa/totp/setup", "post">;
export type EnableTotpPayload = OpenApiJsonBody<"/api/v1/identity-security/mfa/totp/enable", "post">;
export type DisableMfaPayload = OpenApiJsonBody<"/api/v1/identity-security/mfa/disable", "post">;
export type RegenerateBackupCodesPayload = OpenApiJsonBody<"/api/v1/identity-security/mfa/backup-codes/regenerate", "post">;
export type ListAdminSessionsQuery = OpenApiQuery<"/api/v1/admin/sessions", "get">;

export function getIdentitySecurityOverview(token: string) {
  return openApiRequest("/api/v1/identity-security/overview", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function setupTotp(token: string, payload: SetupTotpPayload = {}) {
  return openApiRequest("/api/v1/identity-security/mfa/totp/setup", "post", {
    token,
    pathParams: {},
    body: payload,
  });
}

export function enableTotp(token: string, payload: EnableTotpPayload) {
  return openApiRequest("/api/v1/identity-security/mfa/totp/enable", "post", {
    token,
    pathParams: {},
    body: payload,
  });
}

export function disableMfa(token: string, payload: DisableMfaPayload) {
  return openApiRequest("/api/v1/identity-security/mfa/disable", "post", {
    token,
    pathParams: {},
    body: payload,
  });
}

export function regenerateBackupCodes(token: string, payload: RegenerateBackupCodesPayload) {
  return openApiRequest("/api/v1/identity-security/mfa/backup-codes/regenerate", "post", {
    token,
    pathParams: {},
    body: payload,
  });
}

export function revokeTrustedDevice(token: string, deviceId: string) {
  return openApiRequest("/api/v1/identity-security/trusted-devices/{deviceId}", "delete", {
    token,
    pathParams: { deviceId },
  });
}

export function listAdminSessions(token: string, query: ListAdminSessionsQuery = {}) {
  return openApiRequest("/api/v1/admin/sessions", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query,
  });
}

export function revokeAdminSession(token: string, sessionId: string) {
  return openApiRequest("/api/v1/admin/sessions/{sessionId}/revoke", "post", {
    token,
    pathParams: { sessionId },
  });
}
