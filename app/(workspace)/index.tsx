import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowRight, BarChart3, CalendarDays, FolderOpen, ListChecks, Plus, TriangleAlert } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Surface } from "@/components/ui/Surface";
import { MetricCard } from "@/features/workspace/MetricCard";
import { WorkspaceHeader } from "@/features/workspace/WorkspaceHeader";
import { formatDate, humanize, isOverdue, projectHealth, statusTone } from "@/features/projects/projectFormat";
import { listMeetings, listProjects, listTasks } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii } from "@/lib/theme/tokens";
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
      setError(caught instanceof Error ? caught.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const activeProjects = projects.filter((project) => project.status === "ACTIVE").length;
    const movingTasks = tasks.filter((task) => !["DONE", "CANCELLED"].includes(task.status)).length;
    const atRiskProjects = projects.filter((project) => projectHealth(project).tone === "red" || projectHealth(project).tone === "yellow").length;
    const today = new Date().toISOString().slice(0, 10);
    const meetingsToday = meetings.filter((meeting) => meeting.startAt.slice(0, 10) === today).length;
    return { activeProjects, atRiskProjects, meetingsToday, movingTasks };
  }, [meetings, projects, tasks]);

  const priorityTasks = useMemo(() => (
    tasks
      .filter((task) => task.priority === "HIGH" || task.priority === "URGENT" || task.priority === "CRITICAL" || isOverdue(task.dueDate))
      .slice(0, 4)
  ), [tasks]);

  const visibleProjects = projects.slice(0, 4);

  if (!user) return null;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.foreground} />}
      showsVerticalScrollIndicator={false}
      style={styles.safe}
    >
      <WorkspaceHeader user={user} />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Command center</Text>
        <Text style={styles.title}>Good to see you, {user.firstName || "there"}.</Text>
        <Text style={styles.subtitle}>Live delivery health, priority work, and schedule signals.</Text>
        <View style={styles.heroActions}>
          <Button
            label="New project"
            onPress={() => router.push("/(workspace)/projects/new")}
            rightIcon={<Plus color={colors.black} size={16} strokeWidth={2.8} />}
            style={styles.heroButton}
          />
          <Button label="Projects" onPress={() => router.push("/(workspace)/projects")} style={styles.heroButton} variant="outline" />
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.foreground} />
          <Text style={styles.muted}>Loading workspace dashboard</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Retry" onPress={() => void load()} variant="outline" />
        </View>
      ) : (
        <>
          <View style={styles.metrics}>
            <MetricCard icon={FolderOpen} label="Active projects" tone="dark" value={String(stats.activeProjects)} />
            <MetricCard icon={ListChecks} label="Tasks moving" tone="yellow" value={String(stats.movingTasks)} />
          </View>
          <View style={styles.metrics}>
            <MetricCard icon={CalendarDays} label="Meetings today" value={String(stats.meetingsToday)} />
            <MetricCard icon={BarChart3} label="At-risk projects" value={String(stats.atRiskProjects)} />
          </View>

          <Surface eyebrow="Portfolio" title="Project health">
            <View style={styles.stack}>
              {visibleProjects.length ? visibleProjects.map((project) => {
                const health = projectHealth(project);
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={project.id}
                    onPress={() => router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: project.id } })}
                    style={styles.projectRow}
                  >
                    <View style={styles.rowText}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{project.name}</Text>
                      <Text style={styles.rowMeta}>{project.key} - {project.progress}% - Due {formatDate(project.dueDate)}</Text>
                    </View>
                    <StatusPill label={health.label} tone={health.tone} />
                    <ArrowRight color={colors.inkSoft} size={16} />
                  </Pressable>
                );
              }) : (
                <Text style={styles.muted}>No projects yet.</Text>
              )}
            </View>
          </Surface>

          <Surface eyebrow="Priority" title="Work queue">
            <View style={styles.stack}>
              {priorityTasks.length ? priorityTasks.map((task) => (
                <View key={task.id} style={styles.taskRow}>
                  <View style={styles.alertIcon}>
                    <TriangleAlert color={colors.warning} size={17} />
                  </View>
                  <View style={styles.rowText}>
                    <Text numberOfLines={1} style={styles.rowTitle}>{task.title}</Text>
                    <Text style={styles.rowMeta}>{task.project?.name || task.type} - Due {formatDate(task.dueDate)}</Text>
                  </View>
                  <StatusPill label={humanize(task.priority)} tone={statusTone(task.priority)} />
                </View>
              )) : (
                <Text style={styles.muted}>No high-priority work in the current task window.</Text>
              )}
            </View>
          </Surface>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  alertIcon: {
    alignItems: "center",
    backgroundColor: colors.yellowSoft,
    borderRadius: radii.md,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: 112,
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  hero: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 4,
  },
  heroButton: {
    flex: 1,
  },
  loading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 18,
  },
  metrics: {
    flexDirection: "row",
    gap: 12,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  projectRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  rowMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  stack: {
    gap: 10,
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    maxWidth: 300,
  },
  taskRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 33,
    maxWidth: 300,
  },
});
