import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowLeft,
  CheckSquare2,
  ChevronDown,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
} from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import { createTask, getProjectBoard, listProjects, listTasks, updateTaskStatus } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { BoardColumn, Project, ProjectBoard, Task } from "@/lib/types";

type PortfolioView = "summary" | "board" | "list" | "calendar" | "forms" | "timeline" | "settings";
type TaskStatus = Task["status"];

type WorkColumn = {
  id: string;
  name: string;
  status: TaskStatus;
  tasks: Task[];
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

const defaultColumns: { name: string; status: TaskStatus }[] = [
  { name: "To Do", status: "TODO" },
  { name: "In Progress", status: "IN_PROGRESS" },
  { name: "Review", status: "REVIEW" },
  { name: "Done", status: "DONE" },
];

const filters = ["Group by", "Assignee", "Status"];

export function PortfolioBoardScreen() {
  const { accessToken } = useAuthSession();
  const [activeView, setActiveView] = useState<PortfolioView>("board");
  const [board, setBoard] = useState<ProjectBoard | null>(null);
  const [creatingStatus, setCreatingStatus] = useState<TaskStatus | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
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
  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => `${task.title} ${task.key ?? ""} ${task.status}`.toLowerCase().includes(query));
  }, [search, tasks]);
  const summary = useMemo(() => buildSummary(tasks), [tasks]);

  function cycleProject() {
    if (projects.length <= 1) return;
    const currentIndex = Math.max(projects.findIndex((project) => project.id === selectedProject?.id), 0);
    const nextProject = projects[(currentIndex + 1) % projects.length];
    if (!nextProject) return;
    setSelectedProjectId(nextProject.id);
  }

  async function createCard(status: TaskStatus) {
    if (!accessToken || !selectedProject || !draftTitle.trim()) {
      setCreatingStatus(null);
      setDraftTitle("");
      return;
    }
    try {
      await createTask(accessToken, {
        priority: "MEDIUM",
        projectId: selectedProject.id,
        status,
        title: draftTitle.trim(),
        type: "TASK",
      });
      setCreatingStatus(null);
      setDraftTitle("");
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create task.");
    }
  }

  async function moveTask(task: Task, status: TaskStatus) {
    if (!accessToken || task.status === status) return;
    try {
      await updateTaskStatus(accessToken, task.id, { status });
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to move task.");
    }
  }

  function openTask(task: Task) {
    Alert.alert(task.title, `${task.key ?? task.id}\n${humanStatus(task.status)} - ${humanPriority(task.priority)}`, [
      { text: "Close" },
      { onPress: () => moveTask(task, nextStatus(task.status)), text: `Move to ${humanStatus(nextStatus(task.status))}` },
    ]);
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
          <Pressable accessibilityRole="button" style={styles.circleButton}>
            {activeView === "summary" ? <Share2 color={colors.foreground} size={21} strokeWidth={2.7} /> : <MoreHorizontal color={colors.foreground} size={24} strokeWidth={2.8} />}
          </Pressable>
        </View>

        <BoardTabs activeView={activeView} onChange={setActiveView} />

        <View style={styles.filterRail}>
          <Search color={colors.inkSoft} size={20} strokeWidth={2.7} />
          {filters.map((filter) => (
            <Pressable accessibilityRole="button" key={filter} style={styles.filterChip}>
              <Text style={styles.filterChipText}>{filter}</Text>
              <ChevronDown color={colors.inkSoft} size={13} strokeWidth={2.7} />
            </Pressable>
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {activeView === "summary" ? <SummaryView columns={columns} summary={summary} /> : null}
        {activeView === "board" ? (
          <BoardView
            columns={columns}
            creatingStatus={creatingStatus}
            draftTitle={draftTitle}
            onCreate={createCard}
            onDraftChange={setDraftTitle}
            onOpenTask={openTask}
            onStartCreate={(status) => {
              setCreatingStatus(status);
              setDraftTitle("");
            }}
          />
        ) : null}
        {activeView === "list" ? <ListView onOpenTask={openTask} onSearch={setSearch} search={search} tasks={filteredTasks} /> : null}
        {activeView === "calendar" ? <CalendarView tasks={filteredTasks} /> : null}
        {activeView === "forms" ? <UtilityView title="Forms" body="Intake forms will create project work items into this board." /> : null}
        {activeView === "timeline" ? <TimelineView tasks={filteredTasks} /> : null}
        {activeView === "settings" ? <SettingsView board={board} project={selectedProject} /> : null}
      </ScrollView>
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

function SummaryView({ columns, summary }: { columns: WorkColumn[]; summary: ReturnType<typeof buildSummary> }) {
  return (
    <View style={styles.viewStack}>
      <View style={styles.summaryGrid}>
        <SummaryCard label="completed" value={summary.completed} />
        <SummaryCard label="updated" tone="blue" value={summary.updated} />
        <SummaryCard label="created" tone="purple" value={summary.created} />
        <SummaryCard label="due soon" value={summary.dueSoon} />
      </View>
      <View style={styles.analyticsBlock}>
        <Text style={styles.blockTitle}>Status overview</Text>
        <Text style={styles.blockSubtitle}>in the last 14 days</Text>
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

function SummaryCard({ label, tone = "neutral", value }: { label: string; tone?: "blue" | "neutral" | "purple"; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, tone === "blue" ? styles.summaryIconBlue : tone === "purple" ? styles.summaryIconPurple : null]}>
        <CheckSquare2 color={tone === "neutral" ? colors.foreground : colors.accent} size={16} strokeWidth={2.8} />
      </View>
      <Text style={[styles.summaryNumber, tone === "blue" ? styles.textBlue : tone === "purple" ? styles.textPurple : null]}>{value}</Text>
      <Text style={styles.summaryText}>{label}</Text>
      <Text style={styles.summarySubtext}>in the last 7 days</Text>
    </View>
  );
}

function BoardView({
  columns,
  creatingStatus,
  draftTitle,
  onCreate,
  onDraftChange,
  onOpenTask,
  onStartCreate,
}: {
  columns: WorkColumn[];
  creatingStatus: TaskStatus | null;
  draftTitle: string;
  onCreate: (status: TaskStatus) => void;
  onDraftChange: (value: string) => void;
  onOpenTask: (task: Task) => void;
  onStartCreate: (status: TaskStatus) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.boardContent} horizontal showsHorizontalScrollIndicator={false}>
      {columns.map((column) => (
        <View key={column.id} style={styles.column}>
          <View style={styles.columnHeader}>
            <Text style={styles.columnTitle}>{column.name}</Text>
            <Text style={styles.columnCount}>{column.tasks.length}</Text>
            <MoreHorizontal color={colors.inkSoft} size={18} strokeWidth={2.8} />
          </View>
          {column.tasks.map((task) => (
            <TaskCard key={task.id} onPress={() => onOpenTask(task)} task={task} />
          ))}
          {creatingStatus === column.status ? (
            <TextInput
              autoFocus
              onChangeText={onDraftChange}
              onSubmitEditing={() => onCreate(column.status)}
              placeholder="Create work item"
              placeholderTextColor="#8c887f"
              returnKeyType="done"
              style={styles.createInput}
              value={draftTitle}
            />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => onStartCreate(column.status)} style={styles.createRow}>
              <Plus color={colors.foreground} size={19} strokeWidth={2.5} />
              <Text style={styles.createText}>Create</Text>
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function TaskCard({ onPress, task }: { onPress: () => void; task: Task }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.taskCard}>
      <Text numberOfLines={2} style={styles.taskTitle}>{task.title}</Text>
      <View style={styles.taskMeta}>
        <CheckSquare2 color={colors.accent} size={15} strokeWidth={2.6} />
        <Text style={styles.taskKey}>{task.key ?? task.id.slice(0, 6).toUpperCase()}</Text>
      </View>
    </Pressable>
  );
}

function ListView({ onOpenTask, onSearch, search, tasks }: { onOpenTask: (task: Task) => void; onSearch: (value: string) => void; search: string; tasks: Task[] }) {
  return (
    <View style={styles.viewStack}>
      <View style={styles.searchBox}>
        <Search color={colors.foreground} size={20} strokeWidth={2.8} />
        <TextInput
          onChangeText={onSearch}
          placeholder="Search work items"
          placeholderTextColor="#716b61"
          style={styles.searchInput}
          value={search}
        />
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

function CalendarView({ tasks }: { tasks: Task[] }) {
  const days = groupByDueDate(tasks);
  return (
    <View style={styles.viewStack}>
      <View style={styles.monthHeader}>
        <Text style={styles.monthTitle}>{new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
        <Text style={styles.monthBadge}>2 weeks</Text>
      </View>
      <View style={styles.calendarPanel}>
        {days.map((day) => (
          <View key={day.label} style={styles.calendarRow}>
            <View>
              <Text style={styles.calendarDay}>{day.label}</Text>
              <Text style={styles.calendarDate}>{day.date}</Text>
            </View>
            <Text style={styles.calendarCount}>{day.tasks.length}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TimelineView({ tasks }: { tasks: Task[] }) {
  const recent = [...tasks].sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? ""))).slice(0, 6);
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

function SettingsView({ board, project }: { board: ProjectBoard | null; project: Project }) {
  return (
    <View style={styles.settingsPanel}>
      <SettingsRow label="Project" value={project.name} />
      <SettingsRow label="Board" value={board?.name ?? "Default board"} />
      <SettingsRow label="Columns" value={String(board?.columns?.length ?? defaultColumns.length)} />
      <SettingsRow label="API source" value="Agile board" />
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

function PriorityBars({ tasks }: { tasks: Task[] }) {
  const priorities = ["CRITICAL", "URGENT", "HIGH", "MEDIUM", "LOW"] as const;
  const max = Math.max(1, ...priorities.map((priority) => tasks.filter((task) => task.priority === priority).length));
  return (
    <View style={styles.priorityStack}>
      {priorities.map((priority) => {
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
      <Text style={styles.settingsValue}>{value}</Text>
    </View>
  );
}

function buildColumns(board: ProjectBoard | null, tasks: Task[]): WorkColumn[] {
  if (board?.columns?.length) {
    return [...board.columns]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((column) => ({
        id: column.id,
        name: column.name,
        status: normalizeStatus(column.status),
        tasks: tasksForColumn(column, tasks),
      }));
  }

  return defaultColumns.map((column) => ({
    id: column.status,
    name: column.name,
    status: column.status,
    tasks: tasks.filter((task) => task.status === column.status),
  }));
}

function tasksForColumn(column: BoardColumn, tasks: Task[]) {
  const columnTasks = Array.isArray(column.tasks) ? column.tasks : [];
  if (columnTasks.length) return columnTasks;
  const status = normalizeStatus(column.status);
  return tasks.filter((task) => task.status === status);
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

function nextStatus(status: TaskStatus): TaskStatus {
  if (status === "TODO") return "IN_PROGRESS";
  if (status === "IN_PROGRESS") return "REVIEW";
  if (status === "REVIEW" || status === "TESTING") return "DONE";
  if (status === "DONE") return "TODO";
  return "TODO";
}

function normalizeStatus(status?: TaskStatus | null): TaskStatus {
  return status ?? "TODO";
}

function priorityTone(priority: string) {
  if (priority === "CRITICAL" || priority === "URGENT") return "red" as const;
  if (priority === "HIGH") return "yellow" as const;
  return "blue" as const;
}

function statusColor(status: TaskStatus) {
  if (status === "DONE") return colors.success;
  if (status === "IN_PROGRESS") return colors.accent;
  if (status === "REVIEW" || status === "TESTING") return "#7c3aed";
  if (status === "CANCELLED") return colors.danger;
  return "#d9dce3";
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
    gap: 8,
    paddingBottom: 10,
    paddingRight: 20,
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
  calendarPanel: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    overflow: "hidden",
  },
  calendarRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 72,
    paddingHorizontal: 18,
  },
  center: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 24,
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
  column: {
    backgroundColor: "#d9dde2",
    borderRadius: 4,
    gap: 8,
    minHeight: 180,
    padding: 8,
    width: 324,
  },
  columnCount: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
    marginLeft: "auto",
  },
  columnHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  columnTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
  },
  content: {
    gap: 14,
    paddingBottom: 116,
    paddingTop: 8,
  },
  createInput: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 6,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
    minHeight: 56,
    paddingHorizontal: 12,
  },
  createRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  createText: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
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
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: "#cfd2da",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "800",
  },
  filterRail: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
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
    width: 70,
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
    maxWidth: 210,
  },
  projectSwitcher: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
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
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: 24,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  searchInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
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
    justifyContent: "space-between",
    minHeight: 60,
    paddingHorizontal: 18,
  },
  settingsValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
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
  summaryIconPurple: {
    backgroundColor: "#f5d7ff",
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
    borderRadius: 6,
    gap: 8,
    minHeight: 64,
    padding: 12,
    ...shadow.card,
  },
  taskKey: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "800",
  },
  taskMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  taskTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 21,
  },
  textBlue: {
    color: colors.accent,
  },
  textPurple: {
    color: "#7c3aed",
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
