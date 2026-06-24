import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListIntegrationsQuery = OpenApiQuery<"/api/v1/integrations", "get">;
type ListIntegrationLogsQuery = OpenApiQuery<"/api/v1/integrations/{integrationId}/logs", "get">;

export type CreateIntegrationPayload = OpenApiJsonBody<"/api/v1/integrations", "post">;
export type RotateIntegrationSecretPayload = OpenApiJsonBody<"/api/v1/integrations/{integrationId}/rotate-secret", "post">;
export type SyncIntegrationPayload = OpenApiJsonBody<"/api/v1/integrations/{integrationId}/sync", "post">;
export type UpdateIntegrationPayload = OpenApiJsonBody<"/api/v1/integrations/{integrationId}", "patch">;

export function getIntegrationsStatus(token: string) {
  return openApiRequest("/api/v1/integrations/status", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function listIntegrations(token: string, query: ListIntegrationsQuery = {}) {
  return openApiRequest("/api/v1/integrations", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 50),
    },
  });
}

export function createIntegration(token: string, body: CreateIntegrationPayload) {
  return openApiRequest("/api/v1/integrations", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function updateIntegration(token: string, integrationId: string, body: UpdateIntegrationPayload) {
  return openApiRequest("/api/v1/integrations/{integrationId}", "patch", {
    token,
    body,
    pathParams: { integrationId },
  });
}

export function deleteIntegration(token: string, integrationId: string) {
  return openApiRequest("/api/v1/integrations/{integrationId}", "delete", {
    token,
    pathParams: { integrationId },
  });
}

export function enableIntegration(token: string, integrationId: string) {
  return openApiRequest("/api/v1/integrations/{integrationId}/enable", "post", {
    token,
    pathParams: { integrationId },
  });
}

export function disableIntegration(token: string, integrationId: string) {
  return openApiRequest("/api/v1/integrations/{integrationId}/disable", "post", {
    token,
    pathParams: { integrationId },
  });
}

export function rotateIntegrationSecret(token: string, integrationId: string, body: RotateIntegrationSecretPayload) {
  return openApiRequest("/api/v1/integrations/{integrationId}/rotate-secret", "post", {
    token,
    body,
    pathParams: { integrationId },
  });
}

export function syncIntegration(token: string, integrationId: string, body: SyncIntegrationPayload = { mode: "manual" }) {
  return openApiRequest("/api/v1/integrations/{integrationId}/sync", "post", {
    token,
    body,
    pathParams: { integrationId },
  });
}

export function listIntegrationLogs(token: string, integrationId: string, query: ListIntegrationLogsQuery = {}) {
  return openApiRequest("/api/v1/integrations/{integrationId}/logs", "get", {
    token,
    cache: "no-store",
    pathParams: { integrationId },
    query: {
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 30),
    },
  });
}
