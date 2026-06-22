import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowRight, CalendarDays, FolderOpen, Plus, Search } from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import { ProjectCreateModal } from "@/features/projects/ProjectCreateModal";
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
  const [creatingProject, setCreatingProject] = useState(false);

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
  const activeProjectList = useMemo(() => projects.filter((project) => project.status !== "ARCHIVED"), [projects]);
  const visibleProjects = useMemo(() => activeProjectList.slice(0, 6), [activeProjectList]);
  const latestMeeting = meetings[0];

  if (!user) return null;

  function handleProjectCreated(project: Project) {
    setCreatingProject(false);
    void load();
    router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: project.id } });
  }

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
          <Text style={styles.title}>Projects</Text>
          <Text style={styles.subtitle}>{user.firstName ? `${user.firstName}'s portfolio` : "Project portfolio"}</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" style={styles.roundButton}>
            <Search color={colors.foreground} size={22} strokeWidth={2.8} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setCreatingProject(true)} style={styles.addButton}>
            <Plus color={colors.black} size={24} strokeWidth={3} />
          </Pressable>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Search color={colors.inkSoft} size={20} strokeWidth={2.8} />
        <Text style={styles.searchText}>Search projects, tasks, meetings</Text>
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
          <View style={styles.projectBoard}>
            <View style={styles.projectBoardHeader}>
              <View style={styles.projectBoardTitleWrap}>
                <FolderOpen color={colors.foreground} size={20} strokeWidth={2.6} />
                <Text style={styles.projectBoardTitle}>Projects</Text>
                <Text style={styles.projectBoardCount}>{projects.length}</Text>
              </View>
              <Text style={styles.projectBoardMeta}>{activeProjectList.length} active</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setCreatingProject(true)} style={styles.projectBoardAction}>
              <Text style={styles.projectBoardActionText}>Create a project</Text>
              <Plus color={colors.inkSoft} size={18} strokeWidth={2.5} />
            </Pressable>
          </View>

          <SectionHeader
            actionLabel={projects.length > visibleProjects.length ? `View all ${projects.length}` : "View all"}
            onPress={() => router.push("/(workspace)/projects")}
            title="Recent projects"
          />

          <View style={styles.projectList}>
            {visibleProjects.length ? visibleProjects.map((project, index) => {
              const health = projectHealth(project);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={project.id}
                  onPress={() => router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: project.id } })}
                  style={styles.projectRow}
                >
                  <View style={[styles.projectRail, { backgroundColor: swatchForIndex(index) }]} />
                  <View style={styles.projectRowText}>
                    <Text numberOfLines={1} style={styles.projectRowTitle}>{project.name}</Text>
                    <Text style={styles.projectRowMeta}>{project.key} - {project.progress}% - {humanize(project.status)}</Text>
                  </View>
                  <StatusPill label={health.label} tone={health.tone} />
                </Pressable>
              );
            }) : (
              <Pressable accessibilityRole="button" onPress={() => setCreatingProject(true)} style={styles.emptyRow}>
                <View style={[styles.projectRail, { backgroundColor: colors.accent }]} />
                <View style={styles.projectRowText}>
                  <Text style={styles.projectRowTitle}>Create your first project</Text>
                  <Text style={styles.projectRowMeta}>Start a project workspace</Text>
                </View>
                <ArrowRight color={colors.inkSoft} size={17} />
              </Pressable>
            )}
            {projects.length > visibleProjects.length ? (
              <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)/projects")} style={styles.moreProjectsRow}>
                <Text style={styles.moreProjectsText}>Show the full portfolio</Text>
                <View style={styles.moreProjectsBadge}>
                  <Text style={styles.moreProjectsBadgeText}>{projects.length}</Text>
                </View>
              </Pressable>
            ) : null}
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
      <ProjectCreateModal
        onClose={() => setCreatingProject(false)}
        onCreated={handleProjectCreated}
        visible={creatingProject}
      />
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SectionHeader({ actionLabel, onPress, title }: { actionLabel: string; onPress: () => void; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.inlineAction}>
        <Text style={styles.inlineActionText}>{actionLabel}</Text>
        <ArrowRight color={colors.accent} size={16} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
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
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
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
  projectList: {
    backgroundColor: colors.panel,
    borderColor: "rgba(16,16,15,0.04)",
    borderWidth: 1,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  projectRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  content: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 116,
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
  moreProjectsBadge: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 999,
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  moreProjectsBadgeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  moreProjectsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 16,
  },
  moreProjectsText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "900",
  },
  projectBoard: {
    backgroundColor: "#fffaf0",
    borderColor: "#f3d85a",
    borderRadius: 22,
    borderWidth: 2,
    gap: 12,
    padding: 14,
    ...shadow.card,
  },
  projectBoardAction: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 58,
    paddingHorizontal: 16,
  },
  projectBoardActionText: {
    color: colors.inkSoft,
    fontSize: 16,
    fontWeight: "800",
  },
  projectBoardCount: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  projectBoardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  projectBoardTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  projectBoardTitleWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  projectBoardMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  projectRail: {
    borderRadius: 999,
    height: 42,
    width: 6,
  },
  projectRowMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  projectRowText: {
    flex: 1,
    minWidth: 0,
  },
  projectRowTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
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
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
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
});
