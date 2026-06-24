import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListBillingPlansQuery = OpenApiQuery<"/api/v1/plans", "get">;
type ListBillingEventsQuery = OpenApiQuery<"/api/v1/billing/events", "get">;
type ListBillingInvoicesQuery = OpenApiQuery<"/api/v1/invoices", "get">;
type ListBillingUsageRecordsQuery = OpenApiQuery<"/api/v1/usage-records", "get">;
type BillingUsageSummaryQuery = OpenApiQuery<"/api/v1/usage-records/summary", "get">;

export type BillingCheckoutPayload = OpenApiJsonBody<"/api/v1/billing/checkout", "post">;
export type BillingCheckoutConfirmPayload = OpenApiJsonBody<"/api/v1/billing/checkout/confirm", "post">;
export type BillingPortalPayload = OpenApiJsonBody<"/api/v1/billing/portal", "post">;
export type ChangeBillingPlanPayload = OpenApiJsonBody<"/api/v1/subscriptions/{subscriptionId}/change-plan", "post">;
export type StartTenantBillingTrialPayload = OpenApiJsonBody<"/api/v1/billing/trial", "post">;
export type TenantBillingEvent = {
  id: string;
  tenantId?: string | null;
  provider: string;
  eventId: string;
  type: string;
  status: "RECEIVED" | "PROCESSED" | "FAILED" | "IGNORED" | string;
  payload?: unknown;
  processedAt?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type TenantBillingEventPage = {
  data: TenantBillingEvent[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function getBillingAccountStatus(token: string) {
  return openApiRequest("/api/v1/billing/account", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function listBillingPlans(token: string, query: ListBillingPlansQuery = {}) {
  return openApiRequest("/api/v1/plans", "get", {
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

export function getCurrentTenantSubscription(token: string) {
  return openApiRequest("/api/v1/subscriptions/current", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function changeTenantSubscriptionPlan(token: string, subscriptionId: string, body: ChangeBillingPlanPayload) {
  return openApiRequest("/api/v1/subscriptions/{subscriptionId}/change-plan", "post", {
    token,
    body,
    pathParams: { subscriptionId },
  });
}

export function cancelTenantSubscription(token: string, subscriptionId: string) {
  return openApiRequest("/api/v1/subscriptions/{subscriptionId}/cancel", "post", {
    token,
    pathParams: { subscriptionId },
  });
}

export function resumeTenantSubscription(token: string, subscriptionId: string) {
  return openApiRequest("/api/v1/subscriptions/{subscriptionId}/resume", "post", {
    token,
    pathParams: { subscriptionId },
  });
}

export function startTenantBillingTrial(token: string, body: StartTenantBillingTrialPayload) {
  return openApiRequest("/api/v1/billing/trial", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function createBillingCheckout(token: string, body: BillingCheckoutPayload) {
  return openApiRequest("/api/v1/billing/checkout", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function confirmBillingCheckout(token: string, body: BillingCheckoutConfirmPayload) {
  return openApiRequest("/api/v1/billing/checkout/confirm", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function createBillingPortal(token: string, body: BillingPortalPayload = {}) {
  return openApiRequest("/api/v1/billing/portal", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function getTenantEntitlements(token: string) {
  return openApiRequest("/api/v1/entitlements", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function listTenantInvoices(token: string, query: ListBillingInvoicesQuery = {}) {
  return openApiRequest("/api/v1/invoices", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 20),
    },
  });
}

export function listTenantUsageRecords(token: string, query: ListBillingUsageRecordsQuery = {}) {
  return openApiRequest("/api/v1/usage-records", "get", {
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

export function getTenantUsageSummary(token: string, query: BillingUsageSummaryQuery = {}) {
  return openApiRequest("/api/v1/usage-records/summary", "get", {
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

export async function listTenantBillingEvents(token: string, query: ListBillingEventsQuery = {}) {
  const result = await openApiRequest("/api/v1/billing/events", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 20),
    },
  }) as unknown as TenantBillingEventPage | null;

  return result ?? {
    data: [],
    page: query.page ?? 1,
    limit: boundedLimit(query.limit, 20),
    total: 0,
    totalPages: 0,
  };
}
