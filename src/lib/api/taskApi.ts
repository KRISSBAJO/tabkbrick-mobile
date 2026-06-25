import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListTasksQuery = OpenApiQuery<"/api/v1/tasks", "get">;
export type CreateTaskPayload = OpenApiJsonBody<"/api/v1/tasks", "post">;
export type CreateLabelPayload = OpenApiJsonBody<"/api/v1/tasks/labels", "post">;
export type UpdateLabelPayload = OpenApiJsonBody<"/api/v1/tasks/labels/{labelId}", "patch">;
export type TaskUserPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}/assignees", "post">;
export type CreateTaskCommentPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}/comments", "post">;
export type CreateTaskAttachmentPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}/attachments", "post">;
export type CreateTaskChecklistPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}/checklists", "post">;
export type UpdateTaskChecklistPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}/checklists/{checklistId}", "patch">;
export type CreateTaskChecklistItemPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}/checklists/{checklistId}/items", "post">;
export type UpdateTaskChecklistItemPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}/checklists/{checklistId}/items/{itemId}", "patch">;
export type AssignTaskLabelPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}/labels", "post">;
export type CreateTaskDependencyPayload = OpenApiJsonBody<"/api/v1/tasks/{taskId}/dependencies", "post">;
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

export function archiveTask(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/archive", "post", {
    token,
    pathParams: { taskId },
  });
}

export function restoreTask(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/restore", "post", {
    token,
    pathParams: { taskId },
  });
}

export function listLabels(token: string) {
  return openApiRequest("/api/v1/tasks/labels", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function createLabel(token: string, body: CreateLabelPayload) {
  return openApiRequest("/api/v1/tasks/labels", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function updateLabel(token: string, labelId: string, body: UpdateLabelPayload) {
  return openApiRequest("/api/v1/tasks/labels/{labelId}", "patch", {
    token,
    body,
    pathParams: { labelId },
  });
}

export function deleteLabel(token: string, labelId: string) {
  return openApiRequest("/api/v1/tasks/labels/{labelId}", "delete", {
    token,
    pathParams: { labelId },
  });
}

export function listTaskAssignees(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/assignees", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function addTaskAssignee(token: string, taskId: string, userId: string) {
  const body: TaskUserPayload = { userId };
  return openApiRequest("/api/v1/tasks/{taskId}/assignees", "post", {
    token,
    body,
    pathParams: { taskId },
  });
}

export function removeTaskAssignee(token: string, taskId: string, userId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/assignees/{userId}", "delete", {
    token,
    pathParams: { taskId, userId },
  });
}

export function listTaskWatchers(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/watchers", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function addTaskWatcher(token: string, taskId: string, userId: string) {
  const body: TaskUserPayload = { userId };
  return openApiRequest("/api/v1/tasks/{taskId}/watchers", "post", {
    token,
    body,
    pathParams: { taskId },
  });
}

export function removeTaskWatcher(token: string, taskId: string, userId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/watchers/{userId}", "delete", {
    token,
    pathParams: { taskId, userId },
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

export function deleteTaskComment(token: string, taskId: string, commentId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/comments/{commentId}", "delete", {
    token,
    pathParams: { taskId, commentId },
  });
}

export function listTaskAttachments(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/attachments", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function createTaskAttachment(token: string, taskId: string, body: CreateTaskAttachmentPayload) {
  return openApiRequest("/api/v1/tasks/{taskId}/attachments", "post", {
    token,
    body,
    pathParams: { taskId },
  });
}

export function deleteTaskAttachment(token: string, taskId: string, attachmentId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/attachments/{attachmentId}", "delete", {
    token,
    pathParams: { taskId, attachmentId },
  });
}

export function listTaskChecklists(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/checklists", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function createTaskChecklist(token: string, taskId: string, body: CreateTaskChecklistPayload) {
  return openApiRequest("/api/v1/tasks/{taskId}/checklists", "post", {
    token,
    body,
    pathParams: { taskId },
  });
}

export function updateTaskChecklist(token: string, taskId: string, checklistId: string, body: UpdateTaskChecklistPayload) {
  return openApiRequest("/api/v1/tasks/{taskId}/checklists/{checklistId}", "patch", {
    token,
    body,
    pathParams: { taskId, checklistId },
  });
}

export function deleteTaskChecklist(token: string, taskId: string, checklistId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/checklists/{checklistId}", "delete", {
    token,
    pathParams: { taskId, checklistId },
  });
}

export function createTaskChecklistItem(
  token: string,
  taskId: string,
  checklistId: string,
  body: CreateTaskChecklistItemPayload,
) {
  return openApiRequest("/api/v1/tasks/{taskId}/checklists/{checklistId}/items", "post", {
    token,
    body,
    pathParams: { taskId, checklistId },
  });
}

export function updateTaskChecklistItem(
  token: string,
  taskId: string,
  checklistId: string,
  itemId: string,
  body: UpdateTaskChecklistItemPayload,
) {
  return openApiRequest("/api/v1/tasks/{taskId}/checklists/{checklistId}/items/{itemId}", "patch", {
    token,
    body,
    pathParams: { taskId, checklistId, itemId },
  });
}

export function deleteTaskChecklistItem(token: string, taskId: string, checklistId: string, itemId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/checklists/{checklistId}/items/{itemId}", "delete", {
    token,
    pathParams: { taskId, checklistId, itemId },
  });
}

export function listTaskLabels(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/labels", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function assignTaskLabel(token: string, taskId: string, labelId: string) {
  const body: AssignTaskLabelPayload = { labelId };
  return openApiRequest("/api/v1/tasks/{taskId}/labels", "post", {
    token,
    body,
    pathParams: { taskId },
  });
}

export function removeTaskLabel(token: string, taskId: string, labelId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/labels/{labelId}", "delete", {
    token,
    pathParams: { taskId, labelId },
  });
}

export function listTaskDependencies(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/dependencies", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}

export function createTaskDependency(token: string, taskId: string, body: CreateTaskDependencyPayload) {
  return openApiRequest("/api/v1/tasks/{taskId}/dependencies", "post", {
    token,
    body,
    pathParams: { taskId },
  });
}

export function deleteTaskDependency(token: string, taskId: string, dependencyId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/dependencies/{dependencyId}", "delete", {
    token,
    pathParams: { taskId, dependencyId },
  });
}

export function listTaskActivities(token: string, taskId: string) {
  return openApiRequest("/api/v1/tasks/{taskId}/activities", "get", {
    token,
    cache: "no-store",
    pathParams: { taskId },
  });
}
