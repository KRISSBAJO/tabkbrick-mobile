import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ProjectEditModal } from "@/features/projects/ProjectEditModal";
import type { ProjectDraft } from "@/features/projects/ProjectForm";
import { ProjectRecordModal, type ProjectRecordKind, type ProjectRecordValues } from "@/features/projects/ProjectRecordModal";
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
  updateProjectBudget,
  updateProjectChangeRequest,
  updateProjectDecision,
  updateProjectDependency,
  updateProjectMilestone,
  updateProjectRisk,
  updateProjectStakeholder,
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
type RecordModalState =
  | { kind: ProjectRecordKind; mode: "create" }
  | { id: string; kind: ProjectRecordKind; mode: "edit"; values: ProjectRecordValues };

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
  const [editingProject, setEditingProject] = useState(false);
  const [editError, setEditError] = useState("");
  const [recordModal, setRecordModal] = useState<RecordModalState | null>(null);
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

  const summaryItems = useMemo(() => [
    { label: "Tasks", value: countOpenTasks(tasks) },
    { label: "Risks", value: countOpenRisks(risks) },
    { label: "Late", value: milestones.filter((milestone) => !milestone.completedAt && isOverdue(milestone.dueDate)).length },
    { label: "People", value: stakeholders.length + members.length },
  ], [members.length, milestones, risks, stakeholders.length, tasks]);

  async function saveOverview() {
    if (!accessToken || !project || !draft) return;
    setSaving(true);
    setEditError("");
    try {
      const updated = await updateProject(accessToken, project.id, toUpdateProjectPayload(draft));
      setProject(updated);
      setDraft(createDraftFromProject(updated));
      setEditingProject(false);
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : "Unable to update project.");
    } finally {
      setSaving(false);
    }
  }

  function openProjectEdit() {
    if (!project) return;
    setDraft(createDraftFromProject(project));
    setEditError("");
    setEditingProject(true);
  }

  function closeProjectEdit() {
    if (project) setDraft(createDraftFromProject(project));
    setEditError("");
    setEditingProject(false);
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
        dueDate: optional(values.dueDate),
        reason: optional(values.reason),
        scheduleImpactDays: optionalInteger(values.scheduleImpactDays),
        status: optional(values.status) as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "IMPLEMENTED" | "CANCELLED" | undefined,
        title,
      });
    }
    await load(true);
  }

  async function saveRecord(kind: ProjectRecordKind, values: ProjectRecordValues) {
    if (!recordModal || recordModal.mode === "create") {
      await createRecord(kind, values);
      return;
    }
    await updateRecord(kind, recordModal.id, values);
  }

  async function updateRecord(kind: ProjectRecordKind, recordId: string, values: ProjectRecordValues) {
    if (!accessToken || !project) return;
    const id = project.id;
    if (kind === "milestone") {
      await updateProjectMilestone(accessToken, id, recordId, {
        description: optional(values.description),
        dueDate: optional(values.dueDate),
        title: optional(values.title),
      });
    } else if (kind === "risk") {
      await updateProjectRisk(accessToken, id, recordId, {
        description: optional(values.description),
        mitigation: optional(values.mitigation),
        severity: optional(values.severity) as "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "CRITICAL" | undefined,
        title: optional(values.title),
      });
    } else if (kind === "budget") {
      await updateProjectBudget(accessToken, id, recordId, {
        actual: optionalNumber(values.actual),
        currency: optional(values.currency),
        notes: optional(values.notes),
        planned: optionalNumber(values.planned),
      });
    } else if (kind === "stakeholder") {
      await updateProjectStakeholder(accessToken, id, recordId, {
        email: optional(values.email),
        influence: optional(values.influence) as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined,
        isExternal: true,
        name: optional(values.name),
        notes: optional(values.notes),
        organization: optional(values.organization),
        role: optional(values.role),
      });
    } else if (kind === "dependency") {
      await updateProjectDependency(accessToken, id, recordId, {
        dependencyType: optional(values.dependencyType),
        description: optional(values.description),
        dueDate: optional(values.dueDate),
        ownerName: optional(values.ownerName),
        status: optional(values.status) as "OPEN" | "BLOCKED" | "RESOLVED" | "CANCELLED" | undefined,
        title: optional(values.title),
      });
    } else if (kind === "decision") {
      await updateProjectDecision(accessToken, id, recordId, {
        description: optional(values.description),
        outcome: optional(values.outcome),
        ownerName: optional(values.ownerName),
        status: optional(values.status) as "PROPOSED" | "DECIDED" | "SUPERSEDED" | "REOPENED" | undefined,
        title: optional(values.title),
      });
    } else {
      await updateProjectChangeRequest(accessToken, id, recordId, {
        budgetImpact: optionalNumber(values.budgetImpact),
        description: optional(values.description),
        dueDate: optional(values.dueDate),
        reason: optional(values.reason),
        scheduleImpactDays: optionalInteger(values.scheduleImpactDays),
        status: optional(values.status) as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "IMPLEMENTED" | "CANCELLED" | undefined,
        title: optional(values.title),
      });
    }
    await load(true);
  }

  function openCreate(kind: ProjectRecordKind) {
    setRecordModal({ kind, mode: "create" });
  }

  function openEdit(kind: ProjectRecordKind, id: string, values: ProjectRecordValues) {
    setRecordModal({ id, kind, mode: "edit", values });
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
          <Pressable accessibilityRole="button" onPress={() => router.replace("/(workspace)/projects")} style={styles.backLink}>
            <ArrowLeft color={colors.foreground} size={18} strokeWidth={2.7} />
            <Text style={styles.backLinkText}>Projects</Text>
          </Pressable>
          {canEdit ? (
            <Pressable accessibilityRole="button" onPress={openProjectEdit} style={styles.headerAction}>
              <Pencil color={colors.foreground} size={16} strokeWidth={2.6} />
              <Text style={styles.headerActionText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.projectIntro}>
          <View style={styles.projectTitleRow}>
            <View style={styles.projectTitleWrap}>
              <Text style={styles.eyebrow}>{project.key}</Text>
              <Text style={styles.title}>{project.name}</Text>
            </View>
            <StatusPill label={humanize(project.status)} tone={statusTone(project.status)} />
          </View>
          {project.description ? <Text style={styles.description}>{project.description}</Text> : null}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(Math.max(project.progress, 0), 100)}%` }]} />
          </View>
          <View style={styles.projectMetaLine}>
            <Text style={styles.projectMetaText}>{project.progress}% complete</Text>
            <Text style={styles.projectMetaText}>Due {formatDate(project.dueDate)}</Text>
          </View>
          <ProjectSummary items={summaryItems} />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <SectionTabs onChange={setSection} value={section} />

        {section === "overview" && draft ? (
          <View style={styles.section}>
            <SectionHeader
              action={canEdit ? "Edit" : undefined}
              onAction={canEdit ? openProjectEdit : undefined}
              title="Overview"
            />
            <Overview project={project} />
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
            <SectionHeader onAction={canEdit ? () => openCreate("milestone") : undefined} title="Milestones" />
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
                  onEdit={canEdit ? () => openEdit("milestone", milestone.id, valuesFromMilestone(milestone)) : undefined}
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
            <SectionHeader onAction={canEdit ? () => openCreate("risk") : undefined} title="Risks" />
            <RecordList empty="No risks recorded.">
              {risks.map((risk) => (
                <RecordRow
                  key={risk.id}
                  actionLabel={risk.isOpen ? "Close" : "Open"}
                  meta={risk.description || risk.mitigation || "No details"}
                  onAction={() => void updateProjectRisk(accessToken ?? "", project.id, risk.id, { isOpen: !risk.isOpen }).then(() => load(true))}
                  onDelete={() => confirmDelete("risk", () => deleteProjectRisk(accessToken ?? "", project.id, risk.id))}
                  onEdit={canEdit ? () => openEdit("risk", risk.id, valuesFromRisk(risk)) : undefined}
                  status={risk.isOpen ? risk.severity || "OPEN" : "CLOSED"}
                  title={risk.title}
                />
              ))}
            </RecordList>
            <SectionHeader onAction={canEdit ? () => openCreate("dependency") : undefined} title="Dependencies" />
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
                  onEdit={canEdit ? () => openEdit("dependency", dependency.id, valuesFromDependency(dependency)) : undefined}
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
            <SectionHeader onAction={canEdit ? () => openCreate("stakeholder") : undefined} title="Stakeholders" />
            <RecordList empty="No stakeholders recorded.">
              {stakeholders.map((stakeholder) => (
                <RecordRow
                  key={stakeholder.id}
                  meta={[stakeholder.role, stakeholder.organization, stakeholder.email].filter(Boolean).join(" - ") || "Stakeholder"}
                  onDelete={() => confirmDelete("stakeholder", () => deleteProjectStakeholder(accessToken ?? "", project.id, stakeholder.id))}
                  onEdit={canEdit ? () => openEdit("stakeholder", stakeholder.id, valuesFromStakeholder(stakeholder)) : undefined}
                  status={stakeholder.influence}
                  title={stakeholder.name}
                />
              ))}
            </RecordList>
          </View>
        ) : null}

        {section === "finance" ? (
          <View style={styles.section}>
            <SectionHeader onAction={canEdit ? () => openCreate("budget") : undefined} title="Budgets" />
            <RecordList empty="No budgets recorded or you do not have budget access.">
              {budgets.map((budget) => (
                <RecordRow
                  key={budget.id}
                  meta={`Planned ${formatCurrency(budget.planned, budget.currency ?? project.currency ?? "USD")} - Actual ${formatCurrency(budget.actual, budget.currency ?? project.currency ?? "USD")}`}
                  onDelete={() => confirmDelete("budget", () => deleteProjectBudget(accessToken ?? "", project.id, budget.id))}
                  onEdit={canEdit ? () => openEdit("budget", budget.id, valuesFromBudget(budget)) : undefined}
                  status={budget.currency || project.currency || "Budget"}
                  title={budget.notes || "Project budget"}
                />
              ))}
            </RecordList>
          </View>
        ) : null}

        {section === "changes" ? (
          <View style={styles.section}>
            <SectionHeader onAction={canEdit ? () => openCreate("decision") : undefined} title="Decisions" />
            <RecordList empty="No decisions recorded.">
              {decisions.map((decision) => (
                <RecordRow
                  key={decision.id}
                  meta={decision.outcome || decision.description || "No outcome yet"}
                  onDelete={() => confirmDelete("decision", () => deleteProjectDecision(accessToken ?? "", project.id, decision.id))}
                  onEdit={canEdit ? () => openEdit("decision", decision.id, valuesFromDecision(decision)) : undefined}
                  status={decision.status}
                  title={decision.title}
                />
              ))}
            </RecordList>
            <SectionHeader onAction={canEdit ? () => openCreate("changeRequest") : undefined} title="Change requests" />
            <RecordList empty="No change requests recorded.">
              {changeRequests.map((request) => (
                <RecordRow
                  key={request.id}
                  meta={request.reason || request.description || "No reason supplied"}
                  onDelete={() => confirmDelete("change request", () => deleteProjectChangeRequest(accessToken ?? "", project.id, request.id))}
                  onEdit={canEdit ? () => openEdit("changeRequest", request.id, valuesFromChangeRequest(request)) : undefined}
                  status={request.status}
                  title={request.title}
                />
              ))}
            </RecordList>
          </View>
        ) : null}
      </ScrollView>

      <ProjectRecordModal
        initialValues={recordModal?.mode === "edit" ? recordModal.values : undefined}
        kind={recordModal?.kind ?? null}
        mode={recordModal?.mode}
        onClose={() => setRecordModal(null)}
        onSubmit={saveRecord}
        visible={Boolean(recordModal)}
      />
      {draft ? (
        <ProjectEditModal
          draft={draft}
          error={editError}
          onChange={setDraft}
          onClose={closeProjectEdit}
          onSubmit={saveOverview}
          saving={saving}
          teams={teams}
          visible={editingProject}
          workspaces={workspaces}
        />
      ) : null}
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

function valuesFromMilestone(milestone: ProjectMilestone): ProjectRecordValues {
  return {
    description: textValue(milestone.description),
    dueDate: textValue(milestone.dueDate),
    title: textValue(milestone.title),
  };
}

function valuesFromRisk(risk: ProjectRisk): ProjectRecordValues {
  return {
    description: textValue(risk.description),
    mitigation: textValue(risk.mitigation),
    severity: textValue(risk.severity || "MEDIUM"),
    title: textValue(risk.title),
  };
}

function valuesFromBudget(budget: ProjectBudget): ProjectRecordValues {
  return {
    actual: textValue(budget.actual),
    currency: textValue(budget.currency || "USD"),
    notes: textValue(budget.notes),
    planned: textValue(budget.planned),
  };
}

function valuesFromStakeholder(stakeholder: ProjectStakeholder): ProjectRecordValues {
  return {
    email: textValue(stakeholder.email),
    influence: textValue(stakeholder.influence || "MEDIUM"),
    name: textValue(stakeholder.name),
    notes: textValue(stakeholder.notes),
    organization: textValue(stakeholder.organization),
    role: textValue(stakeholder.role),
  };
}

function valuesFromDependency(dependency: ProjectDependency): ProjectRecordValues {
  return {
    dependencyType: textValue(dependency.dependencyType),
    description: textValue(dependency.description),
    dueDate: textValue(dependency.dueDate),
    ownerName: textValue(dependency.ownerName),
    status: textValue(dependency.status || "OPEN"),
    title: textValue(dependency.title),
  };
}

function valuesFromDecision(decision: ProjectDecision): ProjectRecordValues {
  return {
    description: textValue(decision.description),
    outcome: textValue(decision.outcome),
    ownerName: textValue(decision.ownerName),
    status: textValue(decision.status || "PROPOSED"),
    title: textValue(decision.title),
  };
}

function valuesFromChangeRequest(request: ProjectChangeRequest): ProjectRecordValues {
  return {
    budgetImpact: textValue(request.budgetImpact),
    description: textValue(request.description),
    dueDate: textValue(request.dueDate),
    reason: textValue(request.reason),
    scheduleImpactDays: textValue(request.scheduleImpactDays),
    status: textValue(request.status || "DRAFT"),
    title: textValue(request.title),
  };
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function ProjectSummary({ items }: { items: { label: string; value: number }[] }) {
  return (
    <View style={styles.summaryLine}>
      {items.map((item, index) => (
        <View key={item.label} style={styles.summaryItem}>
          {index > 0 ? <View style={styles.summaryDivider} /> : null}
          <Text style={styles.summaryValue}>{item.value}</Text>
          <Text style={styles.summaryLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionTabs({ onChange, value }: { onChange: (value: Section) => void; value: Section }) {
  return (
    <View style={styles.tabsWrap}>
      <Text style={styles.tabsLabel}>Management</Text>
      <ScrollView contentContainerStyle={styles.tabsContent} horizontal showsHorizontalScrollIndicator={false}>
        {sections.map((sectionItem) => {
          const selected = sectionItem.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              key={sectionItem.value}
              onPress={() => onChange(sectionItem.value)}
              style={[styles.tabButton, selected ? styles.tabButtonActive : null]}
            >
              <Text style={[styles.tabButtonText, selected ? styles.tabButtonTextActive : null]}>{sectionItem.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  onEdit,
  status,
  title,
}: {
  actionLabel?: string;
  meta?: string | null;
  onAction?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
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
        {onEdit ? (
          <Pressable accessibilityRole="button" onPress={onEdit} style={styles.iconAction}>
            <Pencil color={colors.accent} size={15} />
            <Text style={[styles.iconActionText, styles.editActionText]}>Edit</Text>
          </Pressable>
        ) : null}
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
  const rows = [
    { label: "Workspace", value: project.workspace?.name || "Current workspace" },
    { label: "Team", value: project.team?.name || "No team" },
    { label: "Client", value: project.clientName || "No client" },
    { label: "Contract", value: formatCurrency(project.contractValue, project.currency ?? "USD") },
    { label: "Start", value: formatDate(project.startDate) },
    { label: "Due", value: formatDate(project.dueDate) },
    { label: "Visibility", value: humanize(project.visibility) },
    { label: "Location", value: [project.locationName, project.city, project.country].filter(Boolean).join(", ") || "No location" },
  ];

  return (
    <View style={styles.overviewList}>
      {rows.map((row, index) => (
        <Info key={row.label} label={row.label} last={index === rows.length - 1} value={row.value} />
      ))}
    </View>
  );
}

function Info({ label, last, value }: { label: string; last: boolean; value: string }) {
  return (
    <View style={[styles.info, last ? styles.infoLast : null]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    paddingVertical: 4,
  },
  backLinkText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
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
    gap: 24,
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
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  emptyRow: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    paddingVertical: 18,
  },
  editActionText: {
    color: colors.accent,
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
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  headerActionText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
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
    alignItems: "flex-start",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 18,
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  infoLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoValue: {
    color: colors.foreground,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
    textAlign: "right",
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  overviewList: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
  },
  progressFill: {
    backgroundColor: colors.accent,
    borderRadius: 99,
    height: 5,
  },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: 99,
    height: 5,
    overflow: "hidden",
  },
  projectIntro: {
    gap: 14,
  },
  projectMetaLine: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  projectMetaText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  projectTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  projectTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  recordActions: {
    alignItems: "flex-end",
    gap: 7,
  },
  recordList: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
  },
  recordMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  recordRow: {
    alignItems: "flex-start",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 14,
    paddingVertical: 15,
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
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionActionText: {
    color: colors.foreground,
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
    fontSize: 19,
    fontWeight: "900",
  },
  summaryDivider: {
    backgroundColor: colors.line,
    height: 28,
    marginRight: 14,
    width: 1,
  },
  summaryItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  summaryLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  summaryLine: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingTop: 2,
  },
  summaryValue: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
  },
  tabButton: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  tabButtonActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  tabButtonText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  tabButtonTextActive: {
    color: colors.white,
  },
  tabsContent: {
    gap: 8,
    paddingRight: 20,
  },
  tabsLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tabsWrap: {
    gap: 10,
  },
  title: {
    color: colors.foreground,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 31,
  },
});
