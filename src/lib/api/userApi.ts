import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListUsersQuery = OpenApiQuery<"/api/v1/users", "get">;
export type InviteTenantUserPayload = OpenApiJsonBody<"/api/v1/users/invite", "post">;
export type BulkInviteTenantUsersPayload = OpenApiJsonBody<"/api/v1/users/bulk-invite", "post">;

export function listUsers(token: string, query: ListUsersQuery = {}) {
  return openApiRequest("/api/v1/users", "get", {
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

export function inviteTenantUser(token: string, body: InviteTenantUserPayload) {
  return openApiRequest("/api/v1/users/invite", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function bulkInviteTenantUsers(token: string, body: BulkInviteTenantUsersPayload) {
  return openApiRequest("/api/v1/users/bulk-invite", "post", {
    token,
    body,
    pathParams: {},
  });
}
