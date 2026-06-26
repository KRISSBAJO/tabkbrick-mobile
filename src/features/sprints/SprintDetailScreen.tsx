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
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CheckSquare2,
  Edit3,
  Flag,
  Link2,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  Trash2,
  X,
} from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import { ProjectDateField, ProjectDatePickerSheet } from "@/features/projects/ProjectDatePicker";
import {
  addSprintTasks,
  completeSprint,
  createSprintRetrospective,
  createTask,
  deleteSprint,
  deleteSprintRetrospective,
  getSprintBurndown,
  getSprint,
  listSprintRetrospectives,
  listSprintTasks,
  listTasks,
  removeSprintTask,
  startSprint,
  updateSprintRetrospective,
  updateSprint,
  type SprintBurndown,
  type SprintRetrospective,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Sprint, Task } from "@/lib/types";
import {
  displayUserName,
  formatCompactDate,
  humanPriority,
  humanStatus,
  priorityTone,
  statusTone,
  taskPriorities,
  taskStatuses,
  taskTypes,
} from "@/features/tasks/taskFilters";

type SprintFormState = {
  endDate: string;
  goal: string;
  name: string;
  startDate: string;
};

type TaskFormState = {
  description: string;
  dueDate: string;
  estimateHours: string;
  priority: Task["priority"];
  status: Task["status"];
  storyPoints: string;
  title: string;
  type: Task["type"];
};

type RetroFormState = {
  actionItems: string;
  improve: string;
  wentWell: string;
};

type SheetState = "addTasks" | "createTask" | "editSprint" | "retrospective" | null;

export function SprintDetailScreen({ sprintId }: { sprintId: string }) {
  const { accessToken } = useAuthSession();
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [burndown, setBurndown] = useState<SprintBurndown | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retroEditingId, setRetroEditingId] = useState<string | null>(null);
  const [retroForm, setRetroForm] = useState<RetroFormState>(emptyRetroForm());
  const [retrospectives, setRetrospectives] = useState<SprintRetrospective[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [sprintForm, setSprintForm] = useState<SprintFormState>(emptySprintForm());
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm());
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<Task["status"] | "ALL">("ALL");
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = useCallback(
    async (showRefreshing = false) => {
      if (!accessToken || !sprintId) return;
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const sprintData = await getSprint(accessToken, sprintId);
        const [taskPage, burndownData, retrospectiveData, projectTasks] = await Promise.all([
          listSprintTasks(accessToken, sprintId, { limit: 200 }),
          getSprintBurndown(accessToken, sprintId).catch(() => null),
          listSprintRetrospectives(accessToken, sprintId).catch(() => [] as SprintRetrospective[]),
          sprintData.projectId
            ? listTasks(accessToken, {
                limit: 200,
                projectId: sprintData.projectId,
                sortBy: "updatedAt",
                sortDirection: "desc",
              })
            : Promise.resolve(null),
        ]);
        const sprintTasks = Array.isArray(taskPage) ? taskPage : taskPage.data;
        setSprint(sprintData);
        setTasks(sprintTasks);
        setSprintForm(sprintToForm(sprintData));
        setBurndown(burndownData);
        setRetrospectives(retrospectiveData);

        if (projectTasks) {
          const all = Array.isArray(projectTasks) ? projectTasks : projectTasks.data;
          setBacklogTasks(all.filter((t) => t.sprintId !== sprintData.id));
        } else {
          setBacklogTasks([]);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load sprint.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, sprintId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.status === "DONE").length;
    const inProgress = tasks.filter(
      (t) => t.status === "IN_PROGRESS" || t.status === "REVIEW" || t.status === "TESTING",
    ).length;
    const blocked = tasks.filter((t) => t.card?.flags.isBlocked).length;
    const points = tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    return {
      blocked,
      done,
      inProgress,
      open: tasks.length - done,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      points,
      total: tasks.length,
    };
  }, [tasks]);

  const statusGroups = useMemo(
    () =>
      taskStatuses
        .map((status) => ({ count: tasks.filter((t) => t.status === status).length, status }))
        .filter((item) => item.count > 0),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    const needle = taskSearch.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchesStatus = taskStatusFilter === "ALL" || t.status === taskStatusFilter;
      const matchesSearch =
        !needle || `${t.title} ${t.key} ${t.description ?? ""}`.toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [taskSearch, taskStatusFilter, tasks]);

  const state = sprintState(sprint);

  function openEditSprint() {
    if (!sprint) return;
    setSprintForm(sprintToForm(sprint));
    setSheet("editSprint");
  }

  function openCreateTask() {
    setTaskForm(emptyTaskForm());
    setSheet("createTask");
  }

  function openAddTasks() {
    setSelectedTaskIds([]);
    setSheet("addTasks");
  }

  function openRetrospective(retrospective?: SprintRetrospective) {
    setRetroEditingId(retrospective?.id ?? null);
    setRetroForm(retrospective ? retroToForm(retrospective) : emptyRetroForm());
    setSheet("retrospective");
  }

  async function saveSprint() {
    if (!accessToken || !sprint || !sprintForm.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateSprint(accessToken, sprint.id, {
        endDate: toNoonIsoOrNull(sprintForm.endDate),
        goal: sprintForm.goal.trim() || undefined,
        name: sprintForm.name.trim(),
        startDate: toNoonIsoOrNull(sprintForm.startDate),
      });
      setSprint({ ...sprint, ...updated });
      setSheet(null);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update sprint.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTask() {
    if (!accessToken || !sprint || !taskForm.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createTask(accessToken, {
        description: taskForm.description.trim() || undefined,
        dueDate: toNoonIso(taskForm.dueDate),
        estimateMins: parsePositiveFloat(taskForm.estimateHours)
          ? Math.round(Number(taskForm.estimateHours) * 60)
          : undefined,
        priority: taskForm.priority,
        projectId: sprint.projectId,
        sprintId: sprint.id,
        status: taskForm.status,
        storyPoints: parsePositiveInt(taskForm.storyPoints) ?? undefined,
        title: taskForm.title.trim(),
        type: taskForm.type,
      });
      setSheet(null);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create sprint task.");
    } finally {
      setSaving(false);
    }
  }

  async function addSelectedTasks() {
    if (!accessToken || !sprint || !selectedTaskIds.length) return;
    setSaving(true);
    setError("");
    try {
      await addSprintTasks(accessToken, sprint.id, selectedTaskIds);
      setSheet(null);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add tasks to sprint.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRetrospective() {
    if (!accessToken || !sprint) return;
    const body = {
      actionItems: retroForm.actionItems
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((title) => ({ title })),
      improve: retroForm.improve.trim() || undefined,
      wentWell: retroForm.wentWell.trim() || undefined,
    };

    if (!body.wentWell && !body.improve && !body.actionItems.length) return;

    setSaving(true);
    setError("");
    try {
      if (retroEditingId) {
        await updateSprintRetrospective(accessToken, sprint.id, retroEditingId, body);
      } else {
        await createSprintRetrospective(accessToken, sprint.id, body);
      }
      setSheet(null);
      setRetroEditingId(null);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save retrospective.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStartSprint() {
    if (!accessToken || !sprint) return;
    setSaving(true);
    setError("");
    try {
      await startSprint(accessToken, sprint.id);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start sprint.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteSprint() {
    if (!accessToken || !sprint) return;
    setSaving(true);
    setError("");
    try {
      await completeSprint(accessToken, sprint.id, { moveIncompleteToBacklog: true });
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete sprint.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteSprint() {
    if (!accessToken || !sprint) return;
    if (!canDeleteSprint(sprint, tasks.length, retrospectives.length)) {
      setError("Only planned sprints with no tasks, meetings, or retrospective notes can be deleted.");
      return;
    }

    Alert.alert("Delete sprint?", `Delete "${sprint.name}"? This only works for planned sprints with no owned records.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            setError("");
            try {
              await deleteSprint(accessToken, sprint.id);
              router.replace("/(workspace)/sprints");
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete sprint.");
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  function confirmRemoveTask(task: Task) {
    if (!accessToken || !sprint) return;
    Alert.alert("Remove from sprint?", `"${task.title}" will move out of this sprint.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await removeSprintTask(accessToken, sprint.id, task.id);
              await load(true);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to remove task.");
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  function confirmDeleteRetrospective(retrospective: SprintRetrospective) {
    if (!accessToken || !sprint) return;
    Alert.alert("Delete retrospective?", "This will remove the sprint retrospective note.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await deleteSprintRetrospective(accessToken, sprint.id, retrospective.id);
              await load(true);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete retrospective.");
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerPanel}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading sprint…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!sprint) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerPanel}>
          <Text style={styles.emptyTitle}>Sprint not found</Text>
          {error ? <Text style={styles.mutedCenter}>{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const heroStyle =
    state === "active"
      ? styles.heroActive
      : state === "completed"
        ? styles.heroCompleted
        : styles.heroPlanned;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── NAV BAR ── */}
        <View style={styles.navBar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={colors.foreground} size={16} strokeWidth={2.8} />
            <Text style={styles.backBtnText}>Sprints</Text>
          </Pressable>
          <View style={styles.navRight}>
            <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.navIconBtn}>
              <RefreshCw color={colors.foreground} size={18} strokeWidth={2.8} />
            </Pressable>
          </View>
        </View>

        {/* ── FEEDBACK ── */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {saving ? (
          <View style={styles.savingPill}>
            <ActivityIndicator color={colors.foreground} size="small" />
            <Text style={styles.savingText}>Syncing sprint…</Text>
          </View>
        ) : null}

        {/* ── HERO PANEL ── */}
        <View style={[styles.heroPanel, heroStyle]}>
          <View style={styles.heroTop}>
            <StatusBadge state={state} />
            <View style={styles.heroActions}>
              <Pressable accessibilityRole="button" onPress={openEditSprint} style={styles.darkIconBtn}>
                <Edit3 color={colors.white} size={17} strokeWidth={2.7} />
              </Pressable>
              {canDeleteSprint(sprint, tasks.length, retrospectives.length) ? (
                <Pressable accessibilityRole="button" onPress={confirmDeleteSprint} style={styles.darkIconBtn}>
                  <Trash2 color={colors.white} size={17} strokeWidth={2.7} />
                </Pressable>
              ) : null}
              {state === "planned" ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void handleStartSprint()}
                  style={[styles.heroActionBtn, saving && styles.disabledAction]}
                >
                  <Play color={colors.black} size={15} strokeWidth={3} />
                  <Text style={styles.heroActionText}>Start</Text>
                </Pressable>
              ) : null}
              {state === "active" ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void handleCompleteSprint()}
                  style={[styles.heroActionBtn, saving && styles.disabledAction]}
                >
                  <CheckCircle2 color={colors.black} size={15} strokeWidth={3} />
                  <Text style={styles.heroActionText}>Complete</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <Text style={styles.heroTitle}>{sprint.name}</Text>
          {sprint.goal ? <Text style={styles.heroGoal}>{sprint.goal}</Text> : null}

          <View style={styles.heroMetaRow}>
            <HeroMeta icon={<Flag color="rgba(255,255,255,0.75)" size={13} strokeWidth={2.5} />} text={`${stats.total} tasks`} />
            <HeroMeta icon={<CheckCircle2 color="rgba(255,255,255,0.75)" size={13} strokeWidth={2.5} />} text={`${stats.percent}% done`} />
            <HeroMeta
              icon={<CalendarDays color="rgba(255,255,255,0.75)" size={13} strokeWidth={2.5} />}
              text={`${formatCompactDate(sprint.startDate)} – ${formatCompactDate(sprint.endDate)}`}
            />
          </View>

          <View style={styles.heroProgressTrack}>
            <View
              style={{
                flex: Math.max(stats.percent, 0.01),
                height: 8,
                backgroundColor: colors.success,
                borderRadius: 99,
              }}
            />
            <View style={{ flex: Math.max(100 - stats.percent, 0.01), height: 8 }} />
          </View>
        </View>

        {/* ── STATS STRIP ── */}
        <View style={styles.statsStrip}>
          <SprintStat
            label="Open"
            textColor={colors.accent}
            tint={colors.blueSoft}
            value={stats.open}
          />
          <SprintStat
            label="Done"
            textColor={colors.success}
            tint={colors.greenSoft}
            value={stats.done}
          />
          <SprintStat
            label="Points"
            textColor={colors.primaryDark}
            tint={colors.yellowSoft}
            value={stats.points}
          />
          <SprintStat
            label="Blocked"
            textColor={stats.blocked > 0 ? colors.danger : colors.inkSoft}
            tint={stats.blocked > 0 ? colors.redSoft : colors.panelMuted}
            value={stats.blocked}
          />
        </View>

        {/* ── ACTION RAIL ── */}
        <View style={styles.actionRail}>
          <Pressable accessibilityRole="button" onPress={openCreateTask} style={styles.brandBtn}>
            <Plus color={colors.black} size={17} strokeWidth={3} />
            <Text style={styles.brandBtnText}>Create task</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={openAddTasks} style={styles.secondaryBtn}>
            <Link2 color={colors.foreground} size={16} strokeWidth={2.7} />
            <Text style={styles.secondaryBtnText}>Add existing</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => openRetrospective()} style={styles.secondaryBtn}>
            <MessageSquare color={colors.foreground} size={16} strokeWidth={2.7} />
            <Text style={styles.secondaryBtnText}>Retro</Text>
          </Pressable>
        </View>

        {/* ── BURNDOWN ── */}
        {burndown ? <BurndownPanel burndown={burndown} /> : null}

        {/* ── STATUS BREAKDOWN ── */}
        {statusGroups.length > 0 ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}>
              <Text style={styles.sectionEyebrow}>Sprint health</Text>
              <Text style={styles.sectionTitle}>Status breakdown</Text>
            </View>
            <View style={styles.statusBars}>
              {statusGroups.map((item) => {
                const pct = stats.total > 0 ? item.count / stats.total : 0;
                const color = statusColor(item.status);
                return (
                  <View key={item.status} style={styles.statusBarRow}>
                    <Text style={styles.statusBarLabel}>{humanStatus(item.status)}</Text>
                    <View style={styles.statusBarTrack}>
                      <View
                        style={{
                          flex: Math.max(pct, 0.001),
                          height: 6,
                          backgroundColor: color,
                          borderRadius: 99,
                        }}
                      />
                      <View style={{ flex: Math.max(1 - pct, 0.001), height: 6 }} />
                    </View>
                    <Text style={[styles.statusBarCount, { color }]}>{item.count}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ── SPRINT TASKS ── */}
        <View style={styles.taskSectionHeader}>
          <Text style={styles.sectionTitle}>Sprint tasks</Text>
          <Text style={styles.sectionMeta}>
            {filteredTasks.length}/{tasks.length} work items
          </Text>
        </View>

        <View style={styles.taskToolbarCard}>
          <View style={styles.taskSearchBar}>
            <Search color={colors.inkSoft} size={17} strokeWidth={2.5} />
            <TextInput
              onChangeText={setTaskSearch}
              placeholder="Search sprint tasks"
              placeholderTextColor={colors.inkSoft}
              style={styles.taskSearchInput}
              value={taskSearch}
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.filterChipRail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <ChoiceChip
              active={taskStatusFilter === "ALL"}
              label="All"
              onPress={() => setTaskStatusFilter("ALL")}
            />
            {taskStatuses.map((status) => (
              <ChoiceChip
                active={taskStatusFilter === status}
                key={status}
                label={humanStatus(status)}
                onPress={() => setTaskStatusFilter(status)}
              />
            ))}
          </ScrollView>
        </View>

        {filteredTasks.length ? (
          <View style={styles.taskCards}>
            {filteredTasks.map((task) => (
              <SprintTaskCard
                key={task.id}
                onOpen={() =>
                  router.push({
                    pathname: "/(workspace)/tasks/[taskId]",
                    params: { returnTo: `/(workspace)/sprints/${sprintId}`, taskId: task.id },
                  })
                }
                onRemove={() => confirmRemoveTask(task)}
                task={task}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <CheckSquare2 color={colors.inkSoft} size={28} strokeWidth={2.5} />
            <Text style={styles.emptyTitle}>No tasks in this sprint</Text>
            <Text style={styles.emptyMeta}>
              {tasks.length
                ? "No sprint tasks match the current filters."
                : "Create a sprint task or add existing project tasks to start planning."}
            </Text>
          </View>
        )}

        {/* ── RETROSPECTIVES ── */}
        <View style={styles.retroSectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Learning loop</Text>
            <Text style={styles.sectionTitle}>Retrospectives</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => openRetrospective()}
            style={styles.retroNewBtn}
          >
            <Plus color={colors.black} size={15} strokeWidth={3} />
            <Text style={styles.retroNewBtnText}>New</Text>
          </Pressable>
        </View>

        {retrospectives.length ? (
          <View style={styles.retroCards}>
            {retrospectives.map((retro) => (
              <Pressable
                accessibilityRole="button"
                key={retro.id}
                onPress={() => openRetrospective(retro)}
                style={styles.retroCard}
              >
                <View style={styles.retroCardIcon}>
                  <MessageSquare color={colors.primaryDark} size={16} strokeWidth={2.7} />
                </View>
                <View style={styles.retroCardBody}>
                  <Text numberOfLines={2} style={styles.retroCardTitle}>
                    {retro.wentWell || retro.improve || "Sprint retrospective"}
                  </Text>
                  {retro.improve ? (
                    <Text numberOfLines={1} style={styles.retroCardMeta}>
                      Improve: {retro.improve}
                    </Text>
                  ) : null}
                  {Array.isArray(retro.actionItems) && retro.actionItems.length > 0 ? (
                    <Text style={styles.retroCardActions}>
                      {retro.actionItems.length} action item
                      {retro.actionItems.length === 1 ? "" : "s"}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => confirmDeleteRetrospective(retro)}
                  style={styles.retroDeleteBtn}
                >
                  <Trash2 color={colors.danger} size={16} strokeWidth={2.7} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <MessageSquare color={colors.inkSoft} size={28} strokeWidth={2.5} />
            <Text style={styles.emptyTitle}>No retrospective yet</Text>
            <Text style={styles.emptyMeta}>
              Capture wins, improvements, and action items before closing the loop.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── SHEETS ── */}
      <SprintEditSheet
        form={sprintForm}
        onChange={setSprintForm}
        onClose={() => setSheet(null)}
        onSave={() => void saveSprint()}
        saving={saving}
        visible={sheet === "editSprint"}
      />
      <SprintTaskSheet
        form={taskForm}
        onChange={setTaskForm}
        onClose={() => setSheet(null)}
        onSave={() => void saveTask()}
        saving={saving}
        visible={sheet === "createTask"}
      />
      <AddTasksSheet
        onClose={() => setSheet(null)}
        onSave={() => void addSelectedTasks()}
        onToggle={(taskId) =>
          setSelectedTaskIds((current) =>
            current.includes(taskId)
              ? current.filter((id) => id !== taskId)
              : [...current, taskId],
          )
        }
        saving={saving}
        selectedTaskIds={selectedTaskIds}
        tasks={backlogTasks}
        visible={sheet === "addTasks"}
      />
      <RetrospectiveSheet
        form={retroForm}
        isEditing={Boolean(retroEditingId)}
        onChange={setRetroForm}
        onClose={() => {
          setSheet(null);
          setRetroEditingId(null);
        }}
        onSave={() => void saveRetrospective()}
        saving={saving}
        visible={sheet === "retrospective"}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: "active" | "completed" | "planned" }) {
  const label =
    state === "active" ? "Active" : state === "completed" ? "Completed" : "Planned";
  const dotActive = state === "active" ? styles.liveDotGreen : null;
  return (
    <View style={styles.statusBadge}>
      <View style={[styles.liveDot, dotActive]} />
      <Text style={styles.statusBadgeText}>{label}</Text>
    </View>
  );
}

function HeroMeta({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.heroMeta}>
      {icon}
      <Text style={styles.heroMetaText}>{text}</Text>
    </View>
  );
}

function SprintStat({
  label,
  textColor,
  tint,
  value,
}: {
  label: string;
  textColor: string;
  tint: string;
  value: number;
}) {
  return (
    <View style={[styles.sprintStat, { backgroundColor: tint }]}>
      <Text style={[styles.sprintStatValue, { color: textColor }]}>{value}</Text>
      <Text style={[styles.sprintStatLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function BurndownPanel({ burndown }: { burndown: SprintBurndown }) {
  const points = burndown.series.slice(-10);
  const maxRemaining = Math.max(1, ...points.map((p) => p.remainingPoints));
  const donePercent = burndown.totalPoints
    ? Math.round((burndown.pointsDone / burndown.totalPoints) * 100)
    : 0;

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>Velocity</Text>
          <Text style={styles.sectionTitle}>Burndown</Text>
        </View>
        <View style={styles.burndownBadge}>
          <TrendingDown color={colors.success} size={16} strokeWidth={2.7} />
          <Text style={styles.burndownBadgeText}>{donePercent}% done</Text>
        </View>
      </View>

      <View style={styles.burndownSummary}>
        <MiniSignal
          icon={<BarChart3 color={colors.foreground} size={16} strokeWidth={2.7} />}
          label="Total pts"
          value={burndown.totalPoints}
        />
        <MiniSignal
          icon={<CheckCircle2 color={colors.success} size={16} strokeWidth={2.7} />}
          label="Done pts"
          value={burndown.pointsDone}
        />
        <MiniSignal
          icon={<CheckSquare2 color={colors.accent} size={16} strokeWidth={2.7} />}
          label="Tasks"
          value={burndown.totalTasks}
        />
      </View>

      {points.length ? (
        <View style={styles.burndownChart}>
          {points.map((point) => {
            const h = Math.max(10, Math.round((point.remainingPoints / maxRemaining) * 92));
            return (
              <View key={point.date} style={styles.burndownColumn}>
                <View style={[styles.burndownBar, { height: h }]} />
                <Text style={styles.burndownDate}>{point.date.slice(5)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function MiniSignal({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <View style={styles.miniSignal}>
      {icon}
      <View style={styles.miniSignalText}>
        <Text style={styles.miniSignalValue}>{value}</Text>
        <Text style={styles.miniSignalLabel}>{label}</Text>
      </View>
    </View>
  );
}

function SprintTaskCard({
  onOpen,
  onRemove,
  task,
}: {
  onOpen: () => void;
  onRemove: () => void;
  task: Task;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.taskCard, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.taskCardRail, { backgroundColor: priorityColor(task.priority) }]} />
      <View style={styles.taskCardBody}>
        <View style={styles.taskCardTitleRow}>
          <Text numberOfLines={1} style={styles.taskCardTitle}>
            {task.title}
          </Text>
          <Text style={styles.taskCardKey}>{task.key ?? task.id.slice(0, 6).toUpperCase()}</Text>
        </View>
        <View style={styles.taskCardPills}>
          <StatusPill label={humanStatus(task.status)} tone={statusTone(task.status)} />
          <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} />
          <Text style={styles.taskCardAssignee}>
            {displayUserName(task.assignees?.[0]?.user ?? task.card?.assignees[0])}
          </Text>
        </View>
        <Text style={styles.taskCardMeta}>
          {humanStatus(task.type)} · {task.storyPoints ?? 0} pts · {formatCompactDate(task.dueDate)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={onRemove}
        style={styles.taskRemoveBtn}
      >
        <Trash2 color={colors.danger} size={16} strokeWidth={2.7} />
      </Pressable>
    </Pressable>
  );
}

// ── Sheets ────────────────────────────────────────────────────────────────────

function SprintEditSheet({
  form,
  onChange,
  onClose,
  onSave,
  saving,
  visible,
}: {
  form: SprintFormState;
  onChange: (next: SprintFormState) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  visible: boolean;
}) {
  const [datePicker, setDatePicker] = useState<"endDate" | "startDate" | null>(null);

  function selectDate(value: string) {
    if (!datePicker) return;
    onChange({ ...form, [datePicker]: value });
    setDatePicker(null);
  }

  return (
    <BaseSheet onClose={onClose} title="Edit sprint" visible={visible}>
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <Field label="Sprint name">
          <TextInput
            onChangeText={(name) => onChange({ ...form, name })}
            placeholder="Sprint name"
            placeholderTextColor="#8c887f"
            style={styles.input}
            value={form.name}
          />
        </Field>
        <Field label="Goal">
          <TextInput
            multiline
            onChangeText={(goal) => onChange({ ...form, goal })}
            placeholder="Sprint goal"
            placeholderTextColor="#8c887f"
            style={[styles.input, styles.textArea]}
            value={form.goal}
          />
        </Field>
        <View style={styles.formGrid}>
          <View style={styles.dateGridItem}>
            <ProjectDateField
              helperText="Sprint kickoff"
              label="Start"
              onClear={() => onChange({ ...form, startDate: "" })}
              onPress={() => setDatePicker("startDate")}
              placeholder="Choose start"
              value={form.startDate}
            />
          </View>
          <View style={styles.dateGridItem}>
            <ProjectDateField
              helperText="Target close"
              label="End"
              onClear={() => onChange({ ...form, endDate: "" })}
              onPress={() => setDatePicker("endDate")}
              placeholder="Choose end"
              value={form.endDate}
            />
          </View>
        </View>
      </ScrollView>
      <SheetActions
        disabled={saving || !form.name.trim()}
        onClose={onClose}
        onSave={onSave}
        saveLabel={saving ? "Saving…" : "Save sprint"}
      />
      <ProjectDatePickerSheet
        onClose={() => setDatePicker(null)}
        onSelect={selectDate}
        title={datePicker === "startDate" ? "Sprint start" : "Sprint end"}
        value={datePicker === "startDate" ? form.startDate : form.endDate}
        visible={datePicker !== null}
      />
    </BaseSheet>
  );
}

function SprintTaskSheet({
  form,
  onChange,
  onClose,
  onSave,
  saving,
  visible,
}: {
  form: TaskFormState;
  onChange: (next: TaskFormState) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  visible: boolean;
}) {
  const [datePicker, setDatePicker] = useState(false);

  return (
    <BaseSheet onClose={onClose} title="Create sprint task" visible={visible}>
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <Field label="Title">
          <TextInput
            autoFocus
            onChangeText={(title) => onChange({ ...form, title })}
            placeholder="Write a clear task title"
            placeholderTextColor="#8c887f"
            style={styles.input}
            value={form.title}
          />
        </Field>
        <Field label="Description">
          <TextInput
            multiline
            onChangeText={(description) => onChange({ ...form, description })}
            placeholder="Acceptance notes, context, or links"
            placeholderTextColor="#8c887f"
            style={[styles.input, styles.textArea]}
            value={form.description}
          />
        </Field>
        <Field label="Status">
          <ScrollView contentContainerStyle={styles.choiceRow} horizontal showsHorizontalScrollIndicator={false}>
            {taskStatuses.map((status) => (
              <ChoiceChip
                active={form.status === status}
                key={status}
                label={humanStatus(status)}
                onPress={() => onChange({ ...form, status })}
              />
            ))}
          </ScrollView>
        </Field>
        <Field label="Priority">
          <ScrollView contentContainerStyle={styles.choiceRow} horizontal showsHorizontalScrollIndicator={false}>
            {taskPriorities.map((priority) => (
              <ChoiceChip
                active={form.priority === priority}
                key={priority}
                label={humanPriority(priority)}
                onPress={() => onChange({ ...form, priority })}
              />
            ))}
          </ScrollView>
        </Field>
        <Field label="Type">
          <ScrollView contentContainerStyle={styles.choiceRow} horizontal showsHorizontalScrollIndicator={false}>
            {taskTypes.map((type) => (
              <ChoiceChip
                active={form.type === type}
                key={type}
                label={humanStatus(type)}
                onPress={() => onChange({ ...form, type })}
              />
            ))}
          </ScrollView>
        </Field>
        <View style={styles.formGrid}>
          <View style={styles.dateGridItem}>
            <ProjectDateField
              helperText="Task due date"
              label="Due date"
              onClear={() => onChange({ ...form, dueDate: "" })}
              onPress={() => setDatePicker(true)}
              placeholder="Choose due date"
              value={form.dueDate}
            />
          </View>
          <Field label="Points">
            <TextInput
              keyboardType="number-pad"
              onChangeText={(storyPoints) => onChange({ ...form, storyPoints })}
              placeholder="0"
              placeholderTextColor="#8c887f"
              style={styles.input}
              value={form.storyPoints}
            />
          </Field>
        </View>
        <Field label="Estimate hours">
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={(estimateHours) => onChange({ ...form, estimateHours })}
            placeholder="0"
            placeholderTextColor="#8c887f"
            style={styles.input}
            value={form.estimateHours}
          />
        </Field>
      </ScrollView>
      <SheetActions
        disabled={saving || !form.title.trim()}
        onClose={onClose}
        onSave={onSave}
        saveLabel={saving ? "Saving…" : "Create task"}
      />
      <ProjectDatePickerSheet
        onClose={() => setDatePicker(false)}
        onSelect={(dueDate) => {
          onChange({ ...form, dueDate });
          setDatePicker(false);
        }}
        title="Task due date"
        value={form.dueDate}
        visible={datePicker}
      />
    </BaseSheet>
  );
}

function AddTasksSheet({
  onClose,
  onSave,
  onToggle,
  saving,
  selectedTaskIds,
  tasks,
  visible,
}: {
  onClose: () => void;
  onSave: () => void;
  onToggle: (taskId: string) => void;
  saving: boolean;
  selectedTaskIds: string[];
  tasks: Task[];
  visible: boolean;
}) {
  return (
    <BaseSheet onClose={onClose} title="Add existing tasks" visible={visible}>
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        {tasks.length ? (
          tasks.map((task) => {
            const selected = selectedTaskIds.includes(task.id);
            return (
              <Pressable
                accessibilityRole="button"
                key={task.id}
                onPress={() => onToggle(task.id)}
                style={[styles.pickRow, selected && styles.pickRowActive]}
              >
                <View style={[styles.checkBox, selected && styles.checkBoxActive]}>
                  {selected ? <CheckCircle2 color={colors.black} size={15} strokeWidth={3} /> : null}
                </View>
                <View style={styles.pickText}>
                  <Text numberOfLines={1} style={styles.pickTitle}>{task.title}</Text>
                  <Text style={styles.pickMeta}>
                    {task.key ?? task.id.slice(0, 6).toUpperCase()} – {humanStatus(task.status)}
                  </Text>
                </View>
                <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} />
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No available tasks</Text>
            <Text style={styles.emptyMeta}>
              All loaded project tasks are already assigned to this sprint.
            </Text>
          </View>
        )}
      </ScrollView>
      <SheetActions
        disabled={saving || selectedTaskIds.length === 0}
        onClose={onClose}
        onSave={onSave}
        saveLabel={saving ? "Adding…" : `Add ${selectedTaskIds.length}`}
      />
    </BaseSheet>
  );
}

function RetrospectiveSheet({
  form,
  isEditing,
  onChange,
  onClose,
  onSave,
  saving,
  visible,
}: {
  form: RetroFormState;
  isEditing: boolean;
  onChange: (next: RetroFormState) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  visible: boolean;
}) {
  const canSave = Boolean(form.wentWell.trim() || form.improve.trim() || form.actionItems.trim());

  return (
    <BaseSheet
      onClose={onClose}
      title={isEditing ? "Edit retrospective" : "New retrospective"}
      visible={visible}
    >
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <Field label="What went well">
          <TextInput
            multiline
            onChangeText={(wentWell) => onChange({ ...form, wentWell })}
            placeholder="Wins, delivery patterns, useful decisions"
            placeholderTextColor="#8c887f"
            style={[styles.input, styles.largeTextArea]}
            value={form.wentWell}
          />
        </Field>
        <Field label="What should improve">
          <TextInput
            multiline
            onChangeText={(improve) => onChange({ ...form, improve })}
            placeholder="Bottlenecks, risk signals, planning gaps"
            placeholderTextColor="#8c887f"
            style={[styles.input, styles.largeTextArea]}
            value={form.improve}
          />
        </Field>
        <Field label="Action items">
          <TextInput
            multiline
            onChangeText={(actionItems) => onChange({ ...form, actionItems })}
            placeholder={"One action per line\nTighten QA checklist\nConfirm release owner"}
            placeholderTextColor="#8c887f"
            style={[styles.input, styles.largeTextArea]}
            value={form.actionItems}
          />
        </Field>
      </ScrollView>
      <SheetActions
        disabled={saving || !canSave}
        onClose={onClose}
        onSave={onSave}
        saveLabel={
          saving ? "Saving…" : isEditing ? "Save retro" : "Create retro"
        }
      />
    </BaseSheet>
  );
}

function BaseSheet({
  children,
  onClose,
  title,
  visible,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  if (!visible) return null;
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
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
                <X color={colors.foreground} size={20} strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetActions({
  disabled,
  onClose,
  onSave,
  saveLabel,
}: {
  disabled: boolean;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <View style={styles.sheetActions}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onSave}
        style={[styles.saveButton, disabled && styles.disabledAction]}
      >
        <Text style={styles.saveButtonText}>{saveLabel}</Text>
      </Pressable>
    </View>
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

function ChoiceChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.choiceChip, active && styles.choiceChipActive]}
    >
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

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

function emptyTaskForm(): TaskFormState {
  return {
    description: "",
    dueDate: "",
    estimateHours: "",
    priority: "MEDIUM",
    status: "TODO",
    storyPoints: "",
    title: "",
    type: "TASK",
  };
}

function emptyRetroForm(): RetroFormState {
  return { actionItems: "", improve: "", wentWell: "" };
}

function retroToForm(r: SprintRetrospective): RetroFormState {
  return {
    actionItems: actionItemsToText(r.actionItems),
    improve: r.improve ?? "",
    wentWell: r.wentWell ?? "",
  };
}

function actionItemsToText(actionItems?: unknown[] | null) {
  if (!Array.isArray(actionItems)) return "";
  return actionItems
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "title" in item) {
        const t = (item as { title?: unknown }).title;
        return typeof t === "string" ? t : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function sprintState(sprint: Sprint | null): "active" | "completed" | "planned" {
  if (sprint?.completedAt) return "completed";
  if (!sprint?.startDate) return "planned";
  const start = new Date(String(sprint.startDate)).getTime();
  if (Number.isFinite(start) && start > Date.now()) return "planned";
  return "active";
}

function canDeleteSprint(sprint: Sprint, taskCount: number, retrospectiveCount: number) {
  const counts = sprint._count as (Sprint["_count"] & { meetings?: number }) | undefined;
  return (
    sprintState(sprint) === "planned" &&
    taskCount === 0 &&
    retrospectiveCount === 0 &&
    (counts?.meetings ?? 0) === 0
  );
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

function parsePositiveFloat(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function statusColor(status: Task["status"]) {
  if (status === "DONE") return colors.success;
  if (status === "IN_PROGRESS") return colors.accent;
  if (status === "REVIEW" || status === "TESTING") return "#7c3aed";
  if (status === "CANCELLED") return colors.danger;
  if (status === "BACKLOG") return "#8b8f9a";
  return colors.primaryDark;
}

function priorityColor(priority: Task["priority"]) {
  if (priority === "CRITICAL") return colors.danger;
  if (priority === "URGENT") return "#f97316";
  if (priority === "HIGH") return colors.primaryDark;
  if (priority === "LOW") return "#8b8f9a";
  return colors.accent;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 18, padding: 20, paddingBottom: 120 },

  centerPanel: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center", padding: 24 },
  loadingText: { color: colors.inkSoft, fontSize: 14, fontWeight: "700" },

  // ── NavBar ──
  navBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  backBtn: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadow.card,
  },
  backBtnText: { color: colors.foreground, fontSize: 14, fontWeight: "800" },
  navRight: { alignItems: "center", flexDirection: "row", gap: 8 },
  navIconBtn: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
    ...shadow.card,
  },

  // ── Feedback ──
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 14,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "800", lineHeight: 18 },
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

  // ── Hero Panel ──
  heroPanel: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    overflow: "hidden",
    padding: 22,
  },
  heroActive: { backgroundColor: "#0b1710", borderColor: "rgba(16,185,129,0.25)" },
  heroPlanned: { backgroundColor: "#0b1426", borderColor: "rgba(96,165,250,0.25)" },
  heroCompleted: { backgroundColor: "#120b2a", borderColor: "rgba(124,58,237,0.25)" },
  heroTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  statusBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusBadgeText: { color: colors.white, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  liveDot: { backgroundColor: colors.accent, borderRadius: 999, height: 8, width: 8 },
  liveDotGreen: { backgroundColor: colors.success },
  heroActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  darkIconBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  heroActionBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
  },
  heroActionText: { color: colors.black, fontSize: 13, fontWeight: "900" },
  heroTitle: { color: colors.white, fontSize: 26, fontWeight: "900", letterSpacing: -0.3 },
  heroGoal: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "700", lineHeight: 21 },
  heroMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroMeta: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroMetaText: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "800" },
  heroProgressTrack: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    flexDirection: "row",
    height: 8,
    overflow: "hidden",
  },

  // ── Stats Strip ──
  statsStrip: { flexDirection: "row", gap: 8 },
  sprintStat: {
    alignItems: "center",
    borderRadius: radii.xl,
    flex: 1,
    gap: 4,
    justifyContent: "center",
    paddingVertical: 16,
    ...shadow.card,
  },
  sprintStatValue: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  sprintStatLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },

  // ── Action Rail ──
  actionRail: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  brandBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    flexBasis: "100%",
    flexDirection: "row",
    flexGrow: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 52,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  brandBtnText: { color: colors.black, fontSize: 14, fontWeight: "900" },
  secondaryBtn: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 52,
    ...shadow.card,
  },
  secondaryBtnText: { color: colors.foreground, fontSize: 13, fontWeight: "900" },

  // ── Section Card ──
  sectionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 16,
    padding: 18,
    ...shadow.card,
  },
  sectionCardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionEyebrow: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionTitle: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  sectionMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "800" },

  // ── Burndown ──
  burndownBadge: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  burndownBadgeText: { color: colors.success, fontSize: 12, fontWeight: "900" },
  burndownSummary: { flexDirection: "row", gap: 8 },
  miniSignal: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 10,
  },
  miniSignalText: { flex: 1, minWidth: 0 },
  miniSignalValue: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  miniSignalLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  burndownChart: {
    alignItems: "flex-end",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 142,
    padding: 14,
  },
  burndownColumn: { alignItems: "center", flex: 1, gap: 8, justifyContent: "flex-end" },
  burndownBar: { backgroundColor: colors.accent, borderRadius: 999, width: 16 },
  burndownDate: { color: colors.inkSoft, fontSize: 9, fontWeight: "900" },

  // ── Status Breakdown ──
  statusBars: { gap: 12 },
  statusBarRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  statusBarLabel: { color: colors.foreground, fontSize: 13, fontWeight: "800", width: 88 },
  statusBarTrack: {
    backgroundColor: colors.line,
    borderRadius: 99,
    flex: 1,
    flexDirection: "row",
    height: 6,
    overflow: "hidden",
  },
  statusBarCount: { fontSize: 13, fontWeight: "900", textAlign: "right", width: 22 },

  // ── Task Section ──
  taskSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  taskToolbarCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 12,
    padding: 14,
    ...shadow.card,
  },
  taskSearchBar: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  taskSearchInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 0,
  },
  filterChipRail: { gap: 8, paddingRight: 4 },

  // ── Task Cards ──
  taskCards: { gap: 10 },
  taskCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    ...shadow.card,
  },
  taskCardRail: { alignSelf: "stretch", width: 4 },
  taskCardBody: { flex: 1, gap: 7, minWidth: 0, paddingLeft: 14, paddingVertical: 14 },
  taskCardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  taskCardTitle: { color: colors.foreground, flex: 1, fontSize: 15, fontWeight: "800" },
  taskCardKey: { color: colors.inkSoft, fontSize: 11, fontWeight: "800" },
  taskCardPills: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  taskCardAssignee: { color: colors.inkSoft, fontSize: 12, fontWeight: "800" },
  taskCardMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },
  taskRemoveBtn: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderRadius: 14,
    height: 38,
    justifyContent: "center",
    marginRight: 12,
    width: 38,
  },

  // ── Retro ──
  retroSectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  retroNewBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  retroNewBtnText: { color: colors.black, fontSize: 13, fontWeight: "900" },
  retroCards: { gap: 10 },
  retroCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16,
    ...shadow.card,
  },
  retroCardIcon: {
    alignItems: "center",
    backgroundColor: colors.yellowSoft,
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  retroCardBody: { flex: 1, gap: 5, minWidth: 0 },
  retroCardTitle: { color: colors.foreground, fontSize: 14, fontWeight: "800", lineHeight: 20 },
  retroCardMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },
  retroCardActions: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  retroDeleteBtn: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderRadius: 14,
    height: 38,
    justifyContent: "center",
    width: 38,
  },

  // ── Empty states ──
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 10,
    padding: 36,
    ...shadow.card,
  },
  emptyTitle: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  emptyMeta: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", textAlign: "center" },
  mutedCenter: { color: colors.inkSoft, fontSize: 14, fontWeight: "700", textAlign: "center" },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  primaryBtnText: { color: colors.black, fontSize: 14, fontWeight: "900" },

  disabledAction: { opacity: 0.45 },

  // ── Choice Chip ──
  choiceChip: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 13,
  },
  choiceChipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  choiceChipText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800" },
  choiceChipTextActive: { color: colors.white },
  choiceRow: { gap: 8, paddingRight: 16 },

  // ── Sheet ──
  modalBackdrop: { backgroundColor: "rgba(16,16,15,0.28)", flex: 1, justifyContent: "flex-end" },
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
  sheetTitle: { color: colors.foreground, fontSize: 20, fontWeight: "900" },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sheetContent: { gap: 15, padding: 18 },
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

  // ── Form ──
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
  largeTextArea: { minHeight: 120, paddingTop: 14, textAlignVertical: "top" },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  dateGridItem: { flex: 1, minWidth: "48%" },

  // ── Pick rows (add tasks sheet) ──
  pickRow: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 70,
    padding: 13,
  },
  pickRowActive: { backgroundColor: colors.yellowSoft, borderColor: colors.primaryDark },
  pickText: { flex: 1, minWidth: 0 },
  pickTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  pickMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", marginTop: 3 },
  checkBox: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  checkBoxActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
});
