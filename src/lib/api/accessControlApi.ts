import { openApiRequest } from "@/lib/api/request";

export function listPermissions(token: string) {
  return openApiRequest("/api/v1/permissions", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function listRoles(token: string) {
  return openApiRequest("/api/v1/roles", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}
