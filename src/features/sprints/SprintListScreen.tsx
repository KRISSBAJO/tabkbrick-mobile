import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Play,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react-native";
import { ProjectDateField, ProjectDatePickerSheet } from "@/features/projects/ProjectDatePicker";
import {
  completeSprint,
  createSprint,
  deleteSprint,
  listProjects,
  listSprints,
  startSprint,
  updateSprint,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Project, Sprint } from "@/lib/types";

type SprintFormState = {
  endDate: string;
  goal: string;
  name: string;
  startDate: string;
};

type SprintSheetState =
  | { mode: "create"; sprint?: never }
  | { mode: "edit"; sprint: Sprint }
  | null;

type SprintLane = "active" | "completed" | "planned";

const LANE_ACCENT: Record<SprintLane, string> = {
  active: colors.success,
  completed: "#7c3aed",
  planned: colors.accent,
};

const LANE_SOFT: Record<SprintLane, string> = {
  active: colors.greenSoft,
  completed: "#f3eeff",
  planned: colors.blueSoft,
};

const LANE_LABEL: Record<SprintLane, string> = {
  active: "Active",
  completed: "Completed",
  planned: "Planned",
};

export function SprintListScreen() {
  const { accessToken } = useAuthSession();
  const [error, setError] = useState("");
  const [form, setForm] = useState<SprintFormState>(emptySprintForm());
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [sheet, setSheet] = useState<SprintSheetState>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [sprints, setSprints] = useState<Sprint[]>([]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  const visibleSprints = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sprints;
    return sprints.filter((s) => {
      const hay = `${s.name} ${s.goal ?? ""} ${s.project?.name ?? ""} ${s.project?.key ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [search, sprints]);

  const grouped = useMemo(() => {
    const planned: Sprint[] = [];
    const active: Sprint[] = [];
    const completed: Sprint[] = [];
    for (const s of visibleSprints) {
      const lane = sprintLane(s);
      if (lane === "completed") completed.push(s);
      else if (lane === "active") active.push(s);
      else planned.push(s);
    }
    return { active, completed, planned };
  }, [visibleSprints]);

  const metrics = useMemo(
    () => ({
      active: grouped.active.length,
      completed: grouped.completed.length,
      planned: grouped.planned.length,
      tasks: visibleSprints.reduce((sum, s) => sum + (s._count?.tasks ?? 0), 0),
    }),
    [grouped, visibleSprints],
  );

  const load = useCallback(
    async (showRefreshing = false, projectId = selectedProjectId) => {
      if (!accessToken) return;
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const projectPage = await listProjects(accessToken, { limit: 50 });
        const nextProjects = Array.isArray(projectPage) ? projectPage : projectPage.data;
        const nextProjectId = projectId || nextProjects[0]?.id || "";
        setProjects(nextProjects);
        setSelectedProjectId(nextProjectId);

        if (!nextProjectId) {
          setSprints([]);
          return;
        }

        const sprintPage = await listSprints(accessToken, { limit: 100, projectId: nextProjectId });
        setSprints(Array.isArray(sprintPage) ? sprintPage : sprintPage.data);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load sprints.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, selectedProjectId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateSprint() {
    setForm(emptySprintForm());
    setSheet({ mode: "create" });
  }

  function openEditSprint(sprint: Sprint) {
    setForm(sprintToForm(sprint));
    setSheet({ mode: "edit", sprint });
  }

  async function changeProject(projectId: string) {
    setSelectedProjectId(projectId);
    await load(true, projectId);
  }

  async function saveSprint() {
    if (!accessToken || !selectedProject || !form.name.trim() || !sheet) return;
    const dateError = validateSprintDates(form);
    if (dateError) {
      setError(dateError);
      return;
    }
    setSaving(true);
    setError("");

    try {
      const baseBody = {
        goal: form.goal.trim() || undefined,
        name: form.name.trim(),
      };

      if (sheet.mode === "create") {
        await createSprint(accessToken, {
          ...baseBody,
          endDate: toNoonIso(form.endDate),
          projectId: selectedProject.id,
          startDate: toNoonIso(form.startDate),
        });
      } else {
        await updateSprint(accessToken, sheet.sprint.id, {
          ...baseBody,
          endDate: toNoonIsoOrNull(form.endDate),
          startDate: toNoonIsoOrNull(form.startDate),
        });
      }

      setSheet(null);
      await load(true, selectedProject.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save sprint.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStartSprint(sprint: Sprint) {
    if (!accessToken) return;
    setSaving(true);
    setError("");
    try {
      await startSprint(accessToken, sprint.id);
      await load(true, sprint.projectId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start sprint.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteSprint(sprint: Sprint) {
    if (!accessToken) return;
    setSaving(true);
    setError("");
    try {
      await completeSprint(accessToken, sprint.id, { moveIncompleteToBacklog: true });
      await load(true, sprint.projectId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete sprint.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteSprint(sprint: Sprint) {
    if (!accessToken) return;
    if (!canDeleteSprint(sprint)) {
      setError("Only planned sprints with no tasks, meetings, or retrospective notes can be deleted.");
      return;
    }

    Alert.alert(
      "Delete sprint?",
      `Delete "${sprint.name}"? This only works for planned sprints with no owned records.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setSaving(true);
              try {
                await deleteSprint(accessToken, sprint.id);
                await load(true, sprint.projectId);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Unable to delete sprint.");
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerPanel}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading sprints…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true, selectedProjectId)}
            refreshing={refreshing}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Sprints</Text>
            <Text style={styles.subtitle}>{selectedProject?.name ?? "No project selected"}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load(true, selectedProjectId)}
            style={styles.iconBtn}
          >
            <RefreshCw color={colors.foreground} size={19} strokeWidth={2.8} />
          </Pressable>
          <Pressable
            accessibilityLabel="Create sprint"
            accessibilityRole="button"
            disabled={!selectedProject}
            onPress={openCreateSprint}
            style={[styles.addBtn, !selectedProject && styles.disabledAction]}
          >
            <Plus color={colors.black} size={22} strokeWidth={3} />
          </Pressable>
        </View>

        {/* ── PROJECT CHIPS ── */}
        {projects.length > 1 ? (
          <ScrollView
            contentContainerStyle={styles.projectRail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {projects.map((project) => {
              const active = selectedProject?.id === project.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={project.id}
                  onPress={() => void changeProject(project.id)}
                  style={[styles.projectChip, active && styles.projectChipActive]}
                >
                  <Text style={[styles.projectChipKey, active && styles.projectChipTextActive]}>
                    {project.key}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.projectChipName, active && styles.projectChipTextActive]}
                  >
                    {project.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* ── SEARCH ── */}
        <View style={styles.searchBar}>
          <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
          <TextInput
            onChangeText={setSearch}
            placeholder="Search sprints, goals…"
            placeholderTextColor={colors.inkSoft}
            style={styles.searchInput}
            value={search}
          />
        </View>

        {/* ── METRICS GRID ── */}
        <View style={styles.metricsGrid}>
          <MetricCard
            bg={colors.greenSoft}
            icon={<Zap color={colors.success} size={20} strokeWidth={2.5} />}
            label="Active"
            textColor={colors.success}
            value={metrics.active}
          />
          <MetricCard
            bg={colors.blueSoft}
            icon={<CalendarDays color={colors.accent} size={20} strokeWidth={2.5} />}
            label="Planned"
            textColor={colors.accent}
            value={metrics.planned}
          />
          <MetricCard
            bg={colors.yellowSoft}
            icon={<Target color={colors.primaryDark} size={20} strokeWidth={2.5} />}
            label="Tasks"
            textColor={colors.primaryDark}
            value={metrics.tasks}
          />
          <MetricCard
            bg="#f3eeff"
            icon={<Archive color="#7c3aed" size={20} strokeWidth={2.5} />}
            label="Done"
            textColor="#7c3aed"
            value={metrics.completed}
          />
        </View>

        {/* ── SAVING / ERROR ── */}
        {saving ? (
          <View style={styles.savingPill}>
            <ActivityIndicator color={colors.foreground} size="small" />
            <Text style={styles.savingText}>Syncing…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── MAIN CONTENT ── */}
        {!selectedProject ? (
          <View style={styles.emptyPanel}>
            <View style={styles.emptyPanelIcon}>
              <Target color={colors.accent} size={28} strokeWidth={2.5} />
            </View>
            <Text style={styles.emptyPanelTitle}>No project available</Text>
            <Text style={styles.emptyPanelMeta}>Create a project before planning sprint work.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(workspace)")}
              style={styles.emptyPanelBtn}
            >
              <Text style={styles.emptyPanelBtnText}>Go to projects</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.laneStack}>
            {/* Active */}
            <SprintLaneSection
              lane="active"
              onComplete={handleCompleteSprint}
              onDelete={confirmDeleteSprint}
              onEdit={openEditSprint}
              onStart={handleStartSprint}
              saving={saving}
              sprints={grouped.active}
            />

            {/* Planned */}
            <SprintLaneSection
              lane="planned"
              onComplete={handleCompleteSprint}
              onDelete={confirmDeleteSprint}
              onEdit={openEditSprint}
              onStart={handleStartSprint}
              saving={saving}
              sprints={grouped.planned}
            />

            {/* Completed toggle */}
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowCompleted((v) => !v)}
              style={styles.completedToggle}
            >
              <View style={styles.completedToggleLeft}>
                <Archive color="#7c3aed" size={16} strokeWidth={2.5} />
                <Text style={styles.completedToggleText}>Completed sprints</Text>
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>{grouped.completed.length}</Text>
                </View>
              </View>
              {showCompleted ? (
                <ChevronUp color={colors.inkSoft} size={16} strokeWidth={2.5} />
              ) : (
                <ChevronDown color={colors.inkSoft} size={16} strokeWidth={2.5} />
              )}
            </Pressable>

            {showCompleted ? (
              <SprintLaneSection
                lane="completed"
                onComplete={handleCompleteSprint}
                onDelete={confirmDeleteSprint}
                onEdit={openEditSprint}
                onStart={handleStartSprint}
                saving={saving}
                sprints={grouped.completed}
                withoutHeader
              />
            ) : null}
          </View>
        )}
      </ScrollView>

      <SprintEditorSheet
        form={form}
        onChange={setForm}
        onClose={() => setSheet(null)}
        onSave={() => void saveSprint()}
        saving={saving}
        state={sheet}
      />
    </SafeAreaView>
  );
}

// ── Lane Section ─────────────────────────────────────────────────────────────

function SprintLaneSection({
  lane,
  onComplete,
  onDelete,
  onEdit,
  onStart,
  saving,
  sprints,
  withoutHeader = false,
}: {
  lane: SprintLane;
  onComplete: (sprint: Sprint) => Promise<void>;
  onDelete: (sprint: Sprint) => void;
  onEdit: (sprint: Sprint) => void;
  onStart: (sprint: Sprint) => Promise<void>;
  saving: boolean;
  sprints: Sprint[];
  withoutHeader?: boolean;
}) {
  const accent = LANE_ACCENT[lane];
  const soft = LANE_SOFT[lane];

  return (
    <View style={styles.laneSection}>
      {withoutHeader ? null : (
        <View style={styles.laneSectionHeader}>
          <View style={[styles.laneIcon, { backgroundColor: soft }]}>
            {lane === "active" ? <Zap color={accent} size={14} strokeWidth={3} /> : null}
            {lane === "planned" ? <CalendarDays color={accent} size={14} strokeWidth={3} /> : null}
            {lane === "completed" ? <Archive color={accent} size={14} strokeWidth={3} /> : null}
          </View>
          <Text style={styles.laneTitle}>{LANE_LABEL[lane]}</Text>
          <View style={styles.laneCountBadge}>
            <Text style={styles.laneCountText}>{sprints.length}</Text>
          </View>
        </View>
      )}

      {sprints.length ? (
        <View style={styles.sprintCards}>
          {sprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              lane={lane}
              onComplete={() => void onComplete(sprint)}
              onDelete={() => onDelete(sprint)}
              onEdit={() => onEdit(sprint)}
              onOpen={() =>
                router.push({
                  pathname: "/(workspace)/sprints/[sprintId]",
                  params: { sprintId: sprint.id },
                })
              }
              onStart={() => void onStart(sprint)}
              saving={saving}
              sprint={sprint}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyLane}>
          <Text style={styles.emptyLaneTitle}>
            No {LANE_LABEL[lane].toLowerCase()} sprints
          </Text>
          <Text style={styles.emptyLaneMeta}>
            {lane === "active"
              ? "Start a planned sprint when the team is ready."
              : lane === "planned"
                ? "Create the next delivery window."
                : "Completed sprints will appear here."}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Sprint Card ───────────────────────────────────────────────────────────────

function SprintCard({
  lane,
  onComplete,
  onDelete,
  onEdit,
  onOpen,
  onStart,
  saving,
  sprint,
}: {
  lane: SprintLane;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onOpen: () => void;
  onStart: () => void;
  saving: boolean;
  sprint: Sprint;
}) {
  const accent = LANE_ACCENT[lane];
  const soft = LANE_SOFT[lane];
  const taskCount = sprint._count?.tasks ?? 0;
  const progress = timeProgress(sprint.startDate, sprint.endDate);
  const daysLeft = daysRemaining(sprint.endDate);
  const scheduleText = sprintScheduleText(sprint, lane);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.sprintCard, { borderTopColor: accent }, pressed && { opacity: 0.7 }]}
    >
      {/* Name + task count */}
      <View style={styles.sprintCardTop}>
        <Text numberOfLines={1} style={styles.sprintCardName}>
          {sprint.name}
        </Text>
        <View style={[styles.taskCountBadge, { backgroundColor: soft }]}>
          <Text style={[styles.taskCountText, { color: accent }]}>{taskCount} tasks</Text>
        </View>
      </View>

      {/* Goal */}
      {sprint.goal ? (
        <Text numberOfLines={2} style={styles.sprintCardGoal}>
          {sprint.goal}
        </Text>
      ) : null}

      {/* Date + days left */}
      <View style={styles.sprintDateRow}>
        <CalendarDays color={colors.inkSoft} size={13} strokeWidth={2.5} />
        <Text style={styles.sprintDateText}>{scheduleText}</Text>
        {daysLeft !== null && !sprint.completedAt ? (
          <View style={[styles.daysLeftBadge, daysLeft < 0 && styles.daysLeftOverdue]}>
            <Text style={[styles.daysLeftText, daysLeft < 0 && styles.daysLeftTextOverdue]}>
              {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d left`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Progress bar (time elapsed) */}
      {sprint.startDate && sprint.endDate ? (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={{
                flex: Math.max(progress, 0.01),
                height: 5,
                backgroundColor: accent,
                borderRadius: 99,
              }}
            />
            <View style={{ flex: Math.max(100 - progress, 0.01), height: 5 }} />
          </View>
          <Text style={styles.progressPct}>{progress}%</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.sprintActions}>
        {lane === "planned" ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onStart}
            style={[styles.primaryActionBtn, saving && styles.disabledAction]}
          >
            <Play color={colors.black} size={14} strokeWidth={3} />
            <Text style={styles.primaryActionText}>Start sprint</Text>
          </Pressable>
        ) : null}
        {lane === "active" ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onComplete}
            style={[styles.completeActionBtn, saving && styles.disabledAction]}
          >
            <CheckCircle2 color={colors.success} size={14} strokeWidth={2.5} />
            <Text style={styles.completeActionText}>Complete</Text>
          </Pressable>
        ) : null}
        <View style={styles.sprintIconActions}>
          {lane !== "completed" ? (
            <Pressable accessibilityRole="button" onPress={onEdit} style={styles.iconActionBtn}>
              <Edit3 color={colors.foreground} size={15} strokeWidth={2.7} />
            </Pressable>
          ) : null}
          {canDeleteSprint(sprint) ? (
            <Pressable
              accessibilityRole="button"
              onPress={onDelete}
              style={[styles.iconActionBtn, styles.iconActionBtnDanger]}
            >
              <Trash2 color={colors.danger} size={15} strokeWidth={2.7} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  bg,
  icon,
  label,
  textColor,
  value,
}: {
  bg: string;
  icon: ReactNode;
  label: string;
  textColor: string;
  value: number;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.metricValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

// ── Sprint Editor Sheet ───────────────────────────────────────────────────────

function SprintEditorSheet({
  form,
  onChange,
  onClose,
  onSave,
  saving,
  state,
}: {
  form: SprintFormState;
  onChange: (next: SprintFormState) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  state: SprintSheetState;
}) {
  const [datePicker, setDatePicker] = useState<"endDate" | "startDate" | null>(null);

  function selectDate(value: string) {
    if (!datePicker) return;
    onChange({ ...form, [datePicker]: value });
    setDatePicker(null);
  }

  if (!state) return null;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <View style={styles.sheetTitleStack}>
                <Text style={styles.sheetEyebrow}>
                  {state.mode === "create" ? "New sprint" : "Edit sprint"}
                </Text>
                <Text style={styles.sheetTitle}>Delivery window</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
                <X color={colors.foreground} size={20} strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={styles.plannedNote}>
              <View style={styles.plannedNoteIcon}>
                <CalendarDays color={colors.accent} size={18} strokeWidth={2.7} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.plannedNoteTitle}>Plan first, start later</Text>
                <Text style={styles.plannedNoteText}>Leave dates blank to keep this as a planned sprint. Add dates when the team commits, then start it from the sprint list.</Text>
              </View>
            </View>

            <Field label="Sprint name">
              <TextInput
                autoFocus
                onChangeText={(name) => onChange({ ...form, name })}
                placeholder="Sprint 2026.07"
                placeholderTextColor="#8c887f"
                style={styles.input}
                value={form.name}
              />
            </Field>
            <Field label="Goal">
              <TextInput
                multiline
                onChangeText={(goal) => onChange({ ...form, goal })}
                placeholder="What will this sprint deliver?"
                placeholderTextColor="#8c887f"
                style={[styles.input, styles.textArea]}
                value={form.goal}
              />
            </Field>
            <View style={styles.formGrid}>
              <View style={styles.dateGridItem}>
                <ProjectDateField
                  helperText="Sprint kickoff"
                  label="Start date"
                  onClear={() => onChange({ ...form, startDate: "" })}
                  onPress={() => setDatePicker("startDate")}
                  placeholder="Choose start"
                  value={form.startDate}
                />
              </View>
              <View style={styles.dateGridItem}>
                <ProjectDateField
                  helperText="Target close"
                  label="End date"
                  onClear={() => onChange({ ...form, endDate: "" })}
                  onPress={() => setDatePicker("endDate")}
                  placeholder="Choose end"
                  value={form.endDate}
                />
              </View>
            </View>
            <ScrollView
              contentContainerStyle={styles.quickDates}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <DateChip label="Keep planned" onPress={() => onChange({ ...form, endDate: "", startDate: "" })} />
              <DateChip label="This week" onPress={() => onChange({ ...form, ...dateRange(0, 6) })} />
              <DateChip label="Next week" onPress={() => onChange({ ...form, ...dateRange(7, 13) })} />
              <DateChip label="2 weeks" onPress={() => onChange({ ...form, ...dateRange(0, 13) })} />
            </ScrollView>
          </ScrollView>

          <View style={styles.sheetActions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving || !form.name.trim()}
              onPress={onSave}
              style={[styles.saveButton, (saving || !form.name.trim()) && styles.disabledAction]}
            >
              <Text style={styles.saveButtonText}>
                {saving ? "Saving…" : state.mode === "create" ? "Create sprint" : "Save sprint"}
              </Text>
            </Pressable>
          </View>

          <ProjectDatePickerSheet
            onClose={() => setDatePicker(null)}
            onSelect={selectDate}
            title={datePicker === "startDate" ? "Sprint start" : "Sprint end"}
            value={datePicker === "startDate" ? form.startDate : form.endDate}
            visible={datePicker !== null}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function DateChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.dateChip}>
      <Text style={styles.dateChipText}>{label}</Text>
    </Pressable>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptySprintForm(): SprintFormState {
  return { endDate: "", goal: "", name: "", startDate: "" };
}

function sprintToForm(sprint: Sprint): SprintFormState {
  return {
    endDate: isoDate(sprint.endDate),
    goal: sprint.goal ?? "",
    name: sprint.name,
    startDate: isoDate(sprint.startDate),
  };
}

function isoDate(value?: string | null) {
  return value ? String(value).slice(0, 10) : "";
}

function toNoonIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return `${trimmed}T12:00:00.000Z`;
}

function toNoonIsoOrNull(value: string) {
  return toNoonIso(value) ?? null;
}

function validateSprintDates(form: SprintFormState) {
  if (!form.startDate && form.endDate) return "Choose a start date or clear the end date to keep this sprint planned.";
  if (form.startDate && form.endDate) {
    const start = new Date(form.startDate).getTime();
    const end = new Date(form.endDate).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
      return "Sprint end date must be after the start date.";
    }
  }
  return "";
}

function sprintLane(sprint: Sprint): SprintLane {
  if (sprint.completedAt) return "completed";
  if (!sprint.startDate) return "planned";
  const start = new Date(String(sprint.startDate)).getTime();
  if (Number.isFinite(start) && start > Date.now()) return "planned";
  return "active";
}

function canDeleteSprint(sprint: Sprint) {
  const counts = sprint._count as (Sprint["_count"] & { meetings?: number }) | undefined;
  return (
    sprintLane(sprint) === "planned" &&
    (counts?.tasks ?? 0) === 0 &&
    (counts?.meetings ?? 0) === 0 &&
    (counts?.retrospectives ?? 0) === 0
  );
}

function sprintScheduleText(sprint: Sprint, lane: SprintLane) {
  if (!sprint.startDate && !sprint.endDate) {
    return lane === "planned" ? "Unscheduled planned sprint" : "No schedule";
  }
  if (sprint.startDate && !sprint.endDate) return `Starts ${formatShortDate(sprint.startDate)}`;
  if (!sprint.startDate && sprint.endDate) return `Target ${formatShortDate(sprint.endDate)}`;
  return `${formatShortDate(sprint.startDate)} - ${formatShortDate(sprint.endDate)}`;
}

function dateRange(startOffset: number, endOffset: number) {
  return { endDate: dateOffset(endOffset), startDate: dateOffset(startOffset) };
}

function dateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShortDate(value?: string | null) {
  if (!value) return "No date";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "No date";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysRemaining(value?: string | null) {
  if (!value) return null;
  const end = new Date(String(value)).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
}

function timeProgress(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const now = Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.max(0, Math.min(100, Math.round(((now - startMs) / (endMs - startMs)) * 100)));
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 18, padding: 20, paddingBottom: 120 },

  centerPanel: { alignItems: "center", flex: 1, gap: 14, justifyContent: "center", padding: 24 },
  loadingText: { color: colors.inkSoft, fontSize: 14, fontWeight: "700" },

  // ── Header ──
  header: { alignItems: "center", flexDirection: "row", gap: 10 },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: colors.foreground, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", marginTop: 3 },
  iconBtn: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
    ...shadow.card,
  },
  addBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    height: 48,
    justifyContent: "center",
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    width: 48,
    elevation: 6,
  },

  // ── Project chips ──
  projectRail: { gap: 8, paddingRight: 4 },
  projectChip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 2,
    maxWidth: 190,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadow.card,
  },
  projectChipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  projectChipKey: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  projectChipName: { color: colors.inkSoft, fontSize: 11, fontWeight: "700" },
  projectChipTextActive: { color: colors.white },

  // ── Search ──
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 18,
    ...shadow.card,
  },
  searchInput: { color: colors.foreground, flex: 1, fontSize: 15, fontWeight: "700" },

  // ── Metrics ──
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metricCard: {
    alignItems: "center",
    borderRadius: radii.xl,
    gap: 6,
    justifyContent: "center",
    paddingVertical: 20,
    width: "47.5%",
    ...shadow.card,
  },
  metricValue: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  metricLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },

  // ── Feedback ──
  savingPill: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.panel,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...shadow.card,
  },
  savingText: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 14,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "800", lineHeight: 18 },

  // ── Lane ──
  laneStack: { gap: 22 },
  laneSection: { gap: 12 },
  laneSectionHeader: { alignItems: "center", flexDirection: "row", gap: 8 },
  laneIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  laneTitle: { color: colors.foreground, flex: 1, fontSize: 16, fontWeight: "900" },
  laneCountBadge: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  laneCountText: { color: colors.foreground, fontSize: 12, fontWeight: "900" },

  // ── Sprint Cards ──
  sprintCards: { gap: 12 },
  sprintCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderTopWidth: 4,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    ...shadow.card,
  },
  sprintCardTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  sprintCardName: { color: colors.foreground, flex: 1, fontSize: 16, fontWeight: "900" },
  taskCountBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  taskCountText: { fontSize: 12, fontWeight: "800" },
  sprintCardGoal: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  sprintDateRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  sprintDateText: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },
  daysLeftBadge: {
    backgroundColor: colors.panelMuted,
    borderRadius: 999,
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  daysLeftOverdue: { backgroundColor: colors.redSoft },
  daysLeftText: { color: colors.inkSoft, fontSize: 11, fontWeight: "800" },
  daysLeftTextOverdue: { color: colors.danger },

  progressRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: 99,
    flex: 1,
    flexDirection: "row",
    height: 5,
    overflow: "hidden",
  },
  progressPct: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", textAlign: "right", width: 32 },

  sprintActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  primaryActionBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionText: { color: colors.black, fontSize: 13, fontWeight: "900" },
  completeActionBtn: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderColor: "#bbf7d0",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  completeActionText: { color: colors.success, fontSize: 13, fontWeight: "900" },
  sprintIconActions: { alignItems: "center", flexDirection: "row", gap: 8, marginLeft: "auto" },
  iconActionBtn: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 14,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  iconActionBtnDanger: { backgroundColor: colors.redSoft },

  // ── Empty states ──
  emptyLane: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 6,
    padding: 28,
    ...shadow.card,
  },
  emptyLaneTitle: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  emptyLaneMeta: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", textAlign: "center" },

  emptyPanel: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 12,
    padding: 32,
    ...shadow.card,
  },
  emptyPanelIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    height: 60,
    justifyContent: "center",
    marginBottom: 4,
    width: 60,
  },
  emptyPanelTitle: { color: colors.foreground, fontSize: 18, fontWeight: "900" },
  emptyPanelMeta: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", textAlign: "center" },
  emptyPanelBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  emptyPanelBtnText: { color: colors.black, fontSize: 14, fontWeight: "900" },

  // ── Completed toggle ──
  completedToggle: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...shadow.card,
  },
  completedToggleLeft: { alignItems: "center", flexDirection: "row", gap: 10 },
  completedToggleText: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  completedBadge: {
    backgroundColor: "#f3eeff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  completedBadgeText: { color: "#7c3aed", fontSize: 12, fontWeight: "900" },

  disabledAction: { opacity: 0.45 },

  // ── Sheet / Form ──
  modalBackdrop: {
    backgroundColor: "rgba(16,16,15,0.24)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    overflow: "hidden",
  },
  sheetHeader: { backgroundColor: colors.background },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#d7d5ce",
    borderRadius: 999,
    height: 4,
    marginTop: 10,
    width: 42,
  },
  sheetTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
    paddingTop: 14,
  },
  sheetTitleStack: { gap: 2 },
  sheetEyebrow: { color: colors.inkSoft, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  sheetTitle: { color: colors.foreground, fontSize: 20, fontWeight: "900" },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sheetContent: { gap: 16, padding: 18 },
  plannedNote: {
    alignItems: "flex-start",
    backgroundColor: colors.blueSoft,
    borderColor: "#bfdbfe",
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  plannedNoteIcon: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: 16,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  plannedNoteTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  plannedNoteText: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17, marginTop: 3 },
  sheetActions: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    padding: 16,
  },
  cancelButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  cancelButtonText: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 24,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  saveButtonText: { color: colors.black, fontSize: 14, fontWeight: "900" },

  field: { flex: 1, gap: 8 },
  fieldLabel: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  textArea: { minHeight: 96, paddingTop: 14, textAlignVertical: "top" },
  formGrid: { flexDirection: "row", gap: 10 },
  dateGridItem: { flex: 1 },
  quickDates: { gap: 8, paddingRight: 14 },
  dateChip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  dateChipText: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
});
