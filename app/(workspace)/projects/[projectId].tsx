import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ProjectForm, type ProjectDraft } from "@/features/projects/ProjectForm";
import { ProjectRecordModal, type ProjectRecordKind, type ProjectRecordValues } from "@/features/projects/ProjectRecordModal";
import { ProjectSelector } from "@/features/projects/ProjectSelector";
import {
  countOpenRisks,
  countOpenTasks,
  formatCurrency,
  formatDate,
  humanize,
  isOverdue,
  statusTone,
} from "@/features/projects/projectFormat";
import { createDraftFromProject, toUpdateProjectPayload } from "@/features/projects/projectPayload";
import {
  createProjectBudget,
  createProjectChangeRequest,
  createProjectDecision,
  createProjectDependency,
  createProjectMilestone,
  createProjectRisk,
  createProjectStakeholder,
  deleteProject,
  deleteProjectBudget,
  deleteProjectChangeRequest,
  deleteProjectDecision,
  deleteProjectDependency,
  deleteProjectMilestone,
  deleteProjectRisk,
  deleteProjectStakeholder,
  getProject,
  getProjectPermissions,
  listProjectBudgets,
  listProjectChangeRequests,
  listProjectDecisions,
  listProjectDependencies,
  listProjectMembers,
  listProjectMilestones,
  listProjectRisks,
  listProjectStakeholders,
  listTasks,
  listTeams,
  listWorkspaces,
  updateProject,
  updateProjectDependency,
  updateProjectMilestone,
  updateProjectRisk,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii } from "@/lib/theme/tokens";
import type {
  Project,
  ProjectBudget,
  ProjectChangeRequest,
  ProjectDecision,
  ProjectDependency,
  ProjectMember,
  ProjectMilestone,
  ProjectPermissionMatrix,
  ProjectRisk,
  ProjectStakeholder,
  Task,
  Team,
  Workspace,
} from "@/lib/types";

type Section = "overview" | "plan" | "risk" | "people" | "finance" | "changes";

const sections: { label: string; value: Section }[] = [
  { label: "Overview", value: "overview" },
  { label: "Plan", value: "plan" },
  { label: "Risk", value: "risk" },
  { label: "People", value: "people" },
  { label: "Finance", value: "finance" },
  { label: "Changes", value: "changes" },
];

export default function ProjectDetailScreen() {
  const { projectId: rawProjectId } = useLocalSearchParams<{ projectId: string }>();
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  const { accessToken } = useAuthSession();
  const [project, setProject] = useState<Project | null>(null);
  const [permissions, setPermissions] = useState<ProjectPermissionMatrix | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [budgets, setBudgets] = useState<ProjectBudget[]>([]);
  const [stakeholders, setStakeholders] = useState<ProjectStakeholder[]>([]);
  const [dependencies, setDependencies] = useState<ProjectDependency[]>([]);
  const [decisions, setDecisions] = useState<ProjectDecision[]>([]);
  const [changeRequests, setChangeRequests] = useState<ProjectChangeRequest[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [section, setSection] = useState<Section>("overview");
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [modalKind, setModalKind] = useState<ProjectRecordKind | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canEdit = permissions?.actions?.editProject ?? true;
  const canDelete = permissions?.actions?.deleteProject ?? false;

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken || !projectId) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [
        nextProject,
        nextPermissions,
        taskPage,
        nextMembers,
        nextMilestones,
        nextRisks,
        nextBudgets,
        nextStakeholders,
        nextDependencies,
        nextDecisions,
        nextChangeRequests,
        workspacePage,
        teamPage,
      ] = await Promise.all([
        getProject(accessToken, projectId),
        safe(getProjectPermissions(accessToken, projectId), null),
        safe(listTasks(accessToken, { limit: 12, projectId, sortBy: "updatedAt", sortDirection: "desc" }), { data: [], limit: 12, page: 1, total: 0, totalPages: 0 }),
        safe(listProjectMembers(accessToken, projectId), []),
        safe(listProjectMilestones(accessToken, projectId), []),
        safe(listProjectRisks(accessToken, projectId), []),
        safe(listProjectBudgets(accessToken, projectId), []),
        safe(listProjectStakeholders(accessToken, projectId), []),
        safe(listProjectDependencies(accessToken, projectId), []),
        safe(listProjectDecisions(accessToken, projectId), []),
        safe(listProjectChangeRequests(accessToken, projectId), []),
        safe(listWorkspaces(accessToken, { limit: 50 }), { data: [], limit: 50, page: 1, total: 0, totalPages: 0 }),
        safe(listTeams(accessToken, { limit: 50 }), { data: [], limit: 50, page: 1, total: 0, totalPages: 0 }),
      ]);

      setProject(nextProject);
      setPermissions(nextPermissions);
      setTasks(Array.isArray(taskPage) ? taskPage : taskPage.data);
      setMembers(nextMembers);
      setMilestones(nextMilestones);
      setRisks(nextRisks);
      setBudgets(nextBudgets);
      setStakeholders(nextStakeholders);
      setDependencies(nextDependencies);
      setDecisions(nextDecisions);
      setChangeRequests(nextChangeRequests);
      setWorkspaces(Array.isArray(workspacePage) ? workspacePage : workspacePage.data);
      setTeams(Array.isArray(teamPage) ? teamPage : teamPage.data);
      setDraft(createDraftFromProject(nextProject));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load project.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => ({
    openRisks: countOpenRisks(risks),
    openTasks: countOpenTasks(tasks),
    overdueMilestones: milestones.filter((milestone) => !milestone.completedAt && isOverdue(milestone.dueDate)).length,
    stakeholderCount: stakeholders.length + members.length,
  }), [members.length, milestones, risks, stakeholders.length, tasks]);

  async function saveOverview() {
    if (!accessToken || !project || !draft) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateProject(accessToken, project.id, toUpdateProjectPayload(draft));
      setProject(updated);
      setDraft(createDraftFromProject(updated));
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update project.");
    } finally {
      setSaving(false);
    }
  }

  async function createRecord(kind: ProjectRecordKind, values: ProjectRecordValues) {
    if (!accessToken || !project) return;
    const id = project.id;
    if (kind === "milestone") {
      const title = required(values.title);
      await createProjectMilestone(accessToken, id, {
        description: optional(values.description),
        dueDate: optional(values.dueDate),
        title,
      });
    } else if (kind === "risk") {
      const title = required(values.title);
      await createProjectRisk(accessToken, id, {
        description: optional(values.description),
        isOpen: true,
        mitigation: optional(values.mitigation),
        severity: optional(values.severity) as "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "CRITICAL" | undefined,
        title,
      });
    } else if (kind === "budget") {
      await createProjectBudget(accessToken, id, {
        actual: optionalNumber(values.actual),
        currency: optional(values.currency),
        notes: optional(values.notes),
        planned: optionalNumber(values.planned),
      });
    } else if (kind === "stakeholder") {
      const name = required(values.name, "Name is required.");
      await createProjectStakeholder(accessToken, id, {
        email: optional(values.email),
        influence: optional(values.influence) as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined,
        isExternal: true,
        name,
        notes: optional(values.notes),
        organization: optional(values.organization),
        role: optional(values.role),
      });
    } else if (kind === "dependency") {
      const title = required(values.title);
      await createProjectDependency(accessToken, id, {
        dependencyType: optional(values.dependencyType),
        description: optional(values.description),
        dueDate: optional(values.dueDate),
        ownerName: optional(values.ownerName),
        status: optional(values.status) as "OPEN" | "BLOCKED" | "RESOLVED" | "CANCELLED" | undefined,
        title,
      });
    } else if (kind === "decision") {
      const title = required(values.title);
      await createProjectDecision(accessToken, id, {
        description: optional(values.description),
        outcome: optional(values.outcome),
        ownerName: optional(values.ownerName),
        status: optional(values.status) as "PROPOSED" | "DECIDED" | "SUPERSEDED" | "REOPENED" | undefined,
        title,
      });
    } else {
      const title = required(values.title);
      await createProjectChangeRequest(accessToken, id, {
        budgetImpact: optionalNumber(values.budgetImpact),
        description: optional(values.description),
        reason: optional(values.reason),
        scheduleImpactDays: optionalInteger(values.scheduleImpactDays),
        status: optional(values.status) as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "IMPLEMENTED" | "CANCELLED" | undefined,
        title,
      });
    }
    await load(true);
  }

  function confirmDeleteProject() {
    if (!accessToken || !project) return;
    Alert.alert("Delete project?", "Only empty projects can be deleted by the backend.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => {
          void deleteProject(accessToken, project.id)
            .then(() => router.replace("/(workspace)/projects"))
            .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to delete project."));
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  function confirmDelete(label: string, run: () => Promise<unknown>) {
    Alert.alert(`Delete ${label}?`, "This cannot be undone.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => {
          void run().then(() => load(true)).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to delete item."));
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.foreground} />
        <Text style={styles.muted}>Loading project</Text>
      </View>
    );
  }

  if (error && !project) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Button label="Back to projects" onPress={() => router.replace("/(workspace)/projects")} variant="outline" />
      </View>
    );
  }

  if (!project) return null;

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.foreground} />}
        showsVerticalScrollIndicator={false}
        style={styles.safe}
      >
        <View style={styles.header}>
          <Button
            label="Projects"
            leftIcon={<ArrowLeft color={colors.black} size={16} />}
            onPress={() => router.replace("/(workspace)/projects")}
            style={styles.backButton}
            variant="outline"
          />
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroText}>
                <Text style={styles.eyebrow}>{project.key}</Text>
                <Text style={styles.title}>{project.name}</Text>
              </View>
              <StatusPill label={humanize(project.status)} tone={statusTone(project.status)} />
            </View>
            {project.description ? <Text style={styles.description}>{project.description}</Text> : null}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(Math.max(project.progress, 0), 100)}%` }]} />
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaText}>{project.progress}% complete</Text>
              <Text style={styles.heroMetaText}>Due {formatDate(project.dueDate)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <Metric label="Open tasks" value={metrics.openTasks} />
          <Metric label="Open risks" tone={metrics.openRisks ? "red" : "green"} value={metrics.openRisks} />
          <Metric label="Late milestones" tone={metrics.overdueMilestones ? "red" : "neutral"} value={metrics.overdueMilestones} />
          <Metric label="People" value={metrics.stakeholderCount} />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <ProjectSelector label="Manage" onChange={setSection} options={sections} value={section} />

        {section === "overview" && draft ? (
          <View style={styles.section}>
            <SectionHeader
              action={canEdit ? (editing ? "Cancel" : "Edit") : undefined}
              onAction={canEdit ? () => {
                if (editing) setDraft(createDraftFromProject(project));
                setEditing((value) => !value);
              } : undefined}
              title="Overview"
            />
            {editing ? (
              <>
                <ProjectForm draft={draft} mode="edit" onChange={setDraft} teams={teams} workspaces={workspaces} />
                <Button label="Save overview" loading={saving} onPress={saveOverview} />
              </>
            ) : (
              <Overview project={project} />
            )}
            {canDelete ? (
              <Button
                label="Delete project"
                leftIcon={<Trash2 color={colors.white} size={16} />}
                onPress={confirmDeleteProject}
                variant="dark"
              />
            ) : null}
          </View>
        ) : null}

        {section === "plan" ? (
          <View style={styles.section}>
            <SectionHeader onAction={() => setModalKind("milestone")} title="Milestones" />
            <RecordList empty="No milestones yet.">
              {milestones.map((milestone) => (
                <RecordRow
                  key={milestone.id}
                  actionLabel={milestone.completedAt ? "Reopen" : "Done"}
                  meta={milestone.description || `Due ${formatDate(milestone.dueDate)}`}
                  onAction={() => void updateProjectMilestone(accessToken ?? "", project.id, milestone.id, {
                    completedAt: milestone.completedAt ? null : new Date().toISOString(),
                  }).then(() => load(true))}
                  onDelete={() => confirmDelete("milestone", () => deleteProjectMilestone(accessToken ?? "", project.id, milestone.id))}
                  status={milestone.completedAt ? "COMPLETED" : isOverdue(milestone.dueDate) ? "OVERDUE" : "OPEN"}
                  title={milestone.title}
                />
              ))}
            </RecordList>
            <SectionHeader title="Latest tasks" />
            <RecordList empty="No tasks found for this project.">
              {tasks.map((task) => (
                <RecordRow
                  key={task.id}
                  meta={task.project?.name || task.type}
                  status={task.status}
                  title={task.title}
                />
              ))}
            </RecordList>
          </View>
        ) : null}

        {section === "risk" ? (
          <View style={styles.section}>
            <SectionHeader onAction={() => setModalKind("risk")} title="Risks" />
            <RecordList empty="No risks recorded.">
              {risks.map((risk) => (
                <RecordRow
                  key={risk.id}
                  actionLabel={risk.isOpen ? "Close" : "Open"}
                  meta={risk.description || risk.mitigation || "No details"}
                  onAction={() => void updateProjectRisk(accessToken ?? "", project.id, risk.id, { isOpen: !risk.isOpen }).then(() => load(true))}
                  onDelete={() => confirmDelete("risk", () => deleteProjectRisk(accessToken ?? "", project.id, risk.id))}
                  status={risk.isOpen ? risk.severity || "OPEN" : "CLOSED"}
                  title={risk.title}
                />
              ))}
            </RecordList>
            <SectionHeader onAction={() => setModalKind("dependency")} title="Dependencies" />
            <RecordList empty="No dependencies recorded.">
              {dependencies.map((dependency) => (
                <RecordRow
                  key={dependency.id}
                  actionLabel={dependency.status === "RESOLVED" ? "Reopen" : "Resolve"}
                  meta={dependency.description || dependency.dependencyType || `Due ${formatDate(dependency.dueDate)}`}
                  onAction={() => void updateProjectDependency(accessToken ?? "", project.id, dependency.id, {
                    status: dependency.status === "RESOLVED" ? "OPEN" : "RESOLVED",
                  }).then(() => load(true))}
                  onDelete={() => confirmDelete("dependency", () => deleteProjectDependency(accessToken ?? "", project.id, dependency.id))}
                  status={dependency.status}
                  title={dependency.title}
                />
              ))}
            </RecordList>
          </View>
        ) : null}

        {section === "people" ? (
          <View style={styles.section}>
            <SectionHeader title="Members" />
            <RecordList empty="No project members listed.">
              {members.map((member) => (
                <RecordRow
                  key={member.id}
                  meta={member.user.email}
                  status={member.role || "Member"}
                  title={`${member.user.firstName} ${member.user.lastName}`.trim() || member.user.email}
                />
              ))}
            </RecordList>
            <SectionHeader onAction={() => setModalKind("stakeholder")} title="Stakeholders" />
            <RecordList empty="No stakeholders recorded.">
              {stakeholders.map((stakeholder) => (
                <RecordRow
                  key={stakeholder.id}
                  meta={[stakeholder.role, stakeholder.organization, stakeholder.email].filter(Boolean).join(" - ") || "Stakeholder"}
                  onDelete={() => confirmDelete("stakeholder", () => deleteProjectStakeholder(accessToken ?? "", project.id, stakeholder.id))}
                  status={stakeholder.influence}
                  title={stakeholder.name}
                />
              ))}
            </RecordList>
          </View>
        ) : null}

        {section === "finance" ? (
          <View style={styles.section}>
            <SectionHeader onAction={() => setModalKind("budget")} title="Budgets" />
            <RecordList empty="No budgets recorded or you do not have budget access.">
              {budgets.map((budget) => (
                <RecordRow
                  key={budget.id}
                  meta={`Planned ${formatCurrency(budget.planned, budget.currency ?? project.currency ?? "USD")} - Actual ${formatCurrency(budget.actual, budget.currency ?? project.currency ?? "USD")}`}
                  onDelete={() => confirmDelete("budget", () => deleteProjectBudget(accessToken ?? "", project.id, budget.id))}
                  status={budget.currency || project.currency || "Budget"}
                  title={budget.notes || "Project budget"}
                />
              ))}
            </RecordList>
          </View>
        ) : null}

        {section === "changes" ? (
          <View style={styles.section}>
            <SectionHeader onAction={() => setModalKind("decision")} title="Decisions" />
            <RecordList empty="No decisions recorded.">
              {decisions.map((decision) => (
                <RecordRow
                  key={decision.id}
                  meta={decision.outcome || decision.description || "No outcome yet"}
                  onDelete={() => confirmDelete("decision", () => deleteProjectDecision(accessToken ?? "", project.id, decision.id))}
                  status={decision.status}
                  title={decision.title}
                />
              ))}
            </RecordList>
            <SectionHeader onAction={() => setModalKind("changeRequest")} title="Change requests" />
            <RecordList empty="No change requests recorded.">
              {changeRequests.map((request) => (
                <RecordRow
                  key={request.id}
                  meta={request.reason || request.description || "No reason supplied"}
                  onDelete={() => confirmDelete("change request", () => deleteProjectChangeRequest(accessToken ?? "", project.id, request.id))}
                  status={request.status}
                  title={request.title}
                />
              ))}
            </RecordList>
          </View>
        ) : null}
      </ScrollView>

      <ProjectRecordModal
        kind={modalKind}
        onClose={() => setModalKind(null)}
        onSubmit={createRecord}
        visible={Boolean(modalKind)}
      />
    </>
  );
}

async function safe<T>(promise: Promise<T>, fallback: T) {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function optional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function optionalNumber(value: string | undefined) {
  const text = optional(value);
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function optionalInteger(value: string | undefined) {
  const number = optionalNumber(value);
  return number === undefined ? undefined : Math.round(number);
}

function required(value: string | undefined, message = "Title is required.") {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(message);
  return trimmed;
}

function Metric({ label, tone = "neutral", value }: { label: string; tone?: "green" | "neutral" | "red"; value: number }) {
  return (
    <View style={[styles.metric, tone === "red" ? styles.metricRed : tone === "green" ? styles.metricGreen : null]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ action = "Add", onAction, title }: { action?: string; onAction?: () => void; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.sectionAction}>
          {action === "Add" ? <Plus color={colors.black} size={15} /> : <Pencil color={colors.black} size={14} />}
          <Text style={styles.sectionActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RecordList({ children, empty }: { children: ReactNode; empty: string }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  if (!list.length) {
    return (
      <View style={styles.emptyRow}>
        <Text style={styles.muted}>{empty}</Text>
      </View>
    );
  }

  return <View style={styles.recordList}>{children}</View>;
}

function RecordRow({
  actionLabel,
  meta,
  onAction,
  onDelete,
  status,
  title,
}: {
  actionLabel?: string;
  meta?: string | null;
  onAction?: () => void;
  onDelete?: () => void;
  status?: string | null;
  title: string;
}) {
  return (
    <View style={styles.recordRow}>
      <View style={styles.recordText}>
        <Text numberOfLines={1} style={styles.recordTitle}>{title}</Text>
        {meta ? <Text numberOfLines={2} style={styles.recordMeta}>{meta}</Text> : null}
      </View>
      <View style={styles.recordActions}>
        {status ? <StatusPill label={humanize(status)} tone={statusTone(status)} /> : null}
        {onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} style={styles.iconAction}>
            <CheckCircle2 color={colors.success} size={17} />
            <Text style={styles.iconActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        {onDelete ? (
          <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteAction}>
            <Trash2 color={colors.danger} size={16} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Overview({ project }: { project: Project }) {
  return (
    <View style={styles.overviewGrid}>
      <Info label="Workspace" value={project.workspace?.name || "Current workspace"} />
      <Info label="Team" value={project.team?.name || "No team"} />
      <Info label="Client" value={project.clientName || "No client"} />
      <Info label="Contract" value={formatCurrency(project.contractValue, project.currency ?? "USD")} />
      <Info label="Start" value={formatDate(project.startDate)} />
      <Info label="Due" value={formatDate(project.dueDate)} />
      <Info label="Visibility" value={humanize(project.visibility)} />
      <Info label="Location" value={[project.locationName, project.city, project.country].filter(Boolean).join(", ") || "No location"} />
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    height: 40,
  },
  center: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: 112,
  },
  deleteAction: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderRadius: radii.sm,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  description: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  emptyRow: {
    backgroundColor: colors.muted,
    borderRadius: radii.lg,
    padding: 13,
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 13,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },
  header: {
    gap: 14,
  },
  hero: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  heroMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroMetaText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  iconAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    paddingVertical: 3,
  },
  iconActionText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "900",
  },
  info: {
    backgroundColor: colors.muted,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 3,
    padding: 12,
  },
  infoLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoValue: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  metric: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: "47%",
    padding: 13,
  },
  metricGreen: {
    backgroundColor: colors.greenSoft,
    borderColor: "#bbf7d0",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metricRed: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
  },
  metricValue: {
    color: colors.foreground,
    fontSize: 23,
    fontWeight: "900",
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: 99,
    height: 7,
  },
  progressTrack: {
    backgroundColor: colors.panelMuted,
    borderRadius: 99,
    height: 7,
    overflow: "hidden",
  },
  recordActions: {
    alignItems: "flex-end",
    gap: 7,
  },
  recordList: {
    gap: 10,
  },
  recordMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  recordRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  recordText: {
    flex: 1,
    minWidth: 0,
  },
  recordTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  section: {
    gap: 14,
  },
  sectionAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  sectionActionText: {
    color: colors.black,
    fontSize: 12,
    fontWeight: "900",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
  },
  title: {
    color: colors.foreground,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 31,
  },
});
