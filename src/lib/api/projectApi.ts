import { boundedLimit, openApiRequest, type OpenApiQuery } from "@/lib/api/request";

type ListProjectsQuery = OpenApiQuery<"/api/v1/projects", "get">;

export function listProjects(token: string, query: ListProjectsQuery = {}) {
  return openApiRequest("/api/v1/projects", "get", {
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

export function getProject(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}
