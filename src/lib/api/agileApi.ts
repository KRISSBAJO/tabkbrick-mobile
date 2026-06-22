import { openApiRequest, type OpenApiJsonBody } from "@/lib/api/request";

export type CreateBoardPayload = OpenApiJsonBody<"/api/v1/agile/projects/{projectId}/boards", "post">;
export type CreateBoardColumnPayload = OpenApiJsonBody<"/api/v1/agile/boards/{boardId}/columns", "post">;
export type ReorderBoardColumnsPayload = OpenApiJsonBody<"/api/v1/agile/boards/{boardId}/columns/reorder", "patch">;
export type UpdateBoardPayload = OpenApiJsonBody<"/api/v1/agile/boards/{boardId}", "patch">;
export type UpdateBoardColumnPayload = OpenApiJsonBody<"/api/v1/agile/boards/{boardId}/columns/{columnId}", "patch">;
export type UpdateTaskOrderPayload = OpenApiJsonBody<"/api/v1/agile/tasks/{taskId}/order", "patch">;
export type UpdateTaskStatusPayload = OpenApiJsonBody<"/api/v1/agile/tasks/{taskId}/status", "patch">;

export function getProjectBoard(token: string, projectId: string) {
  return openApiRequest("/api/v1/agile/projects/{projectId}/board", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function listProjectBoards(token: string, projectId: string) {
  return openApiRequest("/api/v1/agile/projects/{projectId}/boards", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function createBoard(token: string, projectId: string, body: CreateBoardPayload) {
  return openApiRequest("/api/v1/agile/projects/{projectId}/boards", "post", {
    token,
    body,
    pathParams: { projectId },
  });
}

export function updateBoard(token: string, boardId: string, body: UpdateBoardPayload) {
  return openApiRequest("/api/v1/agile/boards/{boardId}", "patch", {
    token,
    body,
    pathParams: { boardId },
  });
}

export function deleteBoard(token: string, boardId: string) {
  return openApiRequest("/api/v1/agile/boards/{boardId}", "delete", {
    token,
    pathParams: { boardId },
  });
}

export function createBoardColumn(token: string, boardId: string, body: CreateBoardColumnPayload) {
  return openApiRequest("/api/v1/agile/boards/{boardId}/columns", "post", {
    token,
    body,
    pathParams: { boardId },
  });
}

export function reorderBoardColumns(token: string, boardId: string, body: ReorderBoardColumnsPayload) {
  return openApiRequest("/api/v1/agile/boards/{boardId}/columns/reorder", "patch", {
    token,
    body,
    pathParams: { boardId },
  });
}

export function updateBoardColumn(token: string, boardId: string, columnId: string, body: UpdateBoardColumnPayload) {
  return openApiRequest("/api/v1/agile/boards/{boardId}/columns/{columnId}", "patch", {
    token,
    body,
    pathParams: { boardId, columnId },
  });
}

export function deleteBoardColumn(token: string, boardId: string, columnId: string) {
  return openApiRequest("/api/v1/agile/boards/{boardId}/columns/{columnId}", "delete", {
    token,
    pathParams: { boardId, columnId },
  });
}

export function updateTaskStatus(token: string, taskId: string, body: UpdateTaskStatusPayload) {
  return openApiRequest("/api/v1/agile/tasks/{taskId}/status", "patch", {
    token,
    body,
    pathParams: { taskId },
  });
}

export function updateTaskOrder(token: string, taskId: string, body: UpdateTaskOrderPayload) {
  return openApiRequest("/api/v1/agile/tasks/{taskId}/order", "patch", {
    token,
    body,
    pathParams: { taskId },
  });
}
