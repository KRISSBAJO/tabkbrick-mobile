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
  Bot,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  GripVertical,
  Layers3,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  Trash2,
  TrendingUp,
  UsersRound,
  X,
  Zap,
} from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import { InlineDateRollerPicker, RollerDateField } from "@/components/ui/RollerDatePicker";
import {
  activeFilterCount,
  dueFilterValues,
  emptyTaskFilters,
  filterTasksByControls,
  ownerFilterValues,
  priorityFilterValues,
  statusFilterValues,
  type TaskFilters,
} from "@/features/tasks/taskFilters";
import {
  applyBoardActions,
  createBoardColumn,
  createBoard,
  createTask,
  deleteBoardColumn,
  deleteTask,
  getProjectBoard,
  addTeamMember,
  bulkInviteTenantUsers,
  cancelTeamMemberInvite,
  createTeam,
  generateBoardActionPlan,
  generateBoardSummary,
  inviteTeamMember,
  inviteTenantUser,
  listBoardAiHistory,
  listDocuments,
  listPermissions,
  listProjects,
  listRoles,
  listTasks,
  listTeamMembers,
  listTeams,
  listUsers,
  removeTeamMember,
  resendTeamMemberInvite,
  reorderBoardColumns,
  scanBoardRisks,
  updateBoardColumn,
  updateTask,
  updateTaskOrder,
  type BoardAiActionPlanResponse,
  type BoardAiApplyResponse,
  type BoardAiHistoryEntry,
  type BoardAiRiskScanResponse,
  type BoardAiSummaryResponse,
  type TeamInviteResult,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { BoardColumn, BulkInviteUsersResponse, Permission, Project, ProjectBoard, Role, Task, Team, TeamMember, TenantUser, WorkspaceDocument } from "@/lib/types";

type PortfolioView = "summary" | "board" | "list" | "calendar" | "timeline" | "team" | "docs" | "settings";
type TeamDetailTab = "members" | "invite" | "add" | "directory" | "bulk" | "roles";
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
type BoardAiMode = "summary" | "risk" | "actions" | "apply";
type BoardAiState =
  | { mode: "summary"; result: BoardAiSummaryResponse }
  | { mode: "risk"; result: BoardAiRiskScanResponse }
  | { mode: "actions"; result: BoardAiActionPlanResponse }
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

type PickerOption = {
  detail?: string;
  label: string;
  value: string;
};

type PickerSheetState = {
  helper: string;
  onSelect: (value: string) => void;
  options: PickerOption[];
  title: string;
  value: string;
} | null;

const boardViews: { label: string; value: PortfolioView }[] = [
  { label: "Summary", value: "summary" },
  { label: "Board", value: "board" },
  { label: "List", value: "list" },
  { label: "Calendar", value: "calendar" },
  { label: "Timeline", value: "timeline" },
  { label: "Team", value: "team" },
  { label: "Docs", value: "docs" },
  { label: "Settings", value: "settings" },
];

const taskStatuses: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "TESTING", "DONE", "CANCELLED"];
const taskPriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"];
const taskTypes: TaskType[] = ["TASK", "BUG", "STORY", "EPIC", "FEATURE", "INCIDENT", "APPROVAL", "CHANGE_REQUEST", "MILESTONE"];
const teamRoleOptions = ["Owner", "Lead", "Manager", "Member", "Viewer"];
const teamAccents = ["#2563eb", "#0f9f6e", "#8b5cf6", "#dc2626", "#0ea5e9", "#b45309", "#db2777"];

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
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(emptyTaskFilters);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm());
  const [taskSheet, setTaskSheet] = useState<TaskSheetState>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState<BoardAiMode | null>(null);
  const [aiResult, setAiResult] = useState<BoardAiState>(null);
  const [aiError, setAiError] = useState("");
  const [selectedAiActionIds, setSelectedAiActionIds] = useState<Set<string>>(() => new Set());
  const [aiApplyResult, setAiApplyResult] = useState<BoardAiApplyResponse | null>(null);
  const [aiHistory, setAiHistory] = useState<BoardAiHistoryEntry[]>([]);
  const [aiHistoryError, setAiHistoryError] = useState("");
  const [aiHistoryLoading, setAiHistoryLoading] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  const loadAiHistory = useCallback(async (projectId: string, boardId?: string | null) => {
    if (!accessToken || !projectId) {
      setAiHistory([]);
      return;
    }
    setAiHistoryLoading(true);
    setAiHistoryError("");
    try {
      const response = await listBoardAiHistory(accessToken, {
        boardId: boardId ?? undefined,
        limit: 8,
        projectId,
      });
      setAiHistory(response.data);
    } catch (caught) {
      setAiHistoryError(caught instanceof Error ? caught.message : "Unable to load Board AI history.");
    } finally {
      setAiHistoryLoading(false);
    }
  }, [accessToken]);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const projectPage = await listProjects(accessToken, { limit: 50 });
      const nextProjects = Array.isArray(projectPage) ? projectPage : projectPage.data;
      const nextSelected = nextProjects.find((p) => p.id === selectedProjectId) ?? nextProjects[0] ?? null;
      setProjects(nextProjects);
      setSelectedProjectId(nextSelected?.id ?? "");
      if (!nextSelected) {
        setBoard(null);
        setDocuments([]);
        setTeamMembers([]);
        setTeams([]);
        setTasks([]);
        setAiHistory([]);
        return;
      }
      const [nextBoard, taskPage, teamPage, teamMemberList, documentPage] = await Promise.all([
        safe(getProjectBoard(accessToken, nextSelected.id), null),
        listTasks(accessToken, { limit: 100, projectId: nextSelected.id, sortBy: "sortOrder", sortDirection: "asc" }),
        safe(listTeams(accessToken, { limit: 50, workspaceId: nextSelected.workspaceId ?? undefined }), null),
        nextSelected.teamId ? safe(listTeamMembers(accessToken, nextSelected.teamId), []) : Promise.resolve([]),
        safe(listDocuments(accessToken, { limit: 25, projectId: nextSelected.id }), null),
      ]);
      setBoard(nextBoard);
      setDocuments(documentPage ? (Array.isArray(documentPage) ? documentPage : documentPage.data) : []);
      setTeamMembers(teamMemberList);
      setTeams(teamPage ? (Array.isArray(teamPage) ? teamPage : teamPage.data) : []);
      setTasks(Array.isArray(taskPage) ? taskPage : taskPage.data);
      void loadAiHistory(nextSelected.id, nextBoard?.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load portfolio board.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [accessToken, loadAiHistory, selectedProjectId]);

  useEffect(() => { void load(); }, [load]);

  const columns = useMemo(() => buildColumns(board, tasks), [board, tasks]);
  const filteredTasks = useMemo(() => filterTasksByControls(tasks, filters), [filters, tasks]);
  const filteredColumns = useMemo(() => {
    const taskIds = new Set(filteredTasks.map((t) => t.id));
    return columns.map((col) => ({ ...col, tasks: col.tasks.filter((t) => taskIds.has(t.id)) }));
  }, [columns, filteredTasks]);
  const summary = useMemo(() => buildSummary(tasks), [tasks]);

  function cycleProject() {
    if (projects.length <= 1) return;
    const currentIndex = Math.max(projects.findIndex((p) => p.id === selectedProject?.id), 0);
    const next = projects[(currentIndex + 1) % projects.length];
    if (!next) return;
    setSelectedProjectId(next.id);
  }

  function openCreateTask(column = columns[0]) {
    if (!column) return;
    setTaskSheet({ mode: "create", column });
    setTaskForm(emptyTaskForm(column));
  }

  function openTaskDetail(task: Task) {
    router.push({ pathname: "/(workspace)/tasks/[taskId]", params: { returnTo: "/(workspace)/portfolio", taskId: task.id } });
  }

  function openEditTask(task: Task, column: WorkColumn) {
    setTaskSheet({ mode: "edit", column, task });
    setTaskForm(taskToForm(task, column));
  }

  async function runBoardAi(mode: BoardAiMode) {
    if (!accessToken || !selectedProject) return;
    setAiOpen(true);
    setAiLoading(mode);
    setAiError("");
    setAiApplyResult(null);
    try {
      const payload = { boardId: board?.id, projectId: selectedProject.id };
      if (mode === "summary") {
        const result = await generateBoardSummary(accessToken, payload);
        setAiResult({ mode, result });
      } else if (mode === "risk") {
        const result = await scanBoardRisks(accessToken, payload);
        setAiResult({ mode, result });
      } else if (mode === "actions") {
        const result = await generateBoardActionPlan(accessToken, payload);
        setSelectedAiActionIds(new Set());
        setAiResult({ mode, result });
      }
      void loadAiHistory(selectedProject.id, board?.id);
    } catch (caught) {
      setAiError(caught instanceof Error ? caught.message : "Unable to run board AI.");
    } finally {
      setAiLoading(null);
    }
  }

  function toggleAiAction(actionId: string) {
    setSelectedAiActionIds((current) => {
      const next = new Set(current);
      if (next.has(actionId)) next.delete(actionId);
      else next.add(actionId);
      return next;
    });
  }

  async function applySelectedBoardAiActions() {
    if (!accessToken || !selectedProject || aiResult?.mode !== "actions") return;
    const actionIds = [...selectedAiActionIds];
    if (!actionIds.length) {
      setAiError("Select at least one AI proposal to apply.");
      return;
    }
    setAiLoading("apply");
    setAiError("");
    try {
      const result = await applyBoardActions(accessToken, {
        actionIds,
        boardId: board?.id,
        projectId: selectedProject.id,
      });
      setAiApplyResult(result);
      setAiResult(null);
      setSelectedAiActionIds(new Set());
      await load(true);
    } catch (caught) {
      setAiError(caught instanceof Error ? caught.message : "Unable to apply Board AI actions.");
    } finally {
      setAiLoading(null);
    }
  }

  async function ensureBoardRecord() {
    if (board) return board;
    if (!accessToken || !selectedProject) return null;
    setSaving(true);
    setError("");
    try {
      const created = await createBoard(accessToken, selectedProject.id, {
        description: "Mobile agile board",
        isDefault: true,
        name: `${selectedProject.name} Board`,
      });
      setBoard(created);
      return created;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create board record.");
      return null;
    } finally { setSaving(false); }
  }

  async function openCreateColumn() {
    const currentBoard = await ensureBoardRecord();
    if (!currentBoard) return;
    setColumnSheet({ mode: "create" });
    setColumnForm(emptyColumnForm(columns[columns.length - 1]?.status ?? "TODO"));
  }

  function openEditColumn(column: WorkColumn) {
    setColumnSheet({ mode: "edit", column });
    setColumnForm(columnToForm(column));
  }

  async function saveTask() {
    if (!accessToken || !selectedProject || !taskSheet || !taskForm.title.trim()) return;
    const column = columns.find((c) => c.id === taskForm.columnId) ?? taskSheet.column;
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
        await updateTaskOrder(accessToken, created.id, { boardColumnId: column.source === "api" ? column.id : null, sortOrder: column.tasks.length, status: column.status });
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
        await updateTaskOrder(accessToken, taskSheet.task.id, { boardColumnId: column.source === "api" ? column.id : null, sortOrder: taskSheet.task.sortOrder ?? column.tasks.length, status: column.status });
      }
      setTaskSheet(null);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save task.");
    } finally { setSaving(false); }
  }

  async function confirmDeleteTask(task: Task) {
    if (!accessToken) return;
    Alert.alert("Delete work item?", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            try { await deleteTask(accessToken, task.id); setTaskSheet(null); await load(true); }
            catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete task."); }
            finally { setSaving(false); }
          })();
        },
      },
    ]);
  }

  async function moveTaskToColumn(task: Task, target: WorkColumn) {
    if (!accessToken) return;
    const source = findTaskColumn(columns, task);
    if (source?.id === target.id) return;
    const confirmed = await confirmBoardTaskMove({
      message: `Move "${task.title}" from ${source?.name ?? humanStatus(task.status)} to ${target.name}?`,
      title: "Move work item?",
    });
    if (!confirmed) return;
    const before = tasks;
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, boardColumnId: target.source === "api" ? target.id : null, status: target.status, sortOrder: target.tasks.length } : t)));
    setSaving(true);
    setError("");
    try {
      await updateTaskOrder(accessToken, task.id, { boardColumnId: target.source === "api" ? target.id : null, sortOrder: target.tasks.length, status: target.status });
      await load(true);
    } catch (caught) { setTasks(before); setError(caught instanceof Error ? caught.message : "Unable to move task."); }
    finally { setSaving(false); }
  }

  async function nudgeTask(task: Task, direction: -1 | 1) {
    if (!accessToken) return;
    const column = findTaskColumn(columns, task);
    if (!column) return;
    const index = column.tasks.findIndex((t) => t.id === task.id);
    const target = column.tasks[index + direction];
    if (!target) return;
    const confirmed = await confirmBoardTaskMove({
      message: `Move "${task.title}" ${direction < 0 ? "above" : "below"} "${target.title}" in ${column.name}?`,
      title: "Reorder work item?",
    });
    if (!confirmed) return;
    const nextColumnTasks = [...column.tasks];
    nextColumnTasks[index] = target;
    nextColumnTasks[index + direction] = task;
    const nextTasks = tasks.map((t) => {
      const ni = nextColumnTasks.findIndex((c) => c.id === t.id);
      return ni >= 0 ? { ...t, sortOrder: ni } : t;
    });
    const before = tasks;
    setTasks(nextTasks);
    setSaving(true);
    setError("");
    try {
      await Promise.all(nextColumnTasks.map((t, sortOrder) => updateTaskOrder(accessToken, t.id, { boardColumnId: column.source === "api" ? column.id : null, sortOrder, status: column.status })));
      await load(true);
    } catch (caught) { setTasks(before); setError(caught instanceof Error ? caught.message : "Unable to reorder task."); }
    finally { setSaving(false); }
  }

  async function moveTaskStep(task: Task, direction: -1 | 1) {
    const currentIndex = columns.findIndex((col) => col.tasks.some((t) => t.id === task.id));
    const next = columns[currentIndex + direction];
    if (!next) return;
    await moveTaskToColumn(task, next);
  }

  async function saveColumn() {
    if (!accessToken || !board || !columnSheet || !columnForm.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const wipLimit = parsePositiveInt(columnForm.wipLimit);
      if (columnSheet.mode === "create") {
        await createBoardColumn(accessToken, board.id, { isCollapsed: columnForm.isCollapsed, name: columnForm.name.trim(), sortOrder: columns.length, status: columnForm.status, wipLimit: wipLimit ?? undefined });
      } else {
        await updateBoardColumn(accessToken, board.id, columnSheet.column.id, { isCollapsed: columnForm.isCollapsed, name: columnForm.name.trim(), status: columnForm.status, wipLimit: wipLimit ?? null });
      }
      setColumnSheet(null);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save column.");
    } finally { setSaving(false); }
  }

  async function confirmDeleteColumn(column: WorkColumn) {
    if (!accessToken || !board || column.source !== "api") return;
    Alert.alert("Delete column?", `Delete "${column.name}"? The backend only allows empty columns to be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            try { await deleteBoardColumn(accessToken, board.id, column.id); setColumnSheet(null); await load(true); }
            catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete column."); }
            finally { setSaving(false); }
          })();
        },
      },
    ]);
  }

  async function moveColumn(column: WorkColumn, direction: -1 | 1) {
    if (!accessToken || !board || column.source !== "api") return;
    const currentIndex = board.columns.findIndex((c) => c.id === column.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= board.columns.length) return;
    const nextColumns = arrayMove(board.columns, currentIndex, targetIndex).map((c, i) => ({ ...c, sortOrder: i }));
    setBoard({ ...board, columns: nextColumns });
    setSaving(true);
    setError("");
    try {
      await reorderBoardColumns(accessToken, board.id, { columns: nextColumns.map((c) => ({ columnId: c.id, sortOrder: c.sortOrder })) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reorder columns.");
      await load(true);
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.centerText}>Loading board…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedProject) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Layers3 color={colors.accent} size={28} strokeWidth={2.5} />
          </View>
          <Text style={styles.emptyTitle}>No project boards yet</Text>
          <Text style={styles.emptyBody}>Create a project first, then Portfolio will show its board workspace.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)")} style={styles.primaryBtn}>
            <Plus color={colors.black} size={18} strokeWidth={2.8} />
            <Text style={styles.primaryBtnText}>Go to projects</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)")} style={styles.iconBtn}>
            <ArrowLeft color={colors.foreground} size={20} strokeWidth={2.8} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={cycleProject} style={styles.projectPill}>
            <Text numberOfLines={1} style={styles.projectPillText}>{selectedProject.name}</Text>
            {projects.length > 1 ? <ChevronDown color={colors.white} size={14} strokeWidth={3} /> : null}
          </Pressable>
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" onPress={() => setAiOpen(true)} style={styles.aiHeaderBtn}>
              <Bot color={colors.accent} size={19} strokeWidth={2.8} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => openCreateTask()} style={styles.addBtn}>
              <Plus color={colors.black} size={22} strokeWidth={3} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={activeView === "board" ? () => void openCreateColumn() : undefined}
              style={styles.iconBtn}
            >
              <MoreHorizontal color={colors.foreground} size={22} strokeWidth={2.8} />
            </Pressable>
          </View>
        </View>

        {/* ── View tabs ── */}
        <BoardTabs activeView={activeView} onChange={setActiveView} />

        {/* ── Filter rail ── */}
        <FilterRail
          filters={filters}
          onChange={(patch) => setFilters((cur) => ({ ...cur, ...patch }))}
          onCreateColumn={() => void openCreateColumn()}
          onReset={() => setFilters(emptyTaskFilters)}
          showColumnAction={activeView === "board"}
        />

        {/* ── Saving indicator ── */}
        {saving ? (
          <View style={styles.savingPill}>
            <ActivityIndicator color={colors.foreground} size="small" />
            <Text style={styles.savingText}>Syncing…</Text>
          </View>
        ) : null}

        {/* ── Error ── */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Views ── */}
        {activeView === "summary" ? <SummaryView columns={filteredColumns} summary={summary} /> : null}
        {activeView === "board" ? (
          <BoardView
            columns={filteredColumns}
            onCreateTask={openCreateTask}
            onEditColumn={openEditColumn}
            onMoveColumn={moveColumn}
            onMoveTask={moveTaskStep}
            onNudgeTask={nudgeTask}
            onEditTask={openEditTask}
            onOpenTask={(task) => openTaskDetail(task)}
          />
        ) : null}
        {activeView === "list" ? <ListView onOpenTask={openTaskDetail} tasks={filteredTasks} /> : null}
        {activeView === "calendar" ? <CalendarView onOpenTask={openTaskDetail} tasks={filteredTasks} /> : null}
        {activeView === "timeline" ? <TimelineView onOpenTask={openTaskDetail} tasks={filteredTasks} /> : null}
        {activeView === "team" ? (
          <TeamView
            accessToken={accessToken}
            initialTeamMembers={teamMembers}
            initialTeams={teams}
            project={selectedProject}
          />
        ) : null}
        {activeView === "docs" ? <DocsView documents={documents} /> : null}
        {activeView === "settings" ? <SettingsView board={board} onCreateColumn={() => void openCreateColumn()} project={selectedProject} /> : null}
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

      <BoardAiSheet
        applyResult={aiApplyResult}
        error={aiError}
        history={aiHistory}
        historyError={aiHistoryError}
        historyLoading={aiHistoryLoading}
        loading={aiLoading}
        onApply={() => void applySelectedBoardAiActions()}
        onClose={() => setAiOpen(false)}
        onRefreshHistory={() => void loadAiHistory(selectedProject.id, board?.id)}
        onRun={(mode) => void runBoardAi(mode)}
        onToggleAction={toggleAiAction}
        open={aiOpen}
        projectName={selectedProject.name}
        result={aiResult}
        selectedActionIds={selectedAiActionIds}
      />
    </SafeAreaView>
  );
}

// ── Pure helper ───────────────────────────────────────────────────────────────

async function safe<T>(promise: Promise<T>, fallback: T) {
  try { return await promise; } catch { return fallback; }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BoardAiSheet({
  applyResult,
  error,
  history,
  historyError,
  historyLoading,
  loading,
  onApply,
  onClose,
  onRefreshHistory,
  onRun,
  onToggleAction,
  open,
  projectName,
  result,
  selectedActionIds,
}: {
  applyResult: BoardAiApplyResponse | null;
  error: string;
  history: BoardAiHistoryEntry[];
  historyError: string;
  historyLoading: boolean;
  loading: BoardAiMode | null;
  onApply: () => void;
  onClose: () => void;
  onRefreshHistory: () => void;
  onRun: (mode: BoardAiMode) => void;
  onToggleAction: (actionId: string) => void;
  open: boolean;
  projectName: string;
  result: BoardAiState;
  selectedActionIds: Set<string>;
}) {
  const summary = result?.mode === "summary" ? result.result : null;
  const risk = result?.mode === "risk" ? result.result : null;
  const actionPlan = result?.mode === "actions" ? result.result : null;
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <SheetHeader onClose={onClose} title="Board AI" />
          <ScrollView contentContainerStyle={styles.aiSheetContent} showsVerticalScrollIndicator={false}>
            <View style={styles.aiIntro}>
              <View style={styles.aiIntroIcon}>
                <Bot color={colors.accent} size={23} strokeWidth={2.8} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.aiIntroTitle}>Workspace intelligence</Text>
                <Text style={styles.aiIntroText}>{projectName}</Text>
                <Text style={styles.aiIntroText}>Summarize flow, spot delivery pressure, and review risks before changing the board.</Text>
              </View>
            </View>

            <View style={styles.aiActionsGrid}>
              <Pressable accessibilityRole="button" disabled={Boolean(loading)} onPress={() => onRun("summary")} style={styles.aiActionCard}>
                {loading === "summary" ? <ActivityIndicator color={colors.accent} /> : <Bot color={colors.accent} size={20} strokeWidth={2.8} />}
                <View style={styles.aiActionText}>
                  <Text style={styles.aiActionTitle}>Board summary</Text>
                  <Text style={styles.aiActionSub}>Flow, ownership, and next actions</Text>
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={Boolean(loading)} onPress={() => onRun("risk")} style={styles.aiActionCard}>
                {loading === "risk" ? <ActivityIndicator color={colors.danger} /> : <ShieldAlert color={colors.danger} size={20} strokeWidth={2.8} />}
                <View style={styles.aiActionText}>
                  <Text style={styles.aiActionTitle}>Risk scan</Text>
                  <Text style={styles.aiActionSub}>Overdue, stale, WIP, and ownership gaps</Text>
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={Boolean(loading)} onPress={() => onRun("actions")} style={styles.aiActionCard}>
                {loading === "actions" ? <ActivityIndicator color={colors.accent} /> : <Zap color={colors.accent} size={20} strokeWidth={2.8} />}
                <View style={styles.aiActionText}>
                  <Text style={styles.aiActionTitle}>Action plan</Text>
                  <Text style={styles.aiActionSub}>Review proposals before mutation</Text>
                </View>
              </Pressable>
            </View>

            {error ? (
              <View style={styles.aiErrorBox}>
                <Text style={styles.aiErrorText}>{error}</Text>
              </View>
            ) : null}

            {!result && !error ? (
              <View style={styles.aiEmptyBox}>
                <Text style={styles.aiEmptyTitle}>Run an AI review</Text>
                <Text style={styles.aiEmptyText}>Results stay here as guidance. No task is moved, edited, or assigned automatically.</Text>
              </View>
            ) : null}

            {applyResult && !result ? <BoardAiApplyResultBlock result={applyResult} /> : null}

            {summary ? (
              <View style={styles.aiResultStack}>
                <AiResultBlock title="Narrative" body={summary.content} />
                <AiListBlock items={summary.highlights} title="Highlights" />
                <AiListBlock items={summary.risks} tone="risk" title="Risks" />
                <AiListBlock items={summary.recommendedActions} title="Recommended actions" />
              </View>
            ) : null}

            {risk ? (
              <View style={styles.aiResultStack}>
                <AiResultBlock title="Risk narrative" body={risk.narrative} />
                <View style={styles.aiBlock}>
                  <Text style={styles.aiBlockTitle}>Findings</Text>
                  {risk.findings.length ? risk.findings.map((finding, index) => (
                    <View key={`${finding.type}-${finding.taskId ?? finding.columnId ?? index}`} style={styles.aiFindingCard}>
                      <View style={styles.aiFindingTop}>
                        <Text style={styles.aiFindingSeverity}>{finding.severity}</Text>
                        <Text style={styles.aiFindingType}>{finding.type.replace(/_/g, " ")}</Text>
                      </View>
                      <Text numberOfLines={2} style={styles.aiFindingTitle}>{finding.title}</Text>
                      <Text numberOfLines={3} style={styles.aiFindingEvidence}>{finding.evidence}</Text>
                    </View>
                  )) : (
                    <Text style={styles.aiEmptyText}>No board risk findings were detected.</Text>
                  )}
                </View>
              </View>
            ) : null}

            {actionPlan ? (
              <View style={styles.aiResultStack}>
                <AiResultBlock title="Plan guidance" body={actionPlan.summary} />
                <View style={styles.aiBlock}>
                  <View style={styles.aiApplyHeader}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.aiBlockTitle}>Review queue</Text>
                      <Text style={styles.aiEmptyText}>{selectedActionIds.size} of {actionPlan.proposals.length} selected</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      disabled={loading === "apply" || selectedActionIds.size === 0}
                      onPress={onApply}
                      style={[styles.aiApplyBtn, (loading === "apply" || selectedActionIds.size === 0) && styles.disabledBtn]}
                    >
                      {loading === "apply" ? <ActivityIndicator color={colors.black} /> : <ShieldAlert color={colors.black} size={16} strokeWidth={2.8} />}
                      <Text style={styles.aiApplyBtnText}>{loading === "apply" ? "Applying" : "Apply"}</Text>
                    </Pressable>
                  </View>
                  {applyResult ? (
                    <View style={styles.aiApplyResult}>
                      <Text style={styles.aiApplyResultTitle}>{applyResult.applied} applied, {applyResult.failed} failed</Text>
                      {applyResult.results.map((item) => (
                        <Text key={item.actionId} numberOfLines={2} style={[styles.aiApplyResultLine, item.status === "COMPLETED" ? styles.aiApplyOk : styles.aiApplyFail]}>
                          {item.status}: {item.message ?? item.error ?? item.title ?? item.type}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.aiProposalList}>
                    {actionPlan.proposals.map((proposal) => {
                      const selected = selectedActionIds.has(proposal.actionId);
                      return (
                        <Pressable
                          accessibilityRole="button"
                          key={proposal.actionId}
                          onPress={() => onToggleAction(proposal.actionId)}
                          style={[styles.aiProposalCard, selected && styles.aiProposalCardActive]}
                        >
                          <View style={[styles.aiProposalCheck, selected && styles.aiProposalCheckActive]}>
                            <Text style={styles.aiProposalCheckText}>{selected ? "✓" : ""}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text numberOfLines={2} style={styles.aiProposalTitle}>{proposal.title}</Text>
                            <Text numberOfLines={2} style={styles.aiProposalText}>{proposal.rationale}</Text>
                            <Text numberOfLines={2} style={styles.aiProposalImpact}>{proposal.impact}</Text>
                            <View style={styles.aiProposalMetaRow}>
                              <Text style={styles.aiProposalMeta}>{proposal.type.replace("BOARD_", "").replace(/_/g, " ")}</Text>
                              <Text style={styles.aiProposalMeta}>{proposal.riskLevel}</Text>
                              {proposal.taskKey ? <Text style={styles.aiProposalMeta}>{proposal.taskKey}</Text> : null}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}

            <BoardAiHistoryBlock
              entries={history}
              error={historyError}
              loading={historyLoading}
              onRefresh={onRefreshHistory}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AiResultBlock({ body, title }: { body: string; title: string }) {
  return (
    <View style={styles.aiBlock}>
      <Text style={styles.aiBlockTitle}>{title}</Text>
      <Text style={styles.aiBlockBody}>{body}</Text>
    </View>
  );
}

function BoardAiApplyResultBlock({ result }: { result: BoardAiApplyResponse }) {
  return (
    <View style={styles.aiBlock}>
      <Text style={styles.aiBlockTitle}>Apply attempt saved</Text>
      <Text style={styles.aiBlockBody}>{result.applied} applied, {result.failed} failed. The old review queue was cleared so stale proposal IDs are not reused.</Text>
      <View style={styles.aiApplyResult}>
        {result.results.map((item) => (
          <Text key={item.actionId} numberOfLines={2} style={[styles.aiApplyResultLine, item.status === "COMPLETED" ? styles.aiApplyOk : styles.aiApplyFail]}>
            {item.status}: {item.message ?? item.error ?? item.title ?? item.type}
          </Text>
        ))}
      </View>
    </View>
  );
}

function BoardAiHistoryBlock({
  entries,
  error,
  loading,
  onRefresh,
}: {
  entries: BoardAiHistoryEntry[];
  error: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.aiBlock}>
      <View style={styles.aiHistoryHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.aiBlockTitle}>Board AI history</Text>
          <Text style={styles.aiHistoryMetaText}>Saved generations and apply attempts</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={loading} onPress={onRefresh} style={styles.aiHistoryRefresh}>
          {loading ? <ActivityIndicator color={colors.foreground} size="small" /> : <RefreshCw color={colors.foreground} size={15} strokeWidth={2.6} />}
        </Pressable>
      </View>

      {error ? (
        <View style={styles.aiHistoryError}>
          <Text style={styles.aiErrorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !entries.length && !error ? (
        <Text style={styles.aiEmptyText}>No Board AI records yet.</Text>
      ) : null}

      <View style={styles.aiHistoryList}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.aiHistoryCard}>
            <View style={styles.aiHistoryTop}>
              <View style={styles.aiHistoryKind}>
                {entry.kind === "apply" ? <CheckSquare2 color={colors.accent} size={14} strokeWidth={2.8} /> : historyIcon(entry.type)}
                <Text style={styles.aiHistoryKindText}>{historyTypeLabel(entry.type)}</Text>
              </View>
              <Text style={[
                styles.aiHistoryStatus,
                entry.status === "COMPLETED" ? styles.aiHistoryStatusOk : null,
                entry.status === "FAILED" ? styles.aiHistoryStatusFail : null,
              ]}>
                {entry.status}
              </Text>
            </View>
            <Text numberOfLines={3} style={styles.aiHistoryPreview}>{historyPreview(entry)}</Text>
            <View style={styles.aiHistoryFooter}>
              <Text style={styles.aiHistoryMetaText}>{formatHistoryDate(entry.createdAt)}</Text>
              {entry.totalTokens ? <Text style={styles.aiHistoryMetaText}>{entry.totalTokens} tokens</Text> : null}
              {entry.provider ? <Text style={styles.aiHistoryMetaText}>{entry.provider}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function AiListBlock({ items, title, tone }: { items: string[]; title: string; tone?: "risk" }) {
  return (
    <View style={styles.aiBlock}>
      <Text style={styles.aiBlockTitle}>{title}</Text>
      {items.length ? items.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.aiBulletRow}>
          <View style={[styles.aiBulletDot, tone === "risk" && styles.aiBulletDotRisk]} />
          <Text style={styles.aiBulletText}>{item}</Text>
        </View>
      )) : (
        <Text style={styles.aiEmptyText}>No items returned.</Text>
      )}
    </View>
  );
}

function historyIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("risk")) return <ShieldAlert color={colors.danger} size={14} strokeWidth={2.8} />;
  if (normalized.includes("action")) return <Zap color={colors.accent} size={14} strokeWidth={2.8} />;
  return <Bot color={colors.accent} size={14} strokeWidth={2.8} />;
}

function historyTypeLabel(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("summary")) return "Summary";
  if (normalized.includes("risk")) return "Risk scan";
  if (normalized.includes("apply")) return "Apply";
  if (normalized.includes("action")) return "Action plan";
  return type.replace(/_/g, " ");
}

function historyPreview(entry: BoardAiHistoryEntry) {
  if (entry.error) return entry.error;
  if (entry.kind === "apply") {
    const completed = entry.results?.filter((result) => result.status === "COMPLETED").length ?? 0;
    const failed = entry.results?.filter((result) => result.status !== "COMPLETED").length ?? 0;
    return `${completed} completed, ${failed} failed. Apply audit saved for review.`;
  }
  const artifact = toLooseRecord(entry.artifact);
  const directText = firstString(artifact, ["content", "summary", "narrative"]);
  if (directText) return directText;
  const highlights = toTextArray(artifact.highlights);
  if (highlights.length) return highlights.slice(0, 2).join(" ");
  const proposals = Array.isArray(artifact.proposals) ? artifact.proposals : [];
  if (proposals.length) return `${proposals.length} reviewable proposals generated.`;
  const findings = Array.isArray(artifact.findings) ? artifact.findings : [];
  if (findings.length) return `${findings.length} risk findings captured.`;
  return "Saved Board AI artifact.";
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved";
  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

function toLooseRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toTextArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function BoardTabs({ activeView, onChange }: { activeView: PortfolioView; onChange: (view: PortfolioView) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.tabs} horizontal showsHorizontalScrollIndicator={false}>
      {boardViews.map((view) => {
        const active = view.value === activeView;
        return (
          <Pressable accessibilityRole="button" key={view.value} onPress={() => onChange(view.value)} style={styles.tabBtn}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{view.label}</Text>
            {active ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function FilterRail({
  filters, onChange, onCreateColumn, onReset, showColumnAction,
}: {
  filters: TaskFilters;
  onChange: (patch: Partial<TaskFilters>) => void;
  onCreateColumn: () => void;
  onReset: () => void;
  showColumnAction: boolean;
}) {
  const count = activeFilterCount(filters);
  return (
    <View style={styles.filterStack}>
      <View style={styles.searchBox}>
        <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
        <TextInput
          onChangeText={(search) => onChange({ search })}
          placeholder="Search title, key, label…"
          placeholderTextColor={colors.inkSoft}
          style={styles.searchInput}
          value={filters.search}
        />
      </View>
      <ScrollView contentContainerStyle={styles.filterRail} horizontal showsHorizontalScrollIndicator={false}>
        <FilterChip
          active={Boolean(filters.priority)}
          label={filters.priority ? humanPriority(filters.priority) : "All priorities"}
          onPress={() => onChange({ priority: nextValue(priorityFilterValues, filters.priority) })}
        />
        <FilterChip
          active={Boolean(filters.status)}
          label={filters.status ? humanStatus(filters.status) : "All statuses"}
          onPress={() => onChange({ status: nextValue(statusFilterValues, filters.status) })}
        />
        <FilterChip
          active={Boolean(filters.due)}
          label={filters.due ? humanStatus(filters.due) : "Any due date"}
          onPress={() => onChange({ due: nextValue(dueFilterValues, filters.due) })}
        />
        <FilterChip
          active={Boolean(filters.owner)}
          label={filters.owner ? humanStatus(filters.owner) : "All owners"}
          onPress={() => onChange({ owner: nextValue(ownerFilterValues, filters.owner) })}
        />
        <FilterChip active={filters.blocked} label="Blocked" onPress={() => onChange({ blocked: !filters.blocked })} />
        {count ? <FilterChip active label={`Reset (${count})`} onPress={onReset} /> : null}
        {showColumnAction ? (
          <Pressable accessibilityRole="button" onPress={onCreateColumn} style={styles.addColumnChip}>
            <Plus color={colors.black} size={14} strokeWidth={3} />
            <Text style={styles.addColumnText}>Column</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function FilterChip({ active = false, label, onPress }: { active?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      <ChevronDown color={active ? colors.black : colors.inkSoft} size={12} strokeWidth={2.7} />
    </Pressable>
  );
}

// ── Summary view ──────────────────────────────────────────────────────────────

function SummaryView({ columns, summary }: { columns: WorkColumn[]; summary: ReturnType<typeof buildSummary> }) {
  const allTasks = columns.flatMap((c) => c.tasks);
  const total = columns.reduce((sum, c) => sum + c.tasks.length, 0);
  return (
    <View style={styles.viewStack}>
      {/* Metric grid */}
      <View style={styles.metricGrid}>
        <MetricCard bg={colors.greenSoft} fg={colors.success} icon={<Zap color={colors.success} size={16} strokeWidth={2.7} />} label="Completed" value={summary.completed} />
        <MetricCard bg={colors.blueSoft} fg={colors.accent} icon={<TrendingUp color={colors.accent} size={16} strokeWidth={2.7} />} label="Updated" value={summary.updated} />
        <MetricCard bg={colors.yellowSoft} fg="#b45309" icon={<CheckSquare2 color="#b45309" size={16} strokeWidth={2.7} />} label="Created" value={summary.created} />
        <MetricCard bg={colors.orangeSoft} fg={colors.warning} icon={<CalendarDays color={colors.warning} size={16} strokeWidth={2.7} />} label="Due soon" value={summary.dueSoon} />
      </View>

      {/* Status overview */}
      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsTitle}>Status overview</Text>
        <Text style={styles.analyticsSub}>Current board distribution</Text>
        <View style={styles.statusRows}>
          {columns.map((col) => {
            const pct = total > 0 ? col.tasks.length / total : 0;
            return (
              <View key={col.id} style={styles.statusBarRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(col.status) }]} />
                <Text style={styles.statusName}>{col.name}</Text>
                <View style={styles.statusTrack}>
                  <View style={{ flex: Math.max(pct, 0.001), height: 6, backgroundColor: statusColor(col.status), borderRadius: 99 }} />
                  <View style={{ flex: Math.max(1 - pct, 0.001), height: 6 }} />
                </View>
                <Text style={styles.statusCount}>{col.tasks.length}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Priority breakdown */}
      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsTitle}>Priority breakdown</Text>
        <Text style={styles.analyticsSub}>Current work items</Text>
        <PriorityBars tasks={allTasks} />
      </View>
    </View>
  );
}

function MetricCard({ bg, fg, icon, label, value }: { bg: string; fg: string; icon: ReactNode; label: string; value: number }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: bg }]}>
      <View style={styles.metricCardIcon}>{icon}</View>
      <Text style={[styles.metricValue, { color: fg }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: fg }]}>{label}</Text>
      <Text style={[styles.metricSub, { color: fg }]}>last 7 days</Text>
    </View>
  );
}

// ── Board view ────────────────────────────────────────────────────────────────

function BoardView({
  columns, onCreateTask, onEditColumn, onEditTask, onMoveColumn, onMoveTask, onNudgeTask, onOpenTask,
}: {
  columns: WorkColumn[];
  onCreateTask: (column: WorkColumn) => void;
  onEditColumn: (column: WorkColumn) => void;
  onEditTask: (task: Task, column: WorkColumn) => void;
  onMoveColumn: (column: WorkColumn, direction: -1 | 1) => void;
  onMoveTask: (task: Task, direction: -1 | 1) => void;
  onNudgeTask: (task: Task, direction: -1 | 1) => void;
  onOpenTask: (task: Task, column: WorkColumn) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.boardContent} horizontal showsHorizontalScrollIndicator={false}>
      {columns.map((column, index) => (
        <View
          key={column.id}
          style={[
            styles.column,
            { borderTopColor: statusColor(column.status) },
            column.isCollapsed ? styles.columnCollapsed : null,
          ]}
        >
          {/* Column header */}
          <View style={styles.columnHeader}>
            <GripVertical color={colors.inkSoft} size={15} strokeWidth={2.7} />
            <View style={styles.columnTitleWrap}>
              <Text numberOfLines={1} style={styles.columnTitle}>{column.name}</Text>
              <Text style={styles.columnMeta}>
                {column.wipLimit ? `WIP ${column.tasks.length}/${column.wipLimit}` : `${column.tasks.length} items`}
              </Text>
            </View>
            <View style={[styles.columnCountBadge, { backgroundColor: statusColor(column.status) }]}>
              <Text style={styles.columnCountText}>{column.tasks.length}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => onEditColumn(column)} style={styles.columnIconBtn}>
              <MoreHorizontal color={colors.inkSoft} size={17} strokeWidth={2.8} />
            </Pressable>
          </View>

          {/* Column toolbar */}
          <View style={styles.columnToolbar}>
            <Pressable
              accessibilityRole="button"
              disabled={index === 0 || column.source !== "api"}
              onPress={() => onMoveColumn(column, -1)}
              style={styles.columnToolBtn}
            >
              <ChevronLeft color={index === 0 || column.source !== "api" ? colors.line : colors.foreground} size={15} strokeWidth={3} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={index === columns.length - 1 || column.source !== "api"}
              onPress={() => onMoveColumn(column, 1)}
              style={styles.columnToolBtn}
            >
              <ChevronRight color={index === columns.length - 1 || column.source !== "api" ? colors.line : colors.foreground} size={15} strokeWidth={3} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onCreateTask(column)} style={styles.quickCreateBtn}>
              <Plus color={colors.black} size={14} strokeWidth={3} />
              <Text style={styles.quickCreateText}>Add</Text>
            </Pressable>
          </View>

          {/* Tasks */}
          {column.isCollapsed ? (
            <View style={styles.collapsedBody}>
              <Text style={styles.collapsedCount}>{column.tasks.length}</Text>
            </View>
          ) : (
            column.tasks.map((task, taskIndex) => (
              <TaskCard
                canMoveDown={taskIndex < column.tasks.length - 1}
                canMoveLeft={index > 0}
                canMoveRight={index < columns.length - 1}
                canMoveUp={taskIndex > 0}
                key={task.id}
                onMove={onMoveTask}
                onNudge={onNudgeTask}
                onEdit={() => onEditTask(task, column)}
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
  canMoveDown, canMoveLeft, canMoveRight, canMoveUp, onEdit, onMove, onNudge, onPress, task,
}: {
  canMoveDown: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canMoveUp: boolean;
  onEdit: () => void;
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
      onSwipeableOpen={(dir) => {
        if (dir === "left" && canMoveLeft) onMove(task, -1);
        if (dir === "right" && canMoveRight) onMove(task, 1);
      }}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => <SwipeAction label="← Prev" />}
      renderRightActions={() => <SwipeAction label="Next →" />}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.taskCard,
          isBlocked ? styles.taskCardBlocked : null,
          pressed && { opacity: 0.75 },
        ]}
      >
        {/* Priority rail */}
        <View style={[styles.taskRail, { backgroundColor: priorityColor(task.priority) }]} />

        <View style={styles.taskCardTop}>
          <Text numberOfLines={2} style={styles.taskTitle}>{task.title}</Text>
          <Pressable
            accessibilityLabel="Edit task"
            accessibilityRole="button"
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            style={styles.editIcon}
          >
            <Pencil color={colors.inkSoft} size={14} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.taskMeta}>
          <Text style={styles.taskKey}>{task.key ?? task.id.slice(0, 6).toUpperCase()}</Text>
          <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} />
          {isBlocked ? <StatusPill label="Blocked" tone="red" /> : null}
        </View>

        {(task.dueDate || task.storyPoints) ? (
          <View style={styles.taskFacts}>
            {task.dueDate ? (
              <View style={[styles.factPill, isOverdue && { backgroundColor: colors.redSoft }]}>
                <CalendarDays color={isOverdue ? colors.danger : colors.inkSoft} size={12} strokeWidth={2.4} />
                <Text style={[styles.factText, isOverdue && { color: colors.danger }]}>{formatShortDate(task.dueDate)}</Text>
              </View>
            ) : null}
            {task.storyPoints ? (
              <View style={styles.factPill}>
                <Target color={colors.inkSoft} size={12} strokeWidth={2.4} />
                <Text style={styles.factText}>{task.storyPoints}pts</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.cardActions}>
          <Pressable accessibilityRole="button" disabled={!canMoveLeft} onPress={() => onMove(task, -1)} style={styles.cardActionBtn}>
            <ChevronLeft color={canMoveLeft ? colors.foreground : colors.line} size={15} strokeWidth={3} />
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!canMoveUp} onPress={() => onNudge(task, -1)} style={styles.cardActionBtn}>
            <ArrowUp color={canMoveUp ? colors.foreground : colors.line} size={14} strokeWidth={3} />
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!canMoveDown} onPress={() => onNudge(task, 1)} style={styles.cardActionBtn}>
            <ArrowDown color={canMoveDown ? colors.foreground : colors.line} size={14} strokeWidth={3} />
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!canMoveRight} onPress={() => onMove(task, 1)} style={styles.cardActionBtn}>
            <ChevronRight color={canMoveRight ? colors.foreground : colors.line} size={15} strokeWidth={3} />
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

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({ onOpenTask, tasks }: { onOpenTask: (task: Task) => void; tasks: Task[] }) {
  return (
    <View style={styles.viewStack}>
      <Text style={styles.resultCount}>{tasks.length} {tasks.length === 1 ? "item" : "items"}</Text>
      <View style={styles.listStack}>
        {tasks.map((task) => (
          <Pressable
            accessibilityRole="button"
            key={task.id}
            onPress={() => onOpenTask(task)}
            style={({ pressed }) => [styles.listCard, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.listRail, { backgroundColor: statusColor(task.status) }]} />
            <View style={styles.listCardBody}>
              <View style={styles.listCardTop}>
                <Text numberOfLines={1} style={styles.listCardTitle}>{task.title}</Text>
                <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} />
              </View>
              <Text style={styles.listCardMeta}>{task.key ?? task.id.slice(0, 6).toUpperCase()} · {humanStatus(task.status)}</Text>
            </View>
          </Pressable>
        ))}
        {!tasks.length ? (
          <View style={styles.emptyListCard}>
            <CheckSquare2 color={colors.inkSoft} size={20} strokeWidth={2.5} />
            <Text style={styles.emptyListText}>No work items match the current filters.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Calendar view ─────────────────────────────────────────────────────────────

function CalendarView({ onOpenTask, tasks }: { onOpenTask: (task: Task) => void; tasks: Task[] }) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const days = useMemo(() => calendarDays(selectedDate, tasks), [selectedDate, tasks]);
  const selectedTasks = useMemo(() => tasksDueOn(tasks, selectedDate), [selectedDate, tasks]);
  return (
    <View style={styles.viewStack}>
      <View style={styles.calendarPanel}>
        <View style={styles.calendarHeadRow}>
          <View>
            <Text style={styles.calendarHeadTitle}>{formatMonthYear(selectedDate)}</Text>
            <Text style={styles.calendarHeadSub}>{formatFullDate(selectedDate)}</Text>
          </View>
          <View style={styles.calendarNav}>
            <Pressable accessibilityRole="button" onPress={() => setSelectedDate(shiftDateKey(selectedDate, -7))} style={styles.calendarNavBtn}>
              <ChevronLeft color={colors.foreground} size={16} strokeWidth={3} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setSelectedDate(todayKey())} style={styles.calendarTodayBtn}>
              <Text style={styles.calendarTodayText}>Today</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setSelectedDate(shiftDateKey(selectedDate, 7))} style={styles.calendarNavBtn}>
              <ChevronRight color={colors.foreground} size={16} strokeWidth={3} />
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.calendarDateRail} horizontal showsHorizontalScrollIndicator={false}>
          {days.map((day) => {
            const active = day.key === selectedDate;
            return (
              <Pressable
                accessibilityRole="button"
                key={day.key}
                onPress={() => setSelectedDate(day.key)}
                style={[styles.calendarDateCell, active && styles.calendarDateCellActive]}
              >
                <Text style={[styles.calendarWeekday, active && styles.calendarDateTextActive]}>{day.weekday}</Text>
                <Text style={[styles.calendarDayNumber, active && styles.calendarDateTextActive]}>{day.day}</Text>
                <View style={[styles.calendarCountDot, active && styles.calendarCountDotActive]}>
                  <Text style={[styles.calendarCountText, active && styles.calendarCountTextActive]}>{day.count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.calendarAgendaCard}>
        <View style={styles.sectionTitleRow}>
          <View>
            <Text style={styles.sectionTitle}>Agenda</Text>
            <Text style={styles.sectionSub}>{selectedTasks.length} scheduled item{selectedTasks.length === 1 ? "" : "s"}</Text>
          </View>
          <CalendarDays color={colors.accent} size={18} strokeWidth={2.7} />
        </View>
        <View style={styles.calendarAgendaList}>
          {selectedTasks.map((task) => (
            <Pressable
              accessibilityRole="button"
              key={task.id}
              onPress={() => onOpenTask(task)}
              style={({ pressed }) => [styles.calendarAgendaRow, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.calendarAgendaRail, { backgroundColor: priorityColor(task.priority) }]} />
              <View style={styles.calendarAgendaBody}>
                <Text numberOfLines={1} style={styles.calendarAgendaTitle}>{task.title}</Text>
                <Text numberOfLines={1} style={styles.calendarAgendaMeta}>{task.key} · {humanStatus(task.status)}</Text>
              </View>
              <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} />
            </Pressable>
          ))}
          {!selectedTasks.length ? (
            <View style={styles.emptyListCard}>
              <CalendarDays color={colors.inkSoft} size={20} strokeWidth={2.5} />
              <Text style={styles.emptyListText}>No work item is due on this date.</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── Timeline view ─────────────────────────────────────────────────────────────

function TimelineView({ onOpenTask, tasks }: { onOpenTask: (task: Task) => void; tasks: Task[] }) {
  const items = useMemo(() => buildTimelineItems(tasks), [tasks]);
  return (
    <View style={styles.viewStack}>
      <View style={styles.timelineIntro}>
        <View>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <Text style={styles.sectionSub}>Scheduled project work by start and due date</Text>
        </View>
        <Clock3 color={colors.accent} size={18} strokeWidth={2.7} />
      </View>
      <View style={styles.timelineStack}>
        {items.map((item) => {
          const task = item.task;
          return (
            <Pressable
              accessibilityRole="button"
              key={task.id}
              onPress={() => onOpenTask(task)}
              style={({ pressed }) => [styles.timelineCard, pressed && { opacity: 0.72 }]}
            >
            <View style={styles.timelineDateBox}>
              <Text style={styles.timelineDateMonth}>{formatTimelineMonth(item.endKey)}</Text>
              <Text style={styles.timelineDateDay}>{formatTimelineDay(item.endKey)}</Text>
            </View>
            <View style={[styles.timelineLine, { backgroundColor: statusColor(task.status) }]} />
            <View style={styles.timelineBody}>
              <Text numberOfLines={1} style={styles.timelineTitle}>{task.title}</Text>
              <Text numberOfLines={1} style={styles.timelineMeta}>{item.period} - {humanStatus(task.status)}</Text>
            </View>
            <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} />
            </Pressable>
          );
        })}
        {!items.length ? (
          <View style={styles.emptyListCard}>
            <Clock3 color={colors.inkSoft} size={20} strokeWidth={2.5} />
            <Text style={styles.emptyListText}>No dated work items to place on the timeline.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Settings view ─────────────────────────────────────────────────────────────

function TeamView({
  accessToken,
  initialTeamMembers,
  initialTeams,
  project,
}: {
  accessToken: string | null;
  initialTeamMembers: TeamMember[];
  initialTeams: Team[];
  project: Project;
}) {
  const [activeTab, setActiveTab] = useState<TeamDetailTab>("members");
  const [addForm, setAddForm] = useState({ role: "Member", userId: "" });
  const [bulkText, setBulkText] = useState("");
  const [bulkRoleIds, setBulkRoleIds] = useState<string[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkInviteUsersResponse | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", firstName: "", lastName: "", roleIds: [] as string[], teamRole: "Member" });
  const [members, setMembers] = useState<TeamMember[]>(initialTeamMembers);
  const [membersLoading, setMembersLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [query, setQuery] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(project.teamId ?? initialTeams[0]?.id ?? "");
  const [expandedTeamId, setExpandedTeamId] = useState(project.teamId ?? "");
  const [teamForm, setTeamForm] = useState({ description: "", name: "" });
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [tenantInviteForm, setTenantInviteForm] = useState({ email: "", firstName: "", lastName: "", roleIds: [] as string[] });
  const [users, setUsers] = useState<TenantUser[]>([]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? teams.find((team) => team.id === project.teamId) ?? teams[0] ?? null,
    [project.teamId, selectedTeamId, teams],
  );
  const filteredTeams = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return teams;
    return teams.filter((team) => [team.name, team.description, team.workspace?.name].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)));
  }, [query, teams]);
  const memberUserIds = useMemo(() => new Set(members.map((member) => member.userId)), [members]);
  const addableUsers = useMemo(() => users.filter((user) => !memberUserIds.has(user.id)), [memberUserIds, users]);
  const activeMembers = members.filter((member) => member.user.status === "ACTIVE").length;
  const invitedMembers = members.filter((member) => member.user.status === "INVITED").length;
  const uniquePerms = useMemo(() => {
    const keys = new Set<string>();
    members.forEach((member) => memberPermissionLabels(member).forEach((label) => keys.add(label)));
    return keys.size;
  }, [members]);

  const loadDirectory = useCallback(async () => {
    if (!accessToken) return;
    setDirectoryLoading(true);
    setMessage(null);
    try {
      const [teamPage, userPage, roleList, permissionList] = await Promise.all([
        listTeams(accessToken, { limit: 100, workspaceId: project.workspaceId ?? undefined }),
        listUsers(accessToken, { limit: 100 }),
        listRoles(accessToken),
        listPermissions(accessToken),
      ]);
      const nextTeams = Array.isArray(teamPage) ? teamPage : teamPage.data;
      setTeams(nextTeams);
      setUsers(Array.isArray(userPage) ? userPage : userPage.data);
      setRoles(roleList);
      setPermissions(permissionList);
      setSelectedTeamId((current) => current || project.teamId || nextTeams[0]?.id || "");
      setExpandedTeamId((current) => current || project.teamId || "");
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to load team data." });
    } finally {
      setDirectoryLoading(false);
    }
  }, [accessToken, project.teamId, project.workspaceId]);

  const loadMembers = useCallback(async (teamId = selectedTeamId) => {
    if (!accessToken || !teamId) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    try {
      setMembers(await listTeamMembers(accessToken, teamId));
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to load team members." });
    } finally {
      setMembersLoading(false);
    }
  }, [accessToken, selectedTeamId]);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);
  useEffect(() => { void loadMembers(selectedTeamId); }, [loadMembers, selectedTeamId]);

  async function handleCreateTeam() {
    if (!accessToken || !teamForm.name.trim()) return;
    setSavingTeam(true);
    setMessage(null);
    try {
      const created = await createTeam(accessToken, {
        description: teamForm.description.trim() || undefined,
        name: teamForm.name.trim(),
        workspaceId: project.workspaceId ?? undefined,
      });
      setTeams((current) => [created, ...current.filter((team) => team.id !== created.id)]);
      setSelectedTeamId(created.id);
      setExpandedTeamId(created.id);
      setActiveTab("members");
      setCreateOpen(false);
      setTeamForm({ description: "", name: "" });
      setMessage({ ok: true, text: "Team created." });
      await loadDirectory();
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to create team." });
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleInviteTeamMember() {
    if (!accessToken || !selectedTeam || !inviteForm.email.trim() || !inviteForm.firstName.trim() || !inviteForm.lastName.trim()) return;
    setSavingTeam(true);
    setMessage(null);
    try {
      const result = await inviteTeamMember(accessToken, selectedTeam.id, {
        email: inviteForm.email.trim(),
        firstName: inviteForm.firstName.trim(),
        lastName: inviteForm.lastName.trim(),
        roleIds: inviteForm.roleIds,
        teamRole: inviteForm.teamRole,
      }) as TeamInviteResult;
      setInviteForm({ email: "", firstName: "", lastName: "", roleIds: [], teamRole: "Member" });
      setMessage({ ok: result.deliveryStatus?.status !== "failed", text: describeInviteDelivery(result) });
      await Promise.all([loadMembers(selectedTeam.id), loadDirectory()]);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to invite team member." });
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleAddExistingUser() {
    if (!accessToken || !selectedTeam || !addForm.userId) return;
    setSavingTeam(true);
    setMessage(null);
    try {
      await addTeamMember(accessToken, selectedTeam.id, { role: addForm.role, userId: addForm.userId });
      setAddForm({ role: "Member", userId: "" });
      setMessage({ ok: true, text: "Tenant user added to the team." });
      await Promise.all([loadMembers(selectedTeam.id), loadDirectory()]);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to add team member." });
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleInviteTenantUser() {
    if (!accessToken || !tenantInviteForm.email.trim() || !tenantInviteForm.firstName.trim() || !tenantInviteForm.lastName.trim()) return;
    setSavingTeam(true);
    setMessage(null);
    try {
      const result = await inviteTenantUser(accessToken, {
        email: tenantInviteForm.email.trim(),
        firstName: tenantInviteForm.firstName.trim(),
        lastName: tenantInviteForm.lastName.trim(),
        roleIds: tenantInviteForm.roleIds,
      }) as TeamInviteResult;
      setTenantInviteForm({ email: "", firstName: "", lastName: "", roleIds: [] });
      setMessage({ ok: result.deliveryStatus?.status !== "failed", text: describeInviteDelivery(result, "Tenant user invited.") });
      await loadDirectory();
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to invite tenant user." });
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleBulkInvite() {
    if (!accessToken) return;
    const usersToImport = parseBulkUsers(bulkText);
    if (!usersToImport.length) {
      setMessage({ ok: false, text: "Paste at least one email address." });
      return;
    }
    setSavingTeam(true);
    setBulkResult(null);
    setMessage(null);
    try {
      const result = await bulkInviteTenantUsers(accessToken, {
        defaultRoleIds: bulkRoleIds,
        sendInvites: true,
        users: usersToImport,
      });
      setBulkResult(result);
      setMessage({ ok: result.failed ? false : true, text: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed.` });
      await loadDirectory();
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to bulk invite users." });
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleUpdateRole(member: TeamMember, role: string) {
    if (!accessToken || !selectedTeam) return;
    setSavingTeam(true);
    setMessage(null);
    try {
      await addTeamMember(accessToken, selectedTeam.id, { role, userId: member.userId });
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, role } : item));
      setMessage({ ok: true, text: "Team role updated." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to update team role." });
    } finally {
      setSavingTeam(false);
    }
  }

  function confirmRemoveMember(member: TeamMember) {
    if (!accessToken || !selectedTeam) return;
    Alert.alert("Remove member?", `Remove ${displayUser(member.user)} from ${selectedTeam.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSavingTeam(true);
            try {
              await removeTeamMember(accessToken, selectedTeam.id, member.userId);
              setMembers((current) => current.filter((item) => item.id !== member.id));
              setMessage({ ok: true, text: "Member removed." });
              await loadDirectory();
            } catch (caught) {
              setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to remove member." });
            } finally {
              setSavingTeam(false);
            }
          })();
        },
      },
    ]);
  }

  async function handleResendInvite(member: TeamMember) {
    if (!accessToken || !selectedTeam) return;
    setSavingTeam(true);
    setMessage(null);
    try {
      const result = await resendTeamMemberInvite(accessToken, selectedTeam.id, member.userId);
      setMessage({
        ok: result.deliveryStatus?.status !== "failed",
        text: describeInviteDelivery(result),
      });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to resend invitation." });
    } finally {
      setSavingTeam(false);
    }
  }

  function confirmCancelInvite(member: TeamMember) {
    if (!accessToken || !selectedTeam) return;
    Alert.alert("Cancel invitation?", `Cancel the pending invite for ${displayUser(member.user)}?`, [
      { text: "Keep invite", style: "cancel" },
      {
        text: "Cancel invite",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSavingTeam(true);
            setMessage(null);
            try {
              await cancelTeamMemberInvite(accessToken, selectedTeam.id, member.userId);
              setMembers((current) => current.filter((item) => item.id !== member.id));
              setMessage({ ok: true, text: "Invitation cancelled." });
              await loadDirectory();
            } catch (caught) {
              setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to cancel invitation." });
            } finally {
              setSavingTeam(false);
            }
          })();
        },
      },
    ]);
  }

  if (!accessToken) {
    return (
      <View style={styles.viewStack}>
        <View style={styles.emptyListCard}>
          <UsersRound color={colors.inkSoft} size={20} strokeWidth={2.5} />
          <Text style={styles.emptyListText}>Sign in again to manage teams.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.viewStack}>
      <View style={styles.teamHeader}>
        <View>
          <Text style={styles.teamHeaderTitle}>Teams</Text>
          <Text style={styles.teamHeaderSub}>{teams.length} team{teams.length !== 1 ? "s" : ""} · {users.length} users</Text>
        </View>
        <View style={styles.teamHeaderActions}>
          <Pressable accessibilityRole="button" disabled={directoryLoading} onPress={() => void loadDirectory()} style={styles.teamRefreshBtn}>
            {directoryLoading ? <ActivityIndicator color={colors.foreground} size="small" /> : null}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setCreateOpen(true)} style={styles.teamNewBtn}>
            <Plus color={colors.black} size={15} strokeWidth={3} />
            <Text style={styles.teamNewBtnText}>New</Text>
          </Pressable>
        </View>
      </View>

      {message ? (
        <View style={[styles.teamBanner, message.ok ? styles.teamBannerOk : styles.teamBannerBad]}>
          <Text style={[styles.teamBannerText, message.ok ? styles.teamBannerTextOk : styles.teamBannerTextBad]}>{message.text}</Text>
        </View>
      ) : null}

      <View style={styles.searchBox}>
        <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
        <TextInput
          onChangeText={setQuery}
          placeholder="Search teams..."
          placeholderTextColor={colors.inkSoft}
          style={styles.searchInput}
          value={query}
        />
      </View>

      <View style={styles.teamList}>
        {filteredTeams.map((team) => {
          const active = team.id === selectedTeam?.id;
          const expanded = team.id === expandedTeamId;
          const memberCount = team._count?.members ?? 0;
          const projectCount = team._count?.projects ?? 0;
          return (
            <View key={team.id} style={[styles.teamListItem, expanded && styles.teamListItemExpanded]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSelectedTeamId(team.id);
                  setExpandedTeamId(expanded ? "" : team.id);
                  setActiveTab("members");
                }}
                style={({ pressed }) => [styles.teamRow, pressed && { opacity: 0.72 }]}
              >
              <View style={[styles.teamRowAvatar, { backgroundColor: active ? teamAccent(team.name) : colors.panelMuted }]}>
                <Text style={[styles.teamRowAvatarText, { color: active ? colors.white : colors.foreground }]}>{teamInitials(team.name)}</Text>
              </View>
              <View style={styles.memberBody}>
                <Text numberOfLines={1} style={styles.teamRowName}>{team.name}</Text>
                <Text numberOfLines={1} style={styles.memberMeta}>{team._count?.members ?? 0} members · {team.workspace?.name ?? "Tenant-wide"}</Text>
              </View>
              <View style={styles.teamRowCounts}>
                <Text style={styles.teamRowCountValue}>{projectCount}</Text>
                <Text style={styles.teamRowCountLabel}>Projects</Text>
              </View>
              {expanded ? (
                <ChevronDown color={colors.accent} size={18} strokeWidth={2.7} />
              ) : (
                <ChevronRight color={colors.inkSoft} size={18} strokeWidth={2.7} />
              )}
              </Pressable>
              {expanded ? (
                <View style={styles.teamDropdown}>
                  {team.description ? (
                    <Text numberOfLines={2} style={styles.teamDropdownText}>{team.description}</Text>
                  ) : null}
                  <ScrollView contentContainerStyle={styles.teamInfoRail} horizontal showsHorizontalScrollIndicator={false}>
                    <TeamInfoPill label="Members" value={String(memberCount)} />
                    <TeamInfoPill label="Projects" value={String(projectCount)} />
                    <TeamInfoPill label="Workspace" value={team.workspace?.name ?? "Tenant"} />
                    <TeamInfoPill label="Status" value="Active" />
                    <TeamInfoPill label="Permissions" value={String(permissions.length)} />
                  </ScrollView>
                </View>
              ) : null}
            </View>
          );
        })}
        {!filteredTeams.length ? (
          <View style={styles.emptyListCard}>
            <UsersRound color={colors.inkSoft} size={20} strokeWidth={2.5} />
            <Text style={styles.emptyListText}>No teams found.</Text>
          </View>
        ) : null}
      </View>

      {selectedTeam && expandedTeamId === selectedTeam.id ? (
        <View style={styles.teamDetail}>
          <View style={styles.teamDetailHeader}>
            <View style={[styles.teamDetailAvatar, { backgroundColor: teamAccent(selectedTeam.name) }]}>
              <Text style={styles.teamCardAvatarText}>{teamInitials(selectedTeam.name)}</Text>
            </View>
            <View style={styles.memberBody}>
              <Text numberOfLines={1} style={styles.teamDetailName}>{selectedTeam.name}</Text>
              {selectedTeam.description ? (
                <Text numberOfLines={2} style={styles.memberMeta}>{selectedTeam.description}</Text>
              ) : null}
              <Text style={styles.teamDetailStats}>{invitedMembers} invited members</Text>
              <Text style={styles.teamDetailStats}>{members.length} members · {activeMembers} active · {uniquePerms} perms</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.teamTabRail} horizontal showsHorizontalScrollIndicator={false}>
            {teamTabs(users.length, members.length).map((tab) => (
              <Pressable
                accessibilityRole="button"
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.teamTab, activeTab === tab.id && styles.teamTabActive]}
              >
                <Text style={[styles.teamTabText, activeTab === tab.id && styles.teamTabTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {activeTab === "members" ? (
            <TeamMembersTab
              loading={membersLoading}
              members={members}
              onCancelInvite={confirmCancelInvite}
              onRemove={confirmRemoveMember}
              onResendInvite={(member) => void handleResendInvite(member)}
              onUpdateRole={(member, role) => void handleUpdateRole(member, role)}
              saving={savingTeam}
            />
          ) : null}

          {activeTab === "invite" ? (
            <View style={styles.teamForm}>
              <Text style={styles.teamFormTitle}>Invite to {selectedTeam.name}</Text>
              <TeamTextInput label="Email" onChangeText={(email) => setInviteForm((current) => ({ ...current, email }))} value={inviteForm.email} />
              <View style={styles.formGrid}>
                <TeamTextInput label="First name" onChangeText={(firstName) => setInviteForm((current) => ({ ...current, firstName }))} value={inviteForm.firstName} />
                <TeamTextInput label="Last name" onChangeText={(lastName) => setInviteForm((current) => ({ ...current, lastName }))} value={inviteForm.lastName} />
              </View>
              <TeamRolePicker label="Team role" onSelect={(teamRole) => setInviteForm((current) => ({ ...current, teamRole }))} selected={inviteForm.teamRole} />
              <RolePicker onChange={(roleIds) => setInviteForm((current) => ({ ...current, roleIds }))} roles={roles} selected={inviteForm.roleIds} />
              <TeamActionButton disabled={savingTeam} label={savingTeam ? "Inviting..." : "Invite member"} onPress={() => void handleInviteTeamMember()} />
            </View>
          ) : null}

          {activeTab === "add" ? (
            <View style={styles.teamForm}>
              <Text style={styles.teamFormTitle}>Add existing tenant user</Text>
              <ScrollView contentContainerStyle={styles.userPickList} nestedScrollEnabled>
                {addableUsers.slice(0, 20).map((tenantUser) => {
                  const active = addForm.userId === tenantUser.id;
                  return (
                    <Pressable key={tenantUser.id} onPress={() => setAddForm((current) => ({ ...current, userId: tenantUser.id }))} style={[styles.userPickRow, active && styles.userPickRowActive]}>
                      <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{initials(displayUser(tenantUser))}</Text></View>
                      <View style={styles.memberBody}>
                        <Text numberOfLines={1} style={styles.memberName}>{displayUser(tenantUser)}</Text>
                        <Text numberOfLines={1} style={styles.memberMeta}>{tenantUser.email} - {tenantUser.status}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {!addableUsers.length ? <Text style={styles.emptyListText}>No addable tenant users found.</Text> : null}
              </ScrollView>
              <TeamRolePicker label="Team role" onSelect={(role) => setAddForm((current) => ({ ...current, role }))} selected={addForm.role} />
              <TeamActionButton disabled={savingTeam || !addForm.userId} label={savingTeam ? "Adding..." : "Add user"} onPress={() => void handleAddExistingUser()} />
            </View>
          ) : null}

          {activeTab === "directory" ? (
            <View style={styles.teamForm}>
              <Text style={styles.teamFormTitle}>Tenant users</Text>
              <View style={styles.tenantInviteBox}>
                <Text style={styles.teamFormSub}>Invite tenant user</Text>
                <TeamTextInput label="Email" onChangeText={(email) => setTenantInviteForm((current) => ({ ...current, email }))} value={tenantInviteForm.email} />
                <View style={styles.formGrid}>
                  <TeamTextInput label="First name" onChangeText={(firstName) => setTenantInviteForm((current) => ({ ...current, firstName }))} value={tenantInviteForm.firstName} />
                  <TeamTextInput label="Last name" onChangeText={(lastName) => setTenantInviteForm((current) => ({ ...current, lastName }))} value={tenantInviteForm.lastName} />
                </View>
                <RolePicker onChange={(roleIds) => setTenantInviteForm((current) => ({ ...current, roleIds }))} roles={roles} selected={tenantInviteForm.roleIds} />
                <TeamActionButton disabled={savingTeam} label={savingTeam ? "Inviting..." : "Invite tenant user"} onPress={() => void handleInviteTenantUser()} />
              </View>
              <View style={styles.directoryList}>
                {users.slice(0, 30).map((tenantUser) => (
                  <View key={tenantUser.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{initials(displayUser(tenantUser))}</Text></View>
                    <View style={styles.memberBody}>
                      <Text numberOfLines={1} style={styles.memberName}>{displayUser(tenantUser)}</Text>
                      <Text numberOfLines={1} style={styles.memberMeta}>{tenantUser.email} - {tenantUser.status} - {tenantUser.roles?.length ?? 0} roles</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {activeTab === "bulk" ? (
            <View style={styles.teamForm}>
              <Text style={styles.teamFormTitle}>Bulk upload</Text>
              <Text style={styles.teamFormSub}>Paste one user per line: email, first name, last name. Email-only lines also work.</Text>
              <TextInput
                multiline
                onChangeText={setBulkText}
                placeholder={"ada@acme.com,Ada,Lovelace\ngrace@acme.com,Grace,Hopper"}
                placeholderTextColor={colors.inkSoft}
                style={[styles.input, styles.textArea, styles.bulkInput]}
                value={bulkText}
              />
              <RolePicker onChange={setBulkRoleIds} roles={roles} selected={bulkRoleIds} />
              <TeamActionButton disabled={savingTeam} label={savingTeam ? "Importing..." : "Import users"} onPress={() => void handleBulkInvite()} />
              {bulkResult ? (
                <View style={styles.bulkResultBox}>
                  <Text style={styles.teamFormSub}>{bulkResult.created} created - {bulkResult.updated} updated - {bulkResult.failed} failed</Text>
                  {bulkResult.results.slice(0, 5).map((row) => (
                    <Text key={row.email} numberOfLines={1} style={styles.memberMeta}>{row.email}: {row.status}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {activeTab === "roles" ? <RolesTab roles={roles} /> : null}
        </View>
      ) : (
        <View style={styles.emptyListCard}>
          <UsersRound color={colors.inkSoft} size={20} strokeWidth={2.5} />
          <Text style={styles.emptyListText}>Tap a team row to open members, invites, tenant users, bulk upload, and roles.</Text>
        </View>
      )}

      <Modal animationType="slide" onRequestClose={() => setCreateOpen(false)} transparent visible={createOpen}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <SheetHeader onClose={() => setCreateOpen(false)} title="New team" />
            <View style={styles.sheetContent}>
              <TeamTextInput autoFocus label="Team name" onChangeText={(name) => setTeamForm((current) => ({ ...current, name }))} value={teamForm.name} />
              <TeamTextInput label="Description" multiline onChangeText={(description) => setTeamForm((current) => ({ ...current, description }))} value={teamForm.description} />
            </View>
            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" onPress={() => setCreateOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={savingTeam || !teamForm.name.trim()} onPress={() => void handleCreateTeam()} style={[styles.saveBtn, (savingTeam || !teamForm.name.trim()) && styles.disabledBtn]}>
                <Text style={styles.saveBtnText}>{savingTeam ? "Creating..." : "Create team"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function TeamTextInput({
  autoFocus = false,
  label,
  multiline = false,
  onChangeText,
  value,
}: {
  autoFocus?: boolean;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <Field label={label}>
      <TextInput
        autoFocus={autoFocus}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.inkSoft}
        style={[styles.input, multiline && styles.textArea]}
        value={value}
      />
    </Field>
  );
}

function TeamRolePicker({ label, onSelect, selected }: { label: string; onSelect: (role: string) => void; selected: string }) {
  return (
    <Field label={label}>
      <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
        {teamRoleOptions.map((role) => (
          <ChoiceChip active={selected === role} key={role} label={role} onPress={() => onSelect(role)} />
        ))}
      </ScrollView>
    </Field>
  );
}

function RolePicker({ onChange, roles, selected }: { onChange: (roleIds: string[]) => void; roles: Role[]; selected: string[] }) {
  if (!roles.length) return null;
  return (
    <Field label="Tenant roles">
      <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
        {roles.map((role) => {
          const active = selected.includes(role.id);
          return (
            <ChoiceChip
              active={active}
              key={role.id}
              label={role.name}
              onPress={() => onChange(toggleString(selected, role.id))}
            />
          );
        })}
      </ScrollView>
    </Field>
  );
}

function TeamActionButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.teamSubmitBtn, disabled && styles.disabledBtn]}>
      <Text style={styles.teamSubmitText}>{label}</Text>
    </Pressable>
  );
}

function TeamInfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.teamInfoPill}>
      <Text numberOfLines={1} style={styles.teamInfoValue}>{value}</Text>
      <Text style={styles.teamInfoLabel}>{label}</Text>
    </View>
  );
}

function TeamMembersTab({
  loading,
  members,
  onCancelInvite,
  onRemove,
  onResendInvite,
  onUpdateRole,
  saving,
}: {
  loading: boolean;
  members: TeamMember[];
  onCancelInvite: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
  onResendInvite: (member: TeamMember) => void;
  onUpdateRole: (member: TeamMember, role: string) => void;
  saving: boolean;
}) {
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(() => new Set());
  function toggleMember(memberId: string) {
    setExpandedMembers((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  if (loading) {
    return (
      <View style={styles.teamForm}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.emptyListText}>Loading members...</Text>
      </View>
    );
  }
  if (!members.length) {
    return (
      <View style={styles.emptyListCard}>
        <UsersRound color={colors.inkSoft} size={20} strokeWidth={2.5} />
        <Text style={styles.emptyListText}>No members yet. Use Invite or Add user.</Text>
      </View>
    );
  }
  return (
    <View style={styles.teamMembersList}>
      {members.map((member) => {
        const expanded = expandedMembers.has(member.id);
        const isInvited = member.user.status === "INVITED";
        return (
          <View key={member.id} style={styles.teamMemberCard}>
            <Pressable
              accessibilityRole="button"
              onPress={() => toggleMember(member.id)}
              style={({ pressed }) => [styles.memberCompactRow, pressed && { opacity: 0.72 }]}
            >
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{initials(displayUser(member.user))}</Text>
              </View>
              <View style={styles.memberBody}>
                <Text numberOfLines={1} style={styles.memberName}>{displayUser(member.user)}</Text>
                <Text numberOfLines={1} style={styles.memberMeta}>{member.user.email} - {member.user.status}</Text>
              </View>
              <View style={styles.memberRoleBadge}>
                <Text numberOfLines={1} style={styles.memberRoleBadgeText}>{member.role ?? "Member"}</Text>
              </View>
              {expanded ? (
                <ChevronDown color={colors.accent} size={17} strokeWidth={2.7} />
              ) : (
                <ChevronRight color={colors.inkSoft} size={17} strokeWidth={2.7} />
              )}
            </Pressable>
            {expanded ? (
              <View style={styles.memberExpandedPanel}>
                <TeamRolePicker label="Team role" onSelect={(role) => onUpdateRole(member, role)} selected={member.role ?? "Member"} />
                <View style={styles.memberPermRow}>
                  {memberPermissionLabels(member).slice(0, 4).map((permission) => (
                    <View key={permission} style={styles.permissionPill}>
                      <Text numberOfLines={1} style={styles.permissionPillText}>{permission}</Text>
                    </View>
                  ))}
                {memberPermissionLabels(member).length > 4 ? <Text style={styles.memberMeta}>+{memberPermissionLabels(member).length - 4}</Text> : null}
              </View>
                {isInvited ? (
                  <View style={styles.memberInviteActions}>
                    <Pressable accessibilityRole="button" disabled={saving} onPress={() => onResendInvite(member)} style={styles.memberInviteAction}>
                      <RefreshCw color={colors.foreground} size={14} strokeWidth={2.5} />
                      <Text style={styles.memberInviteActionText}>Resend</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={saving} onPress={() => onCancelInvite(member)} style={[styles.memberInviteAction, styles.memberInviteCancelAction]}>
                      <X color={colors.danger} size={14} strokeWidth={2.5} />
                      <Text style={styles.memberInviteCancelText}>Cancel invite</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable accessibilityRole="button" disabled={saving} onPress={() => onRemove(member)} style={styles.memberRemoveRow}>
                    <Trash2 color={colors.danger} size={15} strokeWidth={2.5} />
                    <Text style={styles.memberRemoveText}>Remove member</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function RolesTab({ roles }: { roles: Role[] }) {
  return (
    <View style={styles.roleGrid}>
      {roles.map((role) => {
        const permissions = role.permissions?.map(({ permission }) => permissionLabel(permission)).filter(Boolean) ?? [];
        return (
          <View key={role.id} style={styles.roleCard}>
            <View style={styles.roleHeader}>
              <View>
                <Text style={styles.roleTitle}>{role.name}</Text>
                <Text style={styles.memberMeta}>{role.description ?? "Tenant role"}</Text>
              </View>
              {role.isSystem ? (
                <View style={styles.systemPill}>
                  <Text style={styles.systemPillText}>System</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.memberPermRow}>
              {permissions.slice(0, 5).map((permission) => (
                <View key={permission} style={styles.permissionPill}>
                  <Text numberOfLines={1} style={styles.permissionPillText}>{permission}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.memberMeta}>{permissions.length} permissions - {role._count?.users ?? 0} users</Text>
          </View>
        );
      })}
      {!roles.length ? (
        <View style={styles.emptyListCard}>
          <UsersRound color={colors.inkSoft} size={20} strokeWidth={2.5} />
          <Text style={styles.emptyListText}>No roles returned by the API.</Text>
        </View>
      ) : null}
    </View>
  );
}

function DocsView({ documents }: { documents: WorkspaceDocument[] }) {
  return (
    <View style={styles.viewStack}>
      <View style={styles.docsHero}>
        <View>
          <Text style={styles.sectionTitle}>Docs</Text>
          <Text style={styles.sectionSub}>Project documents linked from the web document center</Text>
        </View>
        <Text style={styles.sectionCount}>{documents.length}</Text>
      </View>
      <View style={styles.docsStack}>
        {documents.map((document) => (
          <View key={document.id} style={styles.docRow}>
            <View style={styles.docIcon}>
              <FileText color={colors.accent} size={18} strokeWidth={2.6} />
            </View>
            <View style={styles.memberBody}>
              <Text numberOfLines={1} style={styles.memberName}>{document.title}</Text>
              <Text numberOfLines={1} style={styles.memberMeta}>{document.documentType} - {document.status} - updated {formatShortDate(document.updatedAt)}</Text>
            </View>
          </View>
        ))}
        {!documents.length ? (
          <View style={styles.emptyListCard}>
            <FileText color={colors.inkSoft} size={20} strokeWidth={2.5} />
            <Text style={styles.emptyListText}>No project documents are linked yet.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SettingsView({ board, onCreateColumn, project }: { board: ProjectBoard | null; onCreateColumn: () => void; project: Project }) {
  return (
    <View style={styles.viewStack}>
      <View style={styles.settingsCard}>
        <SettingsRow label="Project" value={project.name} />
        <SettingsRow label="Board" value={board?.name ?? "Default board"} />
        <SettingsRow label="Columns" value={String(board?.columns?.length ?? defaultColumns.length)} />
        <SettingsRow label="Source" value="Agile board" last />
      </View>
      <Pressable accessibilityRole="button" onPress={onCreateColumn} style={styles.settingsActionBtn}>
        <Layers3 color={colors.black} size={17} strokeWidth={2.8} />
        <Text style={styles.settingsActionText}>{board ? "Add board column" : "Create board and column"}</Text>
      </Pressable>
    </View>
  );
}

function SettingsRow({ label, last = false, value }: { label: string; last?: boolean; value: string }) {
  return (
    <View style={[styles.settingsRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.settingsLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.settingsValue}>{value}</Text>
    </View>
  );
}

// ── Utility view ──────────────────────────────────────────────────────────────

// ── Priority bars ─────────────────────────────────────────────────────────────

function PriorityBars({ tasks }: { tasks: Task[] }) {
  const max = Math.max(1, ...taskPriorities.map((p) => tasks.filter((t) => t.priority === p).length));
  return (
    <View style={styles.priorityStack}>
      {taskPriorities.map((priority) => {
        const count = tasks.filter((t) => t.priority === priority).length;
        return (
          <View key={priority} style={styles.priorityRow}>
            <Text style={styles.priorityLabel}>{humanPriority(priority)}</Text>
            <View style={styles.priorityTrack}>
              <View style={[styles.priorityFill, { width: `${(count / max) * 100}%`, backgroundColor: priorityColor(priority) }]} />
            </View>
            <Text style={styles.priorityCount}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Sheets ────────────────────────────────────────────────────────────────────

function TaskEditorSheet({
  columns, form, onChange, onClose, onDelete, onSave, saving, state,
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [picker, setPicker] = useState<PickerSheetState>(null);
  if (!state) return null;
  const title = state.mode === "create" ? "Create work item" : "Edit work item";
  const selectedColumn = columns.find((column) => column.id === form.columnId) ?? state.column;

  function openPicker(next: NonNullable<PickerSheetState>) {
    setPicker(next);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <WorkItemSheetHeader
              mode={state.mode}
              onClose={onClose}
              subtitle="Task details, board placement, schedule, and effort"
              title={title}
            />

            <ScrollView contentContainerStyle={styles.workSheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TaskSectionCard
                description="Write the work clearly enough that the next owner can act without context switching."
                icon={<CheckSquare2 color={colors.foreground} size={18} strokeWidth={2.6} />}
                title="Work item basics"
              >
                <Field helper="Keep it short, outcome-focused, and searchable." label="Title">
                  <TextInput autoFocus={state.mode === "create"} onChangeText={(v) => onChange({ ...form, title: v })} placeholder="Write a clear task title" placeholderTextColor={colors.inkSoft} style={styles.input} value={form.title} />
                </Field>
                <Field helper="Add acceptance notes, links, blockers, or handoff details." label="Description">
                  <TextInput multiline onChangeText={(v) => onChange({ ...form, description: v })} placeholder="Add context, acceptance notes, or links" placeholderTextColor={colors.inkSoft} style={[styles.input, styles.textArea]} value={form.description} />
                </Field>
              </TaskSectionCard>

              <TaskSectionCard
                description="Choose where this item lives on the board and how it should be triaged."
                icon={<Layers3 color={colors.foreground} size={18} strokeWidth={2.6} />}
                title="Board routing"
              >
                <PickerButton
                  helper="Move the item into the right delivery lane."
                  label="Column"
                  onPress={() => openPicker({
                    helper: "Pick the board column this work item belongs to.",
                    options: columns.map((column) => ({ detail: humanStatus(column.status), label: column.name, value: column.id })),
                    title: "Choose column",
                    value: form.columnId,
                    onSelect: (value) => {
                      const column = columns.find((item) => item.id === value);
                      onChange({ ...form, columnId: value, status: column?.status ?? form.status });
                    },
                  })}
                  value={selectedColumn.name}
                />
                <View style={styles.formGrid}>
                  <PickerButton
                    helper="Controls visual urgency and planning order."
                    label="Priority"
                    onPress={() => openPicker({
                      helper: "Critical should be rare and reserved for work that needs immediate attention.",
                      options: taskPriorities.map((priority) => ({ detail: priorityHelp(priority), label: humanPriority(priority), value: priority })),
                      title: "Choose priority",
                      value: form.priority,
                      onSelect: (value) => onChange({ ...form, priority: value as TaskPriority }),
                    })}
                    value={humanPriority(form.priority)}
                  />
                  <PickerButton
                    helper="Classifies reporting and sprint views."
                    label="Type"
                    onPress={() => openPicker({
                      helper: "Use story or feature for planned delivery, bug or incident for fixes.",
                      options: taskTypes.map((type) => ({ detail: taskTypeHelp(type), label: humanStatus(type), value: type })),
                      title: "Choose type",
                      value: form.type,
                      onSelect: (value) => onChange({ ...form, type: value as TaskType }),
                    })}
                    value={humanStatus(form.type)}
                  />
                </View>
              </TaskSectionCard>

              <TaskSectionCard
                description="Set the due date and effort without crowding the form."
                icon={<CalendarDays color={colors.foreground} size={18} strokeWidth={2.6} />}
                title="Schedule and effort"
              >
                <RollerDateField
                  helperText="Tap to choose year, month, and day."
                  label="Due date"
                  onClear={() => onChange({ ...form, dueDate: "" })}
                  onPress={() => setDatePickerOpen(true)}
                  placeholder="No due date"
                  value={form.dueDate}
                />
                <View style={styles.quickRail}>
                  {quickDueOptions.map((opt) => (
                    <ChoiceChip active={form.dueDate === dateOffset(opt.offset)} key={opt.label} label={opt.label} onPress={() => onChange({ ...form, dueDate: dateOffset(opt.offset) })} />
                  ))}
                  <ChoiceChip active={!form.dueDate} label="No date" onPress={() => onChange({ ...form, dueDate: "" })} />
                </View>
                <View style={styles.effortStack}>
                  <StepperField
                    keyboardType="number-pad"
                    label="Story points"
                    onChange={(storyPoints) => onChange({ ...form, storyPoints })}
                    options={["1", "2", "3", "5", "8", "13"]}
                    step={1}
                    value={form.storyPoints}
                  />
                  <StepperField
                    decimal
                    keyboardType="decimal-pad"
                    label="Estimated time"
                    onChange={(estimateHours) => onChange({ ...form, estimateHours })}
                    options={["1", "2", "4", "8"]}
                    step={0.5}
                    suffix="h"
                    value={form.estimateHours}
                  />
                </View>
              </TaskSectionCard>
            </ScrollView>

            <View style={styles.sheetActions}>
              {onDelete ? (
                <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteBtn}>
                  <Trash2 color={colors.danger} size={18} strokeWidth={2.7} />
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={saving || !form.title.trim()} onPress={onSave} style={[styles.saveBtn, (saving || !form.title.trim()) && styles.disabledBtn]}>
                <Text style={styles.saveBtnText}>{saving ? "Saving..." : state.mode === "create" ? "Create" : "Update"}</Text>
                <ArrowRight color={colors.black} size={16} strokeWidth={3} />
              </Pressable>
            </View>
          </View>
          {datePickerOpen ? (
            <InlineDateRollerPicker
              onClose={() => setDatePickerOpen(false)}
              onSelect={(value) => {
                onChange({ ...form, dueDate: value });
                setDatePickerOpen(false);
              }}
              title="Due date"
              value={form.dueDate}
            />
          ) : null}
      <OptionPickerSheet onClose={() => setPicker(null)} picker={picker} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function WorkItemSheetHeader({
  mode,
  onClose,
  subtitle,
  title,
}: {
  mode: "create" | "edit";
  onClose: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.workHeader}>
      <View style={styles.sheetHandle} />
      <View style={styles.workHeaderTop}>
        <View style={styles.workHeaderCopy}>
          <Text style={styles.workEyebrow}>{mode === "create" ? "New task" : "Task update"}</Text>
          <Text style={styles.workTitle}>{title}</Text>
          <Text style={styles.workSubtitle}>{subtitle}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
          <X color={colors.foreground} size={20} strokeWidth={2.8} />
        </Pressable>
      </View>
      <View style={styles.workSteps}>
        {["Basics", "Route", "Plan"].map((label, index) => (
          <View key={label} style={styles.workStep}>
            <View style={[styles.workStepDot, index === 0 ? styles.workStepDotActive : null]}>
              <Text style={[styles.workStepNumber, index === 0 ? styles.workStepNumberActive : null]}>{index + 1}</Text>
            </View>
            <Text style={styles.workStepLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TaskSectionCard({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.taskSectionCard}>
      <View style={styles.taskSectionHead}>
        <View style={styles.taskSectionIcon}>{icon}</View>
        <View style={styles.taskSectionCopy}>
          <Text style={styles.taskSectionTitle}>{title}</Text>
          <Text style={styles.taskSectionDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.taskSectionBody}>{children}</View>
    </View>
  );
}

function PickerButton({
  helper,
  label,
  onPress,
  value,
}: {
  helper: string;
  label: string;
  onPress: () => void;
  value: string;
}) {
  return (
    <View style={styles.pickerField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.pickerButton}>
        <View style={styles.pickerButtonCopy}>
          <Text numberOfLines={1} style={styles.pickerButtonValue}>{value}</Text>
          <Text numberOfLines={2} style={styles.pickerButtonHelper}>{helper}</Text>
        </View>
        <ChevronDown color={colors.inkSoft} size={18} strokeWidth={2.8} />
      </Pressable>
    </View>
  );
}

function StepperField({
  decimal = false,
  keyboardType,
  label,
  onChange,
  options,
  step,
  suffix = "",
  value,
}: {
  decimal?: boolean;
  keyboardType: "decimal-pad" | "number-pad";
  label: string;
  onChange: (value: string) => void;
  options: string[];
  step: number;
  suffix?: string;
  value: string;
}) {
  function adjust(direction: -1 | 1) {
    const current = numericValue(value);
    const next = Math.max(0, current + step * direction);
    onChange(formatStepperValue(next, decimal));
  }

  return (
    <View style={styles.stepperCard}>
      <View style={styles.stepperHeader}>
        <Text style={styles.stepperLabel}>{label}</Text>
        {suffix ? <Text style={styles.stepperSuffix}>{suffix}</Text> : null}
      </View>
      <View style={styles.stepperControl}>
        <Pressable accessibilityLabel={`Decrease ${label}`} accessibilityRole="button" onPress={() => adjust(-1)} style={styles.stepperBtn}>
          <ArrowDown color={colors.foreground} size={16} strokeWidth={3} />
        </Pressable>
        <TextInput
          keyboardType={keyboardType}
          onChangeText={(next) => onChange(sanitizeStepperValue(next, decimal))}
          placeholder="0"
          placeholderTextColor={colors.inkSoft}
          style={styles.stepperInput}
          value={value}
        />
        <Pressable accessibilityLabel={`Increase ${label}`} accessibilityRole="button" onPress={() => adjust(1)} style={[styles.stepperBtn, styles.stepperBtnPrimary]}>
          <ArrowUp color={colors.black} size={17} strokeWidth={3} />
        </Pressable>
      </View>
      <View style={styles.stepperQuickRail}>
        {options.map((option) => {
          const active = value === option;
          return (
            <Pressable accessibilityRole="button" key={option} onPress={() => onChange(option)} style={[styles.stepperQuickBtn, active ? styles.stepperQuickBtnActive : null]}>
              <Text style={[styles.stepperQuickText, active ? styles.stepperQuickTextActive : null]}>{option}{suffix}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function OptionPickerSheet({ onClose, picker }: { onClose: () => void; picker: PickerSheetState }) {
  if (!picker) return null;
  return (
      <View pointerEvents="box-none" style={styles.inlinePickerLayer}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.inlinePickerScrim} />
        <View style={styles.optionSheet}>
          <View style={styles.optionHeader}>
            <View>
              <Text style={styles.workEyebrow}>Choose option</Text>
              <Text style={styles.optionTitle}>{picker.title}</Text>
              <Text style={styles.optionHelper}>{picker.helper}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.optionList} showsVerticalScrollIndicator={false} style={styles.optionScroll}>
            {picker.options.map((option) => {
              const active = option.value === picker.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => {
                    picker.onSelect(option.value);
                    onClose();
                  }}
                  style={[styles.optionRow, active ? styles.optionRowActive : null]}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>{option.label}</Text>
                    {option.detail ? <Text style={styles.optionDetail}>{option.detail}</Text> : null}
                  </View>
                  <View style={[styles.optionCheck, active ? styles.optionCheckActive : null]}>
                    {active ? <CheckSquare2 color={colors.black} size={16} strokeWidth={2.8} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
  );
}

function ColumnEditorSheet({
  form, onChange, onClose, onDelete, onSave, saving, state,
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
              <TextInput autoFocus onChangeText={(v) => onChange({ ...form, name: v })} placeholder="In progress" placeholderTextColor={colors.inkSoft} style={styles.input} value={form.name} />
            </Field>
            <Field label="Mapped status">
              <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
                {taskStatuses.map((s) => (
                  <ChoiceChip active={form.status === s} key={s} label={humanStatus(s)} onPress={() => onChange({ ...form, status: s })} />
                ))}
              </ScrollView>
            </Field>
            <Field label="WIP limit">
              <TextInput keyboardType="number-pad" onChangeText={(v) => onChange({ ...form, wipLimit: v })} placeholder="No limit" placeholderTextColor={colors.inkSoft} style={styles.input} value={form.wipLimit} />
            </Field>
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.fieldLabel}>Collapsed</Text>
                <Text style={styles.fieldHint}>Show this column as a slim rail.</Text>
              </View>
              <Switch onValueChange={(v) => onChange({ ...form, isCollapsed: v })} thumbColor={colors.white} trackColor={{ false: colors.line, true: colors.primary }} value={form.isCollapsed} />
            </View>
          </ScrollView>
          <View style={styles.sheetActions}>
            {onDelete ? (
              <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteBtn}>
                <Trash2 color={colors.danger} size={18} strokeWidth={2.7} />
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving || !form.name.trim()} onPress={onSave} style={[styles.saveBtn, (saving || !form.name.trim()) && styles.disabledBtn]}>
              <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save column"}</Text>
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
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
          <X color={colors.foreground} size={20} strokeWidth={2.8} />
        </Pressable>
      </View>
    </View>
  );
}

function Field({ children, helper, label }: { children: ReactNode; helper?: string; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {helper ? <Text style={styles.fieldHint}>{helper}</Text> : null}
    </View>
  );
}

function ChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choiceChip, active && styles.choiceChipActive]}>
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function confirmBoardTaskMove({ message, title }: { message: string; title: string }) {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    Alert.alert(title, message, [
      { onPress: () => done(false), style: "cancel", text: "Keep here" },
      { onPress: () => done(true), text: "Move item" },
    ], {
      cancelable: true,
      onDismiss: () => done(false),
    });
  });
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function buildColumns(board: ProjectBoard | null, tasks: Task[]): WorkColumn[] {
  if (board?.columns?.length) {
    return [...board.columns]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((col) => ({
        id: col.id,
        isCollapsed: Boolean(col.isCollapsed),
        name: col.name,
        sortOrder: col.sortOrder,
        source: "api",
        status: normalizeStatus(col.status),
        tasks: tasksForColumn(col, tasks),
        wipLimit: col.wip?.limit ?? col.wipLimit ?? null,
      }));
  }
  return defaultColumns.map((col, i) => ({
    id: col.status,
    isCollapsed: false,
    name: col.name,
    sortOrder: i,
    source: "fallback",
    status: col.status,
    tasks: tasks.filter((t) => t.status === col.status).sort(sortTasks),
    wipLimit: null,
  }));
}

function tasksForColumn(column: BoardColumn, tasks: Task[]) {
  const columnTasks = Array.isArray(column.tasks) ? column.tasks : [];
  if (columnTasks.length) return [...columnTasks].sort(sortTasks);
  const status = normalizeStatus(column.status);
  return tasks.filter((t) => t.boardColumnId === column.id || (!t.boardColumnId && t.status === status)).sort(sortTasks);
}

function sortTasks(a: Task, b: Task) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.updatedAt ?? "").localeCompare(String(b.updatedAt ?? ""));
}

function buildSummary(tasks: Task[]) {
  const now = Date.now();
  const ago7 = now - 7 * 24 * 60 * 60 * 1000;
  const ahead7 = now + 7 * 24 * 60 * 60 * 1000;
  return {
    completed: tasks.filter((t) => t.status === "DONE" && dateMs(t.completedAt) >= ago7).length,
    created: tasks.filter((t) => dateMs(t.createdAt) >= ago7).length,
    dueSoon: tasks.filter((t) => { const d = dateMs(t.dueDate); return d > now && d <= ahead7 && t.status !== "DONE" && t.status !== "CANCELLED"; }).length,
    updated: tasks.filter((t) => dateMs(t.updatedAt) >= ago7).length,
  };
}

function calendarDays(selectedKey: string, tasks: Task[]) {
  return Array.from({ length: 9 }, (_, index) => {
    const key = shiftDateKey(selectedKey, index - 4);
    return {
      count: tasksDueOn(tasks, key).length,
      day: formatTimelineDay(key),
      key,
      weekday: dateFromKey(key).toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
    };
  });
}

function tasksDueOn(tasks: Task[], key: string) {
  return tasks
    .filter((task) => taskDueKey(task) === key)
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || String(a.title).localeCompare(String(b.title)));
}

function buildTimelineItems(tasks: Task[]) {
  return tasks
    .map((task) => {
      const startKey = task.startDate ? dateKeyFromValue(task.startDate) : null;
      const endKey = task.dueDate ? dateKeyFromValue(task.dueDate) : null;
      const fallbackKey = dateKeyFromValue(task.updatedAt ?? task.createdAt);
      const key = endKey ?? startKey ?? fallbackKey;
      if (!key) return null;
      return {
        endKey: key,
        period: startKey && endKey ? `${formatShortDate(startKey)} - ${formatShortDate(endKey)}` : formatShortDate(key),
        task,
      };
    })
    .filter((item): item is { endKey: string; period: string; task: Task } => Boolean(item))
    .sort((a, b) => a.endKey.localeCompare(b.endKey))
    .slice(0, 20);
}

function taskDueKey(task: Task) {
  return task.dueDate ? dateKeyFromValue(task.dueDate) : null;
}

function findTaskColumn(columns: WorkColumn[], task: Task) {
  return columns.find((col) => col.tasks.some((t) => t.id === task.id)) ?? null;
}

function emptyTaskForm(column?: WorkColumn): TaskFormState {
  return { columnId: column?.id ?? "", description: "", dueDate: "", estimateHours: "", priority: "MEDIUM", status: column?.status ?? "TODO", storyPoints: "", title: "", type: "TASK" };
}

function taskToForm(task: Task, column: WorkColumn): TaskFormState {
  return {
    columnId: column.id,
    description: task.description ?? "",
    dueDate: dateKeyFromValue(task.dueDate) ?? "",
    estimateHours: task.estimateMins ? trimNumber(task.estimateMins / 60) : "",
    priority: task.priority,
    status: task.status,
    storyPoints: task.storyPoints ? String(task.storyPoints) : "",
    title: task.title,
    type: task.type,
  };
}

function emptyColumnForm(status: TaskStatus = "TODO"): ColumnFormState {
  return { isCollapsed: false, name: "", status, wipLimit: "" };
}

function columnToForm(column: WorkColumn): ColumnFormState {
  return { isCollapsed: column.isCollapsed, name: column.name, status: column.status, wipLimit: column.wipLimit ? String(column.wipLimit) : "" };
}

function arrayMove<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

function nextValue<T extends string>(values: readonly T[], current: T) {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length] ?? current;
}

function cleanDate(value: string) {
  const t = value.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return `${t}T12:00:00.000Z`;
}

function numericValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeStepperValue(value: string, decimal: boolean) {
  const cleaned = decimal ? value.replace(/[^0-9.]/g, "") : value.replace(/[^0-9]/g, "");
  if (!decimal) return cleaned;
  const [first = "", ...rest] = cleaned.split(".");
  return rest.length ? `${first}.${rest.join("")}` : first;
}

function formatStepperValue(value: number, decimal: boolean) {
  if (!decimal) return String(Math.round(value));
  return trimNumber(value);
}

function dateOffset(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function todayKey() {
  return dateKeyFromDate(new Date());
}

function shiftDateKey(key: string, days: number) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKeyFromDate(date);
}

function dateKeyFromValue(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return dateKeyFromDate(date);
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key: string) {
  const [year = "1970", month = "1", day = "1"] = key.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function parsePositiveFloat(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePositiveInt(value: string) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function dateMs(value: unknown) {
  if (!value) return 0;
  const t = new Date(String(value)).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatShortDate(value: unknown) {
  if (!value) return "No date";
  const text = String(value);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(text) ? dateFromKey(text) : new Date(text);
  if (Number.isNaN(d.getTime())) return "No date";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMonthYear(key: string) {
  return dateFromKey(key).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatFullDate(key: string) {
  return dateFromKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short", weekday: "long" });
}

function formatTimelineMonth(key: string) {
  return dateFromKey(key).toLocaleDateString(undefined, { month: "short" }).toUpperCase();
}

function formatTimelineDay(key: string) {
  return String(dateFromKey(key).getDate());
}

function humanPriority(priority: string) {
  return priority.charAt(0) + priority.slice(1).toLowerCase().replaceAll("_", " ");
}

function priorityHelp(priority: string) {
  switch (priority) {
    case "CRITICAL":
      return "Production-impacting or executive-level urgency.";
    case "URGENT":
      return "Needs fast action but can still be planned.";
    case "HIGH":
      return "Important work that should stay visible.";
    case "LOW":
      return "Useful work with flexible timing.";
    case "MEDIUM":
    default:
      return "Normal priority for planned delivery work.";
  }
}

function humanStatus(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function taskTypeHelp(type: string) {
  switch (type) {
    case "BUG":
      return "Defect or regression that needs correction.";
    case "STORY":
      return "User-facing delivery slice for a sprint.";
    case "EPIC":
      return "Large initiative that may break into tasks.";
    case "FEATURE":
      return "Product capability or enhancement.";
    case "INCIDENT":
      return "Operational issue or service disruption.";
    case "APPROVAL":
      return "Decision or sign-off request.";
    case "CHANGE_REQUEST":
      return "Scope, timeline, or budget change.";
    case "MILESTONE":
      return "Key delivery checkpoint.";
    case "TASK":
    default:
      return "General work item.";
  }
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

function priorityColor(priority: string) {
  if (priority === "CRITICAL") return colors.danger;
  if (priority === "URGENT") return colors.warning;
  if (priority === "HIGH") return "#b45309";
  if (priority === "LOW") return colors.inkSoft;
  return colors.accent;
}

function priorityRank(priority: string) {
  return taskPriorities.indexOf(priority as TaskPriority);
}

function displayUser(user: { email?: string; firstName?: string; lastName?: string }) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email || "Unknown member";
}

function describeInviteDelivery(result?: TeamInviteResult, fallback = "Invite created and user added.") {
  const delivery = result?.deliveryStatus;
  if (!delivery) return fallback;
  if (delivery.channel === "in_app") return "Existing user notified in the app.";
  if (delivery.channel === "none") return delivery.message || fallback;
  if (delivery.status === "sent") return "Invite email sent.";
  if (delivery.status === "skipped") {
    return `Invite created, but email delivery is disabled${delivery.provider ? ` (${delivery.provider})` : ""}. Configure mail and use Resend.`;
  }
  return `Invite created, but email delivery failed${delivery.provider ? ` via ${delivery.provider}` : ""}${delivery.error ? `: ${delivery.error}` : "."}`;
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : value.slice(0, 2);
  return letters.toUpperCase();
}

function teamTabs(users: number, members: number): { id: TeamDetailTab; label: string }[] {
  return [
    { id: "members", label: `Members (${members})` },
    { id: "invite", label: "Invite" },
    { id: "add", label: "Add user" },
    { id: "directory", label: `Tenant users (${users})` },
    { id: "bulk", label: "Bulk upload" },
    { id: "roles", label: "Roles" },
  ];
}

function teamAccent(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return teamAccents[hash % teamAccents.length] ?? colors.accent;
}

function teamInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "TM";
}

function toggleString(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function permissionLabel(permission: Permission) {
  return `${permission.action}:${permission.subject}`.toLowerCase();
}

function memberPermissionLabels(member: TeamMember) {
  const labels = new Set<string>();
  member.user.roles?.forEach(({ role }) => {
    role.permissions?.forEach(({ permission }) => labels.add(permissionLabel(permission)));
  });
  return [...labels];
}

function parseBulkUsers(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [email = "", firstName = "", lastName = ""] = line.split(/[,\t;]/).map((part) => part.trim());
      return { email, firstName: firstName || undefined, lastName: lastName || undefined };
    })
    .filter((user) => /@/.test(user.email));
}

function statusColor(status: TaskStatus) {
  if (status === "DONE") return colors.success;
  if (status === "IN_PROGRESS") return colors.accent;
  if (status === "REVIEW" || status === "TESTING") return "#7c3aed";
  if (status === "CANCELLED") return colors.danger;
  if (status === "BACKLOG") return "#8b8f9a";
  return "#e7bc00";
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 14, paddingBottom: 116, paddingTop: 8 },

  // Center / empty states
  center: { alignItems: "center", flex: 1, gap: 14, justifyContent: "center", padding: 24 },
  centerText: { color: colors.inkSoft, fontSize: 14, fontWeight: "800" },
  emptyIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: radii.lg, height: 60, justifyContent: "center", marginBottom: 4, width: 60 },
  emptyTitle: { color: colors.foreground, fontSize: 21, fontWeight: "900" },
  emptyBody: { color: colors.inkSoft, fontSize: 14, fontWeight: "800", lineHeight: 20, textAlign: "center" },
  primaryBtn: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.lg, flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  primaryBtnText: { color: colors.black, fontSize: 14, fontWeight: "900" },

  // Top bar
  topBar: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 8 },
  iconBtn: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
    ...shadow.card,
  },
  aiHeaderBtn: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderColor: "#dbeafe",
    borderRadius: 22,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
    ...shadow.card,
  },
  projectPill: {
    alignItems: "center",
    backgroundColor: colors.foreground,
    borderRadius: 999,
    flexDirection: "row",
    flex: 1,
    gap: 6,
    marginHorizontal: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  projectPillText: { color: colors.white, flex: 1, fontSize: 15, fontWeight: "900" },
  topActions: { alignItems: "center", flexDirection: "row", gap: 10 },
  addBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
    height: 46,
    justifyContent: "center",
    width: 46,
    shadowColor: "#e7bc00",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },

  // View tabs
  tabs: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: 24,
    paddingHorizontal: 20,
  },
  tabBtn: { alignItems: "center", justifyContent: "center", minHeight: 40 },
  tabText: { color: colors.inkSoft, fontSize: 15, fontWeight: "900" },
  tabTextActive: { color: colors.accent },
  tabUnderline: { backgroundColor: colors.accent, borderRadius: 999, bottom: -1, height: 2, left: 0, position: "absolute", right: 0 },

  // Filters
  filterStack: { gap: 10, paddingHorizontal: 20 },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    ...shadow.card,
  },
  searchInput: { color: colors.foreground, flex: 1, fontSize: 15, fontWeight: "800" },
  filterRail: { gap: 8, paddingRight: 20 },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterChipActive: { backgroundColor: colors.yellowSoft, borderColor: "#e7bc00" },
  filterChipText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800" },
  filterChipTextActive: { color: colors.black, fontWeight: "900" },
  addColumnChip: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: "#e7bc00",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  addColumnText: { color: colors.black, fontSize: 13, fontWeight: "900" },

  // Saving / error
  savingPill: { alignItems: "center", alignSelf: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  savingText: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  errorBox: { backgroundColor: colors.redSoft, borderColor: "#fecaca", borderRadius: radii.xl, borderWidth: 1, marginHorizontal: 20, padding: 13 },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "800" },

  // View stack wrapper
  viewStack: { gap: 14, paddingHorizontal: 20 },
  resultCount: { color: colors.inkSoft, fontSize: 13, fontWeight: "800" },

  // Summary / metric grid
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { borderRadius: radii.xl, flexBasis: "47.5%", flexGrow: 1, gap: 4, minHeight: 100, padding: 14, ...shadow.card },
  metricCardIcon: { marginBottom: 4 },
  metricValue: { fontSize: 26, fontWeight: "900" },
  metricLabel: { fontSize: 13, fontWeight: "900" },
  metricSub: { fontSize: 11, fontWeight: "700", opacity: 0.7 },

  // Analytics card
  analyticsCard: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 14, padding: 18, ...shadow.card },
  analyticsTitle: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  analyticsSub: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: -10 },

  // Status bars in summary
  statusRows: { gap: 14 },
  statusBarRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  statusDot: { borderRadius: 99, flexShrink: 0, height: 10, width: 10 },
  statusName: { color: colors.foreground, fontSize: 13, fontWeight: "900", width: 80 },
  statusTrack: { backgroundColor: colors.line, borderRadius: 99, flex: 1, flexDirection: "row", height: 6, overflow: "hidden" },
  statusCount: { color: colors.foreground, fontSize: 13, fontWeight: "900", textAlign: "right", width: 24 },

  // Priority bars
  priorityStack: { gap: 12 },
  priorityRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  priorityLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: "900", width: 68 },
  priorityTrack: { backgroundColor: colors.line, borderRadius: 99, flex: 1, height: 8, overflow: "hidden" },
  priorityFill: { borderRadius: 99, height: 8 },
  priorityCount: { color: colors.foreground, fontSize: 13, fontWeight: "900", textAlign: "right", width: 24 },

  // Board / columns
  boardContent: { gap: 12, paddingBottom: 10, paddingHorizontal: 20, paddingRight: 28 },
  column: {
    backgroundColor: "#eef0f6",
    borderRadius: radii.xl,
    borderTopWidth: 4,
    gap: 8,
    minHeight: 220,
    overflow: "hidden",
    padding: 10,
    width: 316,
  },
  columnCollapsed: { width: 100 },
  columnHeader: { alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 4, paddingTop: 4 },
  columnTitleWrap: { flex: 1, minWidth: 0 },
  columnTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900" },
  columnMeta: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", marginTop: 1 },
  columnCountBadge: { alignItems: "center", borderRadius: 99, height: 24, justifyContent: "center", minWidth: 24, paddingHorizontal: 6 },
  columnCountText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  columnIconBtn: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 10, height: 32, justifyContent: "center", width: 32 },
  columnToolbar: { alignItems: "center", flexDirection: "row", gap: 6, paddingHorizontal: 2 },
  columnToolBtn: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 10, height: 32, justifyContent: "center", width: 36 },
  quickCreateBtn: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 5, height: 32, justifyContent: "center", paddingHorizontal: 12 },
  quickCreateText: { color: colors.black, fontSize: 12, fontWeight: "900" },
  collapsedBody: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 160 },
  collapsedCount: { color: colors.foreground, fontSize: 32, fontWeight: "900" },

  // Task cards in board
  taskCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    gap: 10,
    minHeight: 110,
    overflow: "hidden",
    padding: 12,
    paddingLeft: 16,
    ...shadow.card,
  },
  taskCardBlocked: { borderColor: "#fecaca", borderWidth: 1 },
  taskRail: { bottom: 0, left: 0, position: "absolute", top: 0, width: 4 },
  taskCardTop: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  taskTitle: { color: colors.foreground, flex: 1, fontSize: 15, fontWeight: "900", lineHeight: 20 },
  editIcon: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 8, height: 28, justifyContent: "center", width: 28 },
  taskMeta: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  taskKey: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  taskFacts: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  factPill: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 99, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  factText: { color: colors.inkSoft, fontSize: 11, fontWeight: "900" },
  cardActions: { flexDirection: "row", gap: 6 },
  cardActionBtn: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 10, flex: 1, height: 32, justifyContent: "center" },
  swipeAction: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.md, justifyContent: "center", marginVertical: 2, width: 88 },
  swipeActionText: { color: colors.black, fontSize: 12, fontWeight: "900" },

  // List view
  listStack: { gap: 10 },
  listCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    ...shadow.card,
  },
  listRail: { alignSelf: "stretch", width: 4 },
  listCardBody: { flex: 1, gap: 6, padding: 14 },
  listCardTop: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  listCardTitle: { color: colors.foreground, flex: 1, fontSize: 15, fontWeight: "900" },
  listCardMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "800" },
  emptyListCard: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, flexDirection: "row", gap: 10, padding: 16, ...shadow.card },
  emptyListText: { color: colors.inkSoft, flex: 1, fontSize: 13, fontWeight: "800" },

  // Calendar view
  calendarPanel: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, gap: 16, padding: 16, ...shadow.card },
  calendarHeadRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  calendarHeadTitle: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  calendarHeadSub: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 3 },
  calendarNav: { alignItems: "center", flexDirection: "row", gap: 6 },
  calendarNavBtn: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 14, height: 34, justifyContent: "center", width: 34 },
  calendarTodayBtn: { alignItems: "center", backgroundColor: colors.foreground, borderRadius: 999, height: 34, justifyContent: "center", paddingHorizontal: 13 },
  calendarTodayText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  calendarDateRail: { gap: 8, paddingRight: 6 },
  calendarDateCell: { alignItems: "center", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 18, borderWidth: 1, gap: 4, minHeight: 86, paddingHorizontal: 12, paddingVertical: 10, width: 62 },
  calendarDateCellActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  calendarWeekday: { color: colors.inkSoft, fontSize: 10, fontWeight: "900" },
  calendarDayNumber: { color: colors.foreground, fontSize: 22, fontWeight: "900" },
  calendarDateTextActive: { color: colors.black },
  calendarCountDot: { alignItems: "center", backgroundColor: colors.panel, borderRadius: 99, height: 20, justifyContent: "center", minWidth: 20, paddingHorizontal: 5 },
  calendarCountDotActive: { backgroundColor: colors.black },
  calendarCountText: { color: colors.inkSoft, fontSize: 10, fontWeight: "900" },
  calendarCountTextActive: { color: colors.primary },
  calendarAgendaCard: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, gap: 14, padding: 16, ...shadow.card },
  calendarAgendaList: { gap: 10 },
  calendarAgendaRow: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: radii.lg, flexDirection: "row", gap: 12, minHeight: 64, overflow: "hidden", padding: 12, paddingLeft: 16 },
  calendarAgendaRail: { bottom: 0, left: 0, position: "absolute", top: 0, width: 4 },
  calendarAgendaBody: { flex: 1, minWidth: 0 },
  calendarAgendaTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  calendarAgendaMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 3 },

  // Timeline view
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  sectionTitle: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  sectionSub: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17, marginTop: 2 },
  sectionCount: { color: colors.accent, fontSize: 13, fontWeight: "900" },
  timelineIntro: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 16, ...shadow.card },
  timelineStack: { gap: 10 },
  timelineCard: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, flexDirection: "row", gap: 12, padding: 12, ...shadow.card },
  timelineDateBox: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: radii.md, flexShrink: 0, justifyContent: "center", minHeight: 50, width: 48 },
  timelineDateMonth: { color: colors.inkSoft, fontSize: 9, fontWeight: "900" },
  timelineDateDay: { color: colors.foreground, fontSize: 18, fontWeight: "900" },
  timelineLine: { borderRadius: 99, flexShrink: 0, height: 42, width: 4 },
  timelineBody: { flex: 1, minWidth: 0 },
  timelineTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  timelineMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 2 },

  // Team / docs
  teamHero: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, flexDirection: "row", gap: 14, padding: 16, ...shadow.card },
  teamHeroIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: radii.lg, height: 52, justifyContent: "center", width: 52 },
  teamHeroText: { flex: 1, minWidth: 0 },
  teamCountPill: { alignItems: "center", backgroundColor: colors.black, borderRadius: radii.lg, minWidth: 70, paddingHorizontal: 12, paddingVertical: 10 },
  teamCountValue: { color: colors.primary, fontSize: 18, fontWeight: "900" },
  teamCountLabel: { color: colors.white, fontSize: 10, fontWeight: "900", opacity: 0.72, textTransform: "uppercase" },
  teamSection: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, gap: 10, padding: 16, ...shadow.card },
  memberRow: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 12, minHeight: 58, paddingTop: 10 },
  memberAvatar: { alignItems: "center", backgroundColor: colors.yellowSoft, borderRadius: 16, height: 42, justifyContent: "center", width: 42 },
  memberAvatarText: { color: colors.black, fontSize: 13, fontWeight: "900" },
  memberBody: { flex: 1, minWidth: 0 },
  memberName: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  memberMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 2 },
  teamListItem: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, overflow: "hidden", ...shadow.card },
  teamListItemExpanded: { borderColor: colors.accent },
  teamRow: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 62, padding: 12 },
  teamRowActive: { backgroundColor: colors.yellowSoft, borderColor: colors.primaryDark },
  teamRowAvatar: { alignItems: "center", borderRadius: 14, height: 40, justifyContent: "center", width: 40 },
  teamRowAvatarText: { fontSize: 13, fontWeight: "900" },
  teamRowName: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  teamRowCounts: { alignItems: "flex-end", minWidth: 62 },
  teamRowCountValue: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  teamRowCountLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "900", letterSpacing: 0.4, marginTop: 2, textTransform: "uppercase" },
  teamDropdown: { borderTopColor: colors.line, borderTopWidth: 1, gap: 10, padding: 12, paddingTop: 10 },
  teamDropdownText: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17 },
  teamInfoRail: { gap: 8, paddingRight: 12 },
  teamInfoPill: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, minWidth: 92, paddingHorizontal: 11, paddingVertical: 10 },
  teamInfoValue: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  teamInfoLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "900", letterSpacing: 0.5, marginTop: 4, textTransform: "uppercase" },
  docsHero: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 16, ...shadow.card },
  docsStack: { gap: 10 },
  docRow: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 64, padding: 12, ...shadow.card },
  docIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  teamHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  teamHeaderTitle: { color: colors.foreground, fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  teamHeaderSub: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 2 },
  teamHeaderActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  teamRefreshBtn: { alignItems: "center", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 14, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  teamNewBtn: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.lg, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  teamNewBtnText: { color: colors.black, fontSize: 13, fontWeight: "900" },
  teamList: { gap: 8 },
  teamBanner: { borderRadius: radii.lg, borderWidth: 1, padding: 12 },
  teamBannerOk: { backgroundColor: colors.greenSoft, borderColor: "#bbf7d0" },
  teamBannerBad: { backgroundColor: colors.redSoft, borderColor: "#fecaca" },
  teamBannerText: { fontSize: 13, fontWeight: "900" },
  teamBannerTextOk: { color: colors.success },
  teamBannerTextBad: { color: colors.danger },
  teamCardAvatarText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  teamDetail: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, gap: 14, padding: 16, ...shadow.card },
  teamDetailHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  teamDetailAvatar: { alignItems: "center", borderRadius: 16, height: 48, justifyContent: "center", width: 48 },
  teamDetailName: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  teamDetailStats: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", marginTop: 3 },
  teamTabRail: { gap: 8, paddingRight: 16 },
  teamTab: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  teamTabActive: { backgroundColor: colors.black, borderColor: colors.black },
  teamTabText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  teamTabTextActive: { color: colors.white },
  teamForm: { backgroundColor: colors.panelMuted, borderRadius: radii.xl, gap: 14, padding: 14 },
  teamFormTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900" },
  teamFormSub: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17 },
  userPickList: { gap: 8, maxHeight: 260 },
  userPickRow: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 60, padding: 10 },
  userPickRowActive: { backgroundColor: colors.yellowSoft, borderColor: colors.primaryDark },
  tenantInviteBox: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 12, padding: 12 },
  directoryList: { gap: 8 },
  bulkInput: { minHeight: 150 },
  bulkResultBox: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, gap: 4, padding: 12 },
  teamSubmitBtn: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.lg, justifyContent: "center", minHeight: 52 },
  teamSubmitText: { color: colors.black, fontSize: 14, fontWeight: "900" },
  teamMembersList: { gap: 8 },
  teamMemberCard: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, overflow: "hidden" },
  memberRowNoBorder: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 52 },
  memberCompactRow: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 60, padding: 12 },
  memberRoleBadge: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 999, maxWidth: 82, paddingHorizontal: 9, paddingVertical: 6 },
  memberRoleBadgeText: { color: colors.foreground, fontSize: 10, fontWeight: "900" },
  memberExpandedPanel: { backgroundColor: colors.panelMuted, borderTopColor: colors.line, borderTopWidth: 1, gap: 12, padding: 12 },
  memberInviteActions: { flexDirection: "row", gap: 8 },
  memberInviteAction: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  memberInviteActionText: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  memberInviteCancelAction: { backgroundColor: colors.redSoft, borderColor: "#fecaca" },
  memberInviteCancelText: { color: colors.danger, fontSize: 12, fontWeight: "900" },
  memberRemoveRow: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.redSoft, borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  memberRemoveText: { color: colors.danger, fontSize: 12, fontWeight: "900" },
  teamRemoveBtn: { alignItems: "center", backgroundColor: colors.redSoft, borderRadius: 14, height: 38, justifyContent: "center", width: 38 },
  memberPermRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  permissionPill: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 999, borderWidth: 1, maxWidth: 150, paddingHorizontal: 8, paddingVertical: 5 },
  permissionPillText: { color: colors.inkSoft, fontSize: 10, fontWeight: "900" },
  roleGrid: { gap: 10 },
  roleCard: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 10, padding: 14 },
  roleHeader: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  roleTitle: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  systemPill: { backgroundColor: colors.yellowSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  systemPillText: { color: "#b45309", fontSize: 10, fontWeight: "900" },

  // Settings view
  settingsCard: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, overflow: "hidden", ...shadow.card },
  settingsRow: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 14, justifyContent: "space-between", minHeight: 58, paddingHorizontal: 18 },
  settingsLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: "900" },
  settingsValue: { color: colors.foreground, flex: 1, fontSize: 14, fontWeight: "900", textAlign: "right" },
  settingsActionBtn: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.xl, flexDirection: "row", gap: 10, justifyContent: "center", minHeight: 56, ...shadow.card },
  settingsActionText: { color: colors.black, fontSize: 14, fontWeight: "900" },

  // Utility view
  utilityCard: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 10, padding: 28, ...shadow.card },
  utilityIconBox: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: radii.lg, height: 60, justifyContent: "center", marginBottom: 4, width: 60 },
  utilityTitle: { color: colors.foreground, fontSize: 18, fontWeight: "900" },
  utilityBody: { color: colors.inkSoft, fontSize: 14, fontWeight: "800", lineHeight: 20, textAlign: "center" },

  // Sheet
  modalBackdrop: { backgroundColor: "rgba(16,16,15,0.28)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "92%", overflow: "hidden", ...shadow.heavy },
  sheetHeader: { backgroundColor: colors.background },
  sheetHandle: { alignSelf: "center", backgroundColor: colors.line, borderRadius: 99, height: 4, marginTop: 12, width: 44 },
  workHeader: { backgroundColor: colors.background, gap: 18, paddingBottom: 12 },
  workHeaderTop: { alignItems: "flex-start", flexDirection: "row", gap: 14, justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 8 },
  workHeaderCopy: { flex: 1, minWidth: 0 },
  workEyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  workTitle: { color: colors.foreground, fontSize: 30, fontWeight: "900", letterSpacing: -0.6, lineHeight: 34, marginTop: 4 },
  workSubtitle: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", lineHeight: 19, marginTop: 4 },
  workSteps: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 28 },
  workStep: { alignItems: "center", gap: 7, minWidth: 76 },
  workStepDot: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 99, borderWidth: 1, height: 34, justifyContent: "center", width: 34 },
  workStepDotActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  workStepNumber: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  workStepNumberActive: { color: colors.black },
  workStepLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: "900" },
  sheetTitleRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle: { color: colors.foreground, flex: 1, fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
  closeBtn: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 16, height: 36, justifyContent: "center", width: 36 },
  sheetContent: { gap: 16, padding: 20 },
  workSheetContent: { gap: 16, padding: 20, paddingBottom: 110 },
  aiSheetContent: { gap: 14, padding: 20, paddingBottom: 36 },
  aiIntro: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, flexDirection: "row", gap: 12, padding: 14, ...shadow.card },
  aiIntroIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 18, height: 46, justifyContent: "center", width: 46 },
  aiIntroTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900" },
  aiIntroText: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17, marginTop: 3 },
  aiActionsGrid: { gap: 10 },
  aiActionCard: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 70, padding: 14, ...shadow.card },
  aiActionText: { flex: 1, minWidth: 0 },
  aiActionTitle: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  aiActionSub: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 16, marginTop: 2 },
  aiErrorBox: { backgroundColor: colors.redSoft, borderColor: "#fecaca", borderRadius: radii.xl, borderWidth: 1, padding: 13 },
  aiErrorText: { color: colors.danger, fontSize: 13, fontWeight: "900", lineHeight: 18 },
  aiEmptyBox: { alignItems: "center", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, gap: 5, padding: 18 },
  aiEmptyTitle: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  aiEmptyText: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17, textAlign: "center" },
  aiResultStack: { gap: 10 },
  aiBlock: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 9, padding: 14 },
  aiBlockTitle: { color: colors.foreground, fontSize: 13, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" },
  aiBlockBody: { color: colors.slate, fontSize: 13, fontWeight: "700", lineHeight: 20 },
  aiBulletRow: { alignItems: "flex-start", flexDirection: "row", gap: 9 },
  aiBulletDot: { backgroundColor: colors.accent, borderRadius: 99, height: 7, marginTop: 6, width: 7 },
  aiBulletDotRisk: { backgroundColor: colors.danger },
  aiBulletText: { color: colors.slate, flex: 1, fontSize: 13, fontWeight: "800", lineHeight: 18 },
  aiFindingCard: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, gap: 6, padding: 12 },
  aiFindingTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  aiFindingSeverity: { color: colors.danger, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  aiFindingType: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  aiFindingTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900", lineHeight: 19 },
  aiFindingEvidence: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17 },
  aiApplyHeader: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  aiApplyBtn: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.lg, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 14 },
  aiApplyBtnText: { color: colors.black, fontSize: 13, fontWeight: "900" },
  aiApplyResult: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, gap: 5, padding: 12 },
  aiApplyResultTitle: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  aiApplyResultLine: { fontSize: 11, fontWeight: "800", lineHeight: 16 },
  aiApplyOk: { color: colors.success },
  aiApplyFail: { color: colors.danger },
  aiProposalList: { gap: 9 },
  aiProposalCard: { alignItems: "flex-start", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 },
  aiProposalCardActive: { backgroundColor: colors.yellowSoft, borderColor: colors.primaryDark },
  aiProposalCheck: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 8, borderWidth: 1, height: 22, justifyContent: "center", marginTop: 2, width: 22 },
  aiProposalCheckActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  aiProposalCheckText: { color: colors.black, fontSize: 12, fontWeight: "900" },
  aiProposalTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900", lineHeight: 19 },
  aiProposalText: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17, marginTop: 4 },
  aiProposalImpact: { color: colors.slate, fontSize: 12, fontWeight: "900", lineHeight: 17, marginTop: 4 },
  aiProposalMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  aiProposalMeta: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 999, borderWidth: 1, color: colors.inkSoft, fontSize: 9, fontWeight: "900", letterSpacing: 0.4, paddingHorizontal: 8, paddingVertical: 4, textTransform: "uppercase" },
  aiHistoryHeader: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  aiHistoryRefresh: { alignItems: "center", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", width: 34 },
  aiHistoryError: { backgroundColor: colors.redSoft, borderColor: "#fecaca", borderRadius: radii.lg, borderWidth: 1, padding: 10 },
  aiHistoryList: { gap: 9 },
  aiHistoryCard: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, gap: 8, padding: 12 },
  aiHistoryTop: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  aiHistoryKind: { alignItems: "center", flexDirection: "row", gap: 6 },
  aiHistoryKindText: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  aiHistoryStatus: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 999, borderWidth: 1, color: colors.inkSoft, fontSize: 9, fontWeight: "900", letterSpacing: 0.4, paddingHorizontal: 8, paddingVertical: 4, textTransform: "uppercase" },
  aiHistoryStatusOk: { backgroundColor: colors.greenSoft, borderColor: "#bbf7d0", color: colors.success },
  aiHistoryStatusFail: { backgroundColor: colors.redSoft, borderColor: "#fecaca", color: colors.danger },
  aiHistoryPreview: { color: colors.slate, fontSize: 12, fontWeight: "800", lineHeight: 17 },
  aiHistoryFooter: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  aiHistoryMetaText: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" },
  sheetActions: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, justifyContent: "flex-end", padding: 16 },
  deleteBtn: { alignItems: "center", backgroundColor: colors.redSoft, borderRadius: radii.lg, height: 50, justifyContent: "center", width: 50 },
  cancelBtn: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, height: 50, justifyContent: "center", paddingHorizontal: 18 },
  cancelBtnText: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  saveBtn: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.lg, flexDirection: "row", gap: 6, height: 50, justifyContent: "center", paddingHorizontal: 18 },
  saveBtnText: { color: colors.black, fontSize: 14, fontWeight: "900" },
  disabledBtn: { opacity: 0.45 },

  // Form fields
  field: { gap: 8 },
  fieldLabel: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  fieldHint: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", lineHeight: 16, marginTop: 0 },
  input: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, color: colors.foreground, fontSize: 15, fontWeight: "800", minHeight: 56, paddingHorizontal: 15 },
  textArea: { minHeight: 110, paddingTop: 13, textAlignVertical: "top" },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  chipRow: { gap: 8, paddingRight: 16 },
  choiceChip: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 13 },
  choiceChipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  choiceChipText: { color: colors.inkSoft, fontSize: 13, fontWeight: "900" },
  choiceChipTextActive: { color: colors.white },
  taskSectionBody: { gap: 16 },
  taskSectionCard: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, gap: 18, padding: 18, ...shadow.card },
  taskSectionCopy: { flex: 1, minWidth: 0 },
  taskSectionDescription: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 18, marginTop: 3 },
  taskSectionHead: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  taskSectionIcon: { alignItems: "center", backgroundColor: colors.yellowSoft, borderRadius: radii.md, height: 42, justifyContent: "center", width: 42 },
  taskSectionTitle: { color: colors.foreground, fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
  effortStack: { gap: 12 },
  pickerButton: { alignItems: "center", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 72, paddingHorizontal: 14, paddingVertical: 12 },
  pickerButtonCopy: { flex: 1, minWidth: 0 },
  pickerButtonHelper: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", lineHeight: 16, marginTop: 3 },
  pickerButtonValue: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  pickerField: { flex: 1, gap: 8, minWidth: 132 },
  quickRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepperCard: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 12, padding: 14 },
  stepperHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  stepperLabel: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  stepperSuffix: { color: colors.inkSoft, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  stepperControl: { alignItems: "center", flexDirection: "row", gap: 10 },
  stepperBtn: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 16, borderWidth: 1, height: 44, justifyContent: "center", width: 48 },
  stepperBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  stepperInput: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 16, borderWidth: 1, color: colors.foreground, flex: 1, fontSize: 20, fontWeight: "900", height: 48, minWidth: 0, paddingHorizontal: 12, textAlign: "center" },
  stepperQuickRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepperQuickBtn: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 999, borderWidth: 1, minHeight: 34, minWidth: 48, justifyContent: "center", paddingHorizontal: 10 },
  stepperQuickBtnActive: { backgroundColor: colors.black, borderColor: colors.black },
  stepperQuickText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  stepperQuickTextActive: { color: colors.white },
  inlinePickerLayer: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 20 },
  inlinePickerScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,16,15,0.34)" },
  optionSheet: { backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, gap: 18, padding: 20, paddingBottom: 28, ...shadow.heavy },
  optionHeader: { alignItems: "flex-start", flexDirection: "row", gap: 14, justifyContent: "space-between" },
  optionTitle: { color: colors.foreground, fontSize: 24, fontWeight: "900", letterSpacing: -0.4, marginTop: 3 },
  optionHelper: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 18, marginTop: 4, maxWidth: 300 },
  optionList: { gap: 10 },
  optionScroll: { maxHeight: 520 },
  optionRow: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 66, paddingHorizontal: 14, paddingVertical: 12 },
  optionRowActive: { backgroundColor: colors.yellowSoft, borderColor: colors.primaryDark },
  optionTextWrap: { flex: 1, minWidth: 0 },
  optionLabel: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  optionLabelActive: { color: colors.black },
  optionDetail: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", lineHeight: 16, marginTop: 3 },
  optionCheck: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 999, height: 32, justifyContent: "center", width: 32 },
  optionCheckActive: { backgroundColor: colors.primary },
  switchRow: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 14 },
});
