import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListApiKeysQuery = OpenApiQuery<"/api/v1/admin/api-keys", "get">;

export type CreateApiKeyPayload = OpenApiJsonBody<"/api/v1/admin/api-keys", "post">;

export function listApiKeys(token: string, query: ListApiKeysQuery = {}) {
  return openApiRequest("/api/v1/admin/api-keys", "get", {
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

export function createApiKey(token: string, body: CreateApiKeyPayload) {
  return openApiRequest("/api/v1/admin/api-keys", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function revokeApiKey(token: string, apiKeyId: string) {
  return openApiRequest("/api/v1/admin/api-keys/{apiKeyId}/revoke", "post", {
    token,
    pathParams: { apiKeyId },
  });
}
