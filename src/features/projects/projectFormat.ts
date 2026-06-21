import type { Project, ProjectRisk, Task } from "@/lib/types";

export type ProjectStatus = Project["status"];
export type ProjectVisibility = NonNullable<Project["visibility"]>;

export const projectStatuses: ProjectStatus[] = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"];
export const projectVisibilities: ProjectVisibility[] = ["PRIVATE", "TEAM", "WORKSPACE", "ORGANIZATION", "PUBLIC"];

export function humanize(value: string | null | undefined) {
  if (!value) return "Not set";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function statusTone(status?: string | null): "blue" | "green" | "red" | "yellow" | "neutral" {
  if (!status) return "neutral";
  if (/completed|done|active|resolved|decided|approved|implemented/i.test(status)) return "green";
  if (/blocked|cancelled|rejected|archived|critical|urgent/i.test(status)) return "red";
  if (/planning|progress|review|pending|submitted|hold|open/i.test(status)) return "yellow";
  if (/private|team|workspace|organization|public/i.test(status)) return "blue";
  return "neutral";
}

export function formatDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatCurrency(value?: number | string | null, currency = "USD") {
  if (value === null || value === undefined || value === "") return "Not set";
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat(undefined, { currency, maximumFractionDigits: 0, style: "currency" }).format(amount);
}

export function projectHealth(project: Project) {
  if (project.status === "COMPLETED") return { label: "Complete", tone: "green" as const };
  if (project.status === "ARCHIVED") return { label: "Archived", tone: "neutral" as const };
  if (project.dueDate && new Date(project.dueDate).getTime() < Date.now()) {
    return { label: "Overdue", tone: "red" as const };
  }
  if ((project._count?.risks ?? 0) > 0) return { label: "Watch", tone: "yellow" as const };
  return { label: "Healthy", tone: "green" as const };
}

export function summarizeProject(project: Project) {
  const tasks = project._count?.tasks ?? 0;
  const risks = project._count?.risks ?? 0;
  const members = project._count?.members ?? 0;
  return `${tasks} tasks - ${risks} risks - ${members} members`;
}

export function countOpenRisks(risks: ProjectRisk[]) {
  return risks.filter((risk) => risk.isOpen).length;
}

export function countOpenTasks(tasks: Task[]) {
  return tasks.filter((task) => !["DONE", "CANCELLED"].includes(task.status)).length;
}

export function isOverdue(value?: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}
