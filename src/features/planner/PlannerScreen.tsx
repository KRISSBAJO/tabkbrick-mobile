import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
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
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListTodo,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Video,
  X,
} from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ProjectDateField, ProjectDatePickerSheet } from "@/features/projects/ProjectDatePicker";
import {
  createMeeting,
  createTask,
  listMeetings,
  listProjects,
  listTasks,
  type CreateMeetingPayload,
  type CreateTaskPayload,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Meeting, Project, Task } from "@/lib/types";
import { formatCompactDate, humanPriority, humanStatus, priorityTone, statusTone } from "@/features/tasks/taskFilters";

type PlannerFilter = "all" | "tasks" | "meetings";
type SheetMode = "meeting" | "task" | null;
type DatePickerTarget = "meeting" | "planner" | "task" | null;
type TaskPriority = NonNullable<CreateTaskPayload["priority"]>;
type TaskStatus = NonNullable<CreateTaskPayload["status"]>;
type TaskType = NonNullable<CreateTaskPayload["type"]>;
type MeetingLocationMode = NonNullable<CreateMeetingPayload["locationMode"]>;

type TaskFormState = {
  description: string;
  dueDate: string;
  estimateMins: string;
  priority: TaskPriority;
  projectId: string;
  status: TaskStatus;
  title: string;
  type: TaskType;
};

type MeetingFormState = {
  description: string;
  durationMins: string;
  locationMode: MeetingLocationMode;
  locationName: string;
  meetingDate: string;
  projectId: string;
  startTime: string;
  title: string;
};

type PlannerItem =
  | { date: Date; id: string; kind: "meeting"; meeting: Meeting; title: string }
  | { date: Date; id: string; kind: "task"; task: Task; title: string };

const timePresets = ["09:00", "10:00", "13:00", "15:00"] as const;
const durationPresets = ["15", "30", "45", "60"] as const;
const locationModes: MeetingLocationMode[] = ["ONLINE", "IN_PERSON", "HYBRID", "PHONE", "TBD"];
const priorityOptions: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"];
const statusOptions: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];

export function PlannerScreen() {
  const { accessToken, user } = useAuthSession();
  const [activeFilter, setActiveFilter] = useState<PlannerFilter>("all");
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetMode>(null);
  const [datePicker, setDatePicker] = useState<DatePickerTarget>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [sheetError, setSheetError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskForm, setTaskForm] = useState<TaskFormState>(() => defaultTaskForm([], new Date()));
  const [meetingForm, setMeetingForm] = useState<MeetingFormState>(() => defaultMeetingForm([], new Date()));

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [taskPage, meetingPage, projectPage] = await Promise.all([
        listTasks(accessToken, { limit: 100, page: 1 }),
        listMeetings(accessToken, { limit: 100, page: 1 }),
        listProjects(accessToken, { limit: 50, page: 1 }),
      ]);
      setTasks(Array.isArray(taskPage) ? taskPage : taskPage.data);
      setMeetings(Array.isArray(meetingPage) ? meetingPage : meetingPage.data);
      setProjects(Array.isArray(projectPage) ? projectPage : projectPage.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load planner.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const weekDays = useMemo(() => {
    const first = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(first, i));
  }, [selectedDate]);

  const plannerItems = useMemo(() => buildPlannerItems(tasks, meetings), [meetings, tasks]);
  const countsByDate = useMemo(() => countItemsByDate(plannerItems), [plannerItems]);
  const selectedItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    return plannerItems
      .filter((item) => isSameDay(item.date, selectedDate))
      .filter((item) => activeFilter === "all" || item.kind === activeFilter.slice(0, -1))
      .filter((item) => !search || itemMatchesQuery(item, search))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [activeFilter, plannerItems, query, selectedDate]);

  const openTasks = useMemo(() => tasks.filter((t) => !isClosedTask(t)), [tasks]);
  const selectedTasks = useMemo(() => tasks.filter((t) => dateValueMatches(t.dueDate, selectedDate)), [selectedDate, tasks]);
  const selectedMeetings = useMemo(() => meetings.filter((m) => dateValueMatches(m.startAt, selectedDate)), [meetings, selectedDate]);
  const overdueTasks = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    return openTasks
      .filter((t) => { const d = parseDate(t.dueDate); return d ? startOfDay(d).getTime() < today : false; })
      .sort(sortTasksByDueDate)
      .slice(0, 4);
  }, [openTasks]);
  const assignedNext = useMemo(() => {
    const uid = user?.id;
    const src = uid ? openTasks.filter((t) => taskAssignedToUser(t, uid)) : openTasks;
    return src.sort(sortTasksByDueDate).slice(0, 4);
  }, [openTasks, user?.id]);

  function shiftWeek(amt: number) { setSelectedDate((d) => addDays(d, amt * 7)); }

  function openCreateTask() {
    setSheetError("");
    setTaskForm(defaultTaskForm(projects, selectedDate));
    setActiveSheet("task");
  }

  function openCreateMeeting() {
    setSheetError("");
    setMeetingForm(defaultMeetingForm(projects, selectedDate));
    setActiveSheet("meeting");
  }

  async function submitTask() {
    if (!accessToken) return;
    const title = taskForm.title.trim();
    if (!title) { setSheetError("Task title is required."); return; }
    if (!taskForm.projectId) { setSheetError("Choose a project before creating a task."); return; }
    setSubmitting(true);
    setSheetError("");
    try {
      await createTask(accessToken, {
        description: optional(taskForm.description),
        dueDate: optional(taskForm.dueDate),
        estimateMins: optionalNumber(taskForm.estimateMins),
        priority: taskForm.priority,
        projectId: taskForm.projectId,
        status: taskForm.status,
        title,
        type: taskForm.type,
      });
      setActiveSheet(null);
      await load(true);
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : "Unable to create task.");
    } finally { setSubmitting(false); }
  }

  async function submitMeeting() {
    if (!accessToken) return;
    const title = meetingForm.title.trim();
    if (!title) { setSheetError("Meeting title is required."); return; }
    const startAt = parseDateTime(meetingForm.meetingDate, meetingForm.startTime);
    if (!startAt) { setSheetError("Use a valid meeting date and start time."); return; }
    const duration = optionalNumber(meetingForm.durationMins) ?? 30;
    if (duration <= 0) { setSheetError("Duration must be greater than zero."); return; }
    setSubmitting(true);
    setSheetError("");
    try {
      await createMeeting(accessToken, {
        description: optional(meetingForm.description),
        endAt: addMinutes(startAt, duration).toISOString(),
        locationMode: meetingForm.locationMode,
        locationName: optional(meetingForm.locationName),
        projectId: optional(meetingForm.projectId),
        startAt: startAt.toISOString(),
        timezone: currentTimezone(),
        title,
        visibility: "WORKSPACE",
      });
      setActiveSheet(null);
      await load(true);
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : "Unable to create meeting.");
    } finally { setSubmitting(false); }
  }

  function openTask(task: Task) {
    router.push({ pathname: "/(workspace)/tasks/[taskId]", params: { returnTo: "/(workspace)/meetings", taskId: task.id } });
  }

  function openProject(projectId?: string | null) {
    if (!projectId) return;
    router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Planner</Text>
            <Text style={styles.pageTitle}>{formatHeaderDate(selectedDate)}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" onPress={() => setDatePicker("planner")} style={styles.iconBtn}>
              <CalendarDays color={colors.foreground} size={18} strokeWidth={2.7} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={openCreateTask} style={styles.addBtn}>
              <Plus color={colors.black} size={23} strokeWidth={3} />
            </Pressable>
          </View>
        </View>

        <View style={styles.plannerStatsRow}>
          <PlannerStat label="Items" tone="blue" value={selectedItems.length} />
          <PlannerStat label="Tasks" tone="neutral" value={selectedTasks.length} />
          <PlannerStat label="Meetings" tone="yellow" value={selectedMeetings.length} />
          <PlannerStat label="Late" tone={overdueTasks.length ? "red" : "green"} value={overdueTasks.length} />
        </View>

        {/* ── Week strip ── */}
        <View style={styles.weekPanel}>
          <View style={styles.weekHeader}>
            <Pressable accessibilityRole="button" onPress={() => setDatePicker("planner")} style={styles.weekTitleBlock}>
              <Text style={styles.weekLabel}>{monthLabel(selectedDate)}</Text>
              <Text style={styles.weekMeta}>{formatWeekRange(weekDays[0] ?? selectedDate, weekDays[6] ?? selectedDate)}</Text>
            </Pressable>
            <View style={styles.weekNav}>
              <Pressable accessibilityRole="button" onPress={() => shiftWeek(-1)} style={styles.weekArrow}>
                <ChevronLeft color={colors.foreground} size={18} strokeWidth={2.8} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setSelectedDate(startOfDay(new Date()))} style={styles.todayBtn}>
                <Text style={styles.todayBtnText}>Today</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => shiftWeek(1)} style={styles.weekArrow}>
                <ChevronRight color={colors.foreground} size={18} strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.weekStrip} horizontal showsHorizontalScrollIndicator={false}>
            {weekDays.map((day) => {
              const key = toDateKey(day);
              return (
                <DayButton
                  count={countsByDate.get(key) ?? 0}
                  date={day}
                  key={key}
                  onPress={() => setSelectedDate(startOfDay(day))}
                  selected={isSameDay(day, selectedDate)}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* ── Search ── */}
        <View style={styles.searchBar}>
          <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
          <TextInput
            onChangeText={setQuery}
            placeholder="Search agenda, task, project"
            placeholderTextColor={colors.inkSoft}
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable accessibilityRole="button" onPress={() => setQuery("")} style={styles.clearBtn}>
              <X color={colors.inkSoft} size={16} strokeWidth={2.8} />
            </Pressable>
          ) : null}
        </View>

        {/* ── Filter chips ── */}
        <ScrollView contentContainerStyle={styles.filterRail} horizontal showsHorizontalScrollIndicator={false}>
          <Segment active={activeFilter === "all"} label="All" onPress={() => setActiveFilter("all")} />
          <Segment active={activeFilter === "tasks"} label="Tasks" onPress={() => setActiveFilter("tasks")} />
          <Segment active={activeFilter === "meetings"} label="Meetings" onPress={() => setActiveFilter("meetings")} />
        </ScrollView>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Loading planner…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Planner unavailable</Text>
            <Text style={styles.errorBodyText}>{error}</Text>
            <Button label="Retry" onPress={() => void load()} variant="outline" />
          </View>
        ) : (
          <>
            {/* Agenda */}
            <SectionTitle
              actionLabel="Add task"
              icon={<ListTodo color={colors.accent} size={16} strokeWidth={2.7} />}
              iconBg={colors.blueSoft}
              onAction={openCreateTask}
              title="Agenda"
            />
            {selectedItems.length ? (
              <View style={styles.agendaStack}>
                {selectedItems.map((item) => (
                  <AgendaCard
                    item={item}
                    key={`${item.kind}-${item.id}`}
                    onOpenMeeting={setActiveMeeting}
                    onOpenTask={openTask}
                  />
                ))}
              </View>
            ) : (
              <EmptyAgenda onCreateMeeting={openCreateMeeting} onCreateTask={openCreateTask} />
            )}

            {/* Needs attention */}
            <SectionTitle
              icon={<AlertTriangle color={colors.warning} size={16} strokeWidth={2.7} />}
              iconBg={colors.orangeSoft}
              title="Needs attention"
            />
            <View style={styles.taskStack}>
              {overdueTasks.length ? (
                overdueTasks.map((task) => <TaskRow key={task.id} onPress={() => openTask(task)} task={task} variant="overdue" />)
              ) : (
                <View style={styles.clearCard}>
                  <CheckCircle2 color={colors.success} size={18} strokeWidth={2.7} />
                  <Text style={styles.clearCardText}>No overdue work — you're all caught up!</Text>
                </View>
              )}
            </View>

            {/* Up next */}
            <SectionTitle
              actionLabel="All tasks"
              icon={<Sparkles color={colors.accent} size={16} strokeWidth={2.7} />}
              iconBg={colors.blueSoft}
              onAction={() => router.push("/(workspace)/tasks")}
              title="Up next"
            />
            <View style={styles.taskStack}>
              {assignedNext.length ? (
                assignedNext.map((task) => <TaskRow key={task.id} onPress={() => openTask(task)} task={task} />)
              ) : (
                <View style={styles.clearCard}>
                  <CalendarDays color={colors.inkSoft} size={18} strokeWidth={2.7} />
                  <Text style={styles.clearCardText}>Your assigned tasks appear here once scheduled.</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <PlannerCreateSheet
        activeSheet={activeSheet}
        meetingForm={meetingForm}
        onClose={() => setActiveSheet(null)}
        onDatePicker={setDatePicker}
        onMeetingChange={(patch) => setMeetingForm((cur) => ({ ...cur, ...patch }))}
        onSubmitMeeting={() => void submitMeeting()}
        onSubmitTask={() => void submitTask()}
        onTaskChange={(patch) => setTaskForm((cur) => ({ ...cur, ...patch }))}
        projects={projects}
        sheetError={sheetError}
        submitting={submitting}
        taskForm={taskForm}
      />

      <MeetingDetailSheet meeting={activeMeeting} onClose={() => setActiveMeeting(null)} onOpenProject={openProject} />

      <ProjectDatePickerSheet
        onClose={() => setDatePicker(null)}
        onSelect={(value) => {
          if (datePicker === "task") setTaskForm((cur) => ({ ...cur, dueDate: value }));
          if (datePicker === "meeting") setMeetingForm((cur) => ({ ...cur, meetingDate: value }));
          if (datePicker === "planner") setSelectedDate(startOfDay(parseDate(value) ?? new Date()));
          setDatePicker(null);
        }}
        title={datePicker === "planner" ? "Planner date" : datePicker === "meeting" ? "Meeting date" : "Task due date"}
        value={datePicker === "planner" ? formatDateInput(selectedDate) : datePicker === "meeting" ? meetingForm.meetingDate : taskForm.dueDate}
        visible={Boolean(datePicker)}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DayButton({ count, date, onPress, selected }: { count: number; date: Date; onPress: () => void; selected: boolean }) {
  const isToday = isSameDay(date, new Date());
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.dayBtn, selected && styles.dayBtnActive, pressed && styles.dayBtnPressed]}
    >
      <Text style={[styles.dayName, selected && styles.dayNameActive]}>
        {date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}
      </Text>
      <Text style={[styles.dayNum, selected && styles.dayNumActive]}>{date.getDate()}</Text>
      <View style={styles.dayFooter}>
        {isToday ? <View style={[styles.dayDot, selected && styles.dayDotActive]} /> : null}
        {count ? <Text style={[styles.dayCount, selected && styles.dayCountActive]}>{count}</Text> : null}
      </View>
    </Pressable>
  );
}

function PlannerStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "blue" | "green" | "neutral" | "red" | "yellow";
  value: number;
}) {
  const palette = plannerStatPalette(tone);
  return (
    <View style={[styles.plannerStat, { backgroundColor: palette.bg }]}>
      <Text style={[styles.plannerStatValue, { color: palette.fg }]}>{value}</Text>
      <Text style={[styles.plannerStatLabel, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

function Segment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.segment, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({
  actionLabel,
  icon,
  iconBg,
  onAction,
  title,
}: {
  actionLabel?: string;
  icon: ReactNode;
  iconBg: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadLeft}>
        <View style={[styles.sectionIcon, { backgroundColor: iconBg }]}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {onAction && actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.sectionLink}>
          <Text style={styles.sectionLinkText}>{actionLabel}</Text>
          <ArrowRight color={colors.accent} size={14} strokeWidth={2.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

function AgendaCard({
  item,
  onOpenMeeting,
  onOpenTask,
}: {
  item: PlannerItem;
  onOpenMeeting: (meeting: Meeting) => void;
  onOpenTask: (task: Task) => void;
}) {
  const isTask = item.kind === "task";
  const task = isTask ? item.task : null;
  const meeting = isTask ? null : item.meeting;
  const projectName = task?.project?.name ?? meeting?.project?.name ?? "Workspace";
  const railColor = task ? priorityColor(task.priority) : colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (task ? onOpenTask(task) : meeting ? onOpenMeeting(meeting) : undefined)}
      style={({ pressed }) => [styles.agendaCard, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.agendaRail, { backgroundColor: railColor }]} />
      <View style={styles.agendaBody}>
        <View style={styles.agendaTop}>
          <Text style={styles.agendaTime}>{isTask ? "Task" : formatTime(item.date)}</Text>
          <View style={styles.agendaSpacer} />
          {task ? <StatusPill label={humanPriority(task.priority)} tone={priorityTone(task.priority)} /> : null}
          {meeting ? <StatusPill label={humanStatus(meeting.status)} tone={meetingTone(meeting.status)} /> : null}
        </View>
        <Text numberOfLines={2} style={styles.agendaTitle}>{item.title}</Text>
        <View style={styles.agendaMetaRow}>
          {isTask
            ? <ListTodo color={colors.inkSoft} size={12} strokeWidth={2.5} />
            : <Clock3 color={colors.inkSoft} size={12} strokeWidth={2.5} />}
          <Text numberOfLines={1} style={styles.agendaMeta}>
            {isTask
              ? `${projectName} · Due ${formatCompactDate(task?.dueDate)}`
              : `${projectName} · ${formatMeetingRange(meeting)}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyAgenda({ onCreateMeeting, onCreateTask }: { onCreateMeeting: () => void; onCreateTask: () => void }) {
  return (
    <View style={styles.emptyAgenda}>
      <View style={styles.emptyAgendaIcon}>
        <CalendarDays color={colors.accent} size={24} strokeWidth={2.6} />
      </View>
      <Text style={styles.emptyAgendaTitle}>No scheduled items</Text>
      <Text style={styles.emptyAgendaText}>Plan the day with a task or meeting.</Text>
      <View style={styles.emptyActions}>
        <Button label="New task" onPress={onCreateTask} style={styles.emptyBtn} />
        <Button label="Meeting" onPress={onCreateMeeting} style={styles.emptyBtn} variant="outline" />
      </View>
    </View>
  );
}

function TaskRow({ onPress, task, variant = "normal" }: { onPress: () => void; task: Task; variant?: "normal" | "overdue" }) {
  const title = compactText(task.title, 22);
  const projectName = compactText(task.project?.name ?? "Project", 14);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.taskRow, pressed && { opacity: 0.7 }]}>
      <View style={[styles.taskRail, { backgroundColor: variant === "overdue" ? colors.danger : priorityColor(task.priority) }]} />
      <View style={styles.taskBody}>
        <View style={styles.taskTop}>
          <Text numberOfLines={1} style={styles.taskTitle}>{title}</Text>
          <StatusPill label={humanStatus(task.status)} tone={statusTone(task.status)} />
        </View>
        <View style={styles.taskMeta}>
          <Text numberOfLines={1} style={styles.taskProject}>{projectName}</Text>
          <View style={styles.taskMetaSpacer} />
          <View style={[styles.taskDueBadge, variant === "overdue" && styles.taskDueBadgeOverdue]}>
            <Text style={[styles.taskDue, variant === "overdue" && styles.taskDueOverdue]}>{formatCompactDate(task.dueDate)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function PlannerCreateSheet({
  activeSheet,
  meetingForm,
  onClose,
  onDatePicker,
  onMeetingChange,
  onSubmitMeeting,
  onSubmitTask,
  onTaskChange,
  projects,
  sheetError,
  submitting,
  taskForm,
}: {
  activeSheet: SheetMode;
  meetingForm: MeetingFormState;
  onClose: () => void;
  onDatePicker: (target: DatePickerTarget) => void;
  onMeetingChange: (patch: Partial<MeetingFormState>) => void;
  onSubmitMeeting: () => void;
  onSubmitTask: () => void;
  onTaskChange: (patch: Partial<TaskFormState>) => void;
  projects: Project[];
  sheetError: string;
  submitting: boolean;
  taskForm: TaskFormState;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={Boolean(activeSheet)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetLayer}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetScrim} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.eyebrow}>{activeSheet === "meeting" ? "Schedule" : "Work item"}</Text>
              <Text style={styles.sheetTitle}>{activeSheet === "meeting" ? "New meeting" : "New task"}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetClose}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {sheetError ? (
              <View style={styles.sheetError}>
                <Text style={styles.sheetErrorText}>{sheetError}</Text>
              </View>
            ) : null}

            {activeSheet === "task" ? (
              <>
                <PlannerField label="Task title">
                  <TextInput
                    onChangeText={(v) => onTaskChange({ title: v })}
                    placeholder="What needs to be done?"
                    placeholderTextColor={colors.inkSoft}
                    style={styles.textInput}
                    value={taskForm.title}
                  />
                </PlannerField>
                <ProjectPicker onChange={(v) => onTaskChange({ projectId: v })} projects={projects} value={taskForm.projectId} />
                <ProjectDateField
                  helperText="Sets the agenda day"
                  label="Due date"
                  onClear={() => onTaskChange({ dueDate: "" })}
                  onPress={() => onDatePicker("task")}
                  placeholder="Choose due date"
                  value={taskForm.dueDate}
                />
                <PickerRow label="Priority" options={priorityOptions} renderLabel={humanPriority} value={taskForm.priority} onChange={(v) => onTaskChange({ priority: v })} />
                <PickerRow label="Status" options={statusOptions} renderLabel={humanStatus} value={taskForm.status} onChange={(v) => onTaskChange({ status: v })} />
                <PlannerField label="Estimate minutes">
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={(v) => onTaskChange({ estimateMins: v })}
                    placeholder="30"
                    placeholderTextColor={colors.inkSoft}
                    style={styles.textInput}
                    value={taskForm.estimateMins}
                  />
                </PlannerField>
                <PlannerField label="Description">
                  <TextInput
                    multiline
                    onChangeText={(v) => onTaskChange({ description: v })}
                    placeholder="Add detail for the team"
                    placeholderTextColor={colors.inkSoft}
                    style={[styles.textInput, styles.textArea]}
                    value={taskForm.description}
                  />
                </PlannerField>
                <Button label="Create task" loading={submitting} onPress={onSubmitTask} />
              </>
            ) : null}

            {activeSheet === "meeting" ? (
              <>
                <FormSection
                  icon={<Video color={colors.accent} size={18} strokeWidth={2.7} />}
                  kicker="Basics"
                  title="Meeting details"
                >
                  <PlannerField helper="Use a short outcome-focused title." label="Meeting title">
                    <TextInput
                      onChangeText={(v) => onMeetingChange({ title: v })}
                      placeholder="What is the meeting about?"
                      placeholderTextColor={colors.inkSoft}
                      style={styles.textInput}
                      value={meetingForm.title}
                    />
                  </PlannerField>
                  <ProjectPicker
                    helper="Optional. Link the meeting to keep project activity together."
                    optional
                    onChange={(v) => onMeetingChange({ projectId: v })}
                    projects={projects}
                    value={meetingForm.projectId}
                  />
                </FormSection>

                <FormSection
                  icon={<CalendarDays color={colors.accent} size={18} strokeWidth={2.7} />}
                  kicker="Schedule"
                  title="Date and time"
                >
                  <ProjectDateField
                    helperText="Used for the planner agenda"
                    label="Meeting date"
                    onClear={() => onMeetingChange({ meetingDate: "" })}
                    onPress={() => onDatePicker("meeting")}
                    placeholder="Choose date"
                    value={meetingForm.meetingDate}
                  />
                  <PickerRow
                    helper="Quick presets fill the custom time field."
                    label="Start time"
                    options={timePresets}
                    value={meetingForm.startTime}
                    onChange={(v) => onMeetingChange({ startTime: v })}
                  />
                  <View style={styles.formInlineGrid}>
                    <View style={styles.formInlineItem}>
                      <PlannerField helper="24-hour time, for example 09:30 or 14:45." label="Custom time">
                        <TextInput
                          onChangeText={(v) => onMeetingChange({ startTime: v })}
                          placeholder="14:30"
                          placeholderTextColor={colors.inkSoft}
                          style={styles.textInput}
                          value={meetingForm.startTime}
                        />
                      </PlannerField>
                    </View>
                    <View style={styles.formInlineItem}>
                      <PlannerField helper="Minutes. Must be greater than zero." label="Duration">
                        <TextInput
                          keyboardType="number-pad"
                          onChangeText={(v) => onMeetingChange({ durationMins: v })}
                          placeholder="30"
                          placeholderTextColor={colors.inkSoft}
                          style={styles.textInput}
                          value={meetingForm.durationMins}
                        />
                      </PlannerField>
                    </View>
                  </View>
                  <MeetingTimePreview
                    dateValue={meetingForm.meetingDate}
                    durationMins={meetingForm.durationMins}
                    startTime={meetingForm.startTime}
                  />
                  <PickerRow
                    helper="Tap a preset or type your own duration above."
                    label="Quick duration"
                    options={durationPresets}
                    renderLabel={(v) => `${v} min`}
                    value={meetingForm.durationMins}
                    onChange={(v) => onMeetingChange({ durationMins: v })}
                  />
                </FormSection>

                <FormSection
                  icon={<MapPin color={colors.accent} size={18} strokeWidth={2.7} />}
                  kicker="Location"
                  title="Where it happens"
                >
                  <PickerRow
                    helper="Choose the channel first, then add the exact room, link, or bridge."
                    label="Meeting mode"
                    options={locationModes}
                    renderLabel={humanStatus}
                    value={meetingForm.locationMode}
                    onChange={(v) => onMeetingChange({ locationMode: v })}
                  />
                  <PlannerField helper="Examples: Zoom link, Boardroom A, client office, phone bridge." label="Location detail">
                    <TextInput
                      onChangeText={(v) => onMeetingChange({ locationName: v })}
                      placeholder="Zoom, room name, phone bridge"
                      placeholderTextColor={colors.inkSoft}
                      style={styles.textInput}
                      value={meetingForm.locationName}
                    />
                  </PlannerField>
                </FormSection>

                <FormSection
                  icon={<ListTodo color={colors.accent} size={18} strokeWidth={2.7} />}
                  kicker="Notes"
                  title="Purpose and context"
                >
                  <PlannerField helper="Add purpose, expected outcome, or agenda notes." label="Description">
                    <TextInput
                      multiline
                      onChangeText={(v) => onMeetingChange({ description: v })}
                      placeholder="Purpose, outcomes, or notes"
                      placeholderTextColor={colors.inkSoft}
                      style={[styles.textInput, styles.textArea]}
                      value={meetingForm.description}
                    />
                  </PlannerField>
                </FormSection>

                <View style={styles.sheetSubmitBlock}>
                  <Button label="Create meeting" loading={submitting} onPress={onSubmitMeeting} />
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PlannerField({ children, helper, label }: { children: ReactNode; helper?: string; label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {helper ? <Text style={styles.fieldHint}>{helper}</Text> : null}
    </View>
  );
}

function MeetingTimePreview({
  dateValue,
  durationMins,
  startTime,
}: {
  dateValue: string;
  durationMins: string;
  startTime: string;
}) {
  const start = parseDateTime(dateValue, startTime);
  const duration = optionalNumber(durationMins);
  const validDuration = duration !== undefined && duration > 0;
  const valid = Boolean(start && validDuration);
  const end = start && validDuration ? addMinutes(start, duration) : null;

  return (
    <View style={[styles.timePreview, valid ? null : styles.timePreviewMuted]}>
      <View style={styles.timePreviewIcon}>
        <Clock3 color={valid ? colors.accent : colors.inkSoft} size={16} strokeWidth={2.7} />
      </View>
      <View style={styles.timePreviewCopy}>
        <Text style={styles.timePreviewLabel}>{valid ? "Time preview" : "Time helper"}</Text>
        <Text style={styles.timePreviewText}>
          {valid && start && end
            ? `${formatLongDate(start)} | ${formatTime(start)} - ${formatTime(end)}`
            : "Use HH:mm time and a positive duration in minutes."}
        </Text>
      </View>
    </View>
  );
}

function FormSection({
  children,
  icon,
  kicker,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  kicker: string;
  title: string;
}) {
  return (
    <View style={styles.formSection}>
      <View style={styles.formSectionHeader}>
        <View style={styles.formSectionIcon}>{icon}</View>
        <View style={styles.formSectionCopy}>
          <Text style={styles.formSectionKicker}>{kicker}</Text>
          <Text style={styles.formSectionTitle}>{title}</Text>
        </View>
      </View>
      <View style={styles.formSectionBody}>{children}</View>
    </View>
  );
}

function ProjectPicker({
  helper,
  onChange,
  optional = false,
  projects,
  value,
}: {
  helper?: string;
  onChange: (projectId: string) => void;
  optional?: boolean;
  projects: Project[];
  value: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{optional ? "Project link" : "Project"}</Text>
      <ScrollView contentContainerStyle={styles.chipRail} horizontal showsHorizontalScrollIndicator={false}>
        {optional ? <ChoiceChip active={!value} label="None" onPress={() => onChange("")} /> : null}
        {projects.map((p) => (
          <ChoiceChip active={value === p.id} key={p.id} label={p.name} onPress={() => onChange(p.id)} />
        ))}
      </ScrollView>
      {helper ? <Text style={styles.fieldHint}>{helper}</Text> : null}
      {!projects.length ? <Text style={styles.fieldHelp}>Create a project first to schedule tasks.</Text> : null}
    </View>
  );
}

function PickerRow<T extends string>({
  helper,
  label,
  onChange,
  options,
  renderLabel = (v) => v,
  value,
}: {
  helper?: string;
  label: string;
  onChange: (value: T) => void;
  options: readonly T[];
  renderLabel?: (value: T) => string;
  value: T;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView contentContainerStyle={styles.chipRail} horizontal showsHorizontalScrollIndicator={false}>
        {options.map((opt) => (
          <ChoiceChip active={value === opt} key={opt} label={renderLabel(opt)} onPress={() => onChange(opt)} />
        ))}
      </ScrollView>
      {helper ? <Text style={styles.fieldHint}>{helper}</Text> : null}
    </View>
  );
}

function ChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choiceChip, active && styles.choiceChipActive]}>
      <Text numberOfLines={1} style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MeetingDetailSheet({
  meeting,
  onClose,
  onOpenProject,
}: {
  meeting: Meeting | null;
  onClose: () => void;
  onOpenProject: (projectId?: string | null) => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={Boolean(meeting)}>
      <View style={styles.detailLayer}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetScrim} />
        {meeting ? (
          <View style={styles.detailSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.detailHeader}>
              <View style={styles.detailIcon}>
                <Video color={colors.accent} size={22} strokeWidth={2.7} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailTime}>{formatMeetingRange(meeting)}</Text>
                <Text style={styles.detailTitle}>{meeting.title}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetClose}>
                <X color={colors.foreground} size={20} strokeWidth={2.8} />
              </Pressable>
            </View>
            {meeting.description ? <Text style={styles.detailDescription}>{meeting.description}</Text> : null}
            <View style={styles.detailRows}>
              <DetailRow icon={<CalendarDays color={colors.inkSoft} size={16} strokeWidth={2.6} />} label="Date" value={formatLongDate(meeting.startAt)} />
              <DetailRow icon={<MapPin color={colors.inkSoft} size={16} strokeWidth={2.6} />} label="Location" value={meeting.locationName || humanStatus(meeting.locationMode)} />
              <DetailRow icon={<Clock3 color={colors.inkSoft} size={16} strokeWidth={2.6} />} label="Status" value={humanStatus(meeting.status)} />
            </View>
            {meeting.projectId ? (
              <Button label="Open project" onPress={() => onOpenProject(meeting.projectId)} rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />} />
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      {icon}
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.detailRowValue}>{value}</Text>
    </View>
  );
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function buildPlannerItems(tasks: Task[], meetings: Meeting[]): PlannerItem[] {
  const taskItems = tasks
    .map((task): PlannerItem | null => {
      const date = parseDate(task.dueDate);
      return date ? { date, id: task.id, kind: "task", task, title: task.title } : null;
    })
    .filter((item): item is PlannerItem => Boolean(item));

  const meetingItems = meetings
    .map((meeting): PlannerItem | null => {
      const date = parseDate(meeting.startAt);
      return date ? { date, id: meeting.id, kind: "meeting", meeting, title: meeting.title } : null;
    })
    .filter((item): item is PlannerItem => Boolean(item));

  return [...taskItems, ...meetingItems];
}

function countItemsByDate(items: PlannerItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = toDateKey(item.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function itemMatchesQuery(item: PlannerItem, query: string) {
  if (item.kind === "task") {
    return [item.task.title, item.task.key, item.task.project?.name, item.task.priority, item.task.status]
      .filter(Boolean).join(" ").toLowerCase().includes(query);
  }
  return [item.meeting.title, item.meeting.project?.name, item.meeting.locationName, item.meeting.locationMode, item.meeting.status]
    .filter(Boolean).join(" ").toLowerCase().includes(query);
}

function defaultTaskForm(projects: Project[], date: Date): TaskFormState {
  return { description: "", dueDate: formatDateInput(date), estimateMins: "", priority: "MEDIUM", projectId: projects[0]?.id ?? "", status: "TODO", title: "", type: "TASK" };
}

function defaultMeetingForm(projects: Project[], date: Date): MeetingFormState {
  return { description: "", durationMins: "30", locationMode: "ONLINE", locationName: "", meetingDate: formatDateInput(date), projectId: projects[0]?.id ?? "", startTime: "09:00", title: "" };
}

function meetingTone(status: string) {
  if (status === "COMPLETED") return "green" as const;
  if (status === "CANCELLED" || status === "NO_SHOW") return "red" as const;
  if (status === "LIVE" || status === "SCHEDULED") return "blue" as const;
  return "neutral" as const;
}

function priorityColor(priority: string) {
  if (priority === "CRITICAL") return colors.danger;
  if (priority === "URGENT") return colors.warning;
  if (priority === "HIGH") return "#b45309";
  if (priority === "LOW") return colors.inkSoft;
  return colors.accent;
}

function plannerStatPalette(tone: "blue" | "green" | "neutral" | "red" | "yellow") {
  if (tone === "blue") return { bg: colors.blueSoft, fg: colors.accent };
  if (tone === "green") return { bg: colors.greenSoft, fg: colors.success };
  if (tone === "red") return { bg: colors.redSoft, fg: colors.danger };
  if (tone === "yellow") return { bg: colors.yellowSoft, fg: colors.warning };
  return { bg: colors.panel, fg: colors.inkSoft };
}

function taskAssignedToUser(task: Task, userId: string) {
  return Boolean(
    task.assignees?.some((a) => a.user.id === userId)
    || task.card?.assignees?.some((a) => a.userId === userId || a.id === userId),
  );
}

function sortTasksByDueDate(a: Task, b: Task) {
  const ad = parseDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bd = parseDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return ad - bd;
}

function isClosedTask(task: Task) { return task.status === "DONE" || task.status === "CANCELLED"; }

function dateValueMatches(value: unknown, date: Date) {
  const parsed = parseDate(value);
  return parsed ? isSameDay(parsed, date) : false;
}

function parseDate(value: unknown) {
  if (!value) return null;
  const raw = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateTime(dateValue: string, timeValue: string) {
  const date = parseDate(dateValue);
  const time = /^(\d{1,2}):(\d{2})$/.exec(timeValue.trim());
  if (!date || !time) return null;
  const h = Number(time[1]);
  const m = Number(time[2]);
  if (h > 23 || m > 59) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMinutes(date: Date, amount: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + amount);
  return next;
}

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateKey(date: Date) { return formatDateInput(date); }

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatWeekRange(start: Date, end: Date) {
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function compactText(value: string, maxLength: number) {
  const text = value.trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatHeaderDate(date: Date) {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", weekday: "long" });
}

function formatLongDate(value: unknown) {
  const date = parseDate(value);
  if (!date) return "No date";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(value: unknown) {
  const date = parseDate(value);
  if (!date) return "Time";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatMeetingRange(meeting: Meeting | null) {
  if (!meeting) return "";
  return `${formatTime(meeting.startAt)} – ${formatTime(meeting.endAt)}`;
}

function optional(value: string) { const t = value.trim(); return t ? t : undefined; }

function optionalNumber(value: string) {
  const t = value.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function currentTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create(withFontStyles({
  safe: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 16, paddingBottom: 122, paddingHorizontal: 20, paddingTop: 14 },

  // Header
  header: { alignItems: "center", flexDirection: "row", gap: 14 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  pageTitle: { color: colors.foreground, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 10 },
  plannerStatsRow: { flexDirection: "row", gap: 8 },
  plannerStat: {
    borderColor: "rgba(16,16,15,0.04)",
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  plannerStatLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" },
  plannerStatValue: { fontSize: 19, fontWeight: "900", letterSpacing: -0.4 },
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
  addBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 50,
    justifyContent: "center",
    width: 50,
    shadowColor: "#e7bc00",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },

  // Week panel
  weekPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 22,
    paddingHorizontal: 18,
    paddingVertical: 22,
    ...shadow.card,
  },
  weekHeader: { alignItems: "center", flexDirection: "row", gap: 14, justifyContent: "space-between" },
  weekTitleBlock: { flex: 1, gap: 3, minWidth: 0 },
  weekLabel: { color: colors.foreground, fontSize: 16, fontWeight: "900", letterSpacing: -0.1 },
  weekMeta: { color: colors.inkSoft, fontSize: 11, fontWeight: "800" },
  weekNav: { alignItems: "center", flexDirection: "row", gap: 8 },
  weekArrow: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 16,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  todayBtn: { backgroundColor: colors.foreground, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  todayBtnText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  weekStrip: { gap: 12, paddingRight: 6, paddingVertical: 2 },
  dayBtn: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderColor: "transparent",
    borderRadius: 22,
    borderWidth: 1,
    gap: 7,
    minHeight: 100,
    paddingVertical: 14,
    width: 68,
  },
  dayBtnActive: { backgroundColor: colors.primary, borderColor: "#e7bc00", shadowColor: "#e7bc00", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 4 },
  dayBtnPressed: { opacity: 0.72, transform: [{ translateY: 1 }] },
  dayName: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
  dayNameActive: { color: colors.black },
  dayNum: { color: colors.foreground, fontSize: 21, fontWeight: "900", letterSpacing: -0.3 },
  dayNumActive: { color: colors.black },
  dayFooter: { alignItems: "center", flexDirection: "row", gap: 6, minHeight: 20 },
  dayDot: { backgroundColor: colors.accent, borderRadius: 99, height: 7, width: 7 },
  dayDotActive: { backgroundColor: colors.black },
  dayCount: { color: colors.accent, fontSize: 11, fontWeight: "900" },
  dayCountActive: { color: colors.black },

  // Search + filters
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 18,
    ...shadow.card,
  },
  searchInput: { color: colors.foreground, flex: 1, fontSize: 15, fontWeight: "800" },
  clearBtn: { padding: 4 },
  filterRail: { gap: 8 },
  segment: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  segmentActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  segmentText: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  segmentTextActive: { color: colors.white },

  // Loading / error
  loadingCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 12,
    padding: 36,
    ...shadow.card,
  },
  loadingText: { color: colors.inkSoft, fontSize: 14, fontWeight: "800" },
  errorCard: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  errorTitle: { color: colors.danger, fontSize: 17, fontWeight: "900" },
  errorBodyText: { color: colors.danger, fontSize: 13, fontWeight: "800", textAlign: "center" },

  // Section headers
  sectionHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  sectionHeadLeft: { alignItems: "center", flexDirection: "row", gap: 10 },
  sectionIcon: { alignItems: "center", borderRadius: radii.md, height: 36, justifyContent: "center", width: 36 },
  sectionTitle: { color: colors.foreground, fontSize: 19, fontWeight: "900" },
  sectionLink: { alignItems: "center", flexDirection: "row", gap: 4 },
  sectionLinkText: { color: colors.accent, fontSize: 13, fontWeight: "900" },

  // Agenda cards (individual)
  agendaStack: { gap: 10 },
  agendaCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    ...shadow.card,
  },
  agendaRail: { alignSelf: "stretch", width: 4 },
  agendaBody: { flex: 1, gap: 8, padding: 15 },
  agendaTop: { alignItems: "center", flexDirection: "row", gap: 8 },
  agendaTime: { color: colors.inkSoft, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  agendaSpacer: { flex: 1 },
  agendaTitle: { color: colors.foreground, fontSize: 15, fontWeight: "900", lineHeight: 21 },
  agendaMetaRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  agendaMeta: { color: colors.inkSoft, flex: 1, fontSize: 12, fontWeight: "800" },

  // Empty agenda
  emptyAgenda: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 10,
    padding: 36,
    ...shadow.card,
  },
  emptyAgendaIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 24,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  emptyAgendaTitle: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  emptyAgendaText: { color: colors.inkSoft, fontSize: 13, fontWeight: "700" },
  emptyActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  emptyBtn: { flex: 1, minWidth: 118 },

  // Task rows
  taskStack: { gap: 10 },
  taskRow: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    ...shadow.card,
  },
  taskRail: { alignSelf: "stretch", width: 4 },
  taskBody: { flex: 1, gap: 7, paddingHorizontal: 13, paddingVertical: 12 },
  taskTop: { alignItems: "center", flexDirection: "row", gap: 8 },
  taskTitle: { color: colors.foreground, flex: 1, fontSize: 13, fontWeight: "900", lineHeight: 18 },
  taskMeta: { alignItems: "center", flexDirection: "row", gap: 8 },
  taskMetaSpacer: { flex: 1 },
  taskProject: { color: colors.inkSoft, flexShrink: 1, fontSize: 11, fontWeight: "800", maxWidth: 156 },
  taskDue: { color: colors.inkSoft, fontSize: 10, fontWeight: "900" },
  taskDueBadge: {
    backgroundColor: colors.panelMuted,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  taskDueBadgeOverdue: { backgroundColor: colors.redSoft },
  taskDueOverdue: { color: colors.danger },

  // Clear / empty cards for sections
  clearCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 16,
    ...shadow.card,
  },
  clearCardText: { color: colors.inkSoft, flex: 1, fontSize: 13, fontWeight: "800" },

  // Sheet
  sheetLayer: { flex: 1, justifyContent: "flex-end" },
  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,16,15,0.42)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    maxHeight: "90%",
    padding: 20,
    paddingBottom: 26,
    ...shadow.heavy,
  },
  sheetHandle: { alignSelf: "center", backgroundColor: colors.line, borderRadius: 99, height: 4, marginBottom: 14, width: 48 },
  sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sheetTitle: { color: colors.foreground, fontSize: 25, fontWeight: "900", letterSpacing: -0.3 },
  sheetClose: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  sheetContent: { gap: 16, paddingTop: 18 },
  sheetError: { backgroundColor: colors.redSoft, borderColor: "#fecaca", borderRadius: radii.lg, borderWidth: 1, padding: 12 },
  sheetErrorText: { color: colors.danger, fontSize: 13, fontWeight: "800" },
  fieldWrap: { gap: 8 },
  fieldLabel: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  fieldHint: { color: colors.inkSoft, fontSize: 11, fontWeight: "700", lineHeight: 16 },
  fieldHelp: { color: colors.warning, fontSize: 12, fontWeight: "800" },
  formInlineGrid: { flexDirection: "row", gap: 10 },
  formInlineItem: { flex: 1, minWidth: 0 },
  formSection: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 16,
    padding: 16,
    ...shadow.card,
  },
  formSectionBody: { gap: 15 },
  formSectionCopy: { flex: 1, minWidth: 0 },
  formSectionHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  formSectionIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 17,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  formSectionKicker: { color: colors.accent, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  formSectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900", marginTop: 2 },
  sheetSubmitBlock: { paddingTop: 2 },
  timePreview: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderColor: "#dbeafe",
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 13,
  },
  timePreviewCopy: { flex: 1, minWidth: 0 },
  timePreviewIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 15,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  timePreviewLabel: { color: colors.accent, fontSize: 10, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  timePreviewMuted: { backgroundColor: colors.panelMuted, borderColor: colors.line },
  timePreviewText: { color: colors.foreground, fontSize: 13, fontWeight: "800", lineHeight: 18, marginTop: 2 },
  textInput: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 56,
    paddingHorizontal: 15,
  },
  textArea: { minHeight: 104, paddingTop: 14, textAlignVertical: "top" },
  chipRail: { gap: 8, paddingRight: 8 },
  choiceChip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 190,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceChipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  choiceChipText: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  choiceChipTextActive: { color: colors.white },

  // Meeting detail sheet
  detailLayer: { flex: 1, justifyContent: "flex-end" },
  detailSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    gap: 16,
    padding: 20,
    paddingBottom: 28,
    ...shadow.heavy,
  },
  detailHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  detailIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 21,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  detailCopy: { flex: 1, minWidth: 0 },
  detailTime: { color: colors.accent, fontSize: 12, fontWeight: "900" },
  detailTitle: { color: colors.foreground, fontSize: 20, fontWeight: "900", lineHeight: 26 },
  detailDescription: { color: colors.inkSoft, fontSize: 14, fontWeight: "700", lineHeight: 21 },
  detailRows: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailRow: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  detailRowLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: "900", width: 72 },
  detailRowValue: { color: colors.foreground, flex: 1, fontSize: 13, fontWeight: "900", textAlign: "right" },
}));
