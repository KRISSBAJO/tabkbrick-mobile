import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListTasksQuery = OpenApiQuery<"/api/v1/tasks", "get">;
export type CreateTaskPayload = OpenApiJsonBody<"/api/v1/tasks", "post">;

export function listTasks(token: string, query: ListTasksQuery = {}) {
  return openApiRequest("/api/v1/tasks", "get", {
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

export function getTask(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function createTask(token: string, body: CreateTaskPayload) {
  return openApiRequest("/api/v1/tasks", "post", {
    token,
    body,
    pathParams: {},
  });
}
