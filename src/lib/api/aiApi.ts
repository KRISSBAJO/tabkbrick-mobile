import { apiRequest, boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery, type OpenApiResponse } from "@/lib/api/request";
import type { components } from "@/lib/generated/openapi";

type AiAgentQuery = OpenApiQuery<"/api/v1/ai/agents", "get">;
type AiConversationQuery = OpenApiQuery<"/api/v1/ai/conversations", "get">;
type AiActionQuery = OpenApiQuery<"/api/v1/ai/actions", "get">;
type AiUsageQuery = OpenApiQuery<"/api/v1/ai/usage", "get">;
type BoardAiHistoryQuery = OpenApiQuery<"/api/v1/ai/board-history", "get">;

export type AiAgent = components["schemas"]["AiAgent"];
export type AiSettings = components["schemas"]["AiSettings"];
export type AiStatus = {
  configured?: Record<string, boolean>;
  defaultProvider?: string;
  enabled?: boolean;
  enabledByEnvironment?: boolean;
  healthy?: boolean;
  message?: string;
  module?: string;
  providerConfigured?: boolean;
  providers?: string[];
  ready?: boolean;
  status?: string;
} & Record<string, unknown>;

export type AiChatPayload = OpenApiJsonBody<"/api/v1/ai/chat", "post">;
export type ProjectAiPayload = OpenApiJsonBody<"/api/v1/ai/project-summary", "post">;
export type BoardAiPayload = OpenApiJsonBody<"/api/v1/ai/board-summary", "post">;
export type BoardAiSummaryResponse = NonNullable<OpenApiResponse<"/api/v1/ai/board-summary", "post">>;
export type BoardAiRiskScanResponse = NonNullable<OpenApiResponse<"/api/v1/ai/board-risk-scan", "post">>;
export type BoardAiActionPlanResponse = NonNullable<OpenApiResponse<"/api/v1/ai/board-actions", "post">>;
export type BoardAiApplyActionsPayload = OpenApiJsonBody<"/api/v1/ai/board-actions/apply", "post">;
export type BoardAiApplyResponse = NonNullable<OpenApiResponse<"/api/v1/ai/board-actions/apply", "post">>;
export type BoardAiHistoryResponse = NonNullable<OpenApiResponse<"/api/v1/ai/board-history", "get">>;
export type BoardAiHistoryEntry = BoardAiHistoryResponse["data"][number];
export type KnowledgeSearchPayload = OpenApiJsonBody<"/api/v1/ai/knowledge-search", "post">;
export type UpdateAiSettingsPayload = OpenApiJsonBody<"/api/v1/ai/settings", "patch">;
export type CreateAiConversationPayload = OpenApiJsonBody<"/api/v1/ai/conversations", "post">;
export type SendAiConversationMessagePayload = OpenApiJsonBody<"/api/v1/ai/conversations/{conversationId}/messages", "post">;
export type AiGeneratedResponse = unknown;
export type PaginatedAiResponse<T> = {
  data: T[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};
export type AiMessage = {
  content: string;
  conversationId: string;
  createdAt: string;
  generated: boolean;
  id: string;
  inputTokens?: number | null;
  metadata?: unknown;
  model?: string | null;
  outputTokens?: number | null;
  provider?: string | null;
  role: "ASSISTANT" | "SYSTEM" | "TOOL" | "USER" | string;
  userId?: string | null;
};
export type AiConversation = {
  _count?: {
    actions?: number;
    messages?: number;
    usageLogs?: number;
  };
  agent?: {
    archivedAt?: string | null;
    enabled?: boolean;
    id: string;
    model?: string;
    name?: string;
    provider?: string;
  };
  agentId: string;
  archivedAt?: string | null;
  contextId?: string | null;
  contextType?: string | null;
  createdAt: string;
  id: string;
  messages?: AiMessage[];
  status: "ARCHIVED" | "LOCKED" | "OPEN" | "RESOLVED" | string;
  summary?: string | null;
  title: string;
  updatedAt: string;
  userId: string;
};
export type AiAction = {
  completedAt?: string | null;
  conversationId?: string | null;
  createdAt: string;
  entityId?: string | null;
  entityType?: string | null;
  error?: string | null;
  id: string;
  output?: unknown;
  requestedById?: string | null;
  status: "CANCELLED" | "COMPLETED" | "FAILED" | "PENDING" | "RUNNING" | string;
  type: string;
};
export type AiUsageLog = {
  createdAt: string;
  estimatedCost?: number | string | null;
  id: string;
  inputTokens?: number | null;
  latencyMs?: number | null;
  model: string;
  outputTokens?: number | null;
  provider: string;
  requestType: string;
  status: string;
  totalTokens?: number | null;
};
export type AiUsageSummary = {
  data?: Array<{
    estimatedCost?: number | string;
    inputTokens?: number;
    model: string;
    outputTokens?: number;
    provider: string;
    requests?: number;
    status: string;
    totalTokens?: number;
  }>;
  totals?: {
    estimatedCost?: number | string;
    inputTokens?: number;
    outputTokens?: number;
    requests?: number;
    totalTokens?: number;
  };
};

export function getAiStatus(token: string) {
  return apiRequest<AiStatus>("/ai/status", {
    cache: "no-store",
    method: "GET",
    token,
  });
}

export function getAiSettings(token: string) {
  return openApiRequest("/api/v1/ai/settings", "get", {
    cache: "no-store",
    pathParams: {},
    token,
  });
}

export function updateAiSettings(token: string, body: UpdateAiSettingsPayload) {
  return openApiRequest("/api/v1/ai/settings", "patch", {
    body,
    pathParams: {},
    token,
  });
}

export function listAiAgents(token: string, query: AiAgentQuery = {}) {
  return openApiRequest("/api/v1/ai/agents", "get", {
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      includeArchived: query.includeArchived ?? false,
      limit: boundedLimit(query.limit, 20),
      page: query.page ?? 1,
    },
    token,
  });
}

export function listAiConversations(token: string, query: AiConversationQuery = {}) {
  return apiRequest<PaginatedAiResponse<AiConversation>>(`/ai/conversations${queryString({
    ...query,
    includeArchived: query.includeArchived ?? false,
    limit: boundedLimit(query.limit, 20),
    page: query.page ?? 1,
  })}`, {
    cache: "no-store",
    method: "GET",
    token,
  });
}

export function createAiConversation(token: string, body: CreateAiConversationPayload) {
  return apiRequest<AiConversation>("/ai/conversations", {
    body: JSON.stringify(body),
    method: "POST",
    token,
  });
}

export function getAiConversation(token: string, conversationId: string) {
  return apiRequest<AiConversation>(`/ai/conversations/${encodeURIComponent(conversationId)}`, {
    cache: "no-store",
    method: "GET",
    token,
  });
}

export function sendAiConversationMessage(token: string, conversationId: string, body: SendAiConversationMessagePayload) {
  return apiRequest<{ assistantMessage: AiMessage | null; userMessage: AiMessage }>(`/ai/conversations/${encodeURIComponent(conversationId)}/messages`, {
    body: JSON.stringify(body),
    method: "POST",
    token,
  });
}

export function summarizeAiConversation(token: string, conversationId: string) {
  return apiRequest<AiConversation>(`/ai/conversations/${encodeURIComponent(conversationId)}/summarize`, {
    method: "POST",
    token,
  });
}

export function archiveAiConversation(token: string, conversationId: string) {
  return apiRequest<AiConversation>(`/ai/conversations/${encodeURIComponent(conversationId)}/archive`, {
    method: "POST",
    token,
  });
}

export function sendAiChat(token: string, body: AiChatPayload) {
  return postAi("/ai/chat", token, body);
}

export function generateProjectSummary(token: string, body: ProjectAiPayload) {
  return postAi("/ai/project-summary", token, body);
}

export function generateSprintPlanning(token: string, body: ProjectAiPayload) {
  return postAi("/ai/sprint-planning", token, body);
}

export function detectProjectRisks(token: string, body: ProjectAiPayload) {
  return postAi("/ai/risk-detection", token, body);
}

export function generateBoardSummary(token: string, body: BoardAiPayload) {
  return openApiRequest("/api/v1/ai/board-summary", "post", {
    body,
    pathParams: {},
    token,
  });
}

export function scanBoardRisks(token: string, body: BoardAiPayload) {
  return openApiRequest("/api/v1/ai/board-risk-scan", "post", {
    body,
    pathParams: {},
    token,
  });
}

export function generateBoardActionPlan(token: string, body: BoardAiPayload) {
  return openApiRequest("/api/v1/ai/board-actions", "post", {
    body,
    pathParams: {},
    token,
  });
}

export function applyBoardActions(token: string, body: BoardAiApplyActionsPayload) {
  return openApiRequest("/api/v1/ai/board-actions/apply", "post", {
    body,
    pathParams: {},
    token,
  });
}

export function listBoardAiHistory(token: string, query: BoardAiHistoryQuery = {}) {
  return openApiRequest("/api/v1/ai/board-history", "get", {
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      limit: boundedLimit(query.limit, 20),
      page: query.page ?? 1,
    },
    token,
  });
}

export function searchAiKnowledge(token: string, body: KnowledgeSearchPayload) {
  return postAi("/ai/knowledge-search", token, body);
}

export function listAiActions(token: string, query: AiActionQuery = {}) {
  return apiRequest<PaginatedAiResponse<AiAction>>(`/ai/actions${queryString({
    ...query,
    limit: boundedLimit(query.limit, 20),
    page: query.page ?? 1,
  })}`, {
    cache: "no-store",
    method: "GET",
    token,
  });
}

export function runAiAction(token: string, actionId: string) {
  return apiRequest<AiAction>(`/ai/actions/${encodeURIComponent(actionId)}/run`, {
    method: "POST",
    token,
  });
}

export function cancelAiAction(token: string, actionId: string) {
  return apiRequest<AiAction>(`/ai/actions/${encodeURIComponent(actionId)}/cancel`, {
    method: "POST",
    token,
  });
}

export function listAiUsage(token: string, query: AiUsageQuery = {}) {
  return apiRequest<PaginatedAiResponse<AiUsageLog>>(`/ai/usage${queryString({
    ...query,
    limit: boundedLimit(query.limit, 20),
    page: query.page ?? 1,
  })}`, {
    cache: "no-store",
    method: "GET",
    token,
  });
}

export function getAiUsageSummary(token: string, query: AiUsageQuery = {}) {
  return apiRequest<AiUsageSummary>(`/ai/usage/summary${queryString(query)}`, {
    cache: "no-store",
    method: "GET",
    token,
  });
}

function postAi<TBody extends object>(path: string, token: string, body: TBody) {
  return apiRequest<AiGeneratedResponse>(path, {
    body: JSON.stringify(body),
    method: "POST",
    token,
  });
}

function queryString(query: Record<string, unknown>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
      return;
    }
    params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}
