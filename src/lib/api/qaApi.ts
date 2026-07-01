import { apiRequest } from "./request";

export type MobileQaExecutionStatus = "PASSED" | "FAILED" | "BLOCKED" | "SKIPPED" | "UNTESTED";
export type MobileQaTestCasePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type MobileQaTestCaseType = "FUNCTIONAL" | "REGRESSION" | "SMOKE" | "SECURITY" | "PERFORMANCE" | "ACCESSIBILITY" | "UAT" | "OTHER";

export type MobileQaExecutionSummary = {
  blocked: number;
  failed: number;
  passRate: number;
  passed: number;
  ready: boolean;
  skipped: number;
  total: number;
  untested: number;
};

export type MobileQaTestCase = {
  id: string;
  title: string;
  description?: string | null;
  expectedResult?: string | null;
  priority: MobileQaTestCasePriority;
  type: MobileQaTestCaseType;
};

export type MobileQaLinkedTestCase = {
  id: string;
  linkType?: string | null;
  testCase: MobileQaTestCase;
};

export type MobileQaLatestExecution = {
  defectTask?: { id: string; key?: string | null; title?: string | null } | null;
  id: string;
  status: MobileQaExecutionStatus;
  testCaseId: string;
  testRunId: string;
  title: string;
  updatedAt?: string | null;
};

export type MobileQaTaskSummary = {
  evidence?: unknown[];
  executions: MobileQaExecutionSummary;
  latestExecutions: MobileQaLatestExecution[];
  linkedTestCases: MobileQaLinkedTestCase[];
};

export type CreateMobileQaTestCasePayload = {
  description?: string;
  expectedResult?: string;
  linkType?: "VALIDATES" | "REGRESSION" | "ACCEPTANCE" | "AUTOMATION";
  priority?: MobileQaTestCasePriority;
  projectId: string;
  taskId?: string;
  title: string;
  type?: MobileQaTestCaseType;
};

export type CreateMobileQaTestRunPayload = {
  name: string;
  projectId: string;
  source?: "MANUAL" | "AUTOMATION" | "IMPORT";
  status?: "PLANNED" | "RUNNING" | "COMPLETED" | "CANCELLED";
  taskId?: string;
  testCaseIds?: string[];
};

export type CreateMobileQaExecutionPayload = {
  actualResult?: string;
  failureMessage?: string;
  notes?: string;
  status: MobileQaExecutionStatus;
  taskId?: string;
  testCaseId?: string;
  title: string;
};

export type CreateMobileQaDefectPayload = {
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "CRITICAL";
  title?: string;
  type?: "BUG" | "TASK" | "INCIDENT";
};

export function getQaTaskSummary(token: string, taskId: string) {
  return apiRequest<MobileQaTaskSummary>(`/qa/tasks/${encodeURIComponent(taskId)}/summary`, {
    method: "GET",
    token,
  });
}

export function createQaTestCase(token: string, payload: CreateMobileQaTestCasePayload) {
  return apiRequest<MobileQaTestCase>("/qa/test-cases", {
    body: JSON.stringify(payload),
    method: "POST",
    token,
  });
}

export function createQaTestRun(token: string, payload: CreateMobileQaTestRunPayload) {
  return apiRequest<{ id: string }>("/qa/test-runs", {
    body: JSON.stringify(payload),
    method: "POST",
    token,
  });
}

export function createQaExecution(token: string, runId: string, payload: CreateMobileQaExecutionPayload) {
  return apiRequest<MobileQaLatestExecution>(`/qa/test-runs/${encodeURIComponent(runId)}/executions`, {
    body: JSON.stringify(payload),
    method: "POST",
    token,
  });
}

export function completeQaTestRun(token: string, runId: string) {
  return apiRequest<{ id: string }>(`/qa/test-runs/${encodeURIComponent(runId)}/complete`, {
    method: "POST",
    token,
  });
}

export function createQaDefectFromExecution(
  token: string,
  runId: string,
  executionId: string,
  payload: CreateMobileQaDefectPayload,
) {
  return apiRequest<{ id: string; key?: string | null }>(
    `/qa/test-runs/${encodeURIComponent(runId)}/executions/${encodeURIComponent(executionId)}/create-defect`,
    {
      body: JSON.stringify(payload),
      method: "POST",
      token,
    },
  );
}
