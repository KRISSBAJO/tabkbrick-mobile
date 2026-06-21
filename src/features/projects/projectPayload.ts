import type { CreateProjectPayload, UpdateProjectPayload } from "@/lib/api";
import type { Project } from "@/lib/types";
import { createEmptyProjectDraft, type ProjectDraft } from "@/features/projects/ProjectForm";

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function progressNumber(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(Math.round(numeric), 0), 100);
}

export function createDraftFromProject(project: Project): ProjectDraft {
  return {
    ...createEmptyProjectDraft(project.workspaceId ?? ""),
    billingCode: project.billingCode ?? "",
    city: project.city ?? "",
    clientEmail: project.clientEmail ?? "",
    clientName: project.clientName ?? "",
    clientPhone: project.clientPhone ?? "",
    contractValue: project.contractValue === null || project.contractValue === undefined ? "" : String(project.contractValue),
    costCenter: project.costCenter ?? "",
    country: project.country ?? "",
    currency: project.currency ?? "USD",
    description: project.description ?? "",
    dueDate: project.dueDate?.slice(0, 10) ?? "",
    key: project.key,
    locationName: project.locationName ?? "",
    name: project.name,
    progress: String(project.progress ?? 0),
    startDate: project.startDate?.slice(0, 10) ?? "",
    status: project.status,
    teamId: project.teamId ?? "",
    visibility: project.visibility ?? "WORKSPACE",
  };
}

export function toCreateProjectPayload(draft: ProjectDraft): CreateProjectPayload {
  return {
    workspaceId: draft.workspaceId,
    billingCode: optionalText(draft.billingCode),
    city: optionalText(draft.city),
    clientEmail: optionalText(draft.clientEmail),
    clientName: optionalText(draft.clientName),
    clientPhone: optionalText(draft.clientPhone),
    contractValue: optionalNumber(draft.contractValue),
    costCenter: optionalText(draft.costCenter),
    country: optionalText(draft.country),
    currency: optionalText(draft.currency),
    description: optionalText(draft.description),
    dueDate: optionalText(draft.dueDate),
    key: draft.key.trim().toUpperCase(),
    locationName: optionalText(draft.locationName),
    name: draft.name.trim(),
    progress: progressNumber(draft.progress),
    startDate: optionalText(draft.startDate),
    status: draft.status,
    teamId: optionalText(draft.teamId),
    visibility: draft.visibility,
  };
}

export function toUpdateProjectPayload(draft: ProjectDraft): UpdateProjectPayload {
  return {
    workspaceId: optionalText(draft.workspaceId),
    billingCode: optionalText(draft.billingCode),
    city: optionalText(draft.city),
    clientEmail: optionalText(draft.clientEmail),
    clientName: optionalText(draft.clientName),
    clientPhone: optionalText(draft.clientPhone),
    contractValue: optionalNumber(draft.contractValue),
    costCenter: optionalText(draft.costCenter),
    country: optionalText(draft.country),
    currency: optionalText(draft.currency),
    description: optionalText(draft.description),
    dueDate: optionalText(draft.dueDate) ?? null,
    locationName: optionalText(draft.locationName),
    name: optionalText(draft.name),
    progress: progressNumber(draft.progress),
    startDate: optionalText(draft.startDate) ?? null,
    status: draft.status,
    teamId: optionalText(draft.teamId),
    visibility: draft.visibility,
  };
}
