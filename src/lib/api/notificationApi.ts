import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListNotificationsQuery = OpenApiQuery<"/api/v1/notifications", "get">;
export type UpdateNotificationPreferencesPayload = OpenApiJsonBody<"/api/v1/notification-preferences", "patch">;

export function listNotifications(token: string, query: ListNotificationsQuery = {}) {
  return openApiRequest("/api/v1/notifications", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 30),
    },
  });
}

export function getUnreadNotificationCount(token: string) {
  return openApiRequest("/api/v1/notifications/unread-count", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function markAllNotificationsRead(token: string) {
  return openApiRequest("/api/v1/notifications/read-all", "patch", {
    token,
    pathParams: {},
  });
}

export function deleteReadNotifications(token: string) {
  return openApiRequest("/api/v1/notifications/read", "delete", {
    token,
    pathParams: {},
  });
}

export function markNotificationRead(token: string, notificationId: string) {
  return openApiRequest("/api/v1/notifications/{notificationId}/read", "patch", {
    token,
    pathParams: { notificationId },
  });
}

export function markNotificationUnread(token: string, notificationId: string) {
  return openApiRequest("/api/v1/notifications/{notificationId}/unread", "patch", {
    token,
    pathParams: { notificationId },
  });
}

export function deleteNotification(token: string, notificationId: string) {
  return openApiRequest("/api/v1/notifications/{notificationId}", "delete", {
    token,
    pathParams: { notificationId },
  });
}

export function listNotificationPreferences(token: string) {
  return openApiRequest("/api/v1/notification-preferences", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function updateNotificationPreferences(token: string, body: UpdateNotificationPreferencesPayload) {
  return openApiRequest("/api/v1/notification-preferences", "patch", {
    token,
    body,
    pathParams: {},
  });
}
