import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, FolderKanban, ListChecks, Pencil, Plus, Trash2, UsersRound } from "lucide-react-native";
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
  projectHealth,
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
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
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
  const { projectId: raw } = useLocalSearchParams<{ projectId: string }>();
  const projectId = Array.isArray(raw) ? raw[0] : raw;
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
        nextProject, nextPermissions, taskPage, nextMembers, nextMilestones,
        nextRisks, nextBudgets, nextStakeholders, nextDependencies,
        nextDecisions, nextChangeRequests, workspacePage, teamPage,
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

  useEffect(() => { void load(); }, [load]);

  const lateMilestones = useMemo(
    () => milestones.filter((m) => !m.completedAt && isOverdue(m.dueDate)).length,
    [milestones],
  );

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
      await createProjectMilestone(accessToken, id, { description: opt(values.description), dueDate: opt(values.dueDate), title: req(values.title) });
    } else if (kind === "risk") {
      await createProjectRisk(accessToken, id, { description: opt(values.description), isOpen: true, mitigation: opt(values.mitigation), severity: opt(values.severity) as "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "CRITICAL" | undefined, title: req(values.title) });
    } else if (kind === "budget") {
      await createProjectBudget(accessToken, id, { actual: optNum(values.actual), currency: opt(values.currency), notes: opt(values.notes), planned: optNum(values.planned) });
    } else if (kind === "stakeholder") {
      await createProjectStakeholder(accessToken, id, { email: opt(values.email), influence: opt(values.influence) as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined, isExternal: true, name: req(values.name, "Name is required."), notes: opt(values.notes), organization: opt(values.organization), role: opt(values.role) });
    } else if (kind === "dependency") {
      await createProjectDependency(accessToken, id, { dependencyType: opt(values.dependencyType), description: opt(values.description), dueDate: opt(values.dueDate), ownerName: opt(values.ownerName), status: opt(values.status) as "OPEN" | "BLOCKED" | "RESOLVED" | "CANCELLED" | undefined, title: req(values.title) });
    } else if (kind === "decision") {
      await createProjectDecision(accessToken, id, { description: opt(values.description), outcome: opt(values.outcome), ownerName: opt(values.ownerName), status: opt(values.status) as "PROPOSED" | "DECIDED" | "SUPERSEDED" | "REOPENED" | undefined, title: req(values.title) });
    } else {
      await createProjectChangeRequest(accessToken, id, { budgetImpact: optNum(values.budgetImpact), description: opt(values.description), dueDate: opt(values.dueDate), reason: opt(values.reason), scheduleImpactDays: optInt(values.scheduleImpactDays), status: opt(values.status) as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "IMPLEMENTED" | "CANCELLED" | undefined, title: req(values.title) });
    }
    await load(true);
  }

  async function saveRecord(kind: ProjectRecordKind, values: ProjectRecordValues) {
    if (!recordModal || recordModal.mode === "create") { await createRecord(kind, values); return; }
    await updateRecord(kind, recordModal.id, values);
  }

  async function updateRecord(kind: ProjectRecordKind, recordId: string, values: ProjectRecordValues) {
    if (!accessToken || !project) return;
    const id = project.id;
    if (kind === "milestone") {
      await updateProjectMilestone(accessToken, id, recordId, { description: opt(values.description), dueDate: opt(values.dueDate), title: opt(values.title) });
    } else if (kind === "risk") {
      await updateProjectRisk(accessToken, id, recordId, { description: opt(values.description), mitigation: opt(values.mitigation), severity: opt(values.severity) as "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "CRITICAL" | undefined, title: opt(values.title) });
    } else if (kind === "budget") {
      await updateProjectBudget(accessToken, id, recordId, { actual: optNum(values.actual), currency: opt(values.currency), notes: opt(values.notes), planned: optNum(values.planned) });
    } else if (kind === "stakeholder") {
      await updateProjectStakeholder(accessToken, id, recordId, { email: opt(values.email), influence: opt(values.influence) as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined, isExternal: true, name: opt(values.name), notes: opt(values.notes), organization: opt(values.organization), role: opt(values.role) });
    } else if (kind === "dependency") {
      await updateProjectDependency(accessToken, id, recordId, { dependencyType: opt(values.dependencyType), description: opt(values.description), dueDate: opt(values.dueDate), ownerName: opt(values.ownerName), status: opt(values.status) as "OPEN" | "BLOCKED" | "RESOLVED" | "CANCELLED" | undefined, title: opt(values.title) });
    } else if (kind === "decision") {
      await updateProjectDecision(accessToken, id, recordId, { description: opt(values.description), outcome: opt(values.outcome), ownerName: opt(values.ownerName), status: opt(values.status) as "PROPOSED" | "DECIDED" | "SUPERSEDED" | "REOPENED" | undefined, title: opt(values.title) });
    } else {
      await updateProjectChangeRequest(accessToken, id, recordId, { budgetImpact: optNum(values.budgetImpact), description: opt(values.description), dueDate: opt(values.dueDate), reason: opt(values.reason), scheduleImpactDays: optInt(values.scheduleImpactDays), status: opt(values.status) as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "IMPLEMENTED" | "CANCELLED" | undefined, title: opt(values.title) });
    }
    await load(true);
  }

  function confirmDeleteProject() {
    if (!accessToken || !project) return;
    Alert.alert("Delete project?", "Only empty projects can be deleted.", [
      { style: "cancel", text: "Cancel" },
      { onPress: () => void deleteProject(accessToken, project.id).then(() => router.replace("/(workspace)/projects")).catch((e) => setError(e instanceof Error ? e.message : "Unable to delete.")), style: "destructive", text: "Delete" },
    ]);
  }

  function confirmDelete(label: string, run: () => Promise<unknown>) {
    Alert.alert(`Delete ${label}?`, "This cannot be undone.", [
      { style: "cancel", text: "Cancel" },
      { onPress: () => void run().then(() => load(true)).catch((e) => setError(e instanceof Error ? e.message : "Unable to delete.")), style: "destructive", text: "Delete" },
    ]);
  }

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading project…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error (no project) ──
  if (error && !project) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Couldn't load project</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Button label="Back to projects" onPress={() => router.replace("/(workspace)/projects")} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  if (!project) return null;

  const swatch = statusSwatch(project.status);
  const health = projectHealth(project);
  const progress = Math.min(Math.max(project.progress ?? 0, 0), 100);
  const openRisks = countOpenRisks(risks);
  const openTasks = countOpenTasks(tasks);

  return (
    <>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── NAV BAR ── */}
          <View style={styles.navBar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/(workspace)/projects")}
              style={styles.navBack}
            >
              <ArrowLeft color={colors.foreground} size={18} strokeWidth={2.8} />
              <Text style={styles.navBackText}>Projects</Text>
            </Pressable>
            {canEdit && (
              <Pressable accessibilityRole="button" onPress={openProjectEdit} style={styles.editBtn}>
                <Pencil color={colors.foreground} size={14} strokeWidth={2.5} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            )}
          </View>

          {/* ── ERROR BANNER ── */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          ) : null}

          {/* ── HERO CARD ── */}
          <View style={[styles.heroCard, { borderTopColor: swatch }]}>
            <View style={styles.heroPills}>
              <StatusPill label={humanize(project.status)} tone={statusTone(project.status)} />
              <StatusPill label={health.label} tone={health.tone} />
            </View>
            <View style={styles.heroKeyRow}>
              <Text style={[styles.heroKey, { color: swatch }]}>{project.key}</Text>
              {project.visibility ? (
                <>
                  <View style={styles.heroBullet} />
                  <Text style={styles.heroVisibility}>{humanize(project.visibility)}</Text>
                </>
              ) : null}
            </View>
            <Text style={styles.heroTitle}>{project.name}</Text>
            {project.description ? (
              <Text style={styles.heroDesc}>{project.description}</Text>
            ) : null}
            {/* Progress */}
            <View style={styles.progressTrack}>
              <View style={{ flex: progress, height: 8, backgroundColor: swatch, borderRadius: 99 }} />
              <View style={{ flex: 100 - progress, height: 8 }} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressLabel}>{progress}% complete</Text>
              <View style={styles.progressDateRow}>
                <CalendarDays color={colors.inkSoft} size={13} strokeWidth={2.5} />
                <Text style={styles.progressLabel}>Due {formatDate(project.dueDate)}</Text>
              </View>
            </View>
          </View>

          {/* ── STATS GRID ── */}
          <View style={styles.statsGrid}>
            <StatCard
              accent={colors.accent}
              icon={<ListChecks color={colors.accent} size={20} strokeWidth={2.7} />}
              label="Open Tasks"
              tint={colors.blueSoft}
              value={openTasks}
            />
            <StatCard
              accent={openRisks > 0 ? colors.danger : colors.inkSoft}
              icon={<AlertTriangle color={openRisks > 0 ? colors.danger : colors.inkSoft} size={20} strokeWidth={2.7} />}
              label="Open Risks"
              tint={openRisks > 0 ? colors.redSoft : colors.panelMuted}
              value={openRisks}
            />
            <StatCard
              accent={lateMilestones > 0 ? colors.warning : colors.inkSoft}
              icon={<Clock3 color={lateMilestones > 0 ? colors.warning : colors.inkSoft} size={20} strokeWidth={2.7} />}
              label="Late"
              tint={lateMilestones > 0 ? colors.orangeSoft : colors.panelMuted}
              value={lateMilestones}
            />
            <StatCard
              accent={colors.success}
              icon={<UsersRound color={colors.success} size={20} strokeWidth={2.7} />}
              label="Team"
              tint={colors.greenSoft}
              value={stakeholders.length + members.length}
            />
          </View>

          {/* ── SECTION TABS ── */}
          <ScrollView contentContainerStyle={styles.tabRail} horizontal showsHorizontalScrollIndicator={false}>
            {sections.map((s) => {
              const active = s.value === section;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={s.value}
                  onPress={() => setSection(s.value)}
                  style={[styles.tabChip, active && styles.tabChipActive]}
                >
                  <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* ── OVERVIEW ── */}
          {section === "overview" && (
            <View style={styles.sectionBlock}>
              <SectionCard icon={<FolderKanban color={colors.accent} size={16} strokeWidth={2.6} />} title="Project details" onAdd={undefined}>
                <OverviewGrid project={project} />
              </SectionCard>
              {canDelete && (
                <Button
                  label="Delete project"
                  leftIcon={<Trash2 color={colors.white} size={16} />}
                  onPress={confirmDeleteProject}
                  variant="dark"
                />
              )}
            </View>
          )}

          {/* ── PLAN ── */}
          {section === "plan" && (
            <View style={styles.sectionBlock}>
              <SectionCard icon={<CalendarDays color={colors.accent} size={16} strokeWidth={2.6} />} title="Milestones" onAdd={canEdit ? () => setRecordModal({ kind: "milestone", mode: "create" }) : undefined}>
                {milestones.length ? (
                  milestones.map((m, idx) => (
                    <RecordCard
                      key={m.id}
                      actionLabel={m.completedAt ? "Reopen" : "Done"}
                      isLast={idx === milestones.length - 1}
                      meta={m.description || `Due ${formatDate(m.dueDate)}`}
                      onAction={() => void updateProjectMilestone(accessToken ?? "", project.id, m.id, { completedAt: m.completedAt ? null : new Date().toISOString() }).then(() => load(true))}
                      onDelete={() => confirmDelete("milestone", () => deleteProjectMilestone(accessToken ?? "", project.id, m.id))}
                      onEdit={canEdit ? () => setRecordModal({ id: m.id, kind: "milestone", mode: "edit", values: { description: tv(m.description), dueDate: tv(m.dueDate), title: tv(m.title) } }) : undefined}
                      status={m.completedAt ? "COMPLETED" : isOverdue(m.dueDate) ? "OVERDUE" : "OPEN"}
                      title={m.title}
                    />
                  ))
                ) : <EmptySection label="No milestones yet." />}
              </SectionCard>
              <SectionCard icon={<ListChecks color={colors.accent} size={16} strokeWidth={2.6} />} title="Latest tasks" onAdd={undefined}>
                {tasks.length ? (
                  tasks.map((t, idx) => (
                    <RecordCard
                      key={t.id}
                      isLast={idx === tasks.length - 1}
                      meta={t.project?.name || t.type}
                      status={t.status}
                      title={t.title}
                    />
                  ))
                ) : <EmptySection label="No tasks found for this project." />}
              </SectionCard>
            </View>
          )}

          {/* ── RISK ── */}
          {section === "risk" && (
            <View style={styles.sectionBlock}>
              <SectionCard icon={<AlertTriangle color={colors.warning} size={16} strokeWidth={2.6} />} title="Risks" onAdd={canEdit ? () => setRecordModal({ kind: "risk", mode: "create" }) : undefined}>
                {risks.length ? (
                  risks.map((r, idx) => (
                    <RecordCard
                      key={r.id}
                      actionLabel={r.isOpen ? "Close" : "Open"}
                      isLast={idx === risks.length - 1}
                      meta={r.description || r.mitigation || "No details"}
                      onAction={() => void updateProjectRisk(accessToken ?? "", project.id, r.id, { isOpen: !r.isOpen }).then(() => load(true))}
                      onDelete={() => confirmDelete("risk", () => deleteProjectRisk(accessToken ?? "", project.id, r.id))}
                      onEdit={canEdit ? () => setRecordModal({ id: r.id, kind: "risk", mode: "edit", values: { description: tv(r.description), mitigation: tv(r.mitigation), severity: tv(r.severity || "MEDIUM"), title: tv(r.title) } }) : undefined}
                      status={r.isOpen ? r.severity || "OPEN" : "CLOSED"}
                      title={r.title}
                    />
                  ))
                ) : <EmptySection label="No risks recorded." />}
              </SectionCard>
              <SectionCard icon={<Clock3 color={colors.accent} size={16} strokeWidth={2.6} />} title="Dependencies" onAdd={canEdit ? () => setRecordModal({ kind: "dependency", mode: "create" }) : undefined}>
                {dependencies.length ? (
                  dependencies.map((d, idx) => (
                    <RecordCard
                      key={d.id}
                      actionLabel={d.status === "RESOLVED" ? "Reopen" : "Resolve"}
                      isLast={idx === dependencies.length - 1}
                      meta={d.description || d.dependencyType || `Due ${formatDate(d.dueDate)}`}
                      onAction={() => void updateProjectDependency(accessToken ?? "", project.id, d.id, { status: d.status === "RESOLVED" ? "OPEN" : "RESOLVED" }).then(() => load(true))}
                      onDelete={() => confirmDelete("dependency", () => deleteProjectDependency(accessToken ?? "", project.id, d.id))}
                      onEdit={canEdit ? () => setRecordModal({ id: d.id, kind: "dependency", mode: "edit", values: { dependencyType: tv(d.dependencyType), description: tv(d.description), dueDate: tv(d.dueDate), ownerName: tv(d.ownerName), status: tv(d.status || "OPEN"), title: tv(d.title) } }) : undefined}
                      status={d.status}
                      title={d.title}
                    />
                  ))
                ) : <EmptySection label="No dependencies recorded." />}
              </SectionCard>
            </View>
          )}

          {/* ── PEOPLE ── */}
          {section === "people" && (
            <View style={styles.sectionBlock}>
              <SectionCard icon={<UsersRound color={colors.accent} size={16} strokeWidth={2.6} />} title="Members" onAdd={undefined}>
                {members.length ? (
                  members.map((m, idx) => (
                    <RecordCard
                      key={m.id}
                      isLast={idx === members.length - 1}
                      meta={m.user.email}
                      status={m.role || "Member"}
                      title={`${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim() || m.user.email}
                    />
                  ))
                ) : <EmptySection label="No project members listed." />}
              </SectionCard>
              <SectionCard icon={<UsersRound color={colors.accent} size={16} strokeWidth={2.6} />} title="Stakeholders" onAdd={canEdit ? () => setRecordModal({ kind: "stakeholder", mode: "create" }) : undefined}>
                {stakeholders.length ? (
                  stakeholders.map((s, idx) => (
                    <RecordCard
                      key={s.id}
                      isLast={idx === stakeholders.length - 1}
                      meta={[s.role, s.organization, s.email].filter(Boolean).join(" · ") || "Stakeholder"}
                      onDelete={() => confirmDelete("stakeholder", () => deleteProjectStakeholder(accessToken ?? "", project.id, s.id))}
                      onEdit={canEdit ? () => setRecordModal({ id: s.id, kind: "stakeholder", mode: "edit", values: { email: tv(s.email), influence: tv(s.influence || "MEDIUM"), name: tv(s.name), notes: tv(s.notes), organization: tv(s.organization), role: tv(s.role) } }) : undefined}
                      status={s.influence}
                      title={s.name}
                    />
                  ))
                ) : <EmptySection label="No stakeholders recorded." />}
              </SectionCard>
            </View>
          )}

          {/* ── FINANCE ── */}
          {section === "finance" && (
            <View style={styles.sectionBlock}>
              <SectionCard icon={<CheckCircle2 color={colors.success} size={16} strokeWidth={2.6} />} title="Budgets" onAdd={canEdit ? () => setRecordModal({ kind: "budget", mode: "create" }) : undefined}>
                {budgets.length ? (
                  budgets.map((b, idx) => (
                    <RecordCard
                      key={b.id}
                      isLast={idx === budgets.length - 1}
                      meta={`Planned ${formatCurrency(b.planned, b.currency ?? project.currency ?? "USD")} · Actual ${formatCurrency(b.actual, b.currency ?? project.currency ?? "USD")}`}
                      onDelete={() => confirmDelete("budget", () => deleteProjectBudget(accessToken ?? "", project.id, b.id))}
                      onEdit={canEdit ? () => setRecordModal({ id: b.id, kind: "budget", mode: "edit", values: { actual: tv(b.actual), currency: tv(b.currency || "USD"), notes: tv(b.notes), planned: tv(b.planned) } }) : undefined}
                      status={b.currency || project.currency || "Budget"}
                      title={b.notes || "Project budget"}
                    />
                  ))
                ) : <EmptySection label="No budgets recorded or you do not have budget access." />}
              </SectionCard>
            </View>
          )}

          {/* ── CHANGES ── */}
          {section === "changes" && (
            <View style={styles.sectionBlock}>
              <SectionCard icon={<CheckCircle2 color={colors.accent} size={16} strokeWidth={2.6} />} title="Decisions" onAdd={canEdit ? () => setRecordModal({ kind: "decision", mode: "create" }) : undefined}>
                {decisions.length ? (
                  decisions.map((d, idx) => (
                    <RecordCard
                      key={d.id}
                      isLast={idx === decisions.length - 1}
                      meta={d.outcome || d.description || "No outcome yet"}
                      onDelete={() => confirmDelete("decision", () => deleteProjectDecision(accessToken ?? "", project.id, d.id))}
                      onEdit={canEdit ? () => setRecordModal({ id: d.id, kind: "decision", mode: "edit", values: { description: tv(d.description), outcome: tv(d.outcome), ownerName: tv(d.ownerName), status: tv(d.status || "PROPOSED"), title: tv(d.title) } }) : undefined}
                      status={d.status}
                      title={d.title}
                    />
                  ))
                ) : <EmptySection label="No decisions recorded." />}
              </SectionCard>
              <SectionCard icon={<Pencil color={colors.accent} size={16} strokeWidth={2.6} />} title="Change requests" onAdd={canEdit ? () => setRecordModal({ kind: "changeRequest", mode: "create" }) : undefined}>
                {changeRequests.length ? (
                  changeRequests.map((cr, idx) => (
                    <RecordCard
                      key={cr.id}
                      isLast={idx === changeRequests.length - 1}
                      meta={cr.reason || cr.description || "No reason supplied"}
                      onDelete={() => confirmDelete("change request", () => deleteProjectChangeRequest(accessToken ?? "", project.id, cr.id))}
                      onEdit={canEdit ? () => setRecordModal({ id: cr.id, kind: "changeRequest", mode: "edit", values: { budgetImpact: tv(cr.budgetImpact), description: tv(cr.description), dueDate: tv(cr.dueDate), reason: tv(cr.reason), scheduleImpactDays: tv(cr.scheduleImpactDays), status: tv(cr.status || "DRAFT"), title: tv(cr.title) } }) : undefined}
                      status={cr.status}
                      title={cr.title}
                    />
                  ))
                ) : <EmptySection label="No change requests recorded." />}
              </SectionCard>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ accent, icon, label, tint, value }: { accent: string; icon: ReactNode; label: string; tint: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: accent }]} />
      <View style={styles.statContent}>
        <View style={styles.statTopRow}>
          <View style={[styles.statIcon, { backgroundColor: tint }]}>
            {icon}
          </View>
          <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
        </View>
        <Text numberOfLines={1} style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function SectionCard({ children, icon, onAdd, title }: { children: ReactNode; icon?: ReactNode; onAdd?: () => void; title: string }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <View style={styles.sectionCardIconRow}>
          <View style={styles.sectionCardIcon}>{icon ?? <FolderKanban color={colors.accent} size={16} strokeWidth={2.5} />}</View>
          <Text numberOfLines={1} style={styles.sectionCardTitle}>{title}</Text>
        </View>
        {onAdd && (
          <Pressable accessibilityRole="button" onPress={onAdd} style={styles.sectionAddBtn}>
            <Plus color={colors.black} size={14} strokeWidth={3} />
            <Text style={styles.sectionAddBtnText}>Add</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function RecordCard({
  actionLabel,
  isLast,
  meta,
  onAction,
  onDelete,
  onEdit,
  status,
  title,
}: {
  actionLabel?: string;
  isLast?: boolean;
  meta?: string | null;
  onAction?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  status?: string | null;
  title: string;
}) {
  const hasActions = Boolean(onEdit || onAction || onDelete);
  return (
    <View style={[styles.recordCard, isLast && styles.recordCardLast]}>
      <View style={styles.recordTopRow}>
        <Text numberOfLines={1} style={styles.recordTitle}>{title}</Text>
        {status ? <StatusPill label={humanize(status)} tone={statusTone(status)} /> : null}
      </View>
      {meta ? <Text numberOfLines={2} style={styles.recordMeta}>{meta}</Text> : null}
      {hasActions && (
        <View style={styles.recordActions}>
          {onEdit && (
            <Pressable accessibilityRole="button" onPress={onEdit} style={[styles.actionBtn, styles.actionBtnEdit]}>
              <Pencil color={colors.accent} size={12} strokeWidth={2.5} />
              <Text style={[styles.actionBtnText, { color: colors.accent }]}>Edit</Text>
            </Pressable>
          )}
          {onAction && (
            <Pressable accessibilityRole="button" onPress={onAction} style={[styles.actionBtn, styles.actionBtnDone]}>
              <CheckCircle2 color={colors.success} size={13} strokeWidth={2.5} />
              <Text style={[styles.actionBtnText, { color: colors.success }]}>{actionLabel}</Text>
            </Pressable>
          )}
          <View style={styles.flex1} />
          {onDelete && (
            <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteBtn}>
              <Trash2 color={colors.danger} size={14} strokeWidth={2.5} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <View style={styles.emptySection}>
      <Text style={styles.emptySectionText}>{label}</Text>
    </View>
  );
}

function OverviewGrid({ project }: { project: Project }) {
  const pairs: [string, string][][] = [
    [["Workspace", project.workspace?.name || "Current workspace"], ["Team", project.team?.name || "No team"]],
    [["Client", project.clientName || "No client"], ["Contract", formatCurrency(project.contractValue, project.currency ?? "USD")]],
    [["Start date", formatDate(project.startDate)], ["Due date", formatDate(project.dueDate)]],
    [["Visibility", humanize(project.visibility)], ["Location", [project.locationName, project.city, project.country].filter(Boolean).join(", ") || "No location"]],
  ];

  return (
    <View style={styles.overviewGrid}>
      {pairs.map((row, rIdx) => (
        <View key={rIdx} style={[styles.overviewRow, rIdx === pairs.length - 1 && { borderBottomWidth: 0 }]}>
          {row.map(([label, value]) => (
            <View key={label} style={styles.overviewCell}>
              <Text style={styles.overviewLabel}>{label}</Text>
              <Text numberOfLines={2} style={styles.overviewValue}>{value}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try { return await promise; } catch { return fallback; }
}

function opt(v: string | undefined) { const t = v?.trim(); return t || undefined; }
function optNum(v: string | undefined) { const t = opt(v); if (!t) return undefined; const n = Number(t); return Number.isFinite(n) ? n : undefined; }
function optInt(v: string | undefined) { const n = optNum(v); return n === undefined ? undefined : Math.round(n); }
function req(v: string | undefined, msg = "Title is required.") { const t = v?.trim(); if (!t) throw new Error(msg); return t; }
function tv(v: unknown) { if (v === null || v === undefined) return ""; return String(v); }

function statusSwatch(status?: string | null): string {
  if (status === "ACTIVE") return colors.success;
  if (status === "PLANNING") return colors.accent;
  if (status === "ON_HOLD") return colors.warning;
  if (status === "COMPLETED") return "#475569";
  return "#94a3b8";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create(withFontStyles({
  safe: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 16, padding: 20, paddingBottom: 120 },

  // Loading / Error screens
  center: { alignItems: "center", flex: 1, gap: 14, justifyContent: "center", padding: 32 },
  loadingText: { color: colors.inkSoft, fontSize: 14, fontWeight: "700" },
  errorTitle: { color: colors.danger, fontSize: 18, fontWeight: "900" },
  errorBody: { color: colors.danger, fontSize: 13, fontWeight: "700", textAlign: "center" },

  // Nav bar
  navBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  navBack: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...shadow.card,
  },
  navBackText: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  editBtn: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    ...shadow.card,
  },
  editBtnText: { color: colors.foreground, fontSize: 13, fontWeight: "900" },

  // Error banner
  errorBox: { backgroundColor: colors.redSoft, borderColor: "#fecaca", borderRadius: radii.xl, borderWidth: 1, padding: 14 },
  errorBoxText: { color: colors.danger, fontSize: 13, fontWeight: "800", lineHeight: 18 },

  // Hero card
  heroCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderTopWidth: 4,
    borderWidth: 1,
    gap: 12,
    padding: 20,
    ...shadow.card,
  },
  heroPills: { flexDirection: "row", gap: 8 },
  heroKeyRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  heroKey: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  heroBullet: { backgroundColor: colors.line, borderRadius: 99, height: 4, width: 4 },
  heroVisibility: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  heroTitle: { color: colors.foreground, fontSize: 24, fontWeight: "900", letterSpacing: -0.4, lineHeight: 30 },
  heroDesc: { color: colors.inkSoft, fontSize: 14, fontWeight: "700", lineHeight: 21 },
  progressTrack: { backgroundColor: colors.line, borderRadius: 99, flexDirection: "row", height: 8, overflow: "hidden" },
  progressMeta: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  progressDateRow: { alignItems: "center", flexDirection: "row", gap: 5 },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statAccent: {
    borderRadius: 999,
    bottom: 14,
    left: 0,
    position: "absolute",
    top: 14,
    width: 4,
  },
  statCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    minHeight: 108,
    overflow: "hidden",
    padding: 14,
    width: "48.5%",
    ...shadow.card,
  },
  statContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingLeft: 6,
  },
  statIcon: {
    alignItems: "center",
    borderRadius: 16,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  statLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  statTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statValue: {
    flexShrink: 1,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "right",
  },

  // Section tabs
  tabRail: { gap: 8, paddingRight: 4 },
  tabChip: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 18 },
  tabChipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  tabChipText: { color: colors.inkSoft, fontSize: 13, fontWeight: "900" },
  tabChipTextActive: { color: colors.white },

  // Section block
  sectionBlock: { gap: 14 },

  // Section card
  sectionCard: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, overflow: "hidden", ...shadow.card },
  sectionCardHeader: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14 },
  sectionCardIconRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, minWidth: 0 },
  sectionCardIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: radii.md, height: 34, justifyContent: "center", width: 34 },
  sectionCardTitle: { color: colors.foreground, flexShrink: 1, fontSize: 15, fontWeight: "900" },
  sectionAddBtn: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 },
  sectionAddBtnText: { color: colors.black, fontSize: 12, fontWeight: "900" },

  // Record card (rows inside section card)
  recordCard: { borderBottomColor: colors.line, borderBottomWidth: 1, gap: 8, paddingHorizontal: 18, paddingVertical: 14 },
  recordCardLast: { borderBottomWidth: 0 },
  recordTopRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  recordTitle: { color: colors.foreground, flex: 1, fontSize: 14, fontWeight: "900" },
  recordMeta: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  recordActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  actionBtn: { alignItems: "center", borderRadius: radii.sm, flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  actionBtnEdit: { backgroundColor: colors.blueSoft },
  actionBtnDone: { backgroundColor: colors.greenSoft },
  actionBtnText: { fontSize: 12, fontWeight: "800" },
  flex1: { flex: 1 },
  deleteBtn: { alignItems: "center", backgroundColor: colors.redSoft, borderRadius: radii.sm, height: 32, justifyContent: "center", width: 32 },

  // Empty section
  emptySection: { alignItems: "center", padding: 24 },
  emptySectionText: { color: colors.inkSoft, fontSize: 13, fontWeight: "700" },

  // Overview grid
  overviewGrid: { gap: 0 },
  overviewRow: { borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row" },
  overviewCell: { flex: 1, gap: 5, padding: 16 },
  overviewLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
  overviewValue: { color: colors.foreground, fontSize: 14, fontWeight: "800", lineHeight: 19 },
}));
