import { useCallback, useEffect, useMemo, useState } from "react";
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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  GripVertical,
  Layers3,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  createBoardColumn,
  createTask,
  deleteBoardColumn,
  deleteTask,
  getProjectBoard,
  listProjects,
  listTasks,
  reorderBoardColumns,
  updateBoardColumn,
  updateTask,
  updateTaskOrder,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { BoardColumn, Project, ProjectBoard, Task } from "@/lib/types";

type PortfolioView = "summary" | "board" | "list" | "calendar" | "forms" | "timeline" | "settings";
type TaskStatus = Task["status"];
type TaskPriority = Task["priority"];
type TaskType = Task["type"];

type WorkColumn = {
  id: string;
  isCollapsed: boolean;
  name: string;
  source: "api" | "fallback";
  sortOrder: number;
  status: TaskStatus;
  tasks: Task[];
  wipLimit: number | null;
};

type TaskSheetState =
  | { mode: "create"; column: WorkColumn; task?: never }
  | { mode: "edit"; column: WorkColumn; task: Task }
  | null;

type ColumnSheetState =
  | { mode: "create"; column?: never }
  | { mode: "edit"; column: WorkColumn }
  | null;

type TaskFormState = {
  columnId: string;
  description: string;
  dueDate: string;
  estimateHours: string;
  priority: TaskPriority;
  status: TaskStatus;
  storyPoints: string;
  title: string;
  type: TaskType;
};

type ColumnFormState = {
  isCollapsed: boolean;
  name: string;
  status: TaskStatus;
  wipLimit: string;
};

const boardViews: { label: string; value: PortfolioView }[] = [
  { label: "Summary", value: "summary" },
  { label: "Board", value: "board" },
  { label: "List", value: "list" },
  { label: "Calendar", value: "calendar" },
  { label: "Forms", value: "forms" },
  { label: "Timeline", value: "timeline" },
  { label: "Settings", value: "settings" },
];

const taskStatuses: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "TESTING", "DONE", "CANCELLED"];
const taskPriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"];
const taskTypes: TaskType[] = ["TASK", "BUG", "STORY", "EPIC", "FEATURE", "INCIDENT", "APPROVAL", "CHANGE_REQUEST", "MILESTONE"];

const defaultColumns: { name: string; status: TaskStatus }[] = [
  { name: "Backlog", status: "BACKLOG" },
  { name: "To Do", status: "TODO" },
  { name: "In Progress", status: "IN_PROGRESS" },
  { name: "Review", status: "REVIEW" },
  { name: "Done", status: "DONE" },
];

const quickDueOptions = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "Next week", offset: 7 },
];

export function PortfolioBoardScreen() {
  const { accessToken } = useAuthSession();
  const [activeView, setActiveView] = useState<PortfolioView>("board");
  const [board, setBoard] = useState<ProjectBoard | null>(null);
  const [columnSheet, setColumnSheet] = useState<ColumnSheetState>(null);
  const [columnForm, setColumnForm] = useState<ColumnFormState>(emptyColumnForm());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm());
  const [taskSheet, setTaskSheet] = useState<TaskSheetState>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const projectPage = await listProjects(accessToken, { limit: 50 });
      const nextProjects = Array.isArray(projectPage) ? projectPage : projectPage.data;
      const nextSelected = nextProjects.find((project) => project.id === selectedProjectId) ?? nextProjects[0] ?? null;
      setProjects(nextProjects);
      setSelectedProjectId(nextSelected?.id ?? "");

      if (!nextSelected) {
        setBoard(null);
        setTasks([]);
        return;
      }

      const [nextBoard, taskPage] = await Promise.all([
        safe(getProjectBoard(accessToken, nextSelected.id), null),
        listTasks(accessToken, { limit: 100, projectId: nextSelected.id, sortBy: "sortOrder", sortDirection: "asc" }),
      ]);
      const nextTasks = Array.isArray(taskPage) ? taskPage : taskPage.data;
      setBoard(nextBoard);
      setTasks(nextTasks);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load portfolio board.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, selectedProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(() => buildColumns(board, tasks), [board, tasks]);
  const filteredTasks = useMemo(() => filterTasks(tasks, search), [search, tasks]);
  const filteredColumns = useMemo(() => {
    const taskIds = new Set(filteredTasks.map((task) => task.id));
    return columns.map((column) => ({ ...column, tasks: column.tasks.filter((task) => taskIds.has(task.id)) }));
  }, [columns, filteredTasks]);
  const summary = useMemo(() => buildSummary(tasks), [tasks]);

  function cycleProject() {
    if (projects.length <= 1) return;
    const currentIndex = Math.max(projects.findIndex((project) => project.id === selectedProject?.id), 0);
    const nextProject = projects[(currentIndex + 1) % projects.length];
    if (!nextProject) return;
    setSelectedProjectId(nextProject.id);
  }

  function openCreateTask(column = columns[0]) {
    if (!column) return;
    setTaskSheet({ mode: "create", column });
    setTaskForm(emptyTaskForm(column));
  }

  function openEditTask(task: Task, column = findTaskColumn(columns, task) ?? columns[0]) {
    if (!column) return;
    setTaskSheet({ mode: "edit", column, task });
    setTaskForm(taskToForm(task, column));
  }

  function openCreateColumn() {
    if (!board) {
      setError("This project does not have a board record yet.");
      return;
    }
    setColumnSheet({ mode: "create" });
    setColumnForm(emptyColumnForm(columns[columns.length - 1]?.status ?? "TODO"));
  }

  function openEditColumn(column: WorkColumn) {
    setColumnSheet({ mode: "edit", column });
    setColumnForm(columnToForm(column));
  }

  async function saveTask() {
    if (!accessToken || !selectedProject || !taskSheet || !taskForm.title.trim()) return;
    const column = columns.find((item) => item.id === taskForm.columnId) ?? taskSheet.column;
    setSaving(true);
    setError("");

    try {
      const dueDate = cleanDate(taskForm.dueDate);
      const storyPoints = parsePositiveInt(taskForm.storyPoints);
      const estimateHours = parsePositiveFloat(taskForm.estimateHours);
      if (taskSheet.mode === "create") {
        const created = await createTask(accessToken, {
          description: taskForm.description.trim() || undefined,
          dueDate: dueDate ?? undefined,
          estimateMins: estimateHours ? Math.round(estimateHours * 60) : undefined,
          priority: taskForm.priority,
          projectId: selectedProject.id,
          status: column.status,
          storyPoints: storyPoints ?? undefined,
          title: taskForm.title.trim(),
          type: taskForm.type,
        });
        await updateTaskOrder(accessToken, created.id, {
          boardColumnId: column.source === "api" ? column.id : null,
          sortOrder: column.tasks.length,
          status: column.status,
        });
      } else {
        await updateTask(accessToken, taskSheet.task.id, {
          description: taskForm.description.trim() || undefined,
          dueDate,
          estimateMins: estimateHours ? Math.round(estimateHours * 60) : undefined,
          priority: taskForm.priority,
          status: column.status,
          storyPoints: storyPoints ?? undefined,
          title: taskForm.title.trim(),
          type: taskForm.type,
        });
        await updateTaskOrder(accessToken, taskSheet.task.id, {
          boardColumnId: column.source === "api" ? column.id : null,
          sortOrder: taskSheet.task.sortOrder ?? column.tasks.length,
          status: column.status,
        });
      }

      setTaskSheet(null);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save task.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteTask(task: Task) {
    if (!accessToken) return;
    Alert.alert("Delete work item?", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await deleteTask(accessToken, task.id);
              setTaskSheet(null);
              await load(true);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete task.");
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  async function moveTaskToColumn(task: Task, target: WorkColumn) {
    if (!accessToken) return;
    const source = findTaskColumn(columns, task);
    if (source?.id === target.id) return;
    const before = tasks;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, boardColumnId: target.source === "api" ? target.id : null, status: target.status, sortOrder: target.tasks.length } : item)));
    setSaving(true);
    setError("");
    try {
      await updateTaskOrder(accessToken, task.id, {
        boardColumnId: target.source === "api" ? target.id : null,
        sortOrder: target.tasks.length,
        status: target.status,
      });
      await load(true);
    } catch (caught) {
      setTasks(before);
      setError(caught instanceof Error ? caught.message : "Unable to move task.");
    } finally {
      setSaving(false);
    }
  }

  async function nudgeTask(task: Task, direction: -1 | 1) {
    if (!accessToken) return;
    const column = findTaskColumn(columns, task);
    if (!column) return;
    const index = column.tasks.findIndex((item) => item.id === task.id);
    const target = column.tasks[index + direction];
    if (!target) return;
    const nextColumnTasks = [...column.tasks];
    nextColumnTasks[index] = target;
    nextColumnTasks[index + direction] = task;
    const nextTasks = tasks.map((item) => {
      const nextIndex = nextColumnTasks.findIndex((candidate) => candidate.id === item.id);
      return nextIndex >= 0 ? { ...item, sortOrder: nextIndex } : item;
    });
    const before = tasks;
    setTasks(nextTasks);
    setSaving(true);
    setError("");
    try {
      await Promise.all(
        nextColumnTasks.map((item, sortOrder) =>
          updateTaskOrder(accessToken, item.id, {
            boardColumnId: column.source === "api" ? column.id : null,
            sortOrder,
            status: column.status,
          }),
        ),
      );
      await load(true);
    } catch (caught) {
      setTasks(before);
      setError(caught instanceof Error ? caught.message : "Unable to reorder task.");
    } finally {
      setSaving(false);
    }
  }

  async function moveTaskStep(task: Task, direction: -1 | 1) {
    const currentIndex = columns.findIndex((column) => column.tasks.some((item) => item.id === task.id));
    const nextColumn = columns[currentIndex + direction];
    if (!nextColumn) return;
    await moveTaskToColumn(task, nextColumn);
  }

  async function saveColumn() {
    if (!accessToken || !board || !columnSheet || !columnForm.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const wipLimit = parsePositiveInt(columnForm.wipLimit);
      if (columnSheet.mode === "create") {
        await createBoardColumn(accessToken, board.id, {
          isCollapsed: columnForm.isCollapsed,
          name: columnForm.name.trim(),
          sortOrder: columns.length,
          status: columnForm.status,
          wipLimit: wipLimit ?? undefined,
        });
      } else {
        await updateBoardColumn(accessToken, board.id, columnSheet.column.id, {
          isCollapsed: columnForm.isCollapsed,
          name: columnForm.name.trim(),
          status: columnForm.status,
          wipLimit: wipLimit ?? null,
        });
      }
      setColumnSheet(null);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save column.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteColumn(column: WorkColumn) {
    if (!accessToken || !board || column.source !== "api") return;
    Alert.alert("Delete column?", `Delete "${column.name}"? The backend only allows empty columns to be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await deleteBoardColumn(accessToken, board.id, column.id);
              setColumnSheet(null);
              await load(true);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete column.");
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  async function moveColumn(column: WorkColumn, direction: -1 | 1) {
    if (!accessToken || !board || column.source !== "api") return;
    const currentIndex = board.columns.findIndex((item) => item.id === column.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= board.columns.length) return;
    const nextColumns = arrayMove(board.columns, currentIndex, targetIndex).map((item, index) => ({ ...item, sortOrder: index }));
    setBoard({ ...board, columns: nextColumns });
    setSaving(true);
    setError("");
    try {
      await reorderBoardColumns(accessToken, board.id, {
        columns: nextColumns.map((item) => ({ columnId: item.id, sortOrder: item.sortOrder })),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reorder columns.");
      await load(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.foreground} />
          <Text style={styles.muted}>Loading board</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedProject) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No project boards yet</Text>
          <Text style={styles.mutedCenter}>Create a project first, then Portfolio will show its board workspace.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)")} style={styles.primaryButton}>
            <Plus color={colors.black} size={18} strokeWidth={2.8} />
            <Text style={styles.primaryButtonText}>Go to projects</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.foreground} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)")} style={styles.circleButton}>
            <ArrowLeft color={colors.foreground} size={22} strokeWidth={2.8} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={cycleProject} style={styles.projectSwitcher}>
            <Text numberOfLines={1} style={styles.projectName}>{selectedProject.name}</Text>
            <ChevronDown color={colors.foreground} size={15} strokeWidth={3} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" onPress={() => openCreateTask()} style={styles.brandCircleButton}>
              <Plus color={colors.black} size={22} strokeWidth={3} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={activeView === "board" ? openCreateColumn : undefined} style={styles.circleButton}>
              {activeView === "summary" ? <Share2 color={colors.foreground} size={21} strokeWidth={2.7} /> : <MoreHorizontal color={colors.foreground} size={24} strokeWidth={2.8} />}
            </Pressable>
          </View>
        </View>

        <BoardTabs activeView={activeView} onChange={setActiveView} />

        <FilterRail search={search} onCreateColumn={openCreateColumn} onSearch={setSearch} showColumnAction={activeView === "board" && Boolean(board)} />

        {saving ? (
          <View style={styles.savingPill}>
            <ActivityIndicator color={colors.foreground} size="small" />
            <Text style={styles.savingText}>Syncing board</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {activeView === "summary" ? <SummaryView columns={filteredColumns} summary={summary} /> : null}
        {activeView === "board" ? (
          <BoardView
            columns={filteredColumns}
            onCreateTask={openCreateTask}
            onEditColumn={openEditColumn}
            onMoveColumn={moveColumn}
            onMoveTask={moveTaskStep}
            onNudgeTask={nudgeTask}
            onOpenTask={openEditTask}
          />
        ) : null}
        {activeView === "list" ? <ListView onOpenTask={openEditTask} onSearch={setSearch} search={search} tasks={filteredTasks} /> : null}
        {activeView === "calendar" ? <CalendarView onOpenTask={openEditTask} tasks={filteredTasks} /> : null}
        {activeView === "forms" ? <UtilityView title="Forms" body="Mobile intake forms will create project work items directly into this board." /> : null}
        {activeView === "timeline" ? <TimelineView tasks={filteredTasks} /> : null}
        {activeView === "settings" ? <SettingsView board={board} onCreateColumn={openCreateColumn} project={selectedProject} /> : null}
      </ScrollView>

      <TaskEditorSheet
        columns={columns}
        form={taskForm}
        onChange={setTaskForm}
        onClose={() => setTaskSheet(null)}
        onDelete={taskSheet?.mode === "edit" ? () => void confirmDeleteTask(taskSheet.task) : undefined}
        onSave={() => void saveTask()}
        saving={saving}
        state={taskSheet}
      />

      <ColumnEditorSheet
        form={columnForm}
        onChange={setColumnForm}
        onClose={() => setColumnSheet(null)}
        onDelete={columnSheet?.mode === "edit" && columnSheet.column.source === "api" ? () => void confirmDeleteColumn(columnSheet.column) : undefined}
        onSave={() => void saveColumn()}
        saving={saving}
        state={columnSheet}
      />
    </SafeAreaView>
  );
}

async function safe<T>(promise: Promise<T>, fallback: T) {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function BoardTabs({ activeView, onChange }: { activeView: PortfolioView; onChange: (view: PortfolioView) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.tabs} horizontal showsHorizontalScrollIndicator={false}>
      {boardViews.map((view) => {
        const active = view.value === activeView;
        return (
          <Pressable accessibilityRole="button" key={view.value} onPress={() => onChange(view.value)} style={styles.tabButton}>
            <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{view.label}</Text>
            {active ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function FilterRail({
  onCreateColumn,
  onSearch,
  search,
  showColumnAction,
}: {
  onCreateColumn: () => void;
  onSearch: (value: string) => void;
  search: string;
  showColumnAction: boolean;
}) {
  return (
    <View style={styles.filterStack}>
      <View style={styles.searchBox}>
        <Search color={colors.foreground} size={20} strokeWidth={2.8} />
        <TextInput onChangeText={onSearch} placeholder="Search work items" placeholderTextColor="#716b61" style={styles.searchInput} value={search} />
      </View>
      <ScrollView contentContainerStyle={styles.filterRail} horizontal showsHorizontalScrollIndicator={false}>
        <FilterChip label="Group by" />
        <FilterChip label="Assignee" />
        <FilterChip label="Status" />
        {showColumnAction ? (
          <Pressable accessibilityRole="button" onPress={onCreateColumn} style={styles.columnActionChip}>
            <Plus color={colors.black} size={15} strokeWidth={3} />
            <Text style={styles.columnActionText}>Column</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <Pressable accessibilityRole="button" style={styles.filterChip}>
      <Text style={styles.filterChipText}>{label}</Text>
      <ChevronDown color={colors.inkSoft} size={13} strokeWidth={2.7} />
    </Pressable>
  );
}

function SummaryView({ columns, summary }: { columns: WorkColumn[]; summary: ReturnType<typeof buildSummary> }) {
  return (
    <View style={styles.viewStack}>
      <View style={styles.summaryGrid}>
        <SummaryCard label="completed" value={summary.completed} />
        <SummaryCard label="updated" tone="blue" value={summary.updated} />
        <SummaryCard label="created" tone="yellow" value={summary.created} />
        <SummaryCard label="due soon" value={summary.dueSoon} />
      </View>
      <View style={styles.analyticsBlock}>
        <Text style={styles.blockTitle}>Status overview</Text>
        <Text style={styles.blockSubtitle}>current board distribution</Text>
        <View style={styles.statusList}>
          {columns.map((column) => (
            <View key={column.id} style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor(column.status) }]} />
              <Text style={styles.statusName}>{column.name}</Text>
              <Text style={styles.statusCount}>{column.tasks.length}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.analyticsBlock}>
        <Text style={styles.blockTitle}>Priority breakdown</Text>
        <Text style={styles.blockSubtitle}>current work items</Text>
        <PriorityBars tasks={columns.flatMap((column) => column.tasks)} />
      </View>
    </View>
  );
}

function SummaryCard({ label, tone = "neutral", value }: { label: string; tone?: "blue" | "neutral" | "yellow"; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, tone === "blue" ? styles.summaryIconBlue : tone === "yellow" ? styles.summaryIconYellow : null]}>
        <CheckSquare2 color={tone === "neutral" ? colors.foreground : colors.accent} size={16} strokeWidth={2.8} />
      </View>
      <Text style={[styles.summaryNumber, tone === "blue" ? styles.textBlue : null]}>{value}</Text>
      <Text style={styles.summaryText}>{label}</Text>
      <Text style={styles.summarySubtext}>last 7 days</Text>
    </View>
  );
}

function BoardView({
  columns,
  onCreateTask,
  onEditColumn,
  onMoveColumn,
  onMoveTask,
  onNudgeTask,
  onOpenTask,
}: {
  columns: WorkColumn[];
  onCreateTask: (column: WorkColumn) => void;
  onEditColumn: (column: WorkColumn) => void;
  onMoveColumn: (column: WorkColumn, direction: -1 | 1) => void;
  onMoveTask: (task: Task, direction: -1 | 1) => void;
  onNudgeTask: (task: Task, direction: -1 | 1) => void;
  onOpenTask: (task: Task, column: WorkColumn) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.boardContent} horizontal showsHorizontalScrollIndicator={false}>
      {columns.map((column, index) => (
        <View key={column.id} style={[styles.column, column.isCollapsed ? styles.columnCollapsed : null]}>
          <View style={styles.columnHeader}>
            <GripVertical color={colors.inkSoft} size={16} strokeWidth={2.7} />
            <View style={styles.columnTitleWrap}>
              <View style={styles.columnTitleLine}>
                <View style={[styles.columnDot, { backgroundColor: statusColor(column.status) }]} />
                <Text numberOfLines={1} style={styles.columnTitle}>{column.name}</Text>
              </View>
              <Text style={styles.columnMeta}>{column.wipLimit ? `WIP ${column.tasks.length}/${column.wipLimit}` : `${column.tasks.length} work items`}</Text>
            </View>
            <Text style={styles.columnCount}>{column.tasks.length}</Text>
            <Pressable accessibilityRole="button" onPress={() => onEditColumn(column)} style={styles.iconButtonSmall}>
              <MoreHorizontal color={colors.inkSoft} size={18} strokeWidth={2.8} />
            </Pressable>
          </View>

          <View style={styles.columnToolbar}>
            <Pressable accessibilityRole="button" disabled={index === 0 || column.source !== "api"} onPress={() => onMoveColumn(column, -1)} style={styles.columnToolButton}>
              <ChevronLeft color={index === 0 || column.source !== "api" ? "#b6b3aa" : colors.foreground} size={16} strokeWidth={3} />
            </Pressable>
            <Pressable accessibilityRole="button" disabled={index === columns.length - 1 || column.source !== "api"} onPress={() => onMoveColumn(column, 1)} style={styles.columnToolButton}>
              <ChevronRight color={index === columns.length - 1 || column.source !== "api" ? "#b6b3aa" : colors.foreground} size={16} strokeWidth={3} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onCreateTask(column)} style={styles.quickCreateButton}>
              <Plus color={colors.black} size={15} strokeWidth={3} />
              <Text style={styles.quickCreateText}>Create</Text>
            </Pressable>
          </View>

          {column.isCollapsed ? (
            <View style={styles.collapsedColumnBody}>
              <Text style={styles.collapsedText}>{column.tasks.length}</Text>
            </View>
          ) : (
            column.tasks.map((task, taskIndex) => (
              <TaskCard
                canMoveLeft={index > 0}
                canMoveRight={index < columns.length - 1}
                canMoveUp={taskIndex > 0}
                canMoveDown={taskIndex < column.tasks.length - 1}
                column={column}
                key={task.id}
                onMove={onMoveTask}
                onNudge={onNudgeTask}
                onPress={() => onOpenTask(task, column)}
                task={task}
              />
            ))
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function TaskCard({
  canMoveDown,
  canMoveLeft,
  canMoveRight,
  canMoveUp,
  column,
  onMove,
  onNudge,
  onPress,
  task,
}: {
  canMoveDown: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canMoveUp: boolean;
  column: WorkColumn;
  onMove: (task: Task, direction: -1 | 1) => void;
  onNudge: (task: Task, direction: -1 | 1) => void;
  onPress: () => void;
  task: Task;
}) {
  const isBlocked = Boolean(task.card?.flags.isBlocked);
  const isOverdue = Boolean(task.card?.flags.isOverdue);
  const swipeEnabled = canMoveLeft || canMoveRight;
  return (
    <Swipeable
      enabled={swipeEnabled}
      onSwipeableOpen={(direction) => {
        if (direction === "left" && canMoveLeft) onMove(task, -1);
        if (direction === "right" && canMoveRight) onMove(task, 1);
      }}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => <SwipeAction label="Previous" />}
      renderRightActions={() => <SwipeAction label="Next" />}
    >
      <Pressable accessibilityRole="button" onLongPress={onPress} onPress={onPress} style={[styles.taskCard, isBlocked ? styles.taskCardBlocked : null]}>
        <View style={[styles.taskRail, { backgroundColor: statusColor(column.status) }]} />
        <View style={styles.taskCardTop}>
          <Text numberOfLines={2} style={styles.taskTitle}>{task.title}</Text>
          <Pencil color={colors.inkSoft} size={15} strokeWidth={2.5} />
        </View>
        <View style={styles.taskMeta}>
          <CheckSquare2 color={colors.accent} size={15} strokeWidth={2.6} />
          <Text style={styles.taskKey}>{task.key ?? task.id.slice(0, 6).toUpperCase()}</Text>
          <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} />
        </View>
        <View style={styles.taskFacts}>
          {task.dueDate ? (
            <View style={styles.factPill}>
              <CalendarDays color={isOverdue ? colors.danger : colors.inkSoft} size={13} strokeWidth={2.4} />
              <Text style={[styles.factText, isOverdue ? styles.factDanger : null]}>{formatShortDate(task.dueDate)}</Text>
            </View>
          ) : null}
          {task.storyPoints ? <Text style={styles.factPillText}>{task.storyPoints} pts</Text> : null}
          {task._count?.comments ? <Text style={styles.factPillText}>{task._count.comments} comments</Text> : null}
        </View>
        <View style={styles.cardActions}>
          <Pressable accessibilityRole="button" disabled={!canMoveLeft} onPress={() => onMove(task, -1)} style={styles.cardActionButton}>
            <ChevronLeft color={canMoveLeft ? colors.foreground : "#b8b4aa"} size={16} strokeWidth={3} />
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!canMoveUp} onPress={() => onNudge(task, -1)} style={styles.cardActionButton}>
            <ArrowUp color={canMoveUp ? colors.foreground : "#b8b4aa"} size={15} strokeWidth={3} />
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!canMoveDown} onPress={() => onNudge(task, 1)} style={styles.cardActionButton}>
            <ArrowDown color={canMoveDown ? colors.foreground : "#b8b4aa"} size={15} strokeWidth={3} />
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!canMoveRight} onPress={() => onMove(task, 1)} style={styles.cardActionButton}>
            <ChevronRight color={canMoveRight ? colors.foreground : "#b8b4aa"} size={16} strokeWidth={3} />
          </Pressable>
        </View>
      </Pressable>
    </Swipeable>
  );
}

function SwipeAction({ label }: { label: string }) {
  return (
    <View style={styles.swipeAction}>
      <Text style={styles.swipeActionText}>{label}</Text>
    </View>
  );
}

function ListView({ onOpenTask, onSearch, search, tasks }: { onOpenTask: (task: Task) => void; onSearch: (value: string) => void; search: string; tasks: Task[] }) {
  return (
    <View style={styles.viewStack}>
      <View style={styles.searchBox}>
        <Search color={colors.foreground} size={20} strokeWidth={2.8} />
        <TextInput onChangeText={onSearch} placeholder="Search work items" placeholderTextColor="#716b61" style={styles.searchInput} value={search} />
      </View>
      <Text style={styles.resultCount}>{tasks.length} results</Text>
      <View style={styles.listPanel}>
        {tasks.map((task, index) => (
          <Pressable accessibilityRole="button" key={task.id} onPress={() => onOpenTask(task)} style={[styles.listRow, index === tasks.length - 1 ? styles.listRowLast : null]}>
            <CheckSquare2 color={colors.accent} size={18} strokeWidth={2.5} />
            <View style={styles.listText}>
              <Text numberOfLines={1} style={styles.listTitle}>{task.title}</Text>
              <Text style={styles.listMeta}>{task.key ?? task.id.slice(0, 6).toUpperCase()}  =  {humanStatus(task.status)}</Text>
            </View>
            <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CalendarView({ onOpenTask, tasks }: { onOpenTask: (task: Task) => void; tasks: Task[] }) {
  const days = groupByDueDate(tasks);
  return (
    <View style={styles.viewStack}>
      <View style={styles.monthHeader}>
        <Text style={styles.monthTitle}>{new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
        <Text style={styles.monthBadge}>Agenda</Text>
      </View>
      <View style={styles.calendarPanel}>
        {days.map((day) => (
          <View key={day.label} style={styles.calendarGroup}>
            <View style={styles.calendarRow}>
              <View>
                <Text style={styles.calendarDay}>{day.label}</Text>
                <Text style={styles.calendarDate}>{day.date}</Text>
              </View>
              <Text style={styles.calendarCount}>{day.tasks.length}</Text>
            </View>
            {day.tasks.slice(0, 3).map((task) => (
              <Pressable accessibilityRole="button" key={task.id} onPress={() => onOpenTask(task)} style={styles.calendarTaskRow}>
                <Text numberOfLines={1} style={styles.calendarTaskTitle}>{task.title}</Text>
                <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} />
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function TimelineView({ tasks }: { tasks: Task[] }) {
  const recent = [...tasks].sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? ""))).slice(0, 8);
  return (
    <View style={styles.timelinePanel}>
      {recent.map((task) => (
        <View key={task.id} style={styles.timelineRow}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineText}>
            <Text style={styles.timelineTitle}>{task.title}</Text>
            <Text style={styles.timelineMeta}>{humanStatus(task.status)} - updated {formatShortDate(task.updatedAt)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SettingsView({ board, onCreateColumn, project }: { board: ProjectBoard | null; onCreateColumn: () => void; project: Project }) {
  return (
    <View style={styles.settingsPanel}>
      <SettingsRow label="Project" value={project.name} />
      <SettingsRow label="Board" value={board?.name ?? "Default board"} />
      <SettingsRow label="Columns" value={String(board?.columns?.length ?? defaultColumns.length)} />
      <SettingsRow label="API source" value="Agile board" />
      <Pressable accessibilityRole="button" disabled={!board} onPress={onCreateColumn} style={[styles.settingsAction, !board ? styles.disabledAction : null]}>
        <Layers3 color={colors.black} size={17} strokeWidth={2.8} />
        <Text style={styles.settingsActionText}>Add board column</Text>
      </Pressable>
    </View>
  );
}

function UtilityView({ body, title }: { body: string; title: string }) {
  return (
    <View style={styles.utilityPanel}>
      <FileText color={colors.accent} size={30} strokeWidth={2.5} />
      <Text style={styles.utilityTitle}>{title}</Text>
      <Text style={styles.utilityBody}>{body}</Text>
    </View>
  );
}

function TaskEditorSheet({
  columns,
  form,
  onChange,
  onClose,
  onDelete,
  onSave,
  saving,
  state,
}: {
  columns: WorkColumn[];
  form: TaskFormState;
  onChange: (next: TaskFormState) => void;
  onClose: () => void;
  onDelete?: () => void;
  onSave: () => void;
  saving: boolean;
  state: TaskSheetState;
}) {
  if (!state) return null;
  const title = state.mode === "create" ? "Create work item" : "Edit work item";
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <SheetHeader onClose={onClose} title={title} />
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <Field label="Title">
              <TextInput autoFocus={state.mode === "create"} onChangeText={(titleValue) => onChange({ ...form, title: titleValue })} placeholder="Write a clear task title" placeholderTextColor="#8c887f" style={styles.input} value={form.title} />
            </Field>
            <Field label="Description">
              <TextInput
                multiline
                onChangeText={(description) => onChange({ ...form, description })}
                placeholder="Add context, acceptance notes, or links"
                placeholderTextColor="#8c887f"
                style={[styles.input, styles.textArea]}
                value={form.description}
              />
            </Field>
            <Field label="Column">
              <ScrollView contentContainerStyle={styles.choiceRow} horizontal showsHorizontalScrollIndicator={false}>
                {columns.map((column) => (
                  <ChoiceChip active={form.columnId === column.id} key={column.id} label={column.name} onPress={() => onChange({ ...form, columnId: column.id, status: column.status })} />
                ))}
              </ScrollView>
            </Field>
            <Field label="Priority">
              <ScrollView contentContainerStyle={styles.choiceRow} horizontal showsHorizontalScrollIndicator={false}>
                {taskPriorities.map((priority) => (
                  <ChoiceChip active={form.priority === priority} key={priority} label={humanPriority(priority)} onPress={() => onChange({ ...form, priority })} />
                ))}
              </ScrollView>
            </Field>
            <Field label="Type">
              <ScrollView contentContainerStyle={styles.choiceRow} horizontal showsHorizontalScrollIndicator={false}>
                {taskTypes.map((type) => (
                  <ChoiceChip active={form.type === type} key={type} label={humanStatus(type)} onPress={() => onChange({ ...form, type })} />
                ))}
              </ScrollView>
            </Field>
            <View style={styles.formGrid}>
              <Field label="Due date">
                <TextInput onChangeText={(dueDate) => onChange({ ...form, dueDate })} placeholder="YYYY-MM-DD" placeholderTextColor="#8c887f" style={styles.input} value={form.dueDate} />
              </Field>
              <Field label="Story points">
                <TextInput keyboardType="number-pad" onChangeText={(storyPoints) => onChange({ ...form, storyPoints })} placeholder="0" placeholderTextColor="#8c887f" style={styles.input} value={form.storyPoints} />
              </Field>
            </View>
            <ScrollView contentContainerStyle={styles.choiceRow} horizontal showsHorizontalScrollIndicator={false}>
              {quickDueOptions.map((option) => (
                <ChoiceChip active={false} key={option.label} label={option.label} onPress={() => onChange({ ...form, dueDate: dateOffset(option.offset) })} />
              ))}
              <ChoiceChip active={!form.dueDate} label="No date" onPress={() => onChange({ ...form, dueDate: "" })} />
            </ScrollView>
            <Field label="Estimate hours">
              <TextInput keyboardType="decimal-pad" onChangeText={(estimateHours) => onChange({ ...form, estimateHours })} placeholder="0" placeholderTextColor="#8c887f" style={styles.input} value={form.estimateHours} />
            </Field>
          </ScrollView>
          <View style={styles.sheetActions}>
            {onDelete ? (
              <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}>
                <Trash2 color={colors.danger} size={18} strokeWidth={2.7} />
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving || !form.title.trim()} onPress={onSave} style={[styles.saveButton, saving || !form.title.trim() ? styles.disabledAction : null]}>
              <Text style={styles.saveButtonText}>{saving ? "Saving" : state.mode === "create" ? "Create" : "Update"}</Text>
              <ArrowRight color={colors.black} size={17} strokeWidth={3} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ColumnEditorSheet({
  form,
  onChange,
  onClose,
  onDelete,
  onSave,
  saving,
  state,
}: {
  form: ColumnFormState;
  onChange: (next: ColumnFormState) => void;
  onClose: () => void;
  onDelete?: () => void;
  onSave: () => void;
  saving: boolean;
  state: ColumnSheetState;
}) {
  if (!state) return null;
  const title = state.mode === "create" ? "Create column" : "Edit column";
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <SheetHeader onClose={onClose} title={title} />
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <Field label="Column name">
              <TextInput autoFocus onChangeText={(name) => onChange({ ...form, name })} placeholder="In progress" placeholderTextColor="#8c887f" style={styles.input} value={form.name} />
            </Field>
            <Field label="Mapped status">
              <ScrollView contentContainerStyle={styles.choiceRow} horizontal showsHorizontalScrollIndicator={false}>
                {taskStatuses.map((status) => (
                  <ChoiceChip active={form.status === status} key={status} label={humanStatus(status)} onPress={() => onChange({ ...form, status })} />
                ))}
              </ScrollView>
            </Field>
            <Field label="WIP limit">
              <TextInput keyboardType="number-pad" onChangeText={(wipLimit) => onChange({ ...form, wipLimit })} placeholder="No limit" placeholderTextColor="#8c887f" style={styles.input} value={form.wipLimit} />
            </Field>
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.fieldLabel}>Collapsed</Text>
                <Text style={styles.fieldHint}>Show this column as a slim rail.</Text>
              </View>
              <Switch onValueChange={(isCollapsed) => onChange({ ...form, isCollapsed })} thumbColor={colors.white} trackColor={{ false: colors.line, true: colors.primary }} value={form.isCollapsed} />
            </View>
          </ScrollView>
          <View style={styles.sheetActions}>
            {onDelete ? (
              <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}>
                <Trash2 color={colors.danger} size={18} strokeWidth={2.7} />
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving || !form.name.trim()} onPress={onSave} style={[styles.saveButton, saving || !form.name.trim() ? styles.disabledAction : null]}>
              <Text style={styles.saveButtonText}>{saving ? "Saving" : "Save column"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetHeader({ onClose, title }: { onClose: () => void; title: string }) {
  return (
    <View style={styles.sheetHeader}>
      <View style={styles.sheetHandle} />
      <View style={styles.sheetTitleRow}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
          <X color={colors.foreground} size={20} strokeWidth={2.8} />
        </Pressable>
      </View>
    </View>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choiceChip, active ? styles.choiceChipActive : null]}>
      <Text style={[styles.choiceChipText, active ? styles.choiceChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function PriorityBars({ tasks }: { tasks: Task[] }) {
  const max = Math.max(1, ...taskPriorities.map((priority) => tasks.filter((task) => task.priority === priority).length));
  return (
    <View style={styles.priorityStack}>
      {taskPriorities.map((priority) => {
        const count = tasks.filter((task) => task.priority === priority).length;
        return (
          <View key={priority} style={styles.priorityRow}>
            <Text style={styles.priorityLabel}>{humanPriority(priority)}</Text>
            <View style={styles.priorityTrack}>
              <View style={[styles.priorityFill, { width: `${(count / max) * 100}%` }]} />
            </View>
            <Text style={styles.priorityCount}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.settingsValue}>{value}</Text>
    </View>
  );
}

function buildColumns(board: ProjectBoard | null, tasks: Task[]): WorkColumn[] {
  if (board?.columns?.length) {
    return [...board.columns]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((column) => ({
        id: column.id,
        isCollapsed: Boolean(column.isCollapsed),
        name: column.name,
        sortOrder: column.sortOrder,
        source: "api",
        status: normalizeStatus(column.status),
        tasks: tasksForColumn(column, tasks),
        wipLimit: column.wip?.limit ?? column.wipLimit ?? null,
      }));
  }

  return defaultColumns.map((column, index) => ({
    id: column.status,
    isCollapsed: false,
    name: column.name,
    sortOrder: index,
    source: "fallback",
    status: column.status,
    tasks: tasks.filter((task) => task.status === column.status).sort(sortTasks),
    wipLimit: null,
  }));
}

function tasksForColumn(column: BoardColumn, tasks: Task[]) {
  const columnTasks = Array.isArray(column.tasks) ? column.tasks : [];
  if (columnTasks.length) return [...columnTasks].sort(sortTasks);
  const status = normalizeStatus(column.status);
  return tasks
    .filter((task) => task.boardColumnId === column.id || (!task.boardColumnId && task.status === status))
    .sort(sortTasks);
}

function sortTasks(left: Task, right: Task) {
  return (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || String(left.updatedAt ?? "").localeCompare(String(right.updatedAt ?? ""));
}

function filterTasks(tasks: Task[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return tasks;
  return tasks.filter((task) => `${task.title} ${task.key ?? ""} ${task.status} ${task.priority} ${task.type}`.toLowerCase().includes(query));
}

function buildSummary(tasks: Task[]) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const sevenDaysAhead = now + 7 * 24 * 60 * 60 * 1000;
  return {
    completed: tasks.filter((task) => task.status === "DONE" && dateMs(task.completedAt) >= sevenDaysAgo).length,
    created: tasks.filter((task) => dateMs(task.createdAt) >= sevenDaysAgo).length,
    dueSoon: tasks.filter((task) => {
      const due = dateMs(task.dueDate);
      return due > now && due <= sevenDaysAhead && task.status !== "DONE" && task.status !== "CANCELLED";
    }).length,
    updated: tasks.filter((task) => dateMs(task.updatedAt) >= sevenDaysAgo).length,
  };
}

function groupByDueDate(tasks: Task[]) {
  const dated = tasks.filter((task) => task.dueDate).sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate)));
  if (!dated.length) return [{ date: "No date", label: "Unscheduled", tasks }];
  const groups = new Map<string, Task[]>();
  for (const task of dated) {
    const key = String(task.dueDate).slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  return [...groups.entries()].slice(0, 8).map(([date, groupedTasks]) => ({
    date: formatShortDate(date),
    label: new Date(date).toLocaleDateString(undefined, { weekday: "long" }),
    tasks: groupedTasks,
  }));
}

function findTaskColumn(columns: WorkColumn[], task: Task) {
  return columns.find((column) => column.tasks.some((item) => item.id === task.id)) ?? null;
}

function emptyTaskForm(column?: WorkColumn): TaskFormState {
  return {
    columnId: column?.id ?? "",
    description: "",
    dueDate: "",
    estimateHours: "",
    priority: "MEDIUM",
    status: column?.status ?? "TODO",
    storyPoints: "",
    title: "",
    type: "TASK",
  };
}

function taskToForm(task: Task, column: WorkColumn): TaskFormState {
  return {
    columnId: column.id,
    description: task.description ?? "",
    dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "",
    estimateHours: task.estimateMins ? String(Math.round((task.estimateMins / 60) * 10) / 10) : "",
    priority: task.priority,
    status: column.status,
    storyPoints: task.storyPoints ? String(task.storyPoints) : "",
    title: task.title,
    type: task.type,
  };
}

function emptyColumnForm(status: TaskStatus = "TODO"): ColumnFormState {
  return {
    isCollapsed: false,
    name: "",
    status,
    wipLimit: "",
  };
}

function columnToForm(column: WorkColumn): ColumnFormState {
  return {
    isCollapsed: column.isCollapsed,
    name: column.name,
    status: column.status,
    wipLimit: column.wipLimit ? String(column.wipLimit) : "",
  };
}

function arrayMove<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

function cleanDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return `${trimmed}T12:00:00.000Z`;
}

function dateOffset(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function parsePositiveFloat(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function dateMs(value: unknown) {
  if (!value) return 0;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatShortDate(value: unknown) {
  if (!value) return "No date";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function humanPriority(priority: string) {
  return priority.charAt(0) + priority.slice(1).toLowerCase().replaceAll("_", " ");
}

function humanStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStatus(status?: TaskStatus | null): TaskStatus {
  return status ?? "TODO";
}

function priorityTone(priority: string) {
  if (priority === "CRITICAL" || priority === "URGENT") return "red" as const;
  if (priority === "HIGH") return "yellow" as const;
  if (priority === "LOW") return "neutral" as const;
  return "blue" as const;
}

function statusColor(status: TaskStatus) {
  if (status === "DONE") return colors.success;
  if (status === "IN_PROGRESS") return colors.accent;
  if (status === "REVIEW" || status === "TESTING") return "#7c3aed";
  if (status === "CANCELLED") return colors.danger;
  if (status === "BACKLOG") return "#8b8f9a";
  return colors.primaryDark;
}

const styles = StyleSheet.create({
  analyticsBlock: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    gap: 14,
    padding: 18,
    ...shadow.card,
  },
  blockSubtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    marginTop: -10,
  },
  blockTitle: {
    color: colors.foreground,
    fontSize: 19,
    fontWeight: "900",
  },
  boardContent: {
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    paddingRight: 28,
  },
  brandCircleButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
    ...shadow.card,
  },
  calendarCount: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    color: colors.black,
    fontSize: 12,
    fontWeight: "900",
    minWidth: 26,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    textAlign: "center",
  },
  calendarDate: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  calendarDay: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  calendarGroup: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
  },
  calendarPanel: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    overflow: "hidden",
  },
  calendarRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 66,
    paddingHorizontal: 18,
  },
  calendarTaskRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  calendarTaskTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  cardActionButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    width: 48,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingTop: 2,
  },
  center: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 24,
  },
  choiceChip: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 13,
  },
  choiceChipActive: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.primaryDark,
  },
  choiceChipText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  choiceChipTextActive: {
    color: colors.foreground,
  },
  choiceRow: {
    gap: 8,
    paddingRight: 16,
  },
  circleButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
    ...shadow.card,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  collapsedColumnBody: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 160,
  },
  collapsedText: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: "900",
  },
  column: {
    backgroundColor: "#dfe2e7",
    borderRadius: 8,
    gap: 8,
    minHeight: 220,
    padding: 8,
    width: 324,
  },
  columnActionChip: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  columnActionText: {
    color: colors.black,
    fontSize: 13,
    fontWeight: "900",
  },
  columnCollapsed: {
    width: 110,
  },
  columnCount: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  columnDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  columnHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 7,
    paddingTop: 4,
  },
  columnMeta: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  columnTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
  },
  columnTitleLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  columnTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  columnToolButton: {
    alignItems: "center",
    backgroundColor: "#eef0f4",
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    width: 40,
  },
  columnToolbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 2,
  },
  content: {
    gap: 14,
    paddingBottom: 116,
    paddingTop: 8,
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderRadius: 18,
    height: 50,
    justifyContent: "center",
    width: 52,
  },
  disabledAction: {
    opacity: 0.45,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 21,
    fontWeight: "900",
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
    borderWidth: 1,
    marginHorizontal: 20,
    padding: 13,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  factDanger: {
    color: colors.danger,
  },
  factPill: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  factPillText: {
    backgroundColor: colors.panelMuted,
    borderRadius: 999,
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  factText: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
  },
  field: {
    gap: 8,
  },
  fieldHint: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  fieldLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: "#cfd2da",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "800",
  },
  filterRail: {
    gap: 8,
    paddingRight: 20,
  },
  filterStack: {
    gap: 10,
    paddingHorizontal: 20,
  },
  formGrid: {
    flexDirection: "row",
    gap: 10,
  },
  iconButtonSmall: {
    alignItems: "center",
    backgroundColor: "#eef0f4",
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    width: 38,
  },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  listMeta: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },
  listPanel: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    overflow: "hidden",
  },
  listRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 13,
    minHeight: 78,
    paddingHorizontal: 18,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  listText: {
    flex: 1,
    minWidth: 0,
  },
  listTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
  },
  modalBackdrop: {
    backgroundColor: "rgba(16,16,15,0.24)",
    flex: 1,
    justifyContent: "flex-end",
  },
  monthBadge: {
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.warning,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  monthHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
  },
  mutedCenter: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: "900",
  },
  priorityCount: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
    width: 24,
  },
  priorityFill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 8,
  },
  priorityLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
    width: 80,
  },
  priorityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  priorityStack: {
    gap: 12,
  },
  priorityTrack: {
    backgroundColor: colors.line,
    borderRadius: 999,
    flex: 1,
    height: 8,
    overflow: "hidden",
  },
  projectName: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
    maxWidth: 180,
  },
  projectSwitcher: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  quickCreateButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    flex: 1,
    gap: 5,
    height: 34,
    justifyContent: "center",
  },
  quickCreateText: {
    color: colors.black,
    fontSize: 13,
    fontWeight: "900",
  },
  resultCount: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "800",
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  saveButtonText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: "900",
  },
  savingPill: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.panel,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  savingText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: 24,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    ...shadow.card,
  },
  searchInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  settingsAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 58,
  },
  settingsActionText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: "900",
  },
  settingsLabel: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  settingsPanel: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  settingsRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    minHeight: 60,
    paddingHorizontal: 18,
  },
  settingsValue: {
    color: colors.foreground,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    overflow: "hidden",
  },
  sheetActions: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    padding: 16,
  },
  sheetContent: {
    gap: 15,
    padding: 18,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#d7d5ce",
    borderRadius: 999,
    height: 4,
    marginTop: 10,
    width: 42,
  },
  sheetHeader: {
    backgroundColor: colors.background,
  },
  sheetTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
  },
  sheetTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  statusCount: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  statusDot: {
    borderRadius: 999,
    height: 14,
    width: 14,
  },
  statusList: {
    gap: 16,
    paddingTop: 8,
  },
  statusName: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 96,
    padding: 14,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryIcon: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 11,
    height: 28,
    justifyContent: "center",
    marginBottom: 8,
    width: 28,
  },
  summaryIconBlue: {
    backgroundColor: colors.blueSoft,
  },
  summaryIconYellow: {
    backgroundColor: colors.yellowSoft,
  },
  summaryNumber: {
    color: colors.foreground,
    fontSize: 23,
    fontWeight: "900",
  },
  summarySubtext: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "700",
  },
  summaryText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "900",
  },
  swipeAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    marginVertical: 2,
    width: 96,
  },
  swipeActionText: {
    color: colors.black,
    fontSize: 12,
    fontWeight: "900",
  },
  switchRow: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
  },
  tabs: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: 26,
    paddingHorizontal: 20,
  },
  tabText: {
    color: colors.inkSoft,
    fontSize: 16,
    fontWeight: "900",
  },
  tabTextActive: {
    color: colors.accent,
  },
  tabUnderline: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    bottom: -1,
    height: 2,
    left: 0,
    position: "absolute",
    right: 0,
  },
  taskCard: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    gap: 9,
    minHeight: 120,
    overflow: "hidden",
    padding: 12,
    paddingLeft: 15,
    ...shadow.card,
  },
  taskCardBlocked: {
    borderColor: "#fecaca",
    borderWidth: 1,
  },
  taskCardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  taskFacts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  taskKey: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "800",
  },
  taskMeta: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  taskRail: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 4,
  },
  taskTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 21,
  },
  textArea: {
    minHeight: 112,
    paddingTop: 13,
    textAlignVertical: "top",
  },
  textBlue: {
    color: colors.accent,
  },
  timelineDot: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  timelineMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  timelinePanel: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
  },
  timelineText: {
    flex: 1,
    minWidth: 0,
  },
  timelineTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  utilityBody: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center",
  },
  utilityPanel: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: 24,
    gap: 10,
    marginHorizontal: 20,
    padding: 24,
  },
  utilityTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "900",
  },
  viewStack: {
    gap: 14,
    paddingHorizontal: 20,
  },
});
