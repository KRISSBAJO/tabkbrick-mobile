import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowRight, CalendarDays, FolderOpen, Inbox, Pencil, Plus, Search } from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate, humanize, isOverdue, projectHealth, statusTone } from "@/features/projects/projectFormat";
import { listMeetings, listProjects, listTasks } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Meeting, Project, Task } from "@/lib/types";

export default function DashboardScreen() {
  const { accessToken, user } = useAuthSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [projectPage, taskPage, meetingPage] = await Promise.all([
        listProjects(accessToken, { limit: 50 }),
        listTasks(accessToken, { limit: 50, sortBy: "updatedAt", sortDirection: "desc" }),
        listMeetings(accessToken, { limit: 20 }),
      ]);
      setProjects(Array.isArray(projectPage) ? projectPage : projectPage.data);
      setTasks(Array.isArray(taskPage) ? taskPage : taskPage.data);
      setMeetings(Array.isArray(meetingPage) ? meetingPage : meetingPage.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load home.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTasks = useMemo(() => tasks.filter((task) => !["DONE", "CANCELLED"].includes(task.status)), [tasks]);
  const priorityTasks = useMemo(() => (
    openTasks
      .filter((task) => task.priority === "HIGH" || task.priority === "URGENT" || task.priority === "CRITICAL" || isOverdue(task.dueDate))
      .slice(0, 3)
  ), [openTasks]);
  const activeProjects = projects.filter((project) => project.status !== "ARCHIVED").slice(0, 5);
  const latestMeeting = meetings[0];

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.foreground} />}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Boards</Text>
          <Text style={styles.subtitle}>{user.firstName ? `${user.firstName}'s workspace` : "Workspace"}</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" style={styles.roundButton}>
            <Search color={colors.foreground} size={22} strokeWidth={2.8} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)/projects/new")} style={styles.addButton}>
            <Plus color={colors.white} size={24} strokeWidth={3} />
          </Pressable>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Search color={colors.inkSoft} size={20} strokeWidth={2.8} />
        <Text style={styles.searchText}>Search boards, tasks, meetings</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.foreground} />
          <Text style={styles.muted}>Loading workspace</Text>
        </View>
      ) : error ? (
        <View style={styles.notice}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.linkButton}>
            <Text style={styles.linkText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.inboxPanel}>
            <View style={styles.inboxHeader}>
              <View style={styles.inboxTitleWrap}>
                <Inbox color={colors.foreground} size={20} strokeWidth={2.6} />
                <Text style={styles.inboxTitle}>Inbox</Text>
                <Text style={styles.countText}>{openTasks.length}</Text>
              </View>
              <Pencil color={colors.foreground} size={20} strokeWidth={2.5} />
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)/tasks")} style={styles.quickAdd}>
              <Text style={styles.quickAddText}>Review today's task queue</Text>
              <Plus color={colors.inkSoft} size={18} strokeWidth={2.5} />
            </Pressable>
          </View>

          <SectionTitle title="Your workspaces" />
          <View style={styles.workspaceHeader}>
            <View style={styles.workspaceTitle}>
              <FolderOpen color={colors.foreground} size={19} strokeWidth={2.5} />
              <Text style={styles.workspaceName}>TaskBricks Workspace</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)/projects")} style={styles.inlineAction}>
              <Text style={styles.inlineActionText}>Boards</Text>
              <ArrowRight color={colors.accent} size={17} strokeWidth={2.6} />
            </Pressable>
          </View>

          <View style={styles.boardList}>
            {activeProjects.length ? activeProjects.map((project, index) => {
              const health = projectHealth(project);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={project.id}
                  onPress={() => router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: project.id } })}
                  style={styles.boardRow}
                >
                  <View style={[styles.boardColor, { backgroundColor: swatchForIndex(index) }]} />
                  <View style={styles.boardText}>
                    <Text numberOfLines={1} style={styles.boardTitle}>{project.name}</Text>
                    <Text style={styles.boardMeta}>{project.key} - {project.progress}% - {humanize(project.status)}</Text>
                  </View>
                  <StatusPill label={health.label} tone={health.tone} />
                </Pressable>
              );
            }) : (
              <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)/projects/new")} style={styles.emptyRow}>
                <View style={[styles.boardColor, { backgroundColor: colors.accent }]} />
                <View style={styles.boardText}>
                  <Text style={styles.boardTitle}>Create your first board</Text>
                  <Text style={styles.boardMeta}>Start a project workspace</Text>
                </View>
                <ArrowRight color={colors.inkSoft} size={17} />
              </Pressable>
            )}
          </View>

          <SectionTitle title="Today" />
          <View style={styles.activityList}>
            {priorityTasks.length ? priorityTasks.map((task) => (
              <View key={task.id} style={styles.activityRow}>
                <View style={styles.avatarDot}>
                  <Text style={styles.avatarDotText}>{task.priority[0]}</Text>
                </View>
                <View style={styles.activityText}>
                  <Text numberOfLines={1} style={styles.activityTitle}>{task.title}</Text>
                  <Text style={styles.activityMeta}>{task.project?.name || task.type} - Due {formatDate(task.dueDate)}</Text>
                </View>
                <StatusPill label={humanize(task.priority)} tone={statusTone(task.priority)} />
              </View>
            )) : (
              <View style={styles.activityRow}>
                <View style={styles.avatarDot}>
                  <CalendarDays color={colors.foreground} size={17} />
                </View>
                <View style={styles.activityText}>
                  <Text style={styles.activityTitle}>{latestMeeting ? latestMeeting.title : "No urgent work"}</Text>
                  <Text style={styles.activityMeta}>
                    {latestMeeting ? `Next meeting - ${formatDate(latestMeeting.startAt)}` : "Your priority queue is clear"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function swatchForIndex(index: number) {
  const swatches = ["#2563eb", "#7c3aed", "#059669", "#dc8a23", "#111827"];
  return swatches[index % swatches.length];
}

const styles = StyleSheet.create({
  activityList: {
    gap: 10,
  },
  activityMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  activityRow: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: radii.xl,
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  activityText: {
    flex: 1,
    minWidth: 0,
  },
  activityTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.foreground,
    borderRadius: 22,
    height: 48,
    justifyContent: "center",
    width: 48,
    ...shadow.card,
  },
  avatarDot: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarDotText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  boardColor: {
    borderRadius: 12,
    height: 36,
    width: 36,
  },
  boardList: {
    backgroundColor: colors.panel,
    borderColor: "rgba(16,16,15,0.04)",
    borderWidth: 1,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  boardMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  boardRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  boardText: {
    flex: 1,
    minWidth: 0,
  },
  boardTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  content: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 116,
  },
  countText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  emptyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorText: {
    color: colors.danger,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  inboxHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inboxPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 14,
    padding: 16,
    ...shadow.card,
  },
  inboxTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  inboxTitleWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  inlineAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  inlineActionText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "900",
  },
  linkButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linkText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  loading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 18,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  notice: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
  quickAdd: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: radii.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 58,
    paddingHorizontal: 16,
  },
  quickAddText: {
    color: colors.inkSoft,
    fontSize: 16,
    fontWeight: "800",
  },
  roundButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: 22,
    height: 48,
    justifyContent: "center",
    width: 48,
    ...shadow.card,
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroll: {
    backgroundColor: colors.background,
    flex: 1,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: "rgba(16,16,15,0.04)",
    borderWidth: 1,
    borderRadius: 24,
    flexDirection: "row",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  searchText: {
    color: colors.inkSoft,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionTitle: {
    color: colors.slate,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  title: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 38,
  },
  topActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  workspaceHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  workspaceName: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  workspaceTitle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
});
