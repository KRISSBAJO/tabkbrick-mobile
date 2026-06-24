import { apiRequest, boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";
import type { Sprint, Task } from "@/lib/types";

export type CreateBoardPayload = OpenApiJsonBody<"/api/v1/agile/projects/{projectId}/boards", "post">;
export type CreateBoardColumnPayload = OpenApiJsonBody<"/api/v1/agile/boards/{boardId}/columns", "post">;
export type CreateSprintPayload = OpenApiJsonBody<"/api/v1/agile/sprints", "post">;
export type CompleteSprintPayload = OpenApiJsonBody<"/api/v1/agile/sprints/{sprintId}/complete", "post">;
export type ListSprintsQuery = OpenApiQuery<"/api/v1/agile/sprints", "get">;
export type ListSprintTasksQuery = OpenApiQuery<"/api/v1/agile/sprints/{sprintId}/tasks", "get">;
export type ReorderBoardColumnsPayload = OpenApiJsonBody<"/api/v1/agile/boards/{boardId}/columns/reorder", "patch">;
export type SprintTaskBulkPayload = OpenApiJsonBody<"/api/v1/agile/sprints/{sprintId}/tasks", "post">;
export type UpdateBoardPayload = OpenApiJsonBody<"/api/v1/agile/boards/{boardId}", "patch">;
export type UpdateBoardColumnPayload = OpenApiJsonBody<"/api/v1/agile/boards/{boardId}/columns/{columnId}", "patch">;
export type UpdateSprintPayload = OpenApiJsonBody<"/api/v1/agile/sprints/{sprintId}", "patch">;
export type UpdateTaskOrderPayload = OpenApiJsonBody<"/api/v1/agile/tasks/{taskId}/order", "patch">;
export type UpdateTaskStatusPayload = OpenApiJsonBody<"/api/v1/agile/tasks/{taskId}/status", "patch">;

export type SprintBurndownPoint = {
  date: string;
  remainingPoints: number;
  remainingTasks: number;
};

export type SprintBurndown = {
  pointsDone: number;
  series: SprintBurndownPoint[];
  sprintId: string;
  totalPoints: number;
  totalTasks: number;
};

export type SprintRetrospective = {
  actionItems?: unknown[] | null;
  authorId: string;
  createdAt: string;
  id: string;
  improve?: string | null;
  sprintId: string;
  updatedAt: string;
  wentWell?: string | null;
};

export type SprintRetrospectivePayload = {
  actionItems?: Array<Record<string, unknown>>;
  improve?: string;
  wentWell?: string;
};

type Paginated<T> = {
  data: T[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

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

export function listSprints(token: string, query: ListSprintsQuery = {}) {
  return openApiRequest("/api/v1/agile/sprints", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 100),
    },
  });
}

export function getSprint(token: string, sprintId: string) {
  return apiRequest<Sprint>(`/agile/sprints/${encodeURIComponent(sprintId)}`, {
    token,
    cache: "no-store",
  });
}

export function listSprintTasks(token: string, sprintId: string, query: ListSprintTasksQuery = {}) {
  return apiRequest<Paginated<Task>>(
    `/agile/sprints/${encodeURIComponent(sprintId)}/tasks${queryString({
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 100),
    })}`,
    {
      token,
      cache: "no-store",
    },
  );
}

export function getSprintBurndown(token: string, sprintId: string) {
  return apiRequest<SprintBurndown>(`/agile/sprints/${encodeURIComponent(sprintId)}/burndown`, {
    token,
    cache: "no-store",
  });
}

export function createSprint(token: string, body: CreateSprintPayload) {
  return openApiRequest("/api/v1/agile/sprints", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function updateSprint(token: string, sprintId: string, body: UpdateSprintPayload) {
  return openApiRequest("/api/v1/agile/sprints/{sprintId}", "patch", {
    token,
    body,
    pathParams: { sprintId },
  });
}

export function startSprint(token: string, sprintId: string) {
  return openApiRequest("/api/v1/agile/sprints/{sprintId}/start", "post", {
    token,
    pathParams: { sprintId },
  });
}

export function completeSprint(token: string, sprintId: string, body: CompleteSprintPayload = { moveIncompleteToBacklog: true }) {
  return openApiRequest("/api/v1/agile/sprints/{sprintId}/complete", "post", {
    token,
    body,
    pathParams: { sprintId },
  });
}

export function deleteSprint(token: string, sprintId: string) {
  return openApiRequest("/api/v1/agile/sprints/{sprintId}", "delete", {
    token,
    pathParams: { sprintId },
  });
}

export function addSprintTasks(token: string, sprintId: string, taskIds: string[]) {
  const body: SprintTaskBulkPayload = { taskIds };
  return openApiRequest("/api/v1/agile/sprints/{sprintId}/tasks", "post", {
    token,
    body,
    pathParams: { sprintId },
  });
}

export function removeSprintTask(token: string, sprintId: string, taskId: string) {
  return openApiRequest("/api/v1/agile/sprints/{sprintId}/tasks/{taskId}", "delete", {
    token,
    pathParams: { sprintId, taskId },
  });
}

export function listSprintRetrospectives(token: string, sprintId: string) {
  return apiRequest<SprintRetrospective[]>(`/agile/sprints/${encodeURIComponent(sprintId)}/retrospectives`, {
    token,
    cache: "no-store",
  });
}

export function createSprintRetrospective(token: string, sprintId: string, body: SprintRetrospectivePayload) {
  return apiRequest<SprintRetrospective>(`/agile/sprints/${encodeURIComponent(sprintId)}/retrospectives`, {
    token,
    body: JSON.stringify(body),
    method: "POST",
  });
}

export function updateSprintRetrospective(token: string, sprintId: string, retrospectiveId: string, body: SprintRetrospectivePayload) {
  return apiRequest<SprintRetrospective>(
    `/agile/sprints/${encodeURIComponent(sprintId)}/retrospectives/${encodeURIComponent(retrospectiveId)}`,
    {
      token,
      body: JSON.stringify(body),
      method: "PATCH",
    },
  );
}

export function deleteSprintRetrospective(token: string, sprintId: string, retrospectiveId: string) {
  return apiRequest<{ success: boolean }>(
    `/agile/sprints/${encodeURIComponent(sprintId)}/retrospectives/${encodeURIComponent(retrospectiveId)}`,
    {
      token,
      method: "DELETE",
    },
  );
}

function queryString(query: Record<string, unknown>) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const text = params.toString();
  return text ? `?${text}` : "";
}
