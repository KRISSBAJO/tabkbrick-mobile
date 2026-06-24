import type { Task } from "@/lib/types";

export type TaskPriority = Task["priority"];
export type TaskStatus = Task["status"];
export type TaskType = Task["type"];
export type DueFilter = "" | "OVERDUE" | "TODAY" | "UPCOMING" | "NONE";
export type OwnerFilter = "" | "ASSIGNED" | "UNASSIGNED";

export type TaskFilters = {
  blocked: boolean;
  due: DueFilter;
  owner: OwnerFilter;
  priority: "" | TaskPriority;
  search: string;
  status: "" | TaskStatus;
};

export const emptyTaskFilters: TaskFilters = {
  blocked: false,
  due: "",
  owner: "",
  priority: "",
  search: "",
  status: "",
};

export const taskStatuses: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "TESTING", "DONE", "CANCELLED"];
export const taskPriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"];
export const taskTypes: TaskType[] = ["TASK", "BUG", "STORY", "EPIC", "FEATURE", "INCIDENT", "APPROVAL", "CHANGE_REQUEST", "MILESTONE"];
export const priorityFilterValues: readonly ("" | TaskPriority)[] = ["", ...taskPriorities];
export const statusFilterValues: readonly ("" | TaskStatus)[] = ["", ...taskStatuses];
export const dueFilterValues: readonly DueFilter[] = ["", "OVERDUE", "TODAY", "UPCOMING", "NONE"];
export const ownerFilterValues: readonly OwnerFilter[] = ["", "UNASSIGNED", "ASSIGNED"];

export function filterTasksByControls(tasks: Task[], filters: TaskFilters) {
  const query = filters.search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (query && !taskMatchesSearch(task, query)) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (filters.blocked && !task.card?.flags.isBlocked) return false;
    if (filters.owner === "ASSIGNED" && !hasAssignee(task)) return false;
    if (filters.owner === "UNASSIGNED" && hasAssignee(task)) return false;
    if (filters.due && dueState(task) !== filters.due) return false;
    return true;
  });
}

export function activeFilterCount(filters: TaskFilters) {
  return [
    filters.priority,
    filters.status,
    filters.due,
    filters.owner,
    filters.blocked ? "BLOCKED" : "",
  ].filter(Boolean).length;
}

export function dueState(task: Task): DueFilter {
  if (!task.dueDate) return "NONE";
  if (task.status === "DONE" || task.status === "CANCELLED") return "";
  const due = startOfDay(new Date(String(task.dueDate))).getTime();
  const today = startOfDay(new Date()).getTime();
  if (due < today) return "OVERDUE";
  if (due === today) return "TODAY";
  return "UPCOMING";
}

export function formatShortDate(value: unknown) {
  if (!value) return "No date";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatCompactDate(value: unknown) {
  if (!value) return "No date";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function humanPriority(priority: string) {
  return priority.charAt(0) + priority.slice(1).toLowerCase().replaceAll("_", " ");
}

export function humanStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function priorityTone(priority: string) {
  if (priority === "CRITICAL" || priority === "URGENT") return "red" as const;
  if (priority === "HIGH") return "yellow" as const;
  if (priority === "LOW") return "neutral" as const;
  return "blue" as const;
}

export function statusTone(status: string) {
  if (status === "DONE") return "green" as const;
  if (status === "CANCELLED") return "red" as const;
  if (status === "REVIEW" || status === "TESTING" || status === "IN_PROGRESS") return "yellow" as const;
  return "neutral" as const;
}

export function displayUserName(user: { email?: string; firstName?: string | null; lastName?: string | null } | null | undefined) {
  if (!user) return "Unassigned";
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email || "Unassigned";
}

function taskMatchesSearch(task: Task, query: string) {
  return [
    task.title,
    task.key,
    task.description,
    task.project?.name,
    task.status,
    task.priority,
    task.type,
    ...(task.labels?.map((assignment) => assignment.label.name) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function hasAssignee(task: Task) {
  return Boolean(task.assignees?.length || task.card?.assignees.length);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
