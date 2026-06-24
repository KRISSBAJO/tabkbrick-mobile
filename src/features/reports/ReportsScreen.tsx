import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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
import Svg, { Circle } from "react-native-svg";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Gauge,
  LineChart,
  Play,
  RefreshCw,
  Save,
  Search,
  Target,
  Timer,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react-native";
import {
  createReport,
  exportSavedReport,
  getAnalyticsOverview,
  getBudgetAnalytics,
  getCycleTimeAnalytics,
  getProjectHealthAnalytics,
  getSlaAnalytics,
  getTeamPerformanceAnalytics,
  getVelocityAnalytics,
  listProjects,
  listReportExecutions,
  listReports,
  runAdHocReport,
  runSavedReport,
  type CreateReportPayload,
  type RunReportPayload,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, shadow } from "@/lib/theme/tokens";
import type {
  AnalyticsOverview,
  BudgetAnalytics,
  CycleTimeAnalytics,
  Project,
  ProjectHealthAnalytics,
  Report,
  ReportExecution,
  SlaAnalytics,
  TeamPerformanceAnalytics,
  VelocityAnalytics,
} from "@/lib/types";

type ActiveTab = "overview" | "health" | "team" | "velocity" | "budget" | "sla" | "saved";
type ReportType = "OVERVIEW" | "PROJECT_HEALTH" | "TEAM_PERFORMANCE" | "CYCLE_TIME" | "VELOCITY" | "BUDGET" | "SLA";

type Range = {
  days: number;
  from: string;
  label: string;
  to: string;
};

const emptyOverview: AnalyticsOverview = {
  budget: { actual: 0, planned: 0 },
  openRisks: 0,
  overdueTasks: 0,
  projects: 0,
  tasks: {},
  time: { entries: 0, minutes: 0 },
};

const tabs: Array<{ id: ActiveTab; label: string; reportType: ReportType }> = [
  { id: "overview", label: "Overview", reportType: "OVERVIEW" },
  { id: "health", label: "Health", reportType: "PROJECT_HEALTH" },
  { id: "team", label: "Team", reportType: "TEAM_PERFORMANCE" },
  { id: "velocity", label: "Velocity", reportType: "VELOCITY" },
  { id: "budget", label: "Budget", reportType: "BUDGET" },
  { id: "sla", label: "SLA", reportType: "SLA" },
  { id: "saved", label: "Saved", reportType: "OVERVIEW" },
];

const reportTypes: Array<{ label: string; value: ReportType }> = [
  { label: "Executive overview", value: "OVERVIEW" },
  { label: "Project health", value: "PROJECT_HEALTH" },
  { label: "Team workload", value: "TEAM_PERFORMANCE" },
  { label: "Cycle time", value: "CYCLE_TIME" },
  { label: "Sprint velocity", value: "VELOCITY" },
  { label: "Budget", value: "BUDGET" },
  { label: "SLA", value: "SLA" },
];

export function ReportsScreen() {
  const { accessToken } = useAuthSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [activeType, setActiveType] = useState<ReportType>("OVERVIEW");
  const [budget, setBudget] = useState<BudgetAnalytics>({ data: [], total: 0 });
  const [cycleTime, setCycleTime] = useState<CycleTimeAnalytics>({ averageCycleTimeHours: 0, data: [], total: 0 });
  const [error, setError] = useState("");
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview>(emptyOverview);
  const [projectHealth, setProjectHealth] = useState<ProjectHealthAnalytics>({ data: [], total: 0 });
  const [projects, setProjects] = useState<Project[]>([]);
  const [range, setRange] = useState<Range>(() => createRange(30));
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [savedReports, setSavedReports] = useState<Report[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveDescription, setSaveDescription] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [sla, setSla] = useState<SlaAnalytics>({ breached: 0, completedOnTime: 0, compliancePercent: 100, totalWithDueDate: 0 });
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformanceAnalytics>({ data: [], total: 0 });
  const [velocity, setVelocity] = useState<VelocityAnalytics>({ averageStoryPoints: 0, data: [], total: 0 });

  const filters = useMemo(
    () => ({
      from: toNoonIso(range.from),
      projectId: selectedProjectId || undefined,
      to: toNoonIso(range.to),
    }),
    [range.from, range.to, selectedProjectId],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const activeReportType = tabs.find((tab) => tab.id === activeTab)?.reportType ?? activeType;

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    setMessage(null);

    try {
      const [
        projectPage,
        savedPage,
        executionPage,
        overviewData,
        projectHealthData,
        teamData,
        cycleData,
        velocityData,
        budgetData,
        slaData,
      ] = await Promise.all([
        listProjects(accessToken, { limit: 100 }),
        listReports(accessToken, { limit: 25 }),
        listReportExecutions(accessToken, { limit: 15 }),
        getAnalyticsOverview(accessToken, filters),
        getProjectHealthAnalytics(accessToken, filters),
        getTeamPerformanceAnalytics(accessToken, filters),
        getCycleTimeAnalytics(accessToken, filters),
        getVelocityAnalytics(accessToken, filters),
        getBudgetAnalytics(accessToken, filters),
        getSlaAnalytics(accessToken, filters),
      ]);

      setProjects(Array.isArray(projectPage) ? projectPage : projectPage.data);
      setSavedReports(savedPage.data);
      setExecutions(executionPage.data);
      setOverview(overviewData);
      setProjectHealth(projectHealthData);
      setTeamPerformance(teamData);
      setCycleTime(cycleData);
      setVelocity(velocityData);
      setBudget(budgetData);
      setSla(slaData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load reporting data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusEntries = useMemo(
    () => Object.entries(overview.tasks ?? {}).filter(([, value]) => Number(value) > 0),
    [overview.tasks],
  );

  const totalTasks = useMemo(
    () => statusEntries.reduce((sum, [, value]) => sum + Number(value), 0),
    [statusEntries],
  );

  const filteredHealth = useMemo(
    () => filterBySearch(projectHealth.data, search, (item) => `${item.name} ${item.key} ${item.status}`),
    [projectHealth.data, search],
  );

  const filteredTeam = useMemo(
    () => filterBySearch(teamPerformance.data, search, (item) => item.name),
    [search, teamPerformance.data],
  );

  const filteredReports = useMemo(
    () => filterBySearch(savedReports, search, (item) => `${item.name} ${item.type} ${item.status}`),
    [savedReports, search],
  );

  async function handleRunReport(type = activeReportType) {
    if (!accessToken) return;
    setRunning(true);
    setMessage(null);

    try {
      const payload: RunReportPayload = {
        parameters: filters as unknown as Record<string, never>,
        type,
      };
      const execution = await runAdHocReport(accessToken, payload);
      setExecutions((current) => [execution, ...current].slice(0, 15));
      setMessage({ ok: true, text: `${labelForReportType(type)} queued.` });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to run report." });
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveReport() {
    if (!accessToken || !saveName.trim()) return;
    setSaving(true);
    setMessage(null);

    try {
      const payload: CreateReportPayload = {
        description: saveDescription.trim() || undefined,
        name: saveName.trim(),
        query: filters as unknown as Record<string, never>,
        status: "ACTIVE",
        type: activeType,
      };
      const report = await createReport(accessToken, payload);
      setSavedReports((current) => [report, ...current]);
      setSaveName("");
      setSaveDescription("");
      setSaveOpen(false);
      setMessage({ ok: true, text: "Report saved." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to save report." });
    } finally {
      setSaving(false);
    }
  }

  async function handleRunSavedReport(report: Report) {
    if (!accessToken) return;
    setRunning(true);
    setMessage(null);

    try {
      const execution = await runSavedReport(accessToken, report.id, {
        parameters: filters as unknown as Record<string, never>,
        type: report.type,
      });
      setExecutions((current) => [execution, ...current].slice(0, 15));
      setMessage({ ok: true, text: `${report.name} queued.` });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to run saved report." });
    } finally {
      setRunning(false);
    }
  }

  async function handleExport(report: Report) {
    if (!accessToken) return;
    setMessage(null);
    try {
      const exported = await exportSavedReport(accessToken, report.id, {
        format: "CSV",
        parameters: filters as unknown as Record<string, never>,
      });
      if (exported.fileUrl) {
        await Linking.openURL(exported.fileUrl);
      }
      setMessage({ ok: true, text: exported.fileUrl ? "Export opened." : "Export queued." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to export report." });
    }
  }

  function openSaveSheet(type = activeReportType) {
    setActiveType(type);
    setSaveName(`${labelForReportType(type)} - ${formatShortDate(range.to)}`);
    setSaveDescription("");
    setSaveOpen(true);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)")} style={styles.heroIconBtn}>
              <ArrowLeft color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroEyebrow}>Reports</Text>
              <Text numberOfLines={1} style={styles.heroTitle}>Operational reporting</Text>
              <Text numberOfLines={2} style={styles.heroSub}>Run analytics, save views, and export reports.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.heroIconBtn}>
              <RefreshCw color={colors.foreground} size={19} strokeWidth={2.7} />
            </Pressable>
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{overview.projects}</Text>
              <Text style={styles.heroMetricLabel}>Projects</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricValue}>{totalTasks}</Text>
              <Text style={styles.heroMetricLabel}>Tasks</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroMetric}>
              <Text style={[styles.heroMetricValue, overview.overdueTasks > 0 && { color: colors.primary }]}>{overview.overdueTasks}</Text>
              <Text style={styles.heroMetricLabel}>Overdue</Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <Pressable accessibilityRole="button" disabled={running} onPress={() => void handleRunReport()} style={styles.primaryAction}>
              {running ? <ActivityIndicator color={colors.black} size="small" /> : <Play color={colors.black} size={16} fill={colors.black} strokeWidth={2.7} />}
              <Text style={styles.primaryActionText}>Run report</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => openSaveSheet()} style={styles.secondaryAction}>
              <Save color={colors.foreground} size={16} strokeWidth={2.7} />
              <Text style={styles.secondaryActionText}>Save</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.searchBar}>
            <Search color={colors.inkSoft} size={18} strokeWidth={2.6} />
            <TextInput
              onChangeText={setSearch}
              placeholder="Search reports, project, team"
              placeholderTextColor={colors.inkSoft}
              style={styles.searchInput}
              value={search}
            />
            {search ? (
              <Pressable accessibilityRole="button" onPress={() => setSearch("")} style={styles.clearSearch}>
                <X color={colors.inkSoft} size={16} strokeWidth={2.7} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView contentContainerStyle={styles.filterRail} horizontal showsHorizontalScrollIndicator={false}>
            {[7, 30, 90].map((days) => (
              <Chip active={range.days === days} key={days} label={`${days} days`} onPress={() => setRange(createRange(days))} />
            ))}
            <Chip active={!selectedProjectId} label="All projects" onPress={() => setSelectedProjectId("")} />
            {projects.slice(0, 12).map((project) => (
              <Chip
                active={selectedProjectId === project.id}
                key={project.id}
                label={project.key || project.name}
                onPress={() => setSelectedProjectId(project.id)}
              />
            ))}
          </ScrollView>

          {selectedProject ? (
            <View style={styles.contextStrip}>
              <CalendarDays color={colors.accent} size={16} strokeWidth={2.5} />
              <Text numberOfLines={1} style={styles.contextText}>{selectedProject.name} from {formatShortDate(range.from)} to {formatShortDate(range.to)}</Text>
            </View>
          ) : (
            <View style={styles.contextStrip}>
              <CalendarDays color={colors.accent} size={16} strokeWidth={2.5} />
              <Text numberOfLines={1} style={styles.contextText}>Workspace from {formatShortDate(range.from)} to {formatShortDate(range.to)}</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.tabRail} horizontal showsHorizontalScrollIndicator={false}>
            {tabs.map((tab) => (
              <Pressable
                accessibilityRole="button"
                key={tab.id}
                onPress={() => {
                  setActiveTab(tab.id);
                  setActiveType(tab.reportType);
                }}
                style={[styles.tabChip, activeTab === tab.id && styles.tabChipActive]}
              >
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {message ? (
            <Pressable accessibilityRole="button" onPress={() => setMessage(null)} style={[styles.notice, message.ok ? styles.noticeOk : styles.noticeBad]}>
              <Text style={[styles.noticeText, message.ok ? styles.noticeTextOk : styles.noticeTextBad]}>{message.text}</Text>
              <X color={message.ok ? colors.success : colors.danger} size={15} strokeWidth={2.7} />
            </Pressable>
          ) : null}

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void load()} />
          ) : (
            <>
              {activeTab === "overview" ? (
                <OverviewTab
                  cycleTime={cycleTime}
                  executions={executions}
                  onRun={() => void handleRunReport("OVERVIEW")}
                  onSave={() => openSaveSheet("OVERVIEW")}
                  overview={overview}
                  sla={sla}
                  statusEntries={statusEntries}
                  totalTasks={totalTasks}
                />
              ) : null}

              {activeTab === "health" ? (
                <HealthTab health={filteredHealth} onRun={() => void handleRunReport("PROJECT_HEALTH")} onSave={() => openSaveSheet("PROJECT_HEALTH")} />
              ) : null}

              {activeTab === "team" ? (
                <TeamTab onRun={() => void handleRunReport("TEAM_PERFORMANCE")} onSave={() => openSaveSheet("TEAM_PERFORMANCE")} teams={filteredTeam} />
              ) : null}

              {activeTab === "velocity" ? (
                <VelocityTab cycleTime={cycleTime} onRun={() => void handleRunReport("VELOCITY")} onSave={() => openSaveSheet("VELOCITY")} velocity={velocity} />
              ) : null}

              {activeTab === "budget" ? (
                <BudgetTab budget={budget} onRun={() => void handleRunReport("BUDGET")} onSave={() => openSaveSheet("BUDGET")} overview={overview} />
              ) : null}

              {activeTab === "sla" ? (
                <SlaTab onRun={() => void handleRunReport("SLA")} onSave={() => openSaveSheet("SLA")} sla={sla} />
              ) : null}

              {activeTab === "saved" ? (
                <SavedTab
                  executions={executions}
                  onExport={(report) => void handleExport(report)}
                  onRun={(report) => void handleRunSavedReport(report)}
                  onSave={() => openSaveSheet(activeType)}
                  reports={filteredReports}
                  running={running}
                />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <Modal animationType="slide" onRequestClose={() => setSaveOpen(false)} transparent visible={saveOpen}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <Pressable accessibilityRole="button" onPress={() => setSaveOpen(false)} style={styles.modalScrim} />
          <View style={styles.sheet}>
            <View style={styles.sheetGrabber} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>SAVE REPORT</Text>
                <Text style={styles.sheetTitle}>Reusable report</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setSaveOpen(false)} style={styles.sheetClose}>
                <X color={colors.foreground} size={20} strokeWidth={2.8} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Report type</Text>
            <ScrollView contentContainerStyle={styles.typeRail} horizontal showsHorizontalScrollIndicator={false}>
              {reportTypes.map((type) => (
                <Chip active={activeType === type.value} key={type.value} label={type.label} onPress={() => setActiveType(type.value)} />
              ))}
            </ScrollView>

            <LabeledInput label="Name" onChangeText={setSaveName} placeholder="Weekly delivery snapshot" value={saveName} />
            <LabeledInput
              label="Description"
              multiline
              onChangeText={setSaveDescription}
              placeholder="Who uses this report and what it answers"
              value={saveDescription}
            />

            <Pressable
              accessibilityRole="button"
              disabled={saving || !saveName.trim()}
              onPress={() => void handleSaveReport()}
              style={[styles.sheetPrimary, (!saveName.trim() || saving) && styles.disabledBtn]}
            >
              {saving ? <ActivityIndicator color={colors.black} size="small" /> : <Save color={colors.black} size={18} strokeWidth={2.8} />}
              <Text style={styles.sheetPrimaryText}>Save report</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function OverviewTab({
  cycleTime,
  executions,
  onRun,
  onSave,
  overview,
  sla,
  statusEntries,
  totalTasks,
}: {
  cycleTime: CycleTimeAnalytics;
  executions: ReportExecution[];
  onRun: () => void;
  onSave: () => void;
  overview: AnalyticsOverview;
  sla: SlaAnalytics;
  statusEntries: Array<[string, number]>;
  totalTasks: number;
}) {
  const planned = Number(overview.budget.planned) || 0;
  const actual = Number(overview.budget.actual) || 0;
  const budgetPercent = planned > 0 ? Math.min(Math.round((actual / planned) * 100), 999) : 0;

  return (
    <View style={styles.stack}>
      <View style={styles.kpiGrid}>
        <KpiTile icon={<Gauge color={colors.success} size={18} strokeWidth={2.7} />} label="SLA" tone="green" value={`${sla.compliancePercent}%`} />
        <KpiTile icon={<Timer color={colors.accent} size={18} strokeWidth={2.7} />} label="Cycle" tone="blue" value={`${Math.round(cycleTime.averageCycleTimeHours)}h`} />
        <KpiTile icon={<Target color={colors.danger} size={18} strokeWidth={2.7} />} label="Risks" tone="red" value={overview.openRisks} />
        <KpiTile icon={<FileSpreadsheet color={colors.warning} size={18} strokeWidth={2.7} />} label="Budget" tone="yellow" value={`${budgetPercent}%`} />
      </View>

      <Panel
        actionLabel="Run"
        icon={<BarChart3 color={colors.accent} size={19} strokeWidth={2.7} />}
        onAction={onRun}
        title="Task distribution"
      >
        <View style={styles.distributionWrap}>
          <Donut percent={totalTasks > 0 ? Math.round(((totalTasks - overview.overdueTasks) / totalTasks) * 100) : 100} />
          <View style={styles.statusList}>
            {statusEntries.length ? statusEntries.slice(0, 5).map(([status, count]) => (
              <View key={status} style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
                <Text numberOfLines={1} style={styles.statusName}>{humanize(status)}</Text>
                <Text style={styles.statusValue}>{count}</Text>
              </View>
            )) : <EmptyMini text="No task activity in this range." />}
          </View>
        </View>
      </Panel>

      <Panel
        actionLabel="Save"
        icon={<FileSpreadsheet color={colors.warning} size={19} strokeWidth={2.7} />}
        onAction={onSave}
        title="Budget signal"
      >
        <View style={styles.budgetSummary}>
          <View>
            <Text style={styles.moneyLabel}>Planned</Text>
            <Text style={styles.moneyValue}>{formatMoney(planned)}</Text>
          </View>
          <View>
            <Text style={styles.moneyLabel}>Actual</Text>
            <Text style={[styles.moneyValue, actual > planned && planned > 0 ? { color: colors.danger } : null]}>{formatMoney(actual)}</Text>
          </View>
        </View>
        <ProgressBar percent={budgetPercent} tone={actual > planned && planned > 0 ? "red" : "green"} />
      </Panel>

      <Panel icon={<LineChart color={colors.accent} size={19} strokeWidth={2.7} />} title="Recent executions">
        {executions.length ? executions.slice(0, 4).map((execution) => <ExecutionRow execution={execution} key={execution.id} />) : <EmptyMini text="No report executions yet." />}
      </Panel>
    </View>
  );
}

function HealthTab({ health, onRun, onSave }: { health: ProjectHealthAnalytics["data"]; onRun: () => void; onSave: () => void }) {
  return (
    <View style={styles.stack}>
      <Panel actionLabel="Run" icon={<Gauge color={colors.accent} size={19} strokeWidth={2.7} />} onAction={onRun} title="Project health">
        {health.length ? health.map((project) => (
          <View key={project.id} style={styles.healthRow}>
            <View style={[styles.projectBadge, { backgroundColor: softStatusColor(project.status) }]}>
              <Text style={styles.projectBadgeText}>{project.key.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.healthMain}>
              <View style={styles.rowBetween}>
                <Text numberOfLines={1} style={styles.rowTitle}>{project.name}</Text>
                <Text style={[styles.scoreText, { color: scoreColor(project.healthScore) }]}>{Math.round(project.healthScore)}</Text>
              </View>
              <Text numberOfLines={1} style={styles.rowMeta}>
                {humanize(project.status)} - {project.doneTasks}/{project._count?.tasks ?? 0} done - {project.openRisks} risks
              </Text>
              <ProgressBar percent={Math.round(project.completion)} tone={project.openRisks > 0 ? "yellow" : "blue"} />
            </View>
          </View>
        )) : <EmptyMini text="No project health data for this filter." />}
      </Panel>
      <ActionStrip onRun={onRun} onSave={onSave} />
    </View>
  );
}

function TeamTab({ onRun, onSave, teams }: { onRun: () => void; onSave: () => void; teams: TeamPerformanceAnalytics["data"] }) {
  const maxTasks = Math.max(...teams.map((team) => team.tasks), 1);

  return (
    <View style={styles.stack}>
      <Panel actionLabel="Run" icon={<UsersRound color={colors.accent} size={19} strokeWidth={2.7} />} onAction={onRun} title="Team workload">
        {teams.length ? teams.map((team) => (
          <View key={team.id} style={styles.teamRow}>
            <View style={styles.rowBetween}>
              <Text numberOfLines={1} style={styles.rowTitle}>{team.name}</Text>
              <Text style={styles.rowValue}>{team.completionRate}%</Text>
            </View>
            <View style={styles.teamMetaRow}>
              <Text style={styles.rowMeta}>{team.tasks} tasks</Text>
              <Text style={styles.rowMeta}>{team.doneTasks} done</Text>
              <Text style={styles.rowMeta}>{Math.round(team.minutes / 60)}h</Text>
            </View>
            <ProgressBar percent={Math.round((team.tasks / maxTasks) * 100)} tone={team.completionRate >= 70 ? "green" : "yellow"} />
          </View>
        )) : <EmptyMini text="No team workload data yet." />}
      </Panel>
      <ActionStrip onRun={onRun} onSave={onSave} />
    </View>
  );
}

function VelocityTab({
  cycleTime,
  onRun,
  onSave,
  velocity,
}: {
  cycleTime: CycleTimeAnalytics;
  onRun: () => void;
  onSave: () => void;
  velocity: VelocityAnalytics;
}) {
  const maxPoints = Math.max(...velocity.data.map((item) => item.storyPoints), 1);

  return (
    <View style={styles.stack}>
      <View style={styles.kpiGrid}>
        <KpiTile icon={<TrendingUp color={colors.accent} size={18} strokeWidth={2.7} />} label="Avg velocity" tone="blue" value={round1(velocity.averageStoryPoints)} />
        <KpiTile icon={<Timer color={colors.warning} size={18} strokeWidth={2.7} />} label="Avg cycle" tone="yellow" value={`${round1(cycleTime.averageCycleTimeHours)}h`} />
      </View>

      <Panel actionLabel="Run" icon={<TrendingUp color={colors.accent} size={19} strokeWidth={2.7} />} onAction={onRun} title="Sprint velocity">
        {velocity.data.length ? velocity.data.slice(0, 10).map((sprint) => (
          <View key={sprint.id} style={styles.barRow}>
            <View style={styles.rowBetween}>
              <Text numberOfLines={1} style={styles.rowTitle}>{sprint.name}</Text>
              <Text style={styles.rowValue}>{sprint.storyPoints} pts</Text>
            </View>
            <ProgressBar percent={Math.round((sprint.storyPoints / maxPoints) * 100)} tone="blue" />
            <Text numberOfLines={1} style={styles.rowMeta}>{sprint.project?.name ?? "No project"} - {sprint.completedTasks} completed</Text>
          </View>
        )) : <EmptyMini text="No sprint velocity in this range." />}
      </Panel>

      <Panel actionLabel="Save" icon={<Timer color={colors.warning} size={19} strokeWidth={2.7} />} onAction={onSave} title="Cycle time">
        {cycleTime.data.length ? cycleTime.data.slice(0, 5).map((task) => (
          <View key={task.id} style={styles.compactRow}>
            <View>
              <Text numberOfLines={1} style={styles.rowTitle}>{task.title}</Text>
              <Text style={styles.rowMeta}>{task.key} - {humanize(task.priority)}</Text>
            </View>
            <Text style={styles.rowValue}>{Math.round(task.cycleTimeHours ?? 0)}h</Text>
          </View>
        )) : <EmptyMini text="No completed cycle-time data." />}
      </Panel>
    </View>
  );
}

function BudgetTab({
  budget,
  onRun,
  onSave,
  overview,
}: {
  budget: BudgetAnalytics;
  onRun: () => void;
  onSave: () => void;
  overview: AnalyticsOverview;
}) {
  const planned = Number(overview.budget.planned) || 0;
  const actual = Number(overview.budget.actual) || 0;

  return (
    <View style={styles.stack}>
      <View style={styles.kpiGrid}>
        <KpiTile icon={<FileSpreadsheet color={colors.accent} size={18} strokeWidth={2.7} />} label="Planned" tone="blue" value={formatMoney(planned)} />
        <KpiTile icon={<FileSpreadsheet color={actual > planned && planned > 0 ? colors.danger : colors.success} size={18} strokeWidth={2.7} />} label="Actual" tone={actual > planned && planned > 0 ? "red" : "green"} value={formatMoney(actual)} />
      </View>

      <Panel actionLabel="Run" icon={<FileSpreadsheet color={colors.warning} size={19} strokeWidth={2.7} />} onAction={onRun} title="Budget utilization">
        {budget.data.length ? budget.data.map((item) => (
          <View key={item.id} style={styles.budgetRow}>
            <View style={styles.rowBetween}>
              <Text numberOfLines={1} style={styles.rowTitle}>{item.project.name}</Text>
              <Text style={[styles.rowValue, item.variance > 0 ? { color: colors.danger } : { color: colors.success }]}>{item.utilizationPercent}%</Text>
            </View>
            <Text style={styles.rowMeta}>
              {formatMoney(item.actual)} used of {formatMoney(item.planned)} {item.currency}
            </Text>
            <ProgressBar percent={Math.round(item.utilizationPercent)} tone={item.variance > 0 ? "red" : "green"} />
          </View>
        )) : <EmptyMini text="No project budgets found for this filter." />}
      </Panel>
      <ActionStrip onRun={onRun} onSave={onSave} />
    </View>
  );
}

function SlaTab({ onRun, onSave, sla }: { onRun: () => void; onSave: () => void; sla: SlaAnalytics }) {
  const tone = sla.compliancePercent >= 90 ? "green" : sla.compliancePercent >= 70 ? "yellow" : "red";

  return (
    <View style={styles.stack}>
      <Panel actionLabel="Run" icon={<Target color={colors.accent} size={19} strokeWidth={2.7} />} onAction={onRun} title="SLA compliance">
        <View style={styles.slaWrap}>
          <Donut percent={sla.compliancePercent} tone={tone} />
          <View style={styles.slaCopy}>
            <Text style={styles.slaPercent}>{sla.compliancePercent}%</Text>
            <Text style={styles.slaText}>completed on time</Text>
          </View>
        </View>
        <View style={styles.slaGrid}>
          <KpiTile icon={<CalendarDays color={colors.accent} size={16} strokeWidth={2.7} />} label="With due date" tone="blue" value={sla.totalWithDueDate} />
          <KpiTile icon={<Gauge color={colors.success} size={16} strokeWidth={2.7} />} label="On time" tone="green" value={sla.completedOnTime} />
          <KpiTile icon={<Target color={colors.danger} size={16} strokeWidth={2.7} />} label="Breached" tone="red" value={sla.breached} />
        </View>
      </Panel>
      <ActionStrip onRun={onRun} onSave={onSave} />
    </View>
  );
}

function SavedTab({
  executions,
  onExport,
  onRun,
  onSave,
  reports,
  running,
}: {
  executions: ReportExecution[];
  onExport: (report: Report) => void;
  onRun: (report: Report) => void;
  onSave: () => void;
  reports: Report[];
  running: boolean;
}) {
  return (
    <View style={styles.stack}>
      <Pressable accessibilityRole="button" onPress={onSave} style={styles.createSaved}>
        <View style={styles.createIcon}>
          <Save color={colors.black} size={19} strokeWidth={2.8} />
        </View>
        <View style={styles.createCopy}>
          <Text style={styles.createTitle}>Create saved report</Text>
          <Text style={styles.createMeta}>Store filters, schedule later, run on demand.</Text>
        </View>
        <ChevronRight color={colors.inkSoft} size={18} strokeWidth={2.7} />
      </Pressable>

      <Panel icon={<FileSpreadsheet color={colors.accent} size={19} strokeWidth={2.7} />} title="Report catalog">
        {reports.length ? reports.map((report) => (
          <View key={report.id} style={styles.reportRow}>
            <Pressable accessibilityRole="button" disabled={running} onPress={() => onRun(report)} style={styles.reportMain}>
              <Text numberOfLines={1} style={styles.rowTitle}>{report.name}</Text>
              <Text numberOfLines={1} style={styles.rowMeta}>
                {labelForReportType(report.type)} - {report.status}{report.lastRunAt ? ` - ${formatShortDate(report.lastRunAt)}` : ""}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onExport(report)} style={styles.exportBtn}>
              <Download color={colors.accent} size={16} strokeWidth={2.6} />
            </Pressable>
          </View>
        )) : <EmptyMini text="No saved reports yet." />}
      </Panel>

      <Panel icon={<LineChart color={colors.warning} size={19} strokeWidth={2.7} />} title="Execution history">
        {executions.length ? executions.slice(0, 8).map((execution) => <ExecutionRow execution={execution} key={execution.id} />) : <EmptyMini text="No report executions yet." />}
      </Panel>
    </View>
  );
}

function ActionStrip({ onRun, onSave }: { onRun: () => void; onSave: () => void }) {
  return (
    <View style={styles.actionStrip}>
      <Pressable accessibilityRole="button" onPress={onRun} style={styles.actionPill}>
        <Play color={colors.black} size={15} fill={colors.black} strokeWidth={2.7} />
        <Text style={styles.actionPillText}>Run report</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onSave} style={[styles.actionPill, styles.actionPillGhost]}>
        <Save color={colors.foreground} size={15} strokeWidth={2.7} />
        <Text style={styles.actionPillGhostText}>Save view</Text>
      </Pressable>
    </View>
  );
}

function Panel({
  actionLabel,
  children,
  icon,
  onAction,
  title,
}: {
  actionLabel?: string;
  children: React.ReactNode;
  icon: React.ReactNode;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleWrap}>
          <View style={styles.panelIcon}>{icon}</View>
          <Text style={styles.panelTitle}>{title}</Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} style={styles.panelAction}>
            <Text style={styles.panelActionText}>{actionLabel}</Text>
            <ChevronRight color={colors.accent} size={14} strokeWidth={2.7} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function KpiTile({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "blue" | "green" | "red" | "yellow";
  value: number | string;
}) {
  return (
    <View style={[styles.kpiTile, { backgroundColor: toneSoft(tone) }]}>
      <View style={styles.kpiIcon}>{icon}</View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.kpiValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function Donut({ percent, tone = "blue" }: { percent: number; tone?: "blue" | "green" | "red" | "yellow" }) {
  const normalized = Math.max(0, Math.min(100, percent));
  const radius = 42;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;

  return (
    <View style={styles.donutWrap}>
      <Svg height={116} width={116}>
        <Circle cx={58} cy={58} fill="none" r={radius} stroke="#e9e8ef" strokeWidth={strokeWidth} />
        <Circle
          cx={58}
          cy={58}
          fill="none"
          r={radius}
          stroke={toneColor(tone)}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          transform="rotate(-90 58 58)"
        />
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutValue}>{Math.round(normalized)}%</Text>
        <Text style={styles.donutLabel}>score</Text>
      </View>
    </View>
  );
}

function ProgressBar({ percent, tone }: { percent: number; tone: "blue" | "green" | "red" | "yellow" }) {
  const normalized = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { backgroundColor: toneColor(tone), width: `${normalized}%` }]} />
    </View>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LabeledInput({
  label,
  multiline,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#aaa49d"
        style={[styles.input, multiline && styles.textarea]}
        value={value}
      />
    </View>
  );
}

function ExecutionRow({ execution }: { execution: ReportExecution }) {
  return (
    <View style={styles.executionRow}>
      <View style={[styles.executionDot, { backgroundColor: executionStatusColor(execution.status) }]} />
      <View style={styles.executionMain}>
        <Text numberOfLines={1} style={styles.executionTitle}>{labelForReportType(execution.type)}</Text>
        <Text numberOfLines={1} style={styles.executionMeta}>
          {execution.status} - {formatShortDate(execution.createdAt)}{typeof execution.rowCount === "number" ? ` - ${execution.rowCount} rows` : ""}
        </Text>
      </View>
      <Text style={styles.executionDuration}>{execution.durationMs ? `${Math.round(execution.durationMs / 1000)}s` : "--"}</Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.stateTitle}>Loading reports</Text>
      <Text style={styles.stateText}>Fetching analytics, saved reports, and recent executions.</Text>
    </View>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorTitle}>Reports unavailable</Text>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <View style={styles.emptyMini}>
      <Text style={styles.emptyMiniText}>{text}</Text>
    </View>
  );
}

function createRange(days: number): Range {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - days);
  return {
    days,
    from: from.toISOString().slice(0, 10),
    label: `${days} days`,
    to: to.toISOString().slice(0, 10),
  };
}

function toNoonIso(date: string) {
  return `${date}T12:00:00.000Z`;
}

function formatShortDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(value));
}

function formatMoney(value: number) {
  if (value >= 1000000) return `$${round1(value / 1000000)}m`;
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${Math.round(value)}`;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function humanize(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelForReportType(type?: string | null) {
  if (!type) return "Report";
  return reportTypes.find((item) => item.value === type)?.label ?? humanize(type);
}

function filterBySearch<T>(items: T[], search: string, read: (item: T) => string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => read(item).toLowerCase().includes(needle));
}

function toneColor(tone: "blue" | "green" | "red" | "yellow") {
  if (tone === "green") return colors.success;
  if (tone === "red") return colors.danger;
  if (tone === "yellow") return colors.primaryDark;
  return colors.accent;
}

function toneSoft(tone: "blue" | "green" | "red" | "yellow") {
  if (tone === "green") return colors.greenSoft;
  if (tone === "red") return colors.redSoft;
  if (tone === "yellow") return colors.yellowSoft;
  return colors.blueSoft;
}

function statusColor(status: string) {
  const key = status.toUpperCase();
  if (key.includes("DONE") || key.includes("COMPLETE")) return colors.success;
  if (key.includes("PROGRESS") || key.includes("REVIEW")) return colors.warning;
  if (key.includes("CANCEL") || key.includes("BLOCK")) return colors.danger;
  if (key.includes("TODO")) return colors.accent;
  return "#8b8790";
}

function softStatusColor(status: string) {
  const key = status.toUpperCase();
  if (key.includes("ACTIVE")) return colors.greenSoft;
  if (key.includes("HOLD") || key.includes("ARCHIVE")) return colors.redSoft;
  if (key.includes("PLAN")) return colors.yellowSoft;
  return colors.blueSoft;
}

function scoreColor(score: number) {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.danger;
}

function executionStatusColor(status: string) {
  if (status === "COMPLETED") return colors.success;
  if (status === "FAILED" || status === "CANCELLED") return colors.danger;
  if (status === "RUNNING") return colors.accent;
  return colors.primaryDark;
}

const styles = StyleSheet.create(withFontStyles({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroller: {
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 128,
  },
  hero: {
    backgroundColor: colors.background,
    paddingBottom: 10,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  heroTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  heroIconBtn: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
    ...shadow.card,
  },
  heroTitleWrap: {
    flex: 1,
    gap: 4,
    paddingTop: 1,
  },
  heroEyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: "900",
  },
  heroSub: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  heroBody: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    ...shadow.card,
  },
  heroMetric: {
    alignItems: "center",
    flex: 1,
  },
  heroMetricValue: {
    color: colors.foreground,
    fontSize: 23,
    fontWeight: "900",
  },
  heroMetricLabel: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "uppercase",
  },
  heroDivider: {
    backgroundColor: colors.line,
    height: 34,
    width: 1,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 18,
  },
  primaryActionText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 18,
  },
  secondaryActionText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  body: {
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 18,
    ...shadow.card,
  },
  searchInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  clearSearch: {
    padding: 4,
  },
  filterRail: {
    gap: 9,
    paddingVertical: 16,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 16,
  },
  chipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  chipText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  chipTextActive: {
    color: colors.white,
  },
  contextStrip: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  contextText: {
    color: colors.accent,
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
  },
  tabRail: {
    gap: 8,
    paddingBottom: 16,
  },
  tabChip: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  tabTextActive: {
    color: colors.black,
  },
  notice: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeOk: {
    backgroundColor: colors.greenSoft,
    borderColor: "#bbf7d0",
  },
  noticeBad: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  noticeTextOk: {
    color: colors.success,
  },
  noticeTextBad: {
    color: colors.danger,
  },
  stack: {
    gap: 16,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiTile: {
    borderColor: "rgba(0,0,0,0.04)",
    borderRadius: 22,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 116,
    minWidth: "47%",
    padding: 16,
  },
  kpiIcon: {
    marginBottom: 12,
  },
  kpiValue: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "900",
  },
  kpiLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 5,
    textTransform: "uppercase",
  },
  panel: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    ...shadow.card,
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  panelTitleWrap: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  panelIcon: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 13,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  panelTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  panelAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    paddingLeft: 10,
  },
  panelActionText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  distributionWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
  },
  donutWrap: {
    alignItems: "center",
    height: 116,
    justifyContent: "center",
    width: 116,
  },
  donutCenter: {
    alignItems: "center",
    position: "absolute",
  },
  donutValue: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "900",
  },
  donutLabel: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusList: {
    flex: 1,
    gap: 10,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  statusDot: {
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  statusName: {
    color: colors.foreground,
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  statusValue: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  budgetSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  moneyLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  moneyValue: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  progressTrack: {
    backgroundColor: colors.panelMuted,
    borderRadius: 999,
    height: 9,
    overflow: "hidden",
  },
  progressFill: {
    borderRadius: 999,
    height: "100%",
  },
  healthRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  projectBadge: {
    alignItems: "center",
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  projectBadgeText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  healthMain: {
    flex: 1,
    gap: 8,
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  rowTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
  },
  rowMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  rowValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "900",
  },
  teamRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: 9,
    paddingVertical: 13,
  },
  teamMetaRow: {
    flexDirection: "row",
    gap: 14,
  },
  barRow: {
    gap: 9,
    paddingVertical: 12,
  },
  compactRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 13,
  },
  budgetRow: {
    gap: 9,
    paddingVertical: 12,
  },
  slaWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
    justifyContent: "center",
    marginBottom: 16,
  },
  slaCopy: {
    flex: 1,
  },
  slaPercent: {
    color: colors.foreground,
    fontSize: 38,
    fontWeight: "900",
  },
  slaText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  slaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  createSaved: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 16,
    ...shadow.card,
  },
  createIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  createCopy: {
    flex: 1,
  },
  createTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  createMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  reportRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 13,
  },
  reportMain: {
    flex: 1,
  },
  exportBtn: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 15,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  actionStrip: {
    flexDirection: "row",
    gap: 10,
  },
  actionPill: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  actionPillGhost: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
  },
  actionPillText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: "900",
  },
  actionPillGhostText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  executionRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
  },
  executionDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  executionMain: {
    flex: 1,
  },
  executionTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  executionMeta: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  executionDuration: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  emptyMini: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    padding: 18,
  },
  emptyMiniText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  stateBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 24,
    gap: 8,
    padding: 30,
    ...shadow.card,
  },
  stateTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },
  stateText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: "900",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
  },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.danger,
    borderRadius: 14,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
  },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  sheetGrabber: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    marginBottom: 18,
    width: 44,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
  },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  sheetClose: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  fieldLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
  },
  typeRail: {
    gap: 8,
    paddingBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 54,
    paddingHorizontal: 16,
  },
  textarea: {
    minHeight: 92,
    paddingTop: 14,
    textAlignVertical: "top",
  },
  sheetPrimary: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 20,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 56,
  },
  sheetPrimaryText: {
    color: colors.black,
    fontSize: 15,
    fontWeight: "900",
  },
  disabledBtn: {
    opacity: 0.45,
  },
}));
