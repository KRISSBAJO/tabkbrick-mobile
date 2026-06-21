import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListProjectsQuery = OpenApiQuery<"/api/v1/projects", "get">;
export type CreateProjectPayload = OpenApiJsonBody<"/api/v1/projects", "post">;
export type UpdateProjectPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}", "patch">;
export type AddProjectMemberPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/members", "post">;
export type CreateMilestonePayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/milestones", "post">;
export type UpdateMilestonePayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/milestones/{milestoneId}", "patch">;
export type CreateProjectRiskPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/risks", "post">;
export type UpdateProjectRiskPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/risks/{riskId}", "patch">;
export type CreateProjectBudgetPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/budgets", "post">;
export type UpdateProjectBudgetPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/budgets/{budgetId}", "patch">;
export type CreateProjectStakeholderPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/stakeholders", "post">;
export type UpdateProjectStakeholderPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/stakeholders/{stakeholderId}", "patch">;
export type CreateProjectDependencyPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/dependencies", "post">;
export type UpdateProjectDependencyPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/dependencies/{dependencyId}", "patch">;
export type CreateProjectDecisionPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/decisions", "post">;
export type UpdateProjectDecisionPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/decisions/{decisionId}", "patch">;
export type CreateProjectChangeRequestPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/change-requests", "post">;
export type UpdateProjectChangeRequestPayload = OpenApiJsonBody<"/api/v1/projects/{projectId}/change-requests/{changeRequestId}", "patch">;

export function listProjects(token: string, query: ListProjectsQuery = {}) {
  return openApiRequest("/api/v1/projects", "get", {
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

export function getProject(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function createProject(token: string, body: CreateProjectPayload) {
  return openApiRequest("/api/v1/projects", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function updateProject(token: string, projectId: string, body: UpdateProjectPayload) {
  return openApiRequest("/api/v1/projects/{projectId}", "patch", {
    token,
    body,
    pathParams: { projectId },
  });
}

export function deleteProject(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}", "delete", {
    token,
    pathParams: { projectId },
  });
}

export function getProjectPermissions(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/permissions", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function listProjectMembers(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/members", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function addProjectMember(token: string, projectId: string, body: AddProjectMemberPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/members", "post", {
    token,
    body,
    pathParams: { projectId },
  });
}

export function removeProjectMember(token: string, projectId: string, userId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/members/{userId}", "delete", {
    token,
    pathParams: { projectId, userId },
  });
}

export function listProjectMilestones(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/milestones", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function createProjectMilestone(token: string, projectId: string, body: CreateMilestonePayload) {
  return openApiRequest("/api/v1/projects/{projectId}/milestones", "post", {
    token,
    body,
    pathParams: { projectId },
  });
}

export function updateProjectMilestone(token: string, projectId: string, milestoneId: string, body: UpdateMilestonePayload) {
  return openApiRequest("/api/v1/projects/{projectId}/milestones/{milestoneId}", "patch", {
    token,
    body,
    pathParams: { milestoneId, projectId },
  });
}

export function deleteProjectMilestone(token: string, projectId: string, milestoneId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/milestones/{milestoneId}", "delete", {
    token,
    pathParams: { milestoneId, projectId },
  });
}

export function listProjectRisks(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/risks", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function createProjectRisk(token: string, projectId: string, body: CreateProjectRiskPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/risks", "post", {
    token,
    body,
    pathParams: { projectId },
  });
}

export function updateProjectRisk(token: string, projectId: string, riskId: string, body: UpdateProjectRiskPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/risks/{riskId}", "patch", {
    token,
    body,
    pathParams: { projectId, riskId },
  });
}

export function deleteProjectRisk(token: string, projectId: string, riskId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/risks/{riskId}", "delete", {
    token,
    pathParams: { projectId, riskId },
  });
}

export function listProjectBudgets(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/budgets", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function createProjectBudget(token: string, projectId: string, body: CreateProjectBudgetPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/budgets", "post", {
    token,
    body,
    pathParams: { projectId },
  });
}

export function updateProjectBudget(token: string, projectId: string, budgetId: string, body: UpdateProjectBudgetPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/budgets/{budgetId}", "patch", {
    token,
    body,
    pathParams: { budgetId, projectId },
  });
}

export function deleteProjectBudget(token: string, projectId: string, budgetId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/budgets/{budgetId}", "delete", {
    token,
    pathParams: { budgetId, projectId },
  });
}

export function listProjectStakeholders(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/stakeholders", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function createProjectStakeholder(token: string, projectId: string, body: CreateProjectStakeholderPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/stakeholders", "post", {
    token,
    body,
    pathParams: { projectId },
  });
}

export function updateProjectStakeholder(token: string, projectId: string, stakeholderId: string, body: UpdateProjectStakeholderPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/stakeholders/{stakeholderId}", "patch", {
    token,
    body,
    pathParams: { projectId, stakeholderId },
  });
}

export function deleteProjectStakeholder(token: string, projectId: string, stakeholderId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/stakeholders/{stakeholderId}", "delete", {
    token,
    pathParams: { projectId, stakeholderId },
  });
}

export function listProjectDependencies(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/dependencies", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function createProjectDependency(token: string, projectId: string, body: CreateProjectDependencyPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/dependencies", "post", {
    token,
    body,
    pathParams: { projectId },
  });
}

export function updateProjectDependency(token: string, projectId: string, dependencyId: string, body: UpdateProjectDependencyPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/dependencies/{dependencyId}", "patch", {
    token,
    body,
    pathParams: { dependencyId, projectId },
  });
}

export function deleteProjectDependency(token: string, projectId: string, dependencyId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/dependencies/{dependencyId}", "delete", {
    token,
    pathParams: { dependencyId, projectId },
  });
}

export function listProjectDecisions(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/decisions", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function createProjectDecision(token: string, projectId: string, body: CreateProjectDecisionPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/decisions", "post", {
    token,
    body,
    pathParams: { projectId },
  });
}

export function updateProjectDecision(token: string, projectId: string, decisionId: string, body: UpdateProjectDecisionPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/decisions/{decisionId}", "patch", {
    token,
    body,
    pathParams: { decisionId, projectId },
  });
}

export function deleteProjectDecision(token: string, projectId: string, decisionId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/decisions/{decisionId}", "delete", {
    token,
    pathParams: { decisionId, projectId },
  });
}

export function listProjectChangeRequests(token: string, projectId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/change-requests", "get", {
    token,
    cache: "no-store",
    pathParams: { projectId },
  });
}

export function createProjectChangeRequest(token: string, projectId: string, body: CreateProjectChangeRequestPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/change-requests", "post", {
    token,
    body,
    pathParams: { projectId },
  });
}

export function updateProjectChangeRequest(token: string, projectId: string, changeRequestId: string, body: UpdateProjectChangeRequestPayload) {
  return openApiRequest("/api/v1/projects/{projectId}/change-requests/{changeRequestId}", "patch", {
    token,
    body,
    pathParams: { changeRequestId, projectId },
  });
}

export function deleteProjectChangeRequest(token: string, projectId: string, changeRequestId: string) {
  return openApiRequest("/api/v1/projects/{projectId}/change-requests/{changeRequestId}", "delete", {
    token,
    pathParams: { changeRequestId, projectId },
  });
}
