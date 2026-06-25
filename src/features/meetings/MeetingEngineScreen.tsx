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
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bot,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Link2,
  Plus,
  RefreshCw,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
  Video,
  X,
  Zap,
} from "lucide-react-native";
import {
  archiveMeeting,
  cancelMeeting,
  completeMeeting,
  convertMeetingAiActionItems,
  createBookingPage,
  createMeeting,
  createMeetingAvailabilityWindow,
  createMeetingConference,
  createMeetingType,
  deleteMeetingAvailabilityWindow,
  detectMeetingAiMissedDecisions,
  detectMeetingAiRisks,
  generateMeetingAiAgenda,
  generateMeetingAiFollowUp,
  generateMeetingAiNotes,
  generateMeetingAiPreparationBrief,
  generateMeetingAiRoleSummary,
  getMeetingAiState,
  getMeetingIntegrationSettings,
  getMeetingIntegrationStatus,
  linkMeetingAiContext,
  listBookingPages,
  listBookingRequests,
  listMeetingAvailability,
  listMeetingReminderJobs,
  listMeetingTypes,
  listMeetings,
  listProjects,
  listTeams,
  listUsers,
  processMeetingReminderJobs,
  restoreMeeting,
  retryMeetingReminderJob,
  scheduleMeetingAiFollowUpReminders,
  scoreMeetingAiEffectiveness,
  startMeeting,
  suggestMeetingAiAttendees,
  updateMeetingIntegrationSettings,
  type CreateBookingPagePayload,
  type CreateMeetingAvailabilityWindowPayload,
  type CreateMeetingPayload,
  type CreateMeetingTypePayload,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type {
  BookingPage,
  BookingRequest,
  BookingRoutingStrategy,
  Meeting,
  MeetingAiState,
  MeetingAvailability,
  MeetingConferenceProvider,
  MeetingIntegrationSettings,
  MeetingIntegrationStatus,
  MeetingLocationMode,
  MeetingReminderChannel,
  MeetingReminderJob,
  MeetingStatus,
  MeetingType,
  MeetingTypeCategory,
  Project,
  Team,
  TenantUser,
} from "@/lib/types";
import { ProjectDateField, ProjectDatePickerSheet } from "@/features/projects/ProjectDatePicker";

type ViewMode = "schedule" | "booking" | "types" | "availability" | "ai" | "integrations";
type Notice = { ok: boolean; text: string } | null;

type MeetingForm = {
  agenda: string;
  aiEnabled: boolean;
  attendeeIds: string[];
  description: string;
  durationMins: string;
  externalAttendees: string;
  hostId: string;
  locationMode: MeetingLocationMode;
  meetingDate: string;
  meetingTypeId: string;
  meetingUrl: string;
  projectId: string;
  startTime: string;
  title: string;
};

type BookingForm = {
  allowCancel: boolean;
  allowReschedule: boolean;
  approvalRequired: boolean;
  collectCompanyName: boolean;
  description: string;
  durationMins: string;
  meetingTypeId: string;
  minNoticeMins: string;
  ownerId: string;
  path: string;
  routingStrategy: BookingRoutingStrategy;
  scope: "TENANT" | "TEAM" | "USER";
  subtitle: string;
  teamId: string;
  title: string;
};

type TypeForm = {
  agenda: string;
  category: MeetingTypeCategory;
  description: string;
  durationMins: string;
  locationMode: MeetingLocationMode;
  name: string;
  requiresApproval: boolean;
};

type AvailabilityForm = {
  capacity: string;
  dayOfWeek: string;
  endTime: string;
  label: string;
  ownerId: string;
  scope: "USER" | "TEAM" | "TENANT";
  startTime: string;
  teamId: string;
};

const emptyAvailability: MeetingAvailability = { blackouts: [], windows: [] };

const viewTabs: Array<{ id: ViewMode; icon: typeof CalendarDays; label: string }> = [
  { id: "schedule", icon: CalendarDays, label: "Schedule" },
  { id: "booking", icon: Route, label: "Booking" },
  { id: "types", icon: Settings2, label: "Types" },
  { id: "availability", icon: ShieldCheck, label: "Availability" },
  { id: "ai", icon: Bot, label: "AI" },
  { id: "integrations", icon: Zap, label: "Integrations" },
];

const statusFilters: Array<"ALL" | MeetingStatus> = ["ALL", "SCHEDULED", "LIVE", "COMPLETED", "CANCELLED", "ARCHIVED"];
const locationModes: MeetingLocationMode[] = ["ONLINE", "IN_PERSON", "HYBRID", "PHONE", "TBD"];
const typeCategories: MeetingTypeCategory[] = ["INTERNAL", "CLIENT", "SALES", "SUPPORT", "SPRINT", "STANDUP", "REVIEW", "INTERVIEW", "TRAINING", "CUSTOM"];
const routingStrategies: BookingRoutingStrategy[] = ["DIRECT_HOST", "ROUND_ROBIN", "LEAST_BUSY", "PRIORITY", "DEPARTMENT"];
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const reminderChannels: MeetingReminderChannel[] = ["IN_APP", "EMAIL", "WHATSAPP", "SMS", "WEBHOOK"];
const conferenceProviders: MeetingConferenceProvider[] = ["NONE", "MANUAL", "GOOGLE_MEET", "MICROSOFT_TEAMS", "ZOOM", "CUSTOM_URL"];

export function MeetingEngineScreen() {
  const { accessToken, user } = useAuthSession();
  const [activeView, setActiveView] = useState<ViewMode>("schedule");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [availability, setAvailability] = useState<MeetingAvailability>(emptyAvailability);
  const [bookingPages, setBookingPages] = useState<BookingPage[]>([]);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<MeetingIntegrationStatus | null>(null);
  const [integrationSettings, setIntegrationSettings] = useState<MeetingIntegrationSettings | null>(null);
  const [reminderJobs, setReminderJobs] = useState<MeetingReminderJob[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [aiState, setAiState] = useState<MeetingAiState | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MeetingStatus>("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState<MeetingForm>(createDefaultMeetingForm());
  const [bookingForm, setBookingForm] = useState<BookingForm>(createDefaultBookingForm());
  const [typeForm, setTypeForm] = useState<TypeForm>(createDefaultTypeForm());
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityForm>(createDefaultAvailabilityForm(user?.id));
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [aiTranscript, setAiTranscript] = useState("");

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const selectedMeeting = meetings.find((meeting) => meeting.id === selectedMeetingId) ?? meetings[0] ?? null;

  const metrics = useMemo(() => {
    const now = new Date();
    const todayKey = formatDateValue(now);
    const active = meetings.filter((meeting) => meeting.status !== "ARCHIVED");
    return {
      visible: active.length,
      upcoming: active.filter((meeting) => new Date(meeting.startAt).getTime() >= now.getTime() && meeting.status === "SCHEDULED").length,
      today: active.filter((meeting) => formatDateValue(new Date(meeting.startAt)) === todayKey).length,
      live: active.filter((meeting) => meeting.status === "LIVE").length,
      aiReady: active.filter((meeting) => meeting.aiEnabled).length,
    };
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return meetings.filter((meeting) => {
      if (statusFilter !== "ALL" && meeting.status !== statusFilter) return false;
      if (projectFilter !== "ALL" && meeting.projectId !== projectFilter) return false;
      if (!normalized) return true;
      return [
        meeting.title,
        meeting.description,
        meeting.project?.name,
        meeting.project?.key,
        meeting.locationName,
        meeting.clientName,
        meeting.clientCompany,
      ].filter(Boolean).join(" ").toLowerCase().includes(normalized);
    });
  }, [meetings, projectFilter, search, statusFilter]);

  const load = useCallback(async (showSpinner = true) => {
    if (!accessToken) return;
    if (showSpinner) setLoading(true);
    setNotice(null);

    const results = await Promise.allSettled([
      listMeetings(accessToken, { limit: 100, page: 1 }),
      listMeetingTypes(accessToken, { limit: 100, page: 1 }),
      listProjects(accessToken, { limit: 100, page: 1 }),
      listTeams(accessToken, { limit: 100, page: 1 }),
      listUsers(accessToken, { limit: 100, page: 1 }),
      listMeetingAvailability(accessToken),
      listBookingPages(accessToken, { limit: 100, page: 1 }),
      listBookingRequests(accessToken, { limit: 100, page: 1 }),
      getMeetingIntegrationStatus(accessToken),
      getMeetingIntegrationSettings(accessToken),
      listMeetingReminderJobs(accessToken, { limit: 50, page: 1 }),
    ]);

    setMeetings(pageItems<Meeting>(settledValue(results[0])));
    setMeetingTypes(pageItems<MeetingType>(settledValue(results[1])));
    setProjects(pageItems<Project>(settledValue(results[2])));
    setTeams(pageItems<Team>(settledValue(results[3])));
    setUsers(pageItems<TenantUser>(settledValue(results[4])));
    setAvailability((settledValue(results[5]) as MeetingAvailability | null) ?? emptyAvailability);
    setBookingPages(pageItems<BookingPage>(settledValue(results[6])));
    setBookingRequests(pageItems<BookingRequest>(settledValue(results[7])));
    setIntegrationStatus((settledValue(results[8]) as MeetingIntegrationStatus | null) ?? null);
    setIntegrationSettings((settledValue(results[9]) as MeetingIntegrationSettings | null) ?? null);
    setReminderJobs(pageItems<MeetingReminderJob>(settledValue(results[10])));

    const failed = results.filter((result) => result.status === "rejected").map((result) => errorMessage((result as PromiseRejectedResult).reason));
    if (failed.length) {
      setNotice({ ok: false, text: failed.slice(0, 2).join(" ") });
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!meetings.length) {
      setSelectedMeetingId("");
      return;
    }
    if (!selectedMeetingId || !meetings.some((meeting) => meeting.id === selectedMeetingId)) {
      setSelectedMeetingId(meetings[0]?.id ?? "");
    }
  }, [meetings, selectedMeetingId]);

  useEffect(() => {
    if (!accessToken || !selectedMeetingId || activeView !== "ai") return;
    void refreshAiState(selectedMeetingId);
  }, [accessToken, activeView, selectedMeetingId]);

  async function refreshAiState(meetingId = selectedMeetingId) {
    if (!accessToken || !meetingId) return;
    try {
      setAiState(await getMeetingAiState(accessToken, meetingId));
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  }

  async function handleCreateMeeting() {
    if (!accessToken) return;
    if (!meetingForm.title.trim()) {
      setNotice({ ok: false, text: "Meeting title is required." });
      return;
    }

    setSaving("meeting");
    try {
      const payload = buildMeetingPayload(meetingForm, timezone);
      const created = await createMeeting(accessToken, payload);
      setNotice({ ok: true, text: "Meeting scheduled." });
      setMeetingModalOpen(false);
      setMeetingForm(createDefaultMeetingForm());
      await load(false);
      if (created && typeof created === "object" && "id" in created) {
        setSelectedMeetingId(String(created.id));
      }
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  function confirmMeetingAction(kind: "archive" | "cancel" | "complete" | "restore" | "start") {
    if (!selectedMeeting || !accessToken) return;
    const labels = {
      archive: "Archive meeting",
      cancel: "Cancel meeting",
      complete: "Complete meeting",
      restore: "Restore meeting",
      start: "Start live meeting",
    };
    Alert.alert(labels[kind], `Apply this action to "${selectedMeeting.title}"?`, [
      { style: "cancel", text: "No" },
      { style: "destructive", text: "Yes", onPress: () => void executeMeetingAction(kind, selectedMeeting.id) },
    ]);
  }

  async function executeMeetingAction(kind: "archive" | "cancel" | "complete" | "restore" | "start", meetingId: string) {
    if (!accessToken) return;
    setSaving(kind);
    try {
      if (kind === "start") await startMeeting(accessToken, meetingId);
      if (kind === "complete") await completeMeeting(accessToken, meetingId);
      if (kind === "cancel") await cancelMeeting(accessToken, meetingId, { reason: "Cancelled from mobile." });
      if (kind === "archive") await archiveMeeting(accessToken, meetingId);
      if (kind === "restore") await restoreMeeting(accessToken, meetingId);
      setNotice({ ok: true, text: "Meeting updated." });
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleCreateMeetingType() {
    if (!accessToken || !typeForm.name.trim()) {
      setNotice({ ok: false, text: "Meeting type name is required." });
      return;
    }
    setSaving("type");
    try {
      const payload: CreateMeetingTypePayload = {
        category: typeForm.category,
        defaultAgenda: parseLines(typeForm.agenda),
        durationMins: toNumber(typeForm.durationMins, 30),
        locationMode: typeForm.locationMode,
        name: typeForm.name.trim(),
        requiresApproval: typeForm.requiresApproval,
        description: optional(typeForm.description),
      };
      await createMeetingType(accessToken, payload);
      setTypeForm(createDefaultTypeForm());
      setNotice({ ok: true, text: "Meeting type created." });
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleCreateBookingPage() {
    if (!accessToken || !bookingForm.title.trim() || !bookingForm.path.trim()) {
      setNotice({ ok: false, text: "Booking title and path are required." });
      return;
    }
    setSaving("booking");
    try {
      const payload: CreateBookingPagePayload = {
        allowCancel: bookingForm.allowCancel,
        allowReschedule: bookingForm.allowReschedule,
        approvalRequired: bookingForm.approvalRequired,
        collectCompanyName: bookingForm.collectCompanyName,
        description: optional(bookingForm.description),
        durationMins: toNumber(bookingForm.durationMins, 30),
        meetingTypeId: optional(bookingForm.meetingTypeId),
        minNoticeMins: toNumber(bookingForm.minNoticeMins, 120),
        ownerId: optional(bookingForm.ownerId),
        path: slugifyPath(bookingForm.path),
        routingStrategy: bookingForm.routingStrategy,
        scope: bookingForm.scope,
        subtitle: optional(bookingForm.subtitle),
        teamId: optional(bookingForm.teamId),
        title: bookingForm.title.trim(),
        locationMode: "ONLINE",
        timezone,
      };
      await createBookingPage(accessToken, payload);
      setBookingForm(createDefaultBookingForm());
      setNotice({ ok: true, text: "Booking page created." });
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleCreateAvailabilityWindow() {
    if (!accessToken) return;
    setSaving("availability");
    try {
      const payload: CreateMeetingAvailabilityWindowPayload = {
        capacity: toNumber(availabilityForm.capacity, 1),
        dayOfWeek: toNumber(availabilityForm.dayOfWeek, 1),
        endTime: availabilityForm.endTime || "17:00",
        label: optional(availabilityForm.label) ?? "Working hours",
        ownerId: availabilityForm.scope === "USER" ? optional(availabilityForm.ownerId) : undefined,
        scope: availabilityForm.scope,
        startTime: availabilityForm.startTime || "09:00",
        teamId: availabilityForm.scope === "TEAM" ? optional(availabilityForm.teamId) : undefined,
        timezone,
      };
      await createMeetingAvailabilityWindow(accessToken, payload);
      setNotice({ ok: true, text: "Availability window added." });
      setAvailabilityForm(createDefaultAvailabilityForm(user?.id));
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  function confirmDeleteAvailabilityWindow(windowId: string) {
    Alert.alert("Delete availability", "Remove this booking window?", [
      { style: "cancel", text: "Cancel" },
      { style: "destructive", text: "Delete", onPress: () => void handleDeleteAvailabilityWindow(windowId) },
    ]);
  }

  async function handleDeleteAvailabilityWindow(windowId: string) {
    if (!accessToken) return;
    setSaving(`window:${windowId}`);
    try {
      await deleteMeetingAvailabilityWindow(accessToken, windowId);
      setNotice({ ok: true, text: "Availability removed." });
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleUpdateIntegrationSettings() {
    if (!accessToken || !integrationSettings) return;
    setSaving("integrations");
    try {
      await updateMeetingIntegrationSettings(accessToken, {
        allowedConferenceProviders: integrationSettings.allowedConferenceProviders,
        calendarSyncEnabled: integrationSettings.calendarSyncEnabled,
        defaultConferenceProvider: integrationSettings.defaultConferenceProvider,
        defaultReminderChannels: integrationSettings.defaultReminderChannels,
        emailRemindersEnabled: integrationSettings.emailRemindersEnabled,
        requireApprovedWhatsappTemplates: integrationSettings.requireApprovedWhatsappTemplates,
        smsRemindersEnabled: integrationSettings.smsRemindersEnabled,
        webhookEventsEnabled: integrationSettings.webhookEventsEnabled,
        whatsappRemindersEnabled: integrationSettings.whatsappRemindersEnabled,
      });
      setNotice({ ok: true, text: "Integration settings saved." });
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleProcessReminderJobs() {
    if (!accessToken) return;
    setSaving("reminders");
    try {
      await processMeetingReminderJobs(accessToken, { limit: 25 });
      setNotice({ ok: true, text: "Reminder queue processed." });
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleRetryReminderJob(jobId: string) {
    if (!accessToken) return;
    setSaving(`retry:${jobId}`);
    try {
      await retryMeetingReminderJob(accessToken, jobId);
      setNotice({ ok: true, text: "Reminder job requeued." });
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleCreateConference() {
    if (!accessToken || !selectedMeeting) return;
    setSaving("conference");
    try {
      await createMeetingConference(accessToken, selectedMeeting.id, {
        meetingUrl: selectedMeeting.meetingUrl ?? undefined,
        provider: integrationSettings?.defaultConferenceProvider ?? "MANUAL",
        sendUpdates: "all",
      });
      setNotice({ ok: true, text: "Conference details attached." });
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleRunAi(kind: "agenda" | "attendees" | "brief" | "followup" | "missed" | "notes" | "pm" | "risks" | "score") {
    if (!accessToken || !selectedMeeting) {
      setNotice({ ok: false, text: "Select a meeting before running AI." });
      return;
    }
    setSaving(`ai:${kind}`);
    const body = {
      notes: optional(aiNotes),
      prompt: optional(aiPrompt),
      transcript: optional(aiTranscript),
    };
    try {
      if (kind === "agenda") setAiState(await generateMeetingAiAgenda(accessToken, selectedMeeting.id, body));
      if (kind === "brief") setAiState(await generateMeetingAiPreparationBrief(accessToken, selectedMeeting.id, body));
      if (kind === "attendees") setAiState(await suggestMeetingAiAttendees(accessToken, selectedMeeting.id, body));
      if (kind === "risks") setAiState(await detectMeetingAiRisks(accessToken, selectedMeeting.id, body));
      if (kind === "notes") setAiState(await generateMeetingAiNotes(accessToken, selectedMeeting.id, body));
      if (kind === "followup") setAiState(await generateMeetingAiFollowUp(accessToken, selectedMeeting.id, body));
      if (kind === "pm") setAiState(await generateMeetingAiRoleSummary(accessToken, selectedMeeting.id, { ...body, role: "PROJECT_MANAGER" }));
      if (kind === "score") setAiState(await scoreMeetingAiEffectiveness(accessToken, selectedMeeting.id, body));
      if (kind === "missed") setAiState(await detectMeetingAiMissedDecisions(accessToken, selectedMeeting.id, body));
      setNotice({ ok: true, text: "AI automation updated." });
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleLinkAiContext() {
    if (!accessToken || !selectedMeeting) return;
    setSaving("ai:links");
    try {
      setAiState(await linkMeetingAiContext(accessToken, selectedMeeting.id, {
        clientCompany: selectedMeeting.clientCompany ?? null,
        clientEmail: selectedMeeting.clientEmail ?? null,
        clientName: selectedMeeting.clientName ?? null,
        projectId: selectedMeeting.projectId ?? null,
        sprintId: selectedMeeting.sprintId ?? null,
        taskId: selectedMeeting.taskId ?? null,
        teamId: selectedMeeting.teamId ?? null,
      }));
      setNotice({ ok: true, text: "Meeting context synced to AI." });
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleConvertActionItems() {
    if (!accessToken || !selectedMeeting) return;
    setSaving("ai:convert");
    try {
      await convertMeetingAiActionItems(accessToken, selectedMeeting.id, {
        createChecklist: true,
        defaultPriority: "MEDIUM",
        defaultProjectId: selectedMeeting.projectId ?? projects[0]?.id,
        defaultSprintId: selectedMeeting.sprintId ?? undefined,
      });
      await refreshAiState(selectedMeeting.id);
      setNotice({ ok: true, text: "Open action items converted to tasks." });
      await load(false);
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  async function handleScheduleFollowUps() {
    if (!accessToken || !selectedMeeting) return;
    setSaving("ai:followups");
    try {
      await scheduleMeetingAiFollowUpReminders(accessToken, selectedMeeting.id, { dueOffsetMinutes: 1440 });
      await refreshAiState(selectedMeeting.id);
      setNotice({ ok: true, text: "Follow-up reminders scheduled." });
    } catch (error) {
      setNotice({ ok: false, text: errorMessage(error) });
    } finally {
      setSaving("");
    }
  }

  function renderActiveView() {
    if (activeView === "booking") {
      return (
        <BookingTab
          bookingForm={bookingForm}
          bookingPages={bookingPages}
          bookingRequests={bookingRequests}
          meetingTypes={meetingTypes}
          onChange={setBookingForm}
          onCreate={handleCreateBookingPage}
          saving={saving === "booking"}
          teams={teams}
          users={users}
        />
      );
    }
    if (activeView === "types") {
      return (
        <TypesTab
          form={typeForm}
          meetingTypes={meetingTypes}
          onChange={setTypeForm}
          onCreate={handleCreateMeetingType}
          saving={saving === "type"}
        />
      );
    }
    if (activeView === "availability") {
      return (
        <AvailabilityTab
          availability={availability}
          form={availabilityForm}
          onChange={setAvailabilityForm}
          onCreate={handleCreateAvailabilityWindow}
          onDeleteWindow={confirmDeleteAvailabilityWindow}
          saving={saving}
          teams={teams}
          users={users}
        />
      );
    }
    if (activeView === "ai") {
      return (
        <AiTab
          aiNotes={aiNotes}
          aiPrompt={aiPrompt}
          aiState={aiState}
          aiTranscript={aiTranscript}
          meetings={meetings}
          onConvertActions={handleConvertActionItems}
          onLinkContext={handleLinkAiContext}
          onRun={handleRunAi}
          onScheduleFollowUps={handleScheduleFollowUps}
          saving={saving}
          selectedMeeting={selectedMeeting}
          selectedMeetingId={selectedMeetingId}
          setAiNotes={setAiNotes}
          setAiPrompt={setAiPrompt}
          setAiTranscript={setAiTranscript}
          setSelectedMeetingId={setSelectedMeetingId}
        />
      );
    }
    if (activeView === "integrations") {
      return (
        <IntegrationsTab
          integrationSettings={integrationSettings}
          integrationStatus={integrationStatus}
          onChangeSettings={setIntegrationSettings}
          onCreateConference={handleCreateConference}
          onProcessJobs={handleProcessReminderJobs}
          onRetryJob={handleRetryReminderJob}
          onSaveSettings={handleUpdateIntegrationSettings}
          reminderJobs={reminderJobs}
          saving={saving}
          selectedMeeting={selectedMeeting}
        />
      );
    }

    return (
      <ScheduleTab
        filteredMeetings={filteredMeetings}
        meetings={meetings}
        onAction={confirmMeetingAction}
        onOpenCreate={() => setMeetingModalOpen(true)}
        onProjectFilter={setProjectFilter}
        onSearch={setSearch}
        onSelect={setSelectedMeetingId}
        onStatusFilter={setStatusFilter}
        projectFilter={projectFilter}
        projects={projects}
        saving={saving}
        search={search}
        selectedMeeting={selectedMeeting}
        statusFilter={statusFilter}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} tintColor={colors.foreground} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerIcon}>
              <CalendarClock color={colors.primary} size={22} strokeWidth={2.7} />
            </View>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.eyebrow}>Tenant meeting engine</Text>
              <Text style={styles.title}>Meetings</Text>
              <Text style={styles.subtitle}>Schedule, booking, availability, AI context, and reminder delivery.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void handleRefresh()} style={styles.iconButton}>
              <RefreshCw color={colors.foreground} size={19} strokeWidth={2.7} />
            </Pressable>
          </View>
          <View style={styles.metricStrip}>
            <Metric label="Visible" value={metrics.visible} />
            <Metric label="Upcoming" value={metrics.upcoming} />
            <Metric label="Today" value={metrics.today} />
            <Metric label="Live" value={metrics.live} />
            <Metric label="AI-ready" value={metrics.aiReady} />
          </View>
          <Pressable accessibilityRole="button" onPress={() => setMeetingModalOpen(true)} style={styles.primaryAction}>
            <Plus color={colors.black} size={18} strokeWidth={3} />
            <Text style={styles.primaryActionText}>New meeting</Text>
          </Pressable>
        </View>

        <TabRail active={activeView} onChange={setActiveView} />

        {notice ? (
          <Pressable accessibilityRole="button" onPress={() => setNotice(null)} style={[styles.notice, notice.ok ? styles.noticeOk : styles.noticeBad]}>
            <Text style={[styles.noticeText, notice.ok ? styles.noticeTextOk : styles.noticeTextBad]}>{notice.text}</Text>
            <X color={notice.ok ? colors.success : colors.danger} size={16} strokeWidth={2.8} />
          </Pressable>
        ) : null}

        {loading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.foreground} />
            <Text style={styles.loadingText}>Loading meeting engine...</Text>
          </View>
        ) : (
          renderActiveView()
        )}
      </ScrollView>

      <MeetingCreateModal
        form={meetingForm}
        meetingTypes={meetingTypes}
        onChange={setMeetingForm}
        onClose={() => setMeetingModalOpen(false)}
        onDatePress={() => setDatePickerOpen(true)}
        onSubmit={handleCreateMeeting}
        projects={projects}
        saving={saving === "meeting"}
        users={users}
        visible={meetingModalOpen}
      />
      <ProjectDatePickerSheet
        onClose={() => setDatePickerOpen(false)}
        onSelect={(value) => {
          setMeetingForm((current) => ({ ...current, meetingDate: value || formatDateValue(new Date()) }));
          setDatePickerOpen(false);
        }}
        title="Meeting date"
        value={meetingForm.meetingDate}
        visible={datePickerOpen}
      />
    </SafeAreaView>
  );
}

function ScheduleTab({
  filteredMeetings,
  onAction,
  onOpenCreate,
  onProjectFilter,
  onSearch,
  onSelect,
  onStatusFilter,
  projectFilter,
  projects,
  saving,
  search,
  selectedMeeting,
  statusFilter,
}: {
  filteredMeetings: Meeting[];
  meetings: Meeting[];
  onAction: (kind: "archive" | "cancel" | "complete" | "restore" | "start") => void;
  onOpenCreate: () => void;
  onProjectFilter: (value: string) => void;
  onSearch: (value: string) => void;
  onSelect: (meetingId: string) => void;
  onStatusFilter: (value: "ALL" | MeetingStatus) => void;
  projectFilter: string;
  projects: Project[];
  saving: string;
  search: string;
  selectedMeeting: Meeting | null;
  statusFilter: "ALL" | MeetingStatus;
}) {
  return (
    <View style={styles.viewGrid}>
      <View style={styles.filterPanel}>
        <View style={styles.searchBox}>
          <Search color={colors.inkSoft} size={18} strokeWidth={2.6} />
          <TextInput
            onChangeText={onSearch}
            placeholder="Search title, agenda, project"
            placeholderTextColor="#aaa298"
            style={styles.searchInput}
            value={search}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
          {statusFilters.map((status) => (
            <ChoiceChip active={statusFilter === status} key={status} label={status === "ALL" ? "All" : humanize(status)} onPress={() => onStatusFilter(status)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
          <ChoiceChip active={projectFilter === "ALL"} label="All projects" onPress={() => onProjectFilter("ALL")} />
          {projects.map((project) => (
            <ChoiceChip active={projectFilter === project.id} key={project.id} label={project.key} onPress={() => onProjectFilter(project.id)} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.scheduleGrid}>
        <View style={styles.cardList}>
          <SectionHeader count={filteredMeetings.length} icon={<CalendarDays color={colors.accent} size={18} strokeWidth={2.7} />} title="Schedule" />
          {filteredMeetings.map((meeting) => (
            <Pressable accessibilityRole="button" key={meeting.id} onPress={() => onSelect(meeting.id)} style={[styles.meetingRow, selectedMeeting?.id === meeting.id ? styles.meetingRowActive : null]}>
              <View style={styles.meetingDot} />
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.meetingTitle}>{meeting.title}</Text>
                <Text numberOfLines={1} style={styles.meetingMeta}>{meeting.project?.name ?? meeting.team?.name ?? "Workspace"} - {formatMeetingTime(meeting)}</Text>
              </View>
              {meeting.aiEnabled ? <Text style={styles.aiBadge}>AI</Text> : null}
            </Pressable>
          ))}
          {!filteredMeetings.length ? <EmptyState text="No meetings match the current filters." /> : null}
        </View>

        <View style={styles.detailPanel}>
          {selectedMeeting ? (
            <>
              <View style={styles.detailHeader}>
                <View style={styles.flex}>
                  <Text style={styles.statusTag}>{humanize(selectedMeeting.status)}</Text>
                  <Text style={styles.detailTitle}>{selectedMeeting.title}</Text>
                  <Text style={styles.detailMeta}>{formatMeetingTime(selectedMeeting)} - {durationLabel(selectedMeeting.startAt, selectedMeeting.endAt)}</Text>
                </View>
                <Video color={colors.foreground} size={24} strokeWidth={2.5} />
              </View>
              <InfoLine label="Host" value={selectedMeeting.host ? displayUser(selectedMeeting.host) : "Unassigned"} />
              <InfoLine label="Location" value={selectedMeeting.meetingUrl || selectedMeeting.locationName || humanize(selectedMeeting.locationMode)} />
              <InfoLine label="Project" value={selectedMeeting.project ? `${selectedMeeting.project.key} - ${selectedMeeting.project.name}` : "No project"} />
              <InfoLine label="Attendees" value={`${selectedMeeting.attendees?.length ?? 0} people`} />
              <InfoLine label="AI automation" value={selectedMeeting.aiEnabled ? "Agenda, notes, risks, and follow-up ready" : "Disabled"} />
              <View style={styles.actionGrid}>
                <MiniButton disabled={saving === "start"} label="Start" onPress={() => onAction("start")} variant="dark" />
                <MiniButton disabled={saving === "complete"} label="Complete" onPress={() => onAction("complete")} />
                <MiniButton disabled={saving === "cancel"} label="Cancel" onPress={() => onAction("cancel")} />
                <MiniButton disabled={saving === "archive"} label={selectedMeeting.status === "ARCHIVED" ? "Restore" : "Archive"} onPress={() => onAction(selectedMeeting.status === "ARCHIVED" ? "restore" : "archive")} />
              </View>
            </>
          ) : (
            <EmptyState text="Select a meeting to inspect lifecycle, attendees, location, and AI readiness." />
          )}
          <Pressable accessibilityRole="button" onPress={onOpenCreate} style={styles.detailCreate}>
            <Plus color={colors.black} size={17} strokeWidth={3} />
            <Text style={styles.detailCreateText}>Schedule meeting</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function BookingTab({
  bookingForm,
  bookingPages,
  bookingRequests,
  meetingTypes,
  onChange,
  onCreate,
  saving,
  teams,
  users,
}: {
  bookingForm: BookingForm;
  bookingPages: BookingPage[];
  bookingRequests: BookingRequest[];
  meetingTypes: MeetingType[];
  onChange: (form: BookingForm) => void;
  onCreate: () => void;
  saving: boolean;
  teams: Team[];
  users: TenantUser[];
}) {
  const activePages = bookingPages.filter((page) => page.isActive);
  const pendingRequests = bookingRequests.filter((request) => request.status === "PENDING_APPROVAL");

  return (
    <View style={styles.viewGrid}>
      <SurfaceBlock eyebrow="Public booking engine" icon={<Route color={colors.primary} size={18} strokeWidth={2.8} />} title="Create a bookable experience">
        <FormInput label="Title" onChangeText={(title) => onChange({ ...bookingForm, title })} placeholder="Discovery call" value={bookingForm.title} />
        <FormInput label="Public path" onChangeText={(path) => onChange({ ...bookingForm, path })} placeholder="discovery-call" value={bookingForm.path} />
        <FormInput label="Subtitle" onChangeText={(subtitle) => onChange({ ...bookingForm, subtitle })} placeholder="For teams evaluating TaskBricks" value={bookingForm.subtitle} />
        <FormInput label="Description" multiline onChangeText={(description) => onChange({ ...bookingForm, description })} placeholder="Short public description" value={bookingForm.description} />
        <ChoiceRow label="Scope" options={["TENANT", "TEAM", "USER"]} value={bookingForm.scope} onChange={(scope) => onChange({ ...bookingForm, scope })} />
        <ChoiceRow label="Routing" options={routingStrategies} value={bookingForm.routingStrategy} onChange={(routingStrategy) => onChange({ ...bookingForm, routingStrategy })} />
        <EntityRow
          label="Template"
          options={[{ id: "", label: "No template" }, ...meetingTypes.map((item) => ({ id: item.id, label: item.name }))]}
          value={bookingForm.meetingTypeId}
          onChange={(meetingTypeId) => onChange({ ...bookingForm, meetingTypeId })}
        />
        <EntityRow
          label="Team"
          options={[{ id: "", label: "Any team" }, ...teams.map((team) => ({ id: team.id, label: team.name }))]}
          value={bookingForm.teamId}
          onChange={(teamId) => onChange({ ...bookingForm, teamId })}
        />
        <EntityRow
          label="Host"
          options={[{ id: "", label: "Auto host" }, ...users.map((member) => ({ id: member.id, label: displayUser(member) }))]}
          value={bookingForm.ownerId}
          onChange={(ownerId) => onChange({ ...bookingForm, ownerId })}
        />
        <View style={styles.twoCol}>
          <FormInput keyboardType="number-pad" label="Duration" onChangeText={(durationMins) => onChange({ ...bookingForm, durationMins })} value={bookingForm.durationMins} />
          <FormInput keyboardType="number-pad" label="Min notice" onChangeText={(minNoticeMins) => onChange({ ...bookingForm, minNoticeMins })} value={bookingForm.minNoticeMins} />
        </View>
        <ToggleRow label="Approval required" value={bookingForm.approvalRequired} onToggle={() => onChange({ ...bookingForm, approvalRequired: !bookingForm.approvalRequired })} />
        <ToggleRow label="Collect company" value={bookingForm.collectCompanyName} onToggle={() => onChange({ ...bookingForm, collectCompanyName: !bookingForm.collectCompanyName })} />
        <ToggleRow label="Allow cancel" value={bookingForm.allowCancel} onToggle={() => onChange({ ...bookingForm, allowCancel: !bookingForm.allowCancel })} />
        <ToggleRow label="Allow reschedule" value={bookingForm.allowReschedule} onToggle={() => onChange({ ...bookingForm, allowReschedule: !bookingForm.allowReschedule })} />
        <PrimaryButton loading={saving} label="Create booking page" onPress={onCreate} />
      </SurfaceBlock>

      <View style={styles.gridGap}>
        <View style={styles.miniMetricGrid}>
          <StatTile label="Active pages" tone={colors.foreground} value={activePages.length} />
          <StatTile label="Requests" tone={colors.warning} value={bookingRequests.length} />
          <StatTile label="Pending" tone="#6d5dd3" value={pendingRequests.length} />
        </View>
        <SurfaceBlock eyebrow={`${bookingPages.length} configured`} icon={<Link2 color={colors.accent} size={18} strokeWidth={2.8} />} title="Public booking links">
          {bookingPages.map((page) => (
            <CompactRecord
              key={page.id}
              meta={`${humanize(page.routingStrategy)} - ${page.durationMins ?? page.meetingType?.durationMins ?? 30} mins`}
              right={page.isActive ? "Live" : "Paused"}
              title={page.title}
            />
          ))}
          {!bookingPages.length ? <EmptyState text="No public booking pages yet." /> : null}
        </SurfaceBlock>
        <SurfaceBlock eyebrow="Guest flow" icon={<UsersRound color={colors.accent} size={18} strokeWidth={2.8} />} title="Recent requests">
          {bookingRequests.slice(0, 6).map((request) => (
            <CompactRecord
              key={request.id}
              meta={`${request.guestEmail} - ${formatShortDate(request.startAt)}`}
              right={humanize(request.status)}
              title={request.guestName}
            />
          ))}
          {!bookingRequests.length ? <EmptyState text="No guest bookings have been submitted." /> : null}
        </SurfaceBlock>
      </View>
    </View>
  );
}

function TypesTab({ form, meetingTypes, onChange, onCreate, saving }: {
  form: TypeForm;
  meetingTypes: MeetingType[];
  onChange: (form: TypeForm) => void;
  onCreate: () => void;
  saving: boolean;
}) {
  return (
    <View style={styles.viewGrid}>
      <SurfaceBlock eyebrow="Reusable scheduling template" icon={<Settings2 color={colors.primary} size={18} strokeWidth={2.8} />} title="Create meeting type">
        <FormInput label="Name" onChangeText={(name) => onChange({ ...form, name })} placeholder="Discovery call" value={form.name} />
        <FormInput label="Description" onChangeText={(description) => onChange({ ...form, description })} placeholder="Purpose and rules for this meeting type" value={form.description} />
        <ChoiceRow label="Category" options={typeCategories} value={form.category} onChange={(category) => onChange({ ...form, category })} />
        <ChoiceRow label="Location" options={locationModes} value={form.locationMode} onChange={(locationMode) => onChange({ ...form, locationMode })} />
        <FormInput keyboardType="number-pad" label="Duration minutes" onChangeText={(durationMins) => onChange({ ...form, durationMins })} value={form.durationMins} />
        <FormInput label="Default agenda" multiline onChangeText={(agenda) => onChange({ ...form, agenda })} placeholder="One agenda item per line" value={form.agenda} />
        <ToggleRow label="Require approval before confirmation" value={form.requiresApproval} onToggle={() => onChange({ ...form, requiresApproval: !form.requiresApproval })} />
        <PrimaryButton loading={saving} label="Create type" onPress={onCreate} />
      </SurfaceBlock>
      <SurfaceBlock eyebrow={`${meetingTypes.length} templates`} icon={<FileText color={colors.accent} size={18} strokeWidth={2.8} />} title="Meeting type catalog">
        {meetingTypes.map((type) => (
          <CompactRecord
            key={type.id}
            meta={`${humanize(type.category)} - ${type.durationMins} mins - ${humanize(type.locationMode)}`}
            right={type.requiresApproval ? "Approval" : "Instant"}
            title={type.name}
          />
        ))}
        {!meetingTypes.length ? <EmptyState text="No meeting types yet." /> : null}
      </SurfaceBlock>
    </View>
  );
}

function AvailabilityTab({ availability, form, onChange, onCreate, onDeleteWindow, saving, teams, users }: {
  availability: MeetingAvailability;
  form: AvailabilityForm;
  onChange: (form: AvailabilityForm) => void;
  onCreate: () => void;
  onDeleteWindow: (windowId: string) => void;
  saving: string;
  teams: Team[];
  users: TenantUser[];
}) {
  return (
    <View style={styles.viewGrid}>
      <SurfaceBlock eyebrow="Host booking windows" icon={<ShieldCheck color={colors.primary} size={18} strokeWidth={2.8} />} title="Add availability">
        <FormInput label="Label" onChangeText={(label) => onChange({ ...form, label })} value={form.label} />
        <ChoiceRow label="Scope" options={["USER", "TEAM", "TENANT"]} value={form.scope} onChange={(scope) => onChange({ ...form, scope })} />
        {form.scope === "USER" ? (
          <EntityRow
            label="Owner"
            options={users.map((member) => ({ id: member.id, label: displayUser(member) }))}
            value={form.ownerId}
            onChange={(ownerId) => onChange({ ...form, ownerId })}
          />
        ) : null}
        {form.scope === "TEAM" ? (
          <EntityRow
            label="Team"
            options={teams.map((team) => ({ id: team.id, label: team.name }))}
            value={form.teamId}
            onChange={(teamId) => onChange({ ...form, teamId })}
          />
        ) : null}
        <EntityRow
          label="Day"
          options={weekdays.map((day, index) => ({ id: String(index), label: day }))}
          value={form.dayOfWeek}
          onChange={(dayOfWeek) => onChange({ ...form, dayOfWeek })}
        />
        <View style={styles.threeCol}>
          <FormInput label="Start" onChangeText={(startTime) => onChange({ ...form, startTime })} value={form.startTime} />
          <FormInput label="End" onChangeText={(endTime) => onChange({ ...form, endTime })} value={form.endTime} />
          <FormInput keyboardType="number-pad" label="Capacity" onChangeText={(capacity) => onChange({ ...form, capacity })} value={form.capacity} />
        </View>
        <PrimaryButton loading={saving === "availability"} label="Add window" onPress={onCreate} />
      </SurfaceBlock>
      <SurfaceBlock eyebrow={`${availability.windows.length} windows - ${availability.blackouts.length} blackouts`} icon={<Clock3 color={colors.accent} size={18} strokeWidth={2.8} />} title="Availability rules">
        {availability.windows.map((window) => (
          <View key={window.id} style={styles.windowRow}>
            <View style={styles.flex}>
              <Text style={styles.recordTitle}>{window.label || "Working hours"}</Text>
              <Text style={styles.recordMeta}>{weekdays[window.dayOfWeek] ?? "Day"} - {window.startTime} to {window.endTime} - {humanize(window.scope)}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => onDeleteWindow(window.id)} style={styles.trashButton}>
              <Trash2 color={colors.danger} size={16} strokeWidth={2.8} />
            </Pressable>
          </View>
        ))}
        {availability.blackouts.map((blackout) => (
          <CompactRecord key={blackout.id} meta={`${formatShortDate(blackout.startAt)} - ${formatShortDate(blackout.endAt)}`} right="Blackout" title={blackout.title} />
        ))}
        {!availability.windows.length && !availability.blackouts.length ? <EmptyState text="No availability windows have been configured." /> : null}
      </SurfaceBlock>
    </View>
  );
}

function AiTab({
  aiNotes,
  aiPrompt,
  aiState,
  aiTranscript,
  meetings,
  onConvertActions,
  onLinkContext,
  onRun,
  onScheduleFollowUps,
  saving,
  selectedMeeting,
  selectedMeetingId,
  setAiNotes,
  setAiPrompt,
  setAiTranscript,
  setSelectedMeetingId,
}: {
  aiNotes: string;
  aiPrompt: string;
  aiState: MeetingAiState | null;
  aiTranscript: string;
  meetings: Meeting[];
  onConvertActions: () => void;
  onLinkContext: () => void;
  onRun: (kind: "agenda" | "attendees" | "brief" | "followup" | "missed" | "notes" | "pm" | "risks" | "score") => void;
  onScheduleFollowUps: () => void;
  saving: string;
  selectedMeeting: Meeting | null;
  selectedMeetingId: string;
  setAiNotes: (value: string) => void;
  setAiPrompt: (value: string) => void;
  setAiTranscript: (value: string) => void;
  setSelectedMeetingId: (value: string) => void;
}) {
  const actionItems = aiState?.actionItems ?? [];
  const summary = recordValue(aiState?.summary);
  return (
    <View style={styles.viewGrid}>
      <SurfaceBlock eyebrow="Meeting intelligence" icon={<Bot color={colors.primary} size={18} strokeWidth={2.8} />} title="AI automation">
        <EntityRow
          label="Meeting"
          options={meetings.map((meeting) => ({ id: meeting.id, label: meeting.title }))}
          value={selectedMeetingId}
          onChange={setSelectedMeetingId}
        />
        <FormInput label="Prompt" onChangeText={setAiPrompt} placeholder="Focus on blockers, decisions, and follow-up" value={aiPrompt} />
        <FormInput label="Notes" multiline onChangeText={setAiNotes} placeholder="Paste rough meeting notes" value={aiNotes} />
        <FormInput label="Transcript" multiline onChangeText={setAiTranscript} placeholder="Paste transcript for notes, risks, and action items" value={aiTranscript} />
        <View style={styles.aiGrid}>
          <AiButton loading={saving === "ai:agenda"} label="Agenda" onPress={() => onRun("agenda")} />
          <AiButton loading={saving === "ai:brief"} label="Prep brief" onPress={() => onRun("brief")} />
          <AiButton loading={saving === "ai:attendees"} label="Attendees" onPress={() => onRun("attendees")} />
          <AiButton loading={saving === "ai:risks"} label="Risks" onPress={() => onRun("risks")} />
          <AiButton loading={saving === "ai:notes"} label="Notes" onPress={() => onRun("notes")} />
          <AiButton loading={saving === "ai:followup"} label="Follow-up" onPress={() => onRun("followup")} />
          <AiButton loading={saving === "ai:score"} label="Score" onPress={() => onRun("score")} />
          <AiButton loading={saving === "ai:missed"} label="Missed decisions" onPress={() => onRun("missed")} />
          <AiButton loading={saving === "ai:pm"} label="PM summary" onPress={() => onRun("pm")} />
        </View>
      </SurfaceBlock>
      <View style={styles.gridGap}>
        <SurfaceBlock eyebrow={selectedMeeting?.title ?? "Select meeting"} icon={<Sparkles color={colors.accent} size={18} strokeWidth={2.8} />} title="AI state">
          <View style={styles.miniMetricGrid}>
            <StatTile label="Open actions" tone={colors.warning} value={aiState?.health.openActionItems ?? 0} />
            <StatTile label="Converted" tone={colors.success} value={aiState?.health.convertedActionItems ?? 0} />
            <StatTile label="Score" tone="#6d5dd3" value={aiState?.health.effectivenessScore ?? 0} />
          </View>
          <View style={styles.actionGrid}>
            <MiniButton disabled={saving === "ai:links"} label="Sync context" onPress={onLinkContext} variant="dark" />
            <MiniButton disabled={saving === "ai:convert"} label="Convert tasks" onPress={onConvertActions} />
            <MiniButton disabled={saving === "ai:followups"} label="Reminders" onPress={onScheduleFollowUps} />
          </View>
        </SurfaceBlock>
        <SurfaceBlock eyebrow={`${actionItems.length} extracted`} icon={<CheckCircle2 color={colors.success} size={18} strokeWidth={2.8} />} title="Action items">
          {actionItems.map((item) => (
            <CompactRecord
              key={item.id}
              meta={`${item.ownerEmail || "No owner"}${item.dueDate ? ` - ${item.dueDate}` : ""}`}
              right={item.convertedTaskKey || item.status || "Open"}
              title={item.title}
            />
          ))}
          {!actionItems.length ? <EmptyState text="Run Notes or Follow-up to extract action items." /> : null}
        </SurfaceBlock>
        <SurfaceBlock eyebrow="Latest artifacts" icon={<FileText color={colors.accent} size={18} strokeWidth={2.8} />} title="Summary">
          <ArtifactPreview title="Agenda" value={summary.agenda} />
          <ArtifactPreview title="Preparation brief" value={summary.preparationBrief} />
          <ArtifactPreview title="Risk detection" value={summary.riskDetection} />
          <ArtifactPreview title="Follow-up" value={summary.followUp} />
          {!Object.keys(summary).length ? <EmptyState text="No AI artifacts have been generated for this meeting yet." /> : null}
        </SurfaceBlock>
      </View>
    </View>
  );
}

function IntegrationsTab({
  integrationSettings,
  integrationStatus,
  onChangeSettings,
  onCreateConference,
  onProcessJobs,
  onRetryJob,
  onSaveSettings,
  reminderJobs,
  saving,
  selectedMeeting,
}: {
  integrationSettings: MeetingIntegrationSettings | null;
  integrationStatus: MeetingIntegrationStatus | null;
  onChangeSettings: (settings: MeetingIntegrationSettings | null) => void;
  onCreateConference: () => void;
  onProcessJobs: () => void;
  onRetryJob: (jobId: string) => void;
  onSaveSettings: () => void;
  reminderJobs: MeetingReminderJob[];
  saving: string;
  selectedMeeting: Meeting | null;
}) {
  const providers = Object.entries(integrationStatus?.providers ?? {});
  const queue = integrationStatus?.queue ?? {};
  return (
    <View style={styles.viewGrid}>
      <SurfaceBlock eyebrow="Provider control plane" icon={<Zap color={colors.primary} size={18} strokeWidth={2.8} />} title="Integrations and reminders">
        <View style={styles.miniMetricGrid}>
          <StatTile label="Connected" tone={colors.success} value={providers.filter(([, provider]) => provider.connected).length} />
          <StatTile label="Queued" tone={colors.warning} value={queue.QUEUED ?? 0} />
          <StatTile label="Failed" tone={colors.danger} value={(queue.FAILED ?? 0) + (queue.DEAD_LETTER ?? 0)} />
        </View>
        {providers.map(([provider, state]) => (
          <CompactRecord key={provider} meta={state.name || state.provider || "Tenant integration"} right={state.connected ? "Connected" : "Not connected"} title={humanize(provider)} />
        ))}
        {!providers.length ? <EmptyState text="No provider readiness metadata returned." /> : null}
        <MiniButton disabled={!selectedMeeting || saving === "conference"} label="Create conference for selected meeting" onPress={onCreateConference} variant="dark" />
      </SurfaceBlock>
      <View style={styles.gridGap}>
        <SurfaceBlock eyebrow="Tenant controls" icon={<Settings2 color={colors.accent} size={18} strokeWidth={2.8} />} title="Meeting integration settings">
          {integrationSettings ? (
            <>
              <ChoiceRow
                label="Default conference"
                options={conferenceProviders}
                value={integrationSettings.defaultConferenceProvider}
                onChange={(defaultConferenceProvider) => onChangeSettings({ ...integrationSettings, defaultConferenceProvider })}
              />
              {([
                ["Calendar sync", "calendarSyncEnabled"],
                ["Email reminders", "emailRemindersEnabled"],
                ["WhatsApp reminders", "whatsappRemindersEnabled"],
                ["SMS reminders", "smsRemindersEnabled"],
                ["Webhook events", "webhookEventsEnabled"],
              ] as const).map(([label, key]) => (
                <ToggleRow
                  key={key}
                  label={label}
                  value={Boolean(integrationSettings[key])}
                  onToggle={() => onChangeSettings({ ...integrationSettings, [key]: !integrationSettings[key] })}
                />
              ))}
              <Text style={styles.smallLabel}>Reminder channels</Text>
              <View style={styles.wrapRow}>
                {reminderChannels.map((channel) => {
                  const active = integrationSettings.defaultReminderChannels.includes(channel);
                  return (
                    <ChoiceChip
                      active={active}
                      key={channel}
                      label={humanize(channel)}
                      onPress={() => {
                        const next = active
                          ? integrationSettings.defaultReminderChannels.filter((item) => item !== channel)
                          : [...integrationSettings.defaultReminderChannels, channel];
                        onChangeSettings({ ...integrationSettings, defaultReminderChannels: next });
                      }}
                    />
                  );
                })}
              </View>
              <PrimaryButton loading={saving === "integrations"} label="Save integration settings" onPress={onSaveSettings} />
            </>
          ) : (
            <EmptyState text="Integration settings are not available for this account." />
          )}
        </SurfaceBlock>
        <SurfaceBlock eyebrow={`${reminderJobs.length} recent jobs`} icon={<Clock3 color={colors.accent} size={18} strokeWidth={2.8} />} title="Reminder delivery queue">
          <MiniButton disabled={saving === "reminders"} label="Process due reminders" onPress={onProcessJobs} variant="dark" />
          {reminderJobs.slice(0, 10).map((job) => (
            <View key={job.id} style={styles.windowRow}>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.recordTitle}>{job.meeting?.title ?? job.meetingId}</Text>
                <Text numberOfLines={1} style={styles.recordMeta}>{humanize(job.channel)} - {humanize(job.status)} - {job.attempts}/{job.maxAttempts}</Text>
                {job.lastError ? <Text numberOfLines={2} style={styles.errorLine}>{job.lastError}</Text> : null}
              </View>
              {job.status === "FAILED" || job.status === "DEAD_LETTER" ? (
                <MiniButton disabled={saving === `retry:${job.id}`} label="Retry" onPress={() => onRetryJob(job.id)} />
              ) : null}
            </View>
          ))}
          {!reminderJobs.length ? <EmptyState text="No reminder jobs returned." /> : null}
        </SurfaceBlock>
      </View>
    </View>
  );
}

function MeetingCreateModal({
  form,
  meetingTypes,
  onChange,
  onClose,
  onDatePress,
  onSubmit,
  projects,
  saving,
  users,
  visible,
}: {
  form: MeetingForm;
  meetingTypes: MeetingType[];
  onChange: (form: MeetingForm) => void;
  onClose: () => void;
  onDatePress: () => void;
  onSubmit: () => void;
  projects: Project[];
  saving: boolean;
  users: TenantUser[];
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalLayer}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalScrim} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>New meeting</Text>
              <Text style={styles.modalTitle}>Schedule meeting</Text>
              <Text style={styles.modalSub}>Meeting details, attendees, agenda, and AI readiness.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <SurfaceBlock compact eyebrow="Basics" icon={<CalendarDays color={colors.accent} size={18} strokeWidth={2.8} />} title="Meeting identity">
              <FormInput label="Title" onChangeText={(title) => onChange({ ...form, title })} placeholder="Project sync" value={form.title} />
              <FormInput label="Description" multiline onChangeText={(description) => onChange({ ...form, description })} placeholder="Context or preparation notes" value={form.description} />
              <EntityRow
                label="Template"
                options={[{ id: "", label: "No template" }, ...meetingTypes.map((type) => ({ id: type.id, label: type.name }))]}
                value={form.meetingTypeId}
                onChange={(meetingTypeId) => onChange({ ...form, meetingTypeId })}
              />
              <EntityRow
                label="Project"
                options={[{ id: "", label: "No project" }, ...projects.map((project) => ({ id: project.id, label: `${project.key} - ${project.name}` }))]}
                value={form.projectId}
                onChange={(projectId) => onChange({ ...form, projectId })}
              />
            </SurfaceBlock>
            <SurfaceBlock compact eyebrow="Schedule" icon={<Clock3 color={colors.accent} size={18} strokeWidth={2.8} />} title="Time and place">
              <ProjectDateField helperText="Tap to choose from calendar" label="Date" onClear={() => onChange({ ...form, meetingDate: formatDateValue(new Date()) })} onPress={onDatePress} placeholder="Pick date" value={form.meetingDate} />
              <View style={styles.twoCol}>
                <FormInput label="Start time" onChangeText={(startTime) => onChange({ ...form, startTime })} placeholder="13:00" value={form.startTime} />
                <FormInput keyboardType="number-pad" label="Duration" onChangeText={(durationMins) => onChange({ ...form, durationMins })} value={form.durationMins} />
              </View>
              <ChoiceRow label="Location mode" options={locationModes} value={form.locationMode} onChange={(locationMode) => onChange({ ...form, locationMode })} />
              <FormInput label="Meeting URL" onChangeText={(meetingUrl) => onChange({ ...form, meetingUrl })} placeholder="Google Meet, Teams, Zoom..." value={form.meetingUrl} />
            </SurfaceBlock>
            <SurfaceBlock compact eyebrow="Participants" icon={<UsersRound color={colors.accent} size={18} strokeWidth={2.8} />} title="Attendees and agenda">
              <EntityRow
                label="Host"
                options={[{ id: "", label: "Me as host" }, ...users.map((member) => ({ id: member.id, label: displayUser(member) }))]}
                value={form.hostId}
                onChange={(hostId) => onChange({ ...form, hostId })}
              />
              <Text style={styles.smallLabel}>Internal attendees</Text>
              <View style={styles.wrapRow}>
                {users.slice(0, 20).map((member) => {
                  const active = form.attendeeIds.includes(member.id);
                  return (
                    <ChoiceChip
                      active={active}
                      key={member.id}
                      label={displayUser(member)}
                      onPress={() => onChange({
                        ...form,
                        attendeeIds: active ? form.attendeeIds.filter((id) => id !== member.id) : [...form.attendeeIds, member.id],
                      })}
                    />
                  );
                })}
              </View>
              <FormInput label="External attendees" onChangeText={(externalAttendees) => onChange({ ...form, externalAttendees })} placeholder="client@example.com, pm@example.com" value={form.externalAttendees} />
              <FormInput label="Agenda" multiline onChangeText={(agenda) => onChange({ ...form, agenda })} placeholder="One agenda item per line" value={form.agenda} />
              <ToggleRow label="Enable AI automation" value={form.aiEnabled} onToggle={() => onChange({ ...form, aiEnabled: !form.aiEnabled })} />
            </SurfaceBlock>
            <PrimaryButton loading={saving} label="Schedule meeting" onPress={onSubmit} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TabRail({ active, onChange }: { active: ViewMode; onChange: (view: ViewMode) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRail}>
      {viewTabs.map((tab) => {
        const Icon = tab.icon;
        const selected = active === tab.id;
        return (
          <Pressable accessibilityRole="button" key={tab.id} onPress={() => onChange(tab.id)} style={[styles.viewTab, selected ? styles.viewTabActive : null]}>
            <Icon color={selected ? colors.white : colors.inkSoft} size={16} strokeWidth={2.7} />
            <Text style={[styles.viewTabText, selected ? styles.viewTabTextActive : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SurfaceBlock({ children, compact, eyebrow, icon, title }: { children: React.ReactNode; compact?: boolean; eyebrow: string; icon: React.ReactNode; title: string }) {
  return (
    <View style={[styles.surface, compact ? styles.surfaceCompact : null]}>
      <View style={styles.surfaceHeader}>
        <View style={styles.surfaceIcon}>{icon}</View>
        <View style={styles.flex}>
          <Text style={styles.surfaceEyebrow}>{eyebrow}</Text>
          <Text style={styles.surfaceTitle}>{title}</Text>
        </View>
      </View>
      <View style={styles.surfaceBody}>{children}</View>
    </View>
  );
}

function SectionHeader({ count, icon, title }: { count?: number; icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {count !== undefined ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatTile({ label, tone, value }: { label: string; tone: string; value: number }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FormInput({ label, multiline, style, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        placeholderTextColor="#aaa298"
        style={[styles.formInput, multiline ? styles.formInputMulti : null, style]}
        {...props}
      />
    </View>
  );
}

function ChoiceRow<T extends string>({ label, onChange, options, value }: { label: string; onChange: (value: T) => void; options: T[]; value: T }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.wrapRow}>
        {options.map((option) => (
          <ChoiceChip active={value === option} key={option} label={humanize(option)} onPress={() => onChange(option)} />
        ))}
      </View>
    </View>
  );
}

function EntityRow({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }>; value: string }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
        {options.map((option) => (
          <ChoiceChip active={value === option.id} key={`${label}-${option.id || "empty"}`} label={option.label} onPress={() => onChange(option.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

function ChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, active ? styles.chipActive : null]}>
      <Text numberOfLines={1} style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({ label, onToggle, value }: { label: string; onToggle: () => void; value: boolean }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={onToggle} style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggle, value ? styles.toggleActive : null]}>
        <View style={[styles.toggleKnob, value ? styles.toggleKnobActive : null]} />
      </View>
    </Pressable>
  );
}

function PrimaryButton({ label, loading, onPress }: { label: string; loading?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={loading} onPress={onPress} style={[styles.primaryButton, loading ? styles.disabled : null]}>
      {loading ? <ActivityIndicator color={colors.black} size="small" /> : <Text style={styles.primaryButtonText}>{label}</Text>}
      {!loading ? <ChevronRight color={colors.black} size={18} strokeWidth={3} /> : null}
    </Pressable>
  );
}

function MiniButton({ disabled, label, onPress, variant = "outline" }: { disabled?: boolean; label: string; onPress: () => void; variant?: "dark" | "outline" }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.miniButton, variant === "dark" ? styles.miniButtonDark : null, disabled ? styles.disabled : null]}>
      <Text style={[styles.miniButtonText, variant === "dark" ? styles.miniButtonTextDark : null]}>{label}</Text>
    </Pressable>
  );
}

function AiButton({ label, loading, onPress }: { label: string; loading?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={loading} onPress={onPress} style={[styles.aiButton, loading ? styles.disabled : null]}>
      {loading ? <ActivityIndicator color={colors.foreground} size="small" /> : <Sparkles color={colors.accent} size={14} strokeWidth={2.8} />}
      <Text style={styles.aiButtonText}>{label}</Text>
    </Pressable>
  );
}

function CompactRecord({ meta, right, title }: { meta: string; right?: string; title: string }) {
  return (
    <View style={styles.compactRecord}>
      <View style={styles.recordIcon} />
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.recordTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.recordMeta}>{meta}</Text>
      </View>
      {right ? <Text numberOfLines={1} style={styles.recordRight}>{right}</Text> : null}
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ArtifactPreview({ title, value }: { title: string; value: unknown }) {
  if (!value) return null;
  return (
    <View style={styles.artifact}>
      <Text style={styles.artifactTitle}>{title}</Text>
      <Text numberOfLines={4} style={styles.artifactText}>{artifactText(value)}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function createDefaultMeetingForm(): MeetingForm {
  const start = nextHour();
  return {
    agenda: "",
    aiEnabled: true,
    attendeeIds: [],
    description: "",
    durationMins: "30",
    externalAttendees: "",
    hostId: "",
    locationMode: "ONLINE",
    meetingDate: formatDateValue(start),
    meetingTypeId: "",
    meetingUrl: "",
    projectId: "",
    startTime: formatTimeValue(start),
    title: "",
  };
}

function createDefaultBookingForm(): BookingForm {
  return {
    allowCancel: true,
    allowReschedule: true,
    approvalRequired: false,
    collectCompanyName: true,
    description: "",
    durationMins: "30",
    meetingTypeId: "",
    minNoticeMins: "120",
    ownerId: "",
    path: "",
    routingStrategy: "ROUND_ROBIN",
    scope: "TENANT",
    subtitle: "",
    teamId: "",
    title: "",
  };
}

function createDefaultTypeForm(): TypeForm {
  return {
    agenda: "",
    category: "CUSTOM",
    description: "",
    durationMins: "30",
    locationMode: "ONLINE",
    name: "",
    requiresApproval: false,
  };
}

function createDefaultAvailabilityForm(ownerId?: string): AvailabilityForm {
  return {
    capacity: "1",
    dayOfWeek: "1",
    endTime: "17:00",
    label: "Primary working hours",
    ownerId: ownerId ?? "",
    scope: "USER",
    startTime: "09:00",
    teamId: "",
  };
}

function buildMeetingPayload(form: MeetingForm, timezone: string): CreateMeetingPayload {
  const start = combineDateTime(form.meetingDate, form.startTime);
  const duration = toNumber(form.durationMins, 30);
  const end = new Date(start.getTime() + duration * 60_000);
  return {
    agendaItems: parseLines(form.agenda).map((title, sortOrder) => ({ title, sortOrder })),
    aiEnabled: form.aiEnabled,
    attendeeIds: form.attendeeIds,
    description: optional(form.description),
    endAt: end.toISOString(),
    externalAttendees: parseExternalAttendees(form.externalAttendees),
    hostId: optional(form.hostId),
    locationMode: form.locationMode,
    meetingTypeId: optional(form.meetingTypeId),
    meetingUrl: optional(form.meetingUrl),
    projectId: optional(form.projectId),
    reminderOffsets: [1440, 60, 10],
    startAt: start.toISOString(),
    timezone,
    title: form.title.trim(),
    visibility: "TEAM",
  };
}

function pageItems<T>(value: unknown): T[] {
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: T[] }).data;
  }
  return [];
}

function settledValue(result: PromiseSettledResult<unknown>) {
  return result.status === "fulfilled" ? result.value : null;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Meeting request failed.";
}

function displayUser(user: Pick<TenantUser, "email" | "firstName" | "lastName">) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email;
}

function optional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function parseExternalAttendees(value: string) {
  return value.split(",").map((email) => email.trim()).filter(Boolean).map((email) => ({ email, role: "GUEST" as const }));
}

function toNumber(value: string | number | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nextHour() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
}

function combineDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1, hour || 9, minute || 0, 0, 0);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
}

function formatMeetingTime(meeting: Meeting) {
  const start = new Date(meeting.startAt);
  if (Number.isNaN(start.getTime())) return "No time";
  return `${formatShortDate(meeting.startAt)}, ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(start)}`;
}

function durationLabel(startAt: string, endAt: string) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "Duration unavailable";
  const minutes = Math.max(0, Math.round((end - start) / 60_000));
  return `${minutes} mins`;
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugifyPath(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9/-]+/g, "-").replace(/^-+|-+$/g, "");
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function artifactText(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const first = record.summary ?? record.brief ?? record.body ?? record.title ?? record.score;
    if (typeof first === "string" || typeof first === "number") return String(first);
    return JSON.stringify(value).slice(0, 240);
  }
  return String(value);
}

const styles = StyleSheet.create(withFontStyles({
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  aiBadge: { backgroundColor: "#f1e8ff", borderRadius: 999, color: "#6d28d9", fontSize: 10, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5 },
  aiButton: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 42, paddingHorizontal: 12 },
  aiButtonText: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  aiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  artifact: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, gap: 6, padding: 12 },
  artifactText: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  artifactTitle: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  cardList: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, overflow: "hidden", ...shadow.card },
  chip: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: 999, borderWidth: 1, minHeight: 38, paddingHorizontal: 13, justifyContent: "center" },
  chipActive: { backgroundColor: colors.black, borderColor: colors.black },
  chipRail: { gap: 8, paddingRight: 8 },
  chipText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  chipTextActive: { color: colors.white },
  compactRecord: { alignItems: "center", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: 12, padding: 12 },
  content: { gap: 18, padding: 20, paddingBottom: 120 },
  detailCreate: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderColor: colors.primaryDark, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 6, minHeight: 44, paddingHorizontal: 14 },
  detailCreateText: { color: colors.black, fontSize: 13, fontWeight: "900" },
  detailHeader: { alignItems: "flex-start", flexDirection: "row", gap: 14, justifyContent: "space-between" },
  detailMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 6 },
  detailPanel: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 12, padding: 16, ...shadow.card },
  detailTitle: { color: colors.foreground, fontSize: 22, fontWeight: "900", letterSpacing: 0, marginTop: 4 },
  disabled: { opacity: 0.55 },
  emptyState: { alignItems: "center", borderColor: colors.line, borderRadius: radii.lg, borderStyle: "dashed", borderWidth: 1, justifyContent: "center", minHeight: 92, padding: 16 },
  emptyText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", lineHeight: 19, textAlign: "center" },
  errorLine: { color: colors.danger, fontSize: 11, fontWeight: "800", marginTop: 4 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  fieldLabel: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  filterPanel: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 12, padding: 14, ...shadow.card },
  flex: { flex: 1, minWidth: 0 },
  formField: { gap: 8 },
  formInput: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, color: colors.foreground, fontSize: 14, fontWeight: "800", minHeight: 50, paddingHorizontal: 14 },
  formInputMulti: { minHeight: 104, paddingTop: 14, textAlignVertical: "top" },
  gridGap: { gap: 14 },
  header: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 28, borderWidth: 1, gap: 16, padding: 18, ...shadow.card },
  headerIcon: { alignItems: "center", backgroundColor: colors.black, borderRadius: 17, height: 44, justifyContent: "center", width: 44 },
  headerTitleBlock: { flex: 1, minWidth: 0 },
  headerTop: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  iconButton: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 18, height: 44, justifyContent: "center", width: 44 },
  infoLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  infoLine: { backgroundColor: colors.panelMuted, borderRadius: 16, gap: 4, padding: 12 },
  infoValue: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  loadingPanel: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 10, minHeight: 170, justifyContent: "center" },
  loadingText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800" },
  meetingDot: { backgroundColor: colors.primaryDark, borderRadius: 5, height: 10, width: 10 },
  meetingMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 4 },
  meetingRow: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, minHeight: 76, padding: 14 },
  meetingRowActive: { backgroundColor: colors.yellowSoft },
  meetingTitle: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  metricItem: { alignItems: "center", borderRightColor: colors.line, borderRightWidth: 1, flex: 1, minWidth: 65 },
  metricLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  metricStrip: { backgroundColor: colors.panelMuted, borderRadius: 18, flexDirection: "row", overflow: "hidden", paddingVertical: 12 },
  metricValue: { color: colors.foreground, fontSize: 22, fontWeight: "900" },
  miniButton: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: 16, borderWidth: 1, minHeight: 42, justifyContent: "center", paddingHorizontal: 13 },
  miniButtonDark: { backgroundColor: colors.black, borderColor: colors.black },
  miniButtonText: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  miniButtonTextDark: { color: colors.white },
  miniMetricGrid: { flexDirection: "row", gap: 10 },
  modalClose: { alignItems: "center", backgroundColor: colors.white, borderRadius: 18, height: 42, justifyContent: "center", width: 42 },
  modalContent: { gap: 14, paddingBottom: 22 },
  modalHandle: { alignSelf: "center", backgroundColor: colors.line, borderRadius: 999, height: 4, marginBottom: 12, width: 44 },
  modalHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between", marginBottom: 12 },
  modalLayer: { flex: 1, justifyContent: "flex-end" },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,16,15,0.34)" },
  modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "92%", padding: 20, ...shadow.heavy },
  modalSub: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", marginTop: 4 },
  modalTitle: { color: colors.foreground, fontSize: 27, fontWeight: "900", letterSpacing: 0 },
  notice: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", padding: 13 },
  noticeBad: { backgroundColor: colors.redSoft, borderColor: "#fecaca" },
  noticeOk: { backgroundColor: colors.greenSoft, borderColor: "#bbf7d0" },
  noticeText: { flex: 1, fontSize: 12, fontWeight: "900", lineHeight: 17 },
  noticeTextBad: { color: colors.danger },
  noticeTextOk: { color: colors.success },
  primaryAction: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderColor: colors.primaryDark, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 8, height: 46, paddingHorizontal: 16, ...shadow.card },
  primaryActionText: { color: colors.black, fontSize: 14, fontWeight: "900" },
  primaryButton: { alignItems: "center", backgroundColor: colors.primary, borderColor: colors.primaryDark, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 8, height: 54, justifyContent: "center" },
  primaryButtonText: { color: colors.black, fontSize: 15, fontWeight: "900" },
  recordIcon: { backgroundColor: colors.blueSoft, borderRadius: 14, height: 36, width: 36 },
  recordMeta: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", marginTop: 3 },
  recordRight: { backgroundColor: colors.panelMuted, borderRadius: 999, color: colors.inkSoft, fontSize: 10, fontWeight: "900", maxWidth: 110, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, textTransform: "uppercase" },
  recordTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  safe: { backgroundColor: colors.background, flex: 1 },
  scheduleGrid: { gap: 14 },
  searchBox: { alignItems: "center", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 22, borderWidth: 1, flexDirection: "row", gap: 10, height: 54, paddingHorizontal: 14 },
  searchInput: { color: colors.foreground, flex: 1, fontSize: 14, fontWeight: "800" },
  sectionCount: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  sectionHeader: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 14 },
  sectionTitle: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  smallLabel: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  statLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  statTile: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flex: 1, gap: 2, minHeight: 80, padding: 14 },
  statValue: { fontSize: 24, fontWeight: "900" },
  statusTag: { alignSelf: "flex-start", backgroundColor: colors.yellowSoft, borderRadius: 999, color: colors.warning, fontSize: 10, fontWeight: "900", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, textTransform: "uppercase" },
  subtitle: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", lineHeight: 19, marginTop: 2 },
  surface: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, padding: 16, ...shadow.card },
  surfaceBody: { gap: 13 },
  surfaceCompact: { padding: 14 },
  surfaceEyebrow: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  surfaceHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12, marginBottom: 14 },
  surfaceIcon: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 16, height: 40, justifyContent: "center", width: 40 },
  surfaceTitle: { color: colors.foreground, fontSize: 18, fontWeight: "900", marginTop: 2 },
  tabRail: { gap: 8, paddingRight: 8 },
  threeCol: { flexDirection: "row", gap: 10 },
  title: { color: colors.foreground, fontSize: 31, fontWeight: "900", letterSpacing: 0 },
  toggle: { backgroundColor: colors.line, borderRadius: 999, height: 28, padding: 3, width: 52 },
  toggleActive: { backgroundColor: colors.black },
  toggleKnob: { backgroundColor: colors.white, borderRadius: 11, height: 22, width: 22 },
  toggleKnobActive: { transform: [{ translateX: 24 }] },
  toggleLabel: { color: colors.foreground, flex: 1, fontSize: 13, fontWeight: "900" },
  toggleRow: { alignItems: "center", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 50, paddingHorizontal: 13 },
  trashButton: { alignItems: "center", backgroundColor: colors.redSoft, borderRadius: 14, height: 36, justifyContent: "center", width: 36 },
  twoCol: { flexDirection: "row", gap: 10 },
  viewGrid: { gap: 14 },
  viewTab: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, height: 42, paddingHorizontal: 13 },
  viewTabActive: { backgroundColor: colors.black, borderColor: colors.black },
  viewTabText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  viewTabTextActive: { color: colors.white },
  windowRow: { alignItems: "center", borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: 12, padding: 12 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
}));
