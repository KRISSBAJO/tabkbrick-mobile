import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, FilterX, List, Plus, Search, Table2, X } from "lucide-react-native";
import { InlineDateRollerPicker, RollerDateField } from "@/components/ui/RollerDatePicker";
import { StatusPill } from "@/components/ui/StatusPill";
import { createTask, getProjectBoard, listProjects, listTasks, updateTaskOrder } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Project, ProjectBoard, Task } from "@/lib/types";
import {
  activeFilterCount,
  displayUserName,
  dueFilterValues,
  emptyTaskFilters,
  filterTasksByControls,
  formatCompactDate,
  humanPriority,
  humanStatus,
  ownerFilterValues,
  priorityFilterValues,
  priorityTone,
  statusFilterValues,
  statusTone,
  taskPriorities,
  taskStatuses,
  taskTypes,
  type TaskPriority,
  type TaskFilters,
  type TaskStatus,
  type TaskType,
} from "./taskFilters";

type ViewMode = "list" | "table";
type BoardColumnChoice = {
  boardColumnId: string | null;
  id: string;
  label: string;
  status: TaskStatus;
};
type CreateTaskForm = {
  columnId: string;
  description: string;
  dueDate: string;
  estimateHours: string;
  priority: TaskPriority;
  projectId: string;
  status: TaskStatus;
  storyPoints: string;
  title: string;
  type: TaskType;
};

const fallbackColumns: BoardColumnChoice[] = [
  { boardColumnId: null, id: "fallback-BACKLOG", label: "Backlog", status: "BACKLOG" },
  { boardColumnId: null, id: "fallback-TODO", label: "To Do", status: "TODO" },
  { boardColumnId: null, id: "fallback-IN_PROGRESS", label: "In Progress", status: "IN_PROGRESS" },
  { boardColumnId: null, id: "fallback-REVIEW", label: "Review", status: "REVIEW" },
];

export function TaskListScreen() {
  const { accessToken } = useAuthSession();
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<TaskFilters>(emptyTaskFilters);
  const [loading, setLoading] = useState(true);
  const [projectBoards, setProjectBoards] = useState<Record<string, ProjectBoard | null>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState<CreateTaskForm>(emptyCreateTaskForm());
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [page, projectPage] = await Promise.all([
        listTasks(accessToken, { limit: 100, sortBy: "updatedAt", sortDirection: "desc" }),
        listProjects(accessToken, { limit: 50 }),
      ]);
      const nextProjects = Array.isArray(projectPage) ? projectPage : projectPage.data;
      setTasks(Array.isArray(page) ? page : page.data);
      setProjects(nextProjects);
      setCreateForm((current) => {
        if (current.projectId || !nextProjects[0]) return current;
        return { ...current, projectId: nextProjects[0].id };
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load tasks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const filteredTasks = useMemo(() => filterTasksByControls(tasks, filters), [filters, tasks]);
  const openCount = useMemo(() => tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status)).length, [tasks]);
  const pressureCount = useMemo(() => tasks.filter((t) => t.card?.flags.isBlocked || t.card?.flags.isOverdue).length, [tasks]);
  const selectedProject = useMemo(() => projects.find((project) => project.id === createForm.projectId) ?? projects[0] ?? null, [createForm.projectId, projects]);
  const createColumns = useMemo(() => buildColumnChoices(projectBoards[selectedProject?.id ?? ""]), [projectBoards, selectedProject?.id]);

  useEffect(() => {
    if (!accessToken || !selectedProject || projectBoards[selectedProject.id] !== undefined) return;
    let cancelled = false;
    void (async () => {
      const board = await safe(getProjectBoard(accessToken, selectedProject.id), null);
      if (cancelled) return;
      setProjectBoards((current) => ({ ...current, [selectedProject.id]: board }));
    })();
    return () => { cancelled = true; };
  }, [accessToken, projectBoards, selectedProject]);

  useEffect(() => {
    const projectId = selectedProject?.id ?? "";
    const firstColumn = createColumns[0] ?? fallbackColumns[0];
    if (!projectId || !firstColumn) return;
    setCreateForm((current) => {
      if (current.projectId === projectId && createColumns.some((column) => column.id === current.columnId)) return current;
      return {
        ...current,
        columnId: firstColumn.id,
        projectId,
        status: firstColumn.status,
      };
    });
  }, [createColumns, selectedProject?.id]);

  function openTask(task: Task) {
    router.push({ pathname: "/(workspace)/tasks/[taskId]", params: { returnTo: "/(workspace)/tasks", taskId: task.id } });
  }

  function openCreateTask() {
    setCreateError("");
    const project = selectedProject ?? projects[0] ?? null;
    const column = createColumns[0] ?? fallbackColumns[0];
    setCreateForm((current) => ({
      ...emptyCreateTaskForm(project?.id ?? ""),
      columnId: column?.id ?? "",
      priority: current.priority,
      status: column?.status ?? "TODO",
      type: current.type,
    }));
    setCreateOpen(true);
  }

  async function submitCreateTask() {
    if (!accessToken || !createForm.projectId || !createForm.title.trim()) return;
    const column = createColumns.find((item) => item.id === createForm.columnId) ?? createColumns[0] ?? fallbackColumns[0];
    setCreateSaving(true);
    setCreateError("");
    try {
      const created = await createTask(accessToken, {
        description: createForm.description.trim() || undefined,
        dueDate: cleanDate(createForm.dueDate) ?? undefined,
        estimateMins: parsePositiveFloat(createForm.estimateHours) ? Math.round(Number(createForm.estimateHours) * 60) : undefined,
        priority: createForm.priority,
        projectId: createForm.projectId,
        status: column?.status ?? createForm.status,
        storyPoints: parsePositiveInt(createForm.storyPoints) ?? undefined,
        title: createForm.title.trim(),
        type: createForm.type,
      });
      if (column) {
        await updateTaskOrder(accessToken, created.id, { boardColumnId: column.boardColumnId, sortOrder: 0, status: column.status });
      }
      setCreateOpen(false);
      setCreateForm(emptyCreateTaskForm(createForm.projectId));
      await load(true);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Unable to create task.");
    } finally {
      setCreateSaving(false);
    }
  }

  const patch = (p: Partial<TaskFilters>) => setFilters((cur) => ({ ...cur, ...p }));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)")} style={styles.backBtn}>
            <ArrowLeft color={colors.foreground} size={20} strokeWidth={2.8} />
          </Pressable>
          <View style={styles.headerMid}>
            <Text style={styles.headerTitle}>Tasks</Text>
            <Text style={styles.headerSub}>{openCount} open · {pressureCount} need attention</Text>
          </View>
          <Pressable accessibilityLabel="Create task" accessibilityRole="button" onPress={openCreateTask} style={styles.headerCreateBtn}>
            <Plus color={colors.black} size={22} strokeWidth={3} />
          </Pressable>
          <View style={styles.viewToggle}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setViewMode("list")}
              style={[styles.viewBtn, viewMode === "list" && styles.viewBtnActive]}
            >
              <List color={viewMode === "list" ? colors.white : colors.inkSoft} size={17} strokeWidth={2.5} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setViewMode("table")}
              style={[styles.viewBtn, viewMode === "table" && styles.viewBtnActive]}
            >
              <Table2 color={viewMode === "table" ? colors.white : colors.inkSoft} size={17} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        {/* ── SEARCH ── */}
        <View style={styles.searchBar}>
          <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
          <TextInput
            onChangeText={(search) => patch({ search })}
            placeholder="Search title, key, label…"
            placeholderTextColor={colors.inkSoft}
            style={styles.searchInput}
            value={filters.search}
          />
          {filters.search ? (
            <Pressable accessibilityRole="button" onPress={() => patch({ search: "" })} style={styles.searchClear}>
              <Text style={styles.searchClearText}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ── FILTER CHIPS ── */}
        <ScrollView contentContainerStyle={styles.filterRail} horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip
            active={Boolean(filters.priority)}
            label={filters.priority ? humanPriority(filters.priority) : "Priority"}
            onPress={() => patch({ priority: nextValue(priorityFilterValues, filters.priority) })}
          />
          <FilterChip
            active={Boolean(filters.status)}
            label={filters.status ? humanStatus(filters.status) : "Status"}
            onPress={() => patch({ status: nextValue(statusFilterValues, filters.status) })}
          />
          <FilterChip
            active={Boolean(filters.due)}
            label={filters.due ? humanStatus(filters.due) : "Due date"}
            onPress={() => patch({ due: nextValue(dueFilterValues, filters.due) })}
          />
          <FilterChip
            active={Boolean(filters.owner)}
            label={filters.owner ? humanStatus(filters.owner) : "Owner"}
            onPress={() => patch({ owner: nextValue(ownerFilterValues, filters.owner) })}
          />
          <FilterChip
            active={filters.blocked}
            label="Blocked"
            onPress={() => patch({ blocked: !filters.blocked })}
          />
          {activeFilterCount(filters) > 0 && (
            <Pressable accessibilityRole="button" onPress={() => setFilters(emptyTaskFilters)} style={styles.resetChip}>
              <FilterX color={colors.black} size={13} strokeWidth={2.8} />
              <Text style={styles.resetChipText}>Clear {activeFilterCount(filters)}</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* ── BODY ── */}
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Loading tasks…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Stats chips */}
            {tasks.length > 0 && (
              <View style={styles.statsRow}>
                <View style={[styles.statChip, { backgroundColor: colors.blueSoft }]}>
                  <Text style={[styles.statNum, { color: colors.accent }]}>{tasks.length}</Text>
                  <Text style={[styles.statLbl, { color: colors.accent }]}>Total</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: colors.greenSoft }]}>
                  <Text style={[styles.statNum, { color: colors.success }]}>{openCount}</Text>
                  <Text style={[styles.statLbl, { color: colors.success }]}>Open</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: pressureCount ? colors.redSoft : colors.panelMuted }]}>
                  <Text style={[styles.statNum, { color: pressureCount ? colors.danger : colors.inkSoft }]}>{pressureCount}</Text>
                  <Text style={[styles.statLbl, { color: pressureCount ? colors.danger : colors.inkSoft }]}>Urgent</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: colors.panelMuted }]}>
                  <Text style={[styles.statNum, { color: colors.inkSoft }]}>{filteredTasks.length}</Text>
                  <Text style={[styles.statLbl, { color: colors.inkSoft }]}>Showing</Text>
                </View>
              </View>
            )}

            {viewMode === "list" ? (
              <TaskListView onOpenTask={openTask} tasks={filteredTasks} />
            ) : (
              <TaskTableView onOpenTask={openTask} tasks={filteredTasks} />
            )}
          </>
        )}
      </ScrollView>
      <CreateTaskSheet
        columns={createColumns}
        error={createError}
        form={createForm}
        onChange={setCreateForm}
        onClose={() => setCreateOpen(false)}
        onSubmit={() => void submitCreateTask()}
        projects={projects}
        saving={createSaving}
        visible={createOpen}
      />
    </SafeAreaView>
  );
}

// ── Filter chip ──────────────────────────────────────────────────────────────

function CreateTaskSheet({
  columns,
  error,
  form,
  onChange,
  onClose,
  onSubmit,
  projects,
  saving,
  visible,
}: {
  columns: BoardColumnChoice[];
  error: string;
  form: CreateTaskForm;
  onChange: (next: CreateTaskForm) => void;
  onClose: () => void;
  onSubmit: () => void;
  projects: Project[];
  saving: boolean;
  visible: boolean;
}) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  useEffect(() => {
    if (!visible) setDatePickerOpen(false);
  }, [visible]);
  if (!visible) return null;
  const selectedColumn = columns.find((column) => column.id === form.columnId) ?? columns[0] ?? fallbackColumns[0];

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
        <View style={styles.createSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.createHeader}>
            <View style={styles.createHeaderCopy}>
              <Text style={styles.sheetEyebrow}>New task</Text>
              <Text style={styles.sheetTitle}>Create work item</Text>
              <Text style={styles.sheetSubtitle}>Choose a project and board lane before adding details.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.createContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {error ? (
              <View style={styles.createErrorBox}>
                <Text style={styles.createErrorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.createSection}>
              <Text style={styles.createSectionTitle}>Project</Text>
              <ScrollView contentContainerStyle={styles.projectRail} horizontal showsHorizontalScrollIndicator={false}>
                {projects.map((project) => {
                  const active = project.id === form.projectId;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={project.id}
                      onPress={() => onChange({ ...form, columnId: "", projectId: project.id, status: "TODO" })}
                      style={[styles.projectChoice, active ? styles.projectChoiceActive : null]}
                    >
                      <Text numberOfLines={1} style={[styles.projectChoiceName, active ? styles.projectChoiceNameActive : null]}>{project.name}</Text>
                      <Text numberOfLines={1} style={[styles.projectChoiceKey, active ? styles.projectChoiceNameActive : null]}>{project.key ?? "Project"}</Text>
                    </Pressable>
                  );
                })}
                {!projects.length ? <Text style={styles.noProjectsText}>No projects available.</Text> : null}
              </ScrollView>
            </View>

            <View style={styles.createSection}>
              <Text style={styles.createSectionTitle}>Board lane</Text>
              <ScrollView contentContainerStyle={styles.choiceRail} horizontal showsHorizontalScrollIndicator={false}>
                {columns.map((column) => (
                  <ChoiceButton
                    active={column.id === selectedColumn?.id}
                    key={column.id}
                    label={column.label}
                    onPress={() => onChange({ ...form, columnId: column.id, status: column.status })}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.createSection}>
              <Text style={styles.createSectionTitle}>Details</Text>
              <TextInput
                autoFocus
                onChangeText={(title) => onChange({ ...form, title })}
                placeholder="Task title"
                placeholderTextColor={colors.inkSoft}
                style={styles.createInput}
                value={form.title}
              />
              <TextInput
                multiline
                onChangeText={(description) => onChange({ ...form, description })}
                placeholder="Notes, acceptance criteria, or links"
                placeholderTextColor={colors.inkSoft}
                style={[styles.createInput, styles.createTextArea]}
                value={form.description}
              />
            </View>

            <View style={styles.createSection}>
              <View style={styles.createSectionRow}>
                <Text style={styles.createSectionTitle}>Schedule</Text>
                <CalendarDays color={colors.inkSoft} size={16} strokeWidth={2.6} />
              </View>
              <RollerDateField
                helperText="Tap to choose year, month, and day."
                label="Due date"
                onClear={() => onChange({ ...form, dueDate: "" })}
                onPress={() => setDatePickerOpen(true)}
                placeholder="No due date"
                value={form.dueDate}
              />
              <View style={styles.choiceRailWrap}>
                <ChoiceButton active={form.dueDate === dateOffset(0)} label="Today" onPress={() => onChange({ ...form, dueDate: dateOffset(0) })} />
                <ChoiceButton active={form.dueDate === dateOffset(1)} label="Tomorrow" onPress={() => onChange({ ...form, dueDate: dateOffset(1) })} />
                <ChoiceButton active={form.dueDate === dateOffset(7)} label="Next week" onPress={() => onChange({ ...form, dueDate: dateOffset(7) })} />
                <ChoiceButton active={!form.dueDate} label="No date" onPress={() => onChange({ ...form, dueDate: "" })} />
              </View>
            </View>

            <View style={styles.createSection}>
              <Text style={styles.createSectionTitle}>Priority</Text>
              <ScrollView contentContainerStyle={styles.choiceRail} horizontal showsHorizontalScrollIndicator={false}>
                {taskPriorities.map((priority) => (
                  <ChoiceButton active={form.priority === priority} key={priority} label={humanPriority(priority)} onPress={() => onChange({ ...form, priority })} />
                ))}
              </ScrollView>
              <Text style={[styles.createSectionTitle, { marginTop: 10 }]}>Type</Text>
              <ScrollView contentContainerStyle={styles.choiceRail} horizontal showsHorizontalScrollIndicator={false}>
                {taskTypes.slice(0, 6).map((type) => (
                  <ChoiceButton active={form.type === type} key={type} label={humanStatus(type)} onPress={() => onChange({ ...form, type })} />
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          <View style={styles.createActions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving || !form.projectId || !form.title.trim()}
              onPress={onSubmit}
              style={[styles.submitBtn, (saving || !form.projectId || !form.title.trim()) ? styles.submitBtnDisabled : null]}
            >
              <Text style={styles.submitBtnText}>{saving ? "Creating..." : "Create"}</Text>
              <ArrowRight color={colors.black} size={16} strokeWidth={3} />
            </Pressable>
          </View>
          {datePickerOpen ? (
            <InlineDateRollerPicker
              onClose={() => setDatePickerOpen(false)}
              onSelect={(dueDate) => {
                onChange({ ...form, dueDate });
                setDatePickerOpen(false);
              }}
              title="Due date"
              value={form.dueDate}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ChoiceButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choiceBtn, active ? styles.choiceBtnActive : null]}>
      <Text numberOfLines={1} style={[styles.choiceBtnText, active ? styles.choiceBtnTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({ active = false, label, onPress }: { active?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      <ChevronDown color={active ? colors.white : colors.inkSoft} size={12} strokeWidth={2.8} />
    </Pressable>
  );
}

// ── List view ────────────────────────────────────────────────────────────────

function TaskListView({ onOpenTask, tasks }: { onOpenTask: (t: Task) => void; tasks: Task[] }) {
  if (!tasks.length) return <EmptyState />;
  return (
    <View style={styles.listStack}>
      {tasks.map((task) => {
        const isOverdue = task.card?.flags.isOverdue;
        const isBlocked = task.card?.flags.isBlocked;
        const assignee = task.assignees?.[0]?.user ?? task.card?.assignees?.[0];
        const rail = priorityRail(task.priority);
        return (
          <Pressable
            accessibilityRole="button"
            key={task.id}
            onPress={() => onOpenTask(task)}
            style={({ pressed }) => [styles.taskCard, pressed && { opacity: 0.65 }]}
          >
            <View style={[styles.taskCardRail, { backgroundColor: rail }]} />
            <View style={styles.taskCardBody}>
              <View style={styles.taskCardTop}>
                <Text numberOfLines={2} style={styles.taskCardTitle}>{task.title}</Text>
                <StatusPill label={humanStatus(task.status)} tone={statusTone(task.status)} />
              </View>
              <View style={styles.taskCardBottom}>
                <Text style={styles.taskCardKey}>{task.key ?? task.id.slice(0, 6).toUpperCase()}</Text>
                {isOverdue && <View style={styles.urgentBadge}><Text style={styles.urgentBadgeText}>Overdue</Text></View>}
                {isBlocked && !isOverdue && <View style={[styles.urgentBadge, { backgroundColor: colors.orangeSoft }]}><Text style={[styles.urgentBadgeText, { color: colors.warning }]}>Blocked</Text></View>}
                <View style={styles.flex1} />
                {assignee && <Text style={styles.taskCardAssignee}>{displayUserName(assignee).split(" ")[0]}</Text>}
                <Text style={styles.taskCardDue}>· {formatCompactDate(task.dueDate)}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Table view ───────────────────────────────────────────────────────────────

function TaskTableView({ onOpenTask, tasks }: { onOpenTask: (t: Task) => void; tasks: Task[] }) {
  if (!tasks.length) return <EmptyState />;
  return (
    <View style={styles.tableCard}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header row */}
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, { width: COL.task }]}>Task</Text>
            <Text style={[styles.tableHeadCell, { width: COL.status }]}>Status</Text>
            <Text style={[styles.tableHeadCell, { width: COL.priority }]}>Priority</Text>
            <Text style={[styles.tableHeadCell, { width: COL.owner }]}>Owner</Text>
            <Text style={[styles.tableHeadCell, { width: COL.due }]}>Due</Text>
            <Text style={[styles.tableHeadCell, { width: COL.pts }]}>Pts</Text>
          </View>
          {/* Data rows */}
          {tasks.map((task) => {
            const isOverdue = task.card?.flags.isOverdue;
            const assignee = task.assignees?.[0]?.user ?? task.card?.assignees?.[0];
            return (
              <Pressable
                accessibilityRole="button"
                key={task.id}
                onPress={() => onOpenTask(task)}
                style={({ pressed }) => [styles.tableRow, pressed && { opacity: 0.65 }]}
              >
                <View style={[styles.tableRailCell, { width: COL.task }]}>
                  <View style={[styles.tableRail, { backgroundColor: priorityRail(task.priority) }]} />
                  <View style={styles.tableTaskBody}>
                    <Text numberOfLines={1} style={styles.tableTaskTitle}>{task.title}</Text>
                    <View style={styles.tableTaskMeta}>
                      <Text style={styles.tableKey}>{task.key ?? task.id.slice(0, 6).toUpperCase()}</Text>
                      {isOverdue && <View style={styles.urgentBadgeSm}><Text style={styles.urgentBadgeSmText}>!</Text></View>}
                    </View>
                  </View>
                </View>
                <View style={{ width: COL.status }}>
                  <StatusPill label={humanStatus(task.status)} tone={statusTone(task.status)} />
                </View>
                <View style={{ width: COL.priority }}>
                  <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} />
                </View>
                <Text numberOfLines={1} style={[styles.tableCell, { width: COL.owner }]}>
                  {assignee ? displayUserName(assignee).split(" ")[0] : "—"}
                </Text>
                <Text style={[styles.tableCell, { width: COL.due }, isOverdue && { color: colors.danger }]}>
                  {formatCompactDate(task.dueDate)}
                </Text>
                <Text style={[styles.tableCell, { width: COL.pts, textAlign: "center" }]}>
                  {task.storyPoints ?? "—"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No tasks found</Text>
      <Text style={styles.emptyMeta}>Try adjusting your filters or search term.</Text>
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function safe<T>(promise: Promise<T>, fallback: T) {
  try { return await promise; } catch { return fallback; }
}

function buildColumnChoices(board?: ProjectBoard | null): BoardColumnChoice[] {
  if (!board?.columns?.length) return fallbackColumns;
  return [...board.columns]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((column) => ({
      boardColumnId: column.id,
      id: column.id,
      label: column.name,
      status: normalizeStatus(column.status),
    }));
}

function normalizeStatus(value: unknown): TaskStatus {
  const status = String(value || "TODO") as TaskStatus;
  return taskStatuses.includes(status) ? status : "TODO";
}

function emptyCreateTaskForm(projectId = ""): CreateTaskForm {
  return {
    columnId: "",
    description: "",
    dueDate: "",
    estimateHours: "",
    priority: "MEDIUM",
    projectId,
    status: "TODO",
    storyPoints: "",
    title: "",
    type: "TASK",
  };
}

function cleanDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return `${trimmed}T12:00:00.000Z`;
}

function parsePositiveInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveFloat(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function dateOffset(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextValue<T extends string>(values: readonly T[], current: T): T {
  const idx = values.indexOf(current);
  return values[(idx + 1) % values.length] ?? current;
}

function priorityRail(priority: string): string {
  if (priority === "CRITICAL") return colors.danger;
  if (priority === "URGENT") return colors.warning;
  if (priority === "HIGH") return "#b45309";
  if (priority === "MEDIUM") return colors.accent;
  return colors.line;
}

const COL = { task: 220, status: 130, priority: 110, owner: 110, due: 100, pts: 52 } as const;

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create(withFontStyles({
  safe: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 14, paddingBottom: 120, paddingHorizontal: 20, paddingTop: 14 },

  // Header
  header: { alignItems: "center", flexDirection: "row", gap: 12 },
  backBtn: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
    ...shadow.card,
  },
  headerMid: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.foreground, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  headerSub: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", marginTop: 2 },
  headerCreateBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderRadius: 18,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
    ...shadow.card,
  },
  viewToggle: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 2,
    padding: 3,
  },
  viewBtn: {
    alignItems: "center",
    borderRadius: 13,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  viewBtnActive: { backgroundColor: colors.foreground },

  // Search
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
  searchClear: { padding: 4 },
  searchClearText: { color: colors.inkSoft, fontSize: 14, fontWeight: "900" },

  // Filters
  filterRail: { gap: 8, paddingRight: 4 },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  filterChipText: { color: colors.foreground, fontSize: 13, fontWeight: "800" },
  filterChipTextActive: { color: colors.white },
  resetChip: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  resetChipText: { color: colors.black, fontSize: 13, fontWeight: "900" },

  // Loading / error
  loadingCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: radii.xl,
    gap: 14,
    padding: 40,
    ...shadow.card,
  },
  loadingText: { color: colors.inkSoft, fontSize: 14, fontWeight: "700" },
  errorBox: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "800", textAlign: "center" },
  retryBtn: { backgroundColor: colors.panel, borderRadius: radii.md, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: colors.accent, fontSize: 14, fontWeight: "900" },

  // Stats row
  statsRow: { flexDirection: "row", gap: 8 },
  statChip: {
    alignItems: "center",
    borderRadius: radii.lg,
    flex: 1,
    gap: 2,
    paddingVertical: 12,
  },
  statNum: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  statLbl: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },

  // Task list
  listStack: { gap: 10 },
  taskCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    ...shadow.card,
  },
  taskCardRail: { borderRadius: 0, width: 4 },
  taskCardBody: { flex: 1, gap: 10, padding: 16 },
  taskCardTop: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  taskCardTitle: { color: colors.foreground, flex: 1, fontSize: 15, fontWeight: "800", lineHeight: 21 },
  taskCardBottom: { alignItems: "center", flexDirection: "row", gap: 6 },
  taskCardKey: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  urgentBadge: {
    backgroundColor: colors.redSoft,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  urgentBadgeText: { color: colors.danger, fontSize: 11, fontWeight: "900" },
  flex1: { flex: 1 },
  taskCardAssignee: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },
  taskCardDue: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },

  // Table view
  tableCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
    ...shadow.card,
  },
  tableHead: {
    backgroundColor: colors.panelMuted,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 42,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 0,
  },
  tableHeadCell: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tableRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 64,
    paddingHorizontal: 16,
    gap: 0,
  },
  tableRailCell: { alignItems: "center", flexDirection: "row", gap: 10 },
  tableRail: { borderRadius: 99, height: 32, width: 3 },
  tableTaskBody: { flex: 1, gap: 4 },
  tableTaskTitle: { color: colors.foreground, fontSize: 14, fontWeight: "800" },
  tableTaskMeta: { alignItems: "center", flexDirection: "row", gap: 6 },
  tableKey: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" },
  urgentBadgeSm: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderRadius: 99,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  urgentBadgeSmText: { color: colors.danger, fontSize: 10, fontWeight: "900" },
  tableCell: { color: colors.inkSoft, fontSize: 13, fontWeight: "700" },

  // Empty
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 8,
    padding: 48,
    ...shadow.card,
  },
  emptyTitle: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  emptyMeta: { color: colors.inkSoft, fontSize: 13, fontWeight: "700" },

  // Create task sheet
  modalBackdrop: { backgroundColor: "rgba(16,16,15,0.28)", flex: 1, justifyContent: "flex-end" },
  createSheet: { backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "92%", overflow: "hidden", ...shadow.heavy },
  sheetHandle: { alignSelf: "center", backgroundColor: colors.line, borderRadius: 99, height: 4, marginTop: 12, width: 44 },
  createHeader: { alignItems: "flex-start", flexDirection: "row", gap: 14, justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 12 },
  createHeaderCopy: { flex: 1, minWidth: 0 },
  sheetEyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  sheetTitle: { color: colors.foreground, fontSize: 28, fontWeight: "900", letterSpacing: -0.5, lineHeight: 32, marginTop: 4 },
  sheetSubtitle: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", lineHeight: 18, marginTop: 4 },
  closeBtn: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 16, height: 36, justifyContent: "center", width: 36 },
  createContent: { gap: 14, padding: 20, paddingBottom: 104 },
  createSection: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 12, padding: 14, ...shadow.card },
  createSectionRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  createSectionTitle: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  projectRail: { gap: 10, paddingRight: 4 },
  projectChoice: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, gap: 3, minWidth: 150, paddingHorizontal: 14, paddingVertical: 12 },
  projectChoiceActive: { backgroundColor: colors.black, borderColor: colors.black },
  projectChoiceName: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  projectChoiceNameActive: { color: colors.white },
  projectChoiceKey: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" },
  noProjectsText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", paddingVertical: 10 },
  choiceRail: { gap: 8, paddingRight: 4 },
  choiceRailWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceBtn: { alignItems: "center", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: 13 },
  choiceBtnActive: { backgroundColor: colors.black, borderColor: colors.black },
  choiceBtnText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  choiceBtnTextActive: { color: colors.white },
  createInput: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, color: colors.foreground, fontSize: 15, fontWeight: "800", minHeight: 54, paddingHorizontal: 14 },
  createTextArea: { minHeight: 94, paddingTop: 13, textAlignVertical: "top" },
  createErrorBox: { backgroundColor: colors.redSoft, borderColor: "#fecaca", borderRadius: radii.lg, borderWidth: 1, padding: 12 },
  createErrorText: { color: colors.danger, fontSize: 12, fontWeight: "900" },
  createActions: { alignItems: "center", backgroundColor: colors.background, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, justifyContent: "flex-end", padding: 16 },
  cancelBtn: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, height: 50, justifyContent: "center", paddingHorizontal: 18 },
  cancelBtnText: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  submitBtn: { alignItems: "center", backgroundColor: colors.primary, borderColor: colors.primaryDark, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: 6, height: 50, justifyContent: "center", paddingHorizontal: 18 },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: colors.black, fontSize: 14, fontWeight: "900" },
}));
