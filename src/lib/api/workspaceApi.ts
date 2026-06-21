import { boundedLimit, openApiRequest, type OpenApiQuery } from "@/lib/api/request";

type ListWorkspacesQuery = OpenApiQuery<"/api/v1/workspaces", "get">;
type ListTeamsQuery = OpenApiQuery<"/api/v1/teams", "get">;

export function listWorkspaces(token: string, query: ListWorkspacesQuery = {}) {
  return openApiRequest("/api/v1/workspaces", "get", {
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

export function listTeams(token: string, query: ListTeamsQuery = {}) {
  return openApiRequest("/api/v1/teams", "get", {
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
