import { apiRequest, boundedLimit } from "@/lib/api/request";
import type { AuthUser, Tenant, Workspace } from "@/lib/types";

type AccountQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

export type AccountWorkspace = Workspace & {
  canManage: boolean;
};

export type AccountOverview = {
  user: AuthUser;
  tenant: Tenant | null;
  access: {
    isOwner: boolean;
    canManageTenant: boolean;
    canManageWorkspaces: boolean;
    canManageUsers: boolean;
    canManageSecurity: boolean;
    canManageBilling: boolean;
  };
  counts: {
    workspaces: number;
    teams: number;
    projects: number;
    explicitProjectMemberships: number;
    assignedOpenTasks: number;
    urgentTasks: number;
    unreadNotifications: number;
    trustedDevices: number;
    activeSessions: number;
  };
};

export type AccountPage<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type GuestWorkspaceProject = {
  id: string;
  key: string;
  name: string;
  status: string;
  visibility: string;
  progress: number;
  role: string | null;
  team: { id: string; name: string } | null;
  updatedAt: string;
};

export type GuestWorkspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  role: string | null;
  projectCount: number;
  projects: GuestWorkspaceProject[];
};

export type GuestWorkspacePage = AccountPage<GuestWorkspace> & {
  externalGuestWorkspacesSupported: boolean;
  note: string;
};

export type AccountHelp = {
  categories: Array<{ id: string; title: string; description: string }>;
  channels: Array<{ id: string; label: string; available: boolean }>;
  responseTargets: Record<string, string>;
};

export type SupportRequestPayload = {
  category: "ACCOUNT" | "WORKSPACE" | "BILLING" | "SECURITY" | "TECHNICAL" | "FEATURE";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  subject: string;
  message: string;
  sourceUrl?: string;
};

export type SupportRequestResponse = {
  id: string;
  status: "RECEIVED";
  category: SupportRequestPayload["category"];
  priority: NonNullable<SupportRequestPayload["priority"]>;
  notifiedAdminCount: number;
  message: string;
};

export function getAccountOverview(token: string) {
  return apiRequest<AccountOverview>("/account/overview", {
    token,
    cache: "no-store",
  });
}

export function listAccountWorkspaces(token: string, query: AccountQuery = {}) {
  return apiRequest<AccountPage<AccountWorkspace>>(`/account/workspaces${queryString(query)}`, {
    token,
    cache: "no-store",
  });
}

export function listGuestWorkspaces(token: string, query: AccountQuery = {}) {
  return apiRequest<GuestWorkspacePage>(`/account/guest-workspaces${queryString(query)}`, {
    token,
    cache: "no-store",
  });
}

export function getAccountHelp(token: string) {
  return apiRequest<AccountHelp>("/account/help", {
    token,
    cache: "no-store",
  });
}

export function createSupportRequest(token: string, payload: SupportRequestPayload) {
  return apiRequest<SupportRequestResponse>("/account/support-requests", {
    token,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function queryString(query: AccountQuery) {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    limit: String(boundedLimit(query.limit, 50)),
  });
  if (query.search?.trim()) params.set("search", query.search.trim());
  return `?${params.toString()}`;
}
