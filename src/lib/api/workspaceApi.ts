import { apiRequest, boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListWorkspacesQuery = OpenApiQuery<"/api/v1/workspaces", "get">;
type ListTeamsQuery = OpenApiQuery<"/api/v1/teams", "get">;
export type CreateTeamPayload = OpenApiJsonBody<"/api/v1/teams", "post">;
export type UpdateTeamPayload = OpenApiJsonBody<"/api/v1/teams/{teamId}", "patch">;
export type AddTeamMemberPayload = OpenApiJsonBody<"/api/v1/teams/{teamId}/members", "post">;
export type InviteTeamMemberPayload = OpenApiJsonBody<"/api/v1/teams/{teamId}/invite", "post">;
export type TeamInviteDeliveryStatus = {
  channel: "email" | "in_app" | "none";
  error?: string;
  message: string;
  provider?: string;
  skipped?: boolean;
  status: "sent" | "skipped" | "failed";
};
export type TeamInviteResult<TMember = unknown> = {
  delivery?: "email" | "in_app" | "none";
  deliveryStatus?: TeamInviteDeliveryStatus;
  member?: TMember;
  success?: boolean;
};

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

export function listTeamMembers(token: string, teamId: string) {
  return openApiRequest("/api/v1/teams/{teamId}/members", "get", {
    token,
    cache: "no-store",
    pathParams: { teamId },
  });
}

export function createTeam(token: string, body: CreateTeamPayload) {
  return openApiRequest("/api/v1/teams", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function updateTeam(token: string, teamId: string, body: UpdateTeamPayload) {
  return openApiRequest("/api/v1/teams/{teamId}", "patch", {
    token,
    body,
    pathParams: { teamId },
  });
}

export function deleteTeam(token: string, teamId: string) {
  return openApiRequest("/api/v1/teams/{teamId}", "delete", {
    token,
    pathParams: { teamId },
  });
}

export function addTeamMember(token: string, teamId: string, body: AddTeamMemberPayload) {
  return openApiRequest("/api/v1/teams/{teamId}/members", "post", {
    token,
    body,
    pathParams: { teamId },
  });
}

export function inviteTeamMember(token: string, teamId: string, body: InviteTeamMemberPayload) {
  return openApiRequest("/api/v1/teams/{teamId}/invite", "post", {
    token,
    body,
    pathParams: { teamId },
  });
}

export function removeTeamMember(token: string, teamId: string, userId: string) {
  return openApiRequest("/api/v1/teams/{teamId}/members/{userId}", "delete", {
    token,
    pathParams: { teamId, userId },
  });
}

export function resendTeamMemberInvite(token: string, teamId: string, userId: string) {
  return apiRequest<TeamInviteResult & { success: boolean }>(
    `/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}/resend-invite`,
    {
      method: "POST",
      token,
    },
  );
}

export function cancelTeamMemberInvite(token: string, teamId: string, userId: string) {
  return apiRequest<{ success: boolean }>(
    `/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}/invite`,
    {
      method: "DELETE",
      token,
    },
  );
}
