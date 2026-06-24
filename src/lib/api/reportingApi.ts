import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type AnalyticsQuery = OpenApiQuery<"/api/v1/reporting/analytics/overview", "get">;
type ListReportsQuery = OpenApiQuery<"/api/v1/reporting/reports", "get">;
type ListReportExecutionsQuery = OpenApiQuery<"/api/v1/reporting/executions", "get">;
type ListReportExportsQuery = OpenApiQuery<"/api/v1/reporting/exports", "get">;

export type CreateReportPayload = OpenApiJsonBody<"/api/v1/reporting/reports", "post">;
export type ExportReportPayload = OpenApiJsonBody<"/api/v1/reporting/reports/{reportId}/exports", "post">;
export type RunReportPayload = OpenApiJsonBody<"/api/v1/reporting/reports/run", "post">;

export function getAnalyticsOverview(token: string, query: AnalyticsQuery = {}) {
  return openApiRequest("/api/v1/reporting/analytics/overview", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query,
  });
}

export function getProjectHealthAnalytics(token: string, query: AnalyticsQuery = {}) {
  return openApiRequest("/api/v1/reporting/analytics/project-health", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query,
  });
}

export function getTeamPerformanceAnalytics(token: string, query: AnalyticsQuery = {}) {
  return openApiRequest("/api/v1/reporting/analytics/team-performance", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query,
  });
}

export function getCycleTimeAnalytics(token: string, query: AnalyticsQuery = {}) {
  return openApiRequest("/api/v1/reporting/analytics/cycle-time", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query,
  });
}

export function getVelocityAnalytics(token: string, query: AnalyticsQuery = {}) {
  return openApiRequest("/api/v1/reporting/analytics/velocity", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query,
  });
}

export function getBudgetAnalytics(token: string, query: AnalyticsQuery = {}) {
  return openApiRequest("/api/v1/reporting/analytics/budget", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query,
  });
}

export function getSlaAnalytics(token: string, query: AnalyticsQuery = {}) {
  return openApiRequest("/api/v1/reporting/analytics/sla", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query,
  });
}

export function listReports(token: string, query: ListReportsQuery = {}) {
  return openApiRequest("/api/v1/reporting/reports", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 25),
    },
  });
}

export function createReport(token: string, body: CreateReportPayload) {
  return openApiRequest("/api/v1/reporting/reports", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function runAdHocReport(token: string, body: RunReportPayload) {
  return openApiRequest("/api/v1/reporting/reports/run", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function runSavedReport(token: string, reportId: string, body: RunReportPayload = {}) {
  return openApiRequest("/api/v1/reporting/reports/{reportId}/run", "post", {
    token,
    body,
    pathParams: { reportId },
  });
}

export function exportSavedReport(token: string, reportId: string, body: ExportReportPayload) {
  return openApiRequest("/api/v1/reporting/reports/{reportId}/exports", "post", {
    token,
    body,
    pathParams: { reportId },
  });
}

export function listReportExecutions(token: string, query: ListReportExecutionsQuery = {}) {
  return openApiRequest("/api/v1/reporting/executions", "get", {
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

export function listReportExports(token: string, query: ListReportExportsQuery = {}) {
  return openApiRequest("/api/v1/reporting/exports", "get", {
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
