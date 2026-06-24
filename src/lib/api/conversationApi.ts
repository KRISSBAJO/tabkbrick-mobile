import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListConversationsQuery = OpenApiQuery<"/api/v1/conversations", "get">;
type ListMessagesQuery = OpenApiQuery<"/api/v1/conversations/{conversationId}/messages", "get">;

export type CreateConversationPayload = OpenApiJsonBody<"/api/v1/conversations", "post">;
export type UpdateConversationPayload = OpenApiJsonBody<"/api/v1/conversations/{conversationId}", "patch">;
export type AddConversationMemberPayload = OpenApiJsonBody<"/api/v1/conversations/{conversationId}/members", "post">;
export type CreateMessagePayload = OpenApiJsonBody<"/api/v1/conversations/{conversationId}/messages", "post">;
export type UpdateMessagePayload = OpenApiJsonBody<"/api/v1/messages/{messageId}", "patch">;
export type ForwardMessagePayload = OpenApiJsonBody<"/api/v1/messages/{messageId}/forward", "post">;

export function listConversations(token: string, query: ListConversationsQuery = {}) {
  return openApiRequest("/api/v1/conversations", "get", {
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

export function createConversation(token: string, body: CreateConversationPayload) {
  return openApiRequest("/api/v1/conversations", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function getConversation(token: string, conversationId: string) {
  return openApiRequest("/api/v1/conversations/{conversationId}", "get", {
    token,
    cache: "no-store",
    pathParams: { conversationId },
  });
}

export function updateConversation(token: string, conversationId: string, body: UpdateConversationPayload) {
  return openApiRequest("/api/v1/conversations/{conversationId}", "patch", {
    token,
    body,
    pathParams: { conversationId },
  });
}

export function deleteConversation(token: string, conversationId: string) {
  return openApiRequest("/api/v1/conversations/{conversationId}", "delete", {
    token,
    pathParams: { conversationId },
  });
}

export function listConversationMembers(token: string, conversationId: string) {
  return openApiRequest("/api/v1/conversations/{conversationId}/members", "get", {
    token,
    cache: "no-store",
    pathParams: { conversationId },
  });
}

export function addConversationMember(token: string, conversationId: string, body: AddConversationMemberPayload) {
  return openApiRequest("/api/v1/conversations/{conversationId}/members", "post", {
    token,
    body,
    pathParams: { conversationId },
  });
}

export function removeConversationMember(token: string, conversationId: string, userId: string) {
  return openApiRequest("/api/v1/conversations/{conversationId}/members/{userId}", "delete", {
    token,
    pathParams: { conversationId, userId },
  });
}

export function listMessages(token: string, conversationId: string, query: ListMessagesQuery = {}) {
  return openApiRequest("/api/v1/conversations/{conversationId}/messages", "get", {
    token,
    cache: "no-store",
    pathParams: { conversationId },
    query: {
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 80),
    },
  });
}

export function sendMessage(token: string, conversationId: string, body: CreateMessagePayload) {
  return openApiRequest("/api/v1/conversations/{conversationId}/messages", "post", {
    token,
    body,
    pathParams: { conversationId },
  });
}

export function listPinnedMessages(token: string, conversationId: string) {
  return openApiRequest("/api/v1/conversations/{conversationId}/messages/pinned", "get", {
    token,
    cache: "no-store",
    pathParams: { conversationId },
  });
}

export function updateMessage(token: string, messageId: string, body: UpdateMessagePayload) {
  return openApiRequest("/api/v1/messages/{messageId}", "patch", {
    token,
    body,
    pathParams: { messageId },
  });
}

export function deleteMessage(token: string, messageId: string) {
  return openApiRequest("/api/v1/messages/{messageId}", "delete", {
    token,
    pathParams: { messageId },
  });
}

export function pinMessage(token: string, messageId: string) {
  return openApiRequest("/api/v1/messages/{messageId}/pin", "post", {
    token,
    pathParams: { messageId },
  });
}

export function unpinMessage(token: string, messageId: string) {
  return openApiRequest("/api/v1/messages/{messageId}/unpin", "post", {
    token,
    pathParams: { messageId },
  });
}

export function forwardMessage(token: string, messageId: string, body: ForwardMessagePayload) {
  return openApiRequest("/api/v1/messages/{messageId}/forward", "post", {
    token,
    body,
    pathParams: { messageId },
  });
}

export function addMessageReaction(token: string, messageId: string, emoji: string) {
  return openApiRequest("/api/v1/messages/{messageId}/reactions", "post", {
    token,
    body: { emoji },
    pathParams: { messageId },
  });
}

export function removeMessageReaction(token: string, messageId: string, emoji: string) {
  return openApiRequest("/api/v1/messages/{messageId}/reactions/{emoji}", "delete", {
    token,
    pathParams: { emoji, messageId },
  });
}

export function listMessageReadReceipts(token: string, messageId: string) {
  return openApiRequest("/api/v1/messages/{messageId}/read-receipts", "get", {
    token,
    cache: "no-store",
    pathParams: { messageId },
  });
}

export function markMessageRead(token: string, messageId: string) {
  return openApiRequest("/api/v1/messages/{messageId}/read-receipts", "post", {
    token,
    pathParams: { messageId },
  });
}
