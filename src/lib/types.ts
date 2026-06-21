import type { components } from "@/lib/generated/openapi";

type Schemas = components["schemas"];

export type AuthResponse = Schemas["AuthResponse"];
export type AuthUser = Schemas["AuthUser"];
export type MfaChallengeResponse = Schemas["MfaChallengeResponse"];
export type Meeting = Schemas["Meeting"];
export type Project = Schemas["Project"];
export type ProjectBudget = Schemas["ProjectBudget"];
export type ProjectChangeRequest = Schemas["ProjectChangeRequest"];
export type ProjectDecision = Schemas["ProjectDecision"];
export type ProjectDependency = Schemas["ProjectDependency"];
export type ProjectMember = Schemas["ProjectMember"];
export type ProjectMilestone = Schemas["ProjectMilestone"];
export type ProjectPermissionMatrix = Schemas["ProjectPermissionMatrix"];
export type ProjectRisk = Schemas["ProjectRisk"];
export type ProjectStakeholder = Schemas["ProjectStakeholder"];
export type Team = Schemas["Team"];
export type Task = Schemas["Task"];
export type Workspace = Schemas["Workspace"];
