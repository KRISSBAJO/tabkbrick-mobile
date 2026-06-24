import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListTasksQuery = OpenApiQuery<"/api/v1/tasks", "get">;
export type CreateTaskPayload = OpenApiJsonBody<"/api/v1/tasks", "post">;
export type CreateTaskCommentPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}/comments", "post">;
export type UpdateTaskPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}", "patch">;

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

export function updateTask(token: string, taskId: string, body: UpdateTaskPayload) {
  return openApiRequest("/api/v1/tasks/{taskId}", "patch", {
    token,
    body,
    pathParams: { taskId },
  });
}

export function deleteTask(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}", "delete", {
    token,
    pathParams: { taskId },
  });
}

export function listTaskAssignees(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/assignees", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function listTaskWatchers(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/watchers", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function listTaskComments(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/comments", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function createTaskComment(token: string, taskId: string, body: CreateTaskCommentPayload) {
  return openApiRequest("/api/v1/tasks/{taskId}/comments", "post", {
    token,
    body,
    pathParams: { taskId },
  });
}

export function listTaskAttachments(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/attachments", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function listTaskChecklists(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/checklists", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function listTaskLabels(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/labels", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function listTaskDependencies(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/dependencies", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function listTaskActivities(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/activities", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}
