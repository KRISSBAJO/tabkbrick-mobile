import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowRight, Bell, CalendarDays, CheckCircle2, FolderKanban, Plus, Search, Sparkles, X } from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import { ProfileEditModal } from "@/features/profile/ProfileEditModal";
import { ProjectCreateModal } from "@/features/projects/ProjectCreateModal";
import { formatDate, humanize, isOverdue, projectHealth, statusTone } from "@/features/projects/projectFormat";
import { getUnreadNotificationCount, globalSearch, listNotifications, listProjects, listTasks, type GlobalSearchResult } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, fonts, radii, shadow } from "@/lib/theme/tokens";
import type { Notification, Project, Task } from "@/lib/types";

export default function DashboardScreen() {
  const { accessToken, user } = useAuthSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationPreview, setNotificationPreview] = useState<Notification[]>([]);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [projectPage, taskPage, notificationPage, unread] = await Promise.all([
        listProjects(accessToken, { limit: 50 }),
        listTasks(accessToken, { limit: 50, sortBy: "updatedAt", sortDirection: "desc" }),
        listNotifications(accessToken, { limit: 4, page: 1 }),
        getUnreadNotificationCount(accessToken),
      ]);
      setProjects(Array.isArray(projectPage) ? projectPage : projectPage.data);
      setTasks(Array.isArray(taskPage) ? taskPage : taskPage.data);
      setNotificationPreview(notificationPage.data);
      setUnreadCount(unread.total);
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

  const searchText = searchQuery.trim();

  useEffect(() => {
    if (!accessToken || searchText.length < 2) {
      setSearchLoading(false);
      setSearchError("");
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError("");

    const timer = setTimeout(async () => {
      try {
        const result = await globalSearch(accessToken, {
          category: "all",
          limit: 6,
          page: 1,
          search: searchText,
        });
        if (!cancelled) setSearchResults(result.data);
      } catch (caught) {
        if (!cancelled) {
          setSearchResults([]);
          setSearchError(caught instanceof Error ? caught.message : "Search failed.");
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accessToken, searchText]);

  const openTasks = useMemo(() => tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status)), [tasks]);
  const urgentCount = useMemo(
    () => openTasks.filter((t) => t.priority === "CRITICAL" || t.priority === "URGENT").length,
    [openTasks],
  );
  const activeCount = useMemo(() => projects.filter((p) => p.status === "ACTIVE").length, [projects]);

  const assignedTasks = useMemo(() => {
    if (!user) return [];
    return openTasks
      .filter((task) => isTaskAssignedToUser(task, user.id, user.email))
      .sort((a, b) => dateMs(b.updatedAt) - dateMs(a.updatedAt))
      .slice(0, 5);
  }, [openTasks, user]);

  const visibleProjects = useMemo(
    () => projects.filter((p) => p.status !== "ARCHIVED").slice(0, 3),
    [projects],
  );
  const totalActive = useMemo(() => projects.filter((p) => p.status !== "ARCHIVED").length, [projects]);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    [],
  );

  if (!user) return null;

  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim().toUpperCase() ||
    user.email.slice(0, 2).toUpperCase();
  const avatarUrl = user.avatarUrl?.trim();
  const firstName = user.firstName ?? user.email.split("@")[0] ?? "there";

  function handleProjectCreated(project: Project) {
    setCreatingProject(false);
    void load();
    router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: project.id } });
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSearchFocused(false);
  }

  function openSearchResult(result: GlobalSearchResult) {
    clearSearch();
    openGlobalSearchResult(result);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl onRefresh={() => void load(true)} refreshing={refreshing} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {/* ── HERO CARD ── */}
        <View style={styles.commandHeader}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroDate}>{todayLabel}</Text>
              <Text numberOfLines={1} style={styles.heroName}>Hey, {firstName}</Text>
            </View>
            <View style={styles.heroSideCol}>
              <Pressable accessibilityRole="button" onPress={() => setNotificationOpen((value) => !value)} style={styles.heroBell}>
                <Bell color={colors.foreground} size={19} strokeWidth={2.5} />
                {unreadCount ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityLabel="Edit profile"
                accessibilityRole="button"
                onPress={() => {
                  setNotificationOpen(false);
                  setProfileEditorOpen(true);
                }}
                style={({ pressed }) => [styles.heroAvatar, pressed && styles.heroAvatarPressed]}
              >
                {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.heroAvatarImage} /> : <Text style={styles.heroAvatarText}>{initials}</Text>}
              </Pressable>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <HeroStat label="Projects" value={projects.length} />
            <View style={styles.heroStatRule} />
            <HeroStat label="Active" value={activeCount} />
            <View style={styles.heroStatRule} />
            <HeroStat label="Open Tasks" value={openTasks.length} />
            <View style={styles.heroStatRule} />
            <HeroStat highlight={urgentCount > 0} label="Urgent" value={urgentCount} />
          </View>

        </View>

        {/* ── SEARCH ── */}
        {notificationOpen ? (
          <NotificationDropdown
            notifications={notificationPreview}
            onClose={() => setNotificationOpen(false)}
            unreadCount={unreadCount}
          />
        ) : null}

        <View style={styles.heroAccentLine} />

        <View style={styles.commandRow}>
          <Pressable
            accessibilityLabel="Create project"
            accessibilityRole="button"
            onPress={() => setCreatingProject(true)}
            style={({ pressed }) => [styles.heroCtaRow, pressed && styles.heroCtaRowPressed]}
          >
            <Plus color={colors.black} size={18} strokeWidth={3} />
            <Text style={styles.heroCtaText}>New Project</Text>
          </Pressable>
          <View style={styles.searchBar}>
            <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onBlur={() => {
                if (!searchQuery.trim()) setSearchFocused(false);
              }}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search projects, tasks, people..."
              placeholderTextColor={colors.inkSoft}
              returnKeyType="search"
              style={styles.searchInput}
              value={searchQuery}
            />
            {searchQuery ? (
              <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={clearSearch} style={styles.searchClearBtn}>
                <X color={colors.inkSoft} size={16} strokeWidth={2.8} />
              </Pressable>
            ) : null}
          </View>
          {searchFocused || searchText.length >= 2 ? (
            <GlobalSearchPanel
              error={searchError}
              loading={searchLoading}
              onOpen={openSearchResult}
              query={searchText}
              results={searchResults}
            />
          ) : null}
        </View>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.quickGrid}>
          <QuickAction
            accent={colors.accent}
            icon={<FolderKanban color={colors.accent} size={20} strokeWidth={2.5} />}
            label="Projects"
            onPress={() => router.push("/(workspace)/projects")}
          />
          <QuickAction
            accent={colors.success}
            icon={<CheckCircle2 color={colors.success} size={20} strokeWidth={2.5} />}
            label="All Tasks"
            onPress={() => router.push("/(workspace)/tasks")}
          />
          <QuickAction
            accent={colors.primaryDark}
            icon={<CalendarDays color={colors.primaryDark} size={20} strokeWidth={2.5} />}
            label="Calendar"
            onPress={() => router.push("/(workspace)/portfolio")}
          />
          <QuickAction
            accent={colors.warning}
            icon={<ArrowRight color={colors.warning} size={20} strokeWidth={2.5} />}
            label="Portfolio"
            onPress={() => router.push("/(workspace)/portfolio")}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(workspace)/ai")}
          style={({ pressed }) => [styles.aiHomeCard, pressed && styles.aiHomeCardPressed]}
        >
          <View style={styles.aiHomeIcon}>
            <Sparkles color={colors.black} size={21} strokeWidth={2.8} />
          </View>
          <View style={styles.aiHomeText}>
            <Text style={styles.aiHomeEyebrow}>Workspace intelligence</Text>
            <Text style={styles.aiHomeTitle}>Ask AI to plan, summarize, and find risk</Text>
            <Text numberOfLines={2} style={styles.aiHomeSub}>
              Saved chats, project summaries, sprint planning, risk scans, and knowledge search.
            </Text>
          </View>
          <ArrowRight color={colors.foreground} size={20} strokeWidth={2.8} />
        </Pressable>

        {/* ── LOADING / ERROR ── */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingText}>Loading workspace…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Couldn't load workspace</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── RECENT PROJECTS ── */}
            <SectionHeader
              actionLabel={`View all (${totalActive})`}
              icon={<FolderKanban color={colors.foreground} size={17} strokeWidth={2.5} />}
              onPress={() => router.push("/(workspace)/projects")}
              title="Recent projects"
            />

            {visibleProjects.length ? (
              <View style={styles.projectCards}>
                {visibleProjects.map((project, idx) => (
                  <ProjectCard
                    idx={idx}
                    key={project.id}
                    onPress={() =>
                      router.push({
                        pathname: "/(workspace)/projects/[projectId]",
                        params: { projectId: project.id },
                      })
                    }
                    project={project}
                  />
                ))}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setCreatingProject(true)}
                style={styles.emptyCard}
              >
                <View style={styles.emptyIconWrap}>
                  <FolderKanban color={colors.accent} size={26} strokeWidth={2.5} />
                </View>
                <Text style={styles.emptyTitle}>No projects yet</Text>
                <Text style={styles.emptyMeta}>Tap to create your first project</Text>
              </Pressable>
            )}

            {/* ── UP NEXT ── */}
            <SectionHeader
              actionLabel="All tasks"
              icon={<CheckCircle2 color={colors.foreground} size={17} strokeWidth={2.5} />}
              onPress={() => router.push("/(workspace)/tasks")}
              title="Up next"
            />

            {assignedTasks.length ? (
              <View style={styles.taskCards}>
                {assignedTasks.map((task) => {
                  const overdue = isOverdue(task.dueDate);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={task.id}
                      onPress={() =>
                        router.push({
                          pathname: "/(workspace)/tasks/[taskId]",
                          params: { returnTo: "/(workspace)", taskId: task.id },
                        })
                      }
                      style={({ pressed }) => [styles.taskCard, pressed && { opacity: 0.7 }]}
                    >
                      <View
                        style={[styles.taskRail, { backgroundColor: taskRailColor(task.priority, overdue) }]}
                      />
                      <View style={styles.taskBody}>
                        <Text numberOfLines={1} style={styles.taskTitle}>
                          {task.title}
                        </Text>
                        <Text style={styles.taskMeta}>
                          {task.project?.name || task.type} · Due {formatDate(task.dueDate)}
                        </Text>
                      </View>
                      <View style={styles.taskRight}>
                        <StatusPill label={humanize(task.priority)} tone={statusTone(task.priority)} />
                        <ArrowRight color={colors.inkSoft} size={14} strokeWidth={2.5} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={[styles.emptyIconWrap, styles.emptyIconGreen]}>
                  <CheckCircle2 color={colors.success} size={26} strokeWidth={2.5} />
                </View>
                <Text style={styles.emptyTitle}>All caught up</Text>
                <Text style={styles.emptyMeta}>No tasks assigned to you yet</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ProjectCreateModal
        onClose={() => setCreatingProject(false)}
        onCreated={handleProjectCreated}
        visible={creatingProject}
      />
      <ProfileEditModal
        onClose={() => setProfileEditorOpen(false)}
        visible={profileEditorOpen}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function HeroStat({
  highlight = false,
  label,
  value,
}: {
  highlight?: boolean;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.heroStat}>
      <Text style={[styles.heroStatValue, highlight && styles.heroStatValueHighlight]}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function NotificationDropdown({
  notifications,
  onClose,
  unreadCount,
}: {
  notifications: Notification[];
  onClose: () => void;
  unreadCount: number;
}) {
  return (
    <View style={styles.notificationDropdown}>
      <View style={styles.notificationDropHeader}>
        <View>
          <Text style={styles.notificationDropTitle}>Notifications</Text>
          <Text style={styles.notificationDropMeta}>{unreadCount ? `${unreadCount} unread` : "All caught up"}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onClose();
            router.push("/(workspace)/notifications");
          }}
          style={styles.notificationViewAll}
        >
          <Text style={styles.notificationViewAllText}>View all</Text>
          <ArrowRight color={colors.accent} size={13} strokeWidth={2.7} />
        </Pressable>
      </View>

      {notifications.length ? (
        <View style={styles.notificationPreviewList}>
          {notifications.slice(0, 3).map((notification) => (
            <Pressable
              accessibilityRole="button"
              key={notification.id}
              onPress={onClose}
              style={styles.notificationPreviewRow}
            >
              <View style={[styles.notificationDot, notification.readAt ? styles.notificationDotRead : null]} />
              <View style={styles.notificationPreviewText}>
                <Text numberOfLines={1} style={styles.notificationPreviewTitle}>{notification.title}</Text>
                <Text numberOfLines={1} style={styles.notificationPreviewBody}>{notification.body ?? formatNotificationTime(notification.createdAt)}</Text>
              </View>
              <Text style={styles.notificationPreviewTime}>{formatNotificationTime(notification.createdAt)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.notificationEmpty}>
          <Text style={styles.notificationEmptyTitle}>No new alerts</Text>
          <Text style={styles.notificationEmptyMeta}>Project and task updates will appear here.</Text>
        </View>
      )}
    </View>
  );
}

function GlobalSearchPanel({
  error,
  loading,
  onOpen,
  query,
  results,
}: {
  error: string;
  loading: boolean;
  onOpen: (result: GlobalSearchResult) => void;
  query: string;
  results: GlobalSearchResult[];
}) {
  if (query.length < 2) {
    return (
      <View style={styles.searchPanel}>
        <Text style={styles.searchHint}>Search projects, tasks, docs, people, teams, and messages.</Text>
      </View>
    );
  }

  return (
    <View style={styles.searchPanel}>
      <View style={styles.searchPanelHeader}>
        <Text style={styles.searchPanelTitle}>Search results</Text>
        {loading ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={styles.searchPanelMeta}>{results.length} shown</Text>}
      </View>

      {error ? (
        <Text style={styles.searchError}>{error}</Text>
      ) : loading && !results.length ? (
        <Text style={styles.searchHint}>Searching workspace...</Text>
      ) : results.length ? (
        <View style={styles.searchResultStack}>
          {results.map((result) => (
            <Pressable
              accessibilityRole="button"
              key={`${result.type}-${result.id}`}
              onPress={() => onOpen(result)}
              style={({ pressed }) => [styles.searchResultRow, pressed && styles.searchResultPressed]}
            >
              <View style={[styles.searchResultBadge, { backgroundColor: searchTypeTint(result.type) }]}>
                <Text style={[styles.searchResultBadgeText, { color: searchTypeColor(result.type) }]}>{searchTypeInitial(result.type)}</Text>
              </View>
              <View style={styles.searchResultText}>
                <Text numberOfLines={1} style={styles.searchResultTitle}>{result.title}</Text>
                <Text numberOfLines={1} style={styles.searchResultSubtitle}>{result.subtitle || humanize(result.type)}</Text>
              </View>
              <Text style={styles.searchResultType}>{humanize(result.type)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.searchHint}>No results for "{query}".</Text>
      )}
    </View>
  );
}

function QuickAction({
  accent,
  icon,
  label,
  onPress,
}: {
  accent: string;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
    >
      <View style={[styles.quickIconWrap, { backgroundColor: `${accent}10`, borderColor: `${accent}1f` }]}>{icon}</View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function openGlobalSearchResult(result: GlobalSearchResult) {
  const projectId = result.type === "PROJECT" ? entityId(result, "projectId", "project") : metadataString(result, "projectId", "project");
  const taskId = result.type === "TASK" ? entityId(result, "taskId", "task") : metadataString(result, "taskId", "task");

  if (projectId) {
    router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId } });
    return;
  }

  if (taskId) {
    router.push({ pathname: "/(workspace)/tasks/[taskId]", params: { returnTo: "/(workspace)", taskId } });
    return;
  }

  if (result.type === "FILE") {
    router.push("/(workspace)/docs");
    return;
  }

  if (result.type === "MESSAGE") {
    router.push("/(workspace)/messages");
    return;
  }

  if (result.type === "TEAM" || result.type === "USER") {
    router.push("/(workspace)/team");
    return;
  }

  router.push("/(workspace)/projects");
}

function SectionHeader({
  actionLabel,
  icon,
  onPress,
  title,
}: {
  actionLabel: string;
  icon: ReactNode;
  onPress: () => void;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIconWrap}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.sectionAction}>
        <Text style={styles.sectionActionText}>{actionLabel}</Text>
        <ArrowRight color={colors.accent} size={14} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function ProjectCard({
  idx,
  onPress,
  project,
}: {
  idx: number;
  onPress: () => void;
  project: Project;
}) {
  const swatch = swatchForIndex(idx);
  const health = projectHealth(project);
  const progress = Math.min(Math.max(project.progress ?? 0, 0), 100);
  const taskCount = project._count?.tasks ?? 0;
  const memberCount = project._count?.members ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.projectCard, { borderLeftColor: swatch }, pressed && styles.projectCardPressed]}
    >
      <View style={styles.projectCardTop}>
        <View style={[styles.projectCardIcon, { backgroundColor: `${swatch}10`, borderColor: `${swatch}22` }]}>
          <FolderKanban color={swatch} size={17} strokeWidth={2.5} />
        </View>
        <View style={styles.projectCardBody}>
          <View style={styles.projectCardTitleRow}>
            <Text numberOfLines={1} style={styles.projectCardName}>
              {project.name}
            </Text>
            <ProjectHealthBadge label={health.label} tone={health.tone} />
          </View>
          <Text numberOfLines={1} style={styles.projectCardMeta}>
            {project.key} - {taskCount} tasks - {memberCount} members
          </Text>
        </View>
      </View>
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={{ flex: progress, height: 5, backgroundColor: swatch, borderRadius: 99 }} />
          <View style={{ flex: 100 - progress, height: 5 }} />
        </View>
        <Text style={styles.progressPct}>{progress}%</Text>
      </View>
    </Pressable>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ProjectHealthBadge({
  label,
  tone,
}: {
  label: string;
  tone: ReturnType<typeof projectHealth>["tone"];
}) {
  const toneColor = tone === "red" ? colors.danger : tone === "yellow" ? colors.warning : tone === "green" ? colors.success : colors.inkSoft;

  return (
    <View style={[styles.projectHealthBadge, { backgroundColor: `${toneColor}0d`, borderColor: `${toneColor}24` }]}>
      <Text style={[styles.projectHealthBadgeText, { color: toneColor }]}>{label}</Text>
    </View>
  );
}

function isTaskAssignedToUser(task: Task, userId: string, email: string): boolean {
  const normalizedEmail = email.toLowerCase();
  const directAssignment = task.assignees?.some(
    (a) => a.user.id === userId || a.user.email.toLowerCase() === normalizedEmail,
  );
  const cardAssignment = task.card?.assignees.some(
    (a) => a.userId === userId || a.id === userId || a.email.toLowerCase() === normalizedEmail,
  );
  return Boolean(directAssignment || cardAssignment);
}

function dateMs(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function swatchForIndex(index: number): string {
  const swatches = ["#2563eb", "#7c3aed", "#059669", "#dc8a23", "#e11d48"];
  return swatches[index % swatches.length] ?? "#2563eb";
}

function taskRailColor(priority: string, overdue: boolean): string {
  if (overdue) return colors.danger;
  if (priority === "CRITICAL") return colors.danger;
  if (priority === "URGENT") return colors.warning;
  if (priority === "HIGH") return "#b45309";
  if (priority === "MEDIUM") return colors.accent;
  return colors.line;
}

function entityId(result: GlobalSearchResult, metadataKey: string, urlSegment: string) {
  return metadataString(result, metadataKey, "entityId", "resourceId") || idFromSearchUrl(result.url, urlSegment) || result.id;
}

function metadataString(result: GlobalSearchResult, ...keys: string[]) {
  const metadata = result.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const record = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function idFromSearchUrl(url: string, segment: string) {
  const match = url.match(new RegExp(`/${segment}/([^/?#]+)`, "i"));
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function searchTypeInitial(type: GlobalSearchResult["type"]) {
  if (type === "PROJECT") return "P";
  if (type === "TASK") return "T";
  if (type === "FILE") return "D";
  if (type === "USER") return "U";
  if (type === "TEAM") return "TM";
  if (type === "WORKSPACE") return "W";
  return "M";
}

function searchTypeColor(type: GlobalSearchResult["type"]) {
  if (type === "PROJECT") return colors.accent;
  if (type === "TASK") return colors.success;
  if (type === "FILE") return colors.warning;
  if (type === "MESSAGE") return "#7c3aed";
  if (type === "USER" || type === "TEAM") return "#0f766e";
  return colors.inkSoft;
}

function searchTypeTint(type: GlobalSearchResult["type"]) {
  const color = searchTypeColor(type);
  return `${color}14`;
}

function formatNotificationTime(value: string) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "Now";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create(withFontStyles({
  safe: { backgroundColor: colors.white, flex: 1 },
  scroll: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 20, paddingBottom: 120, paddingHorizontal: 20, paddingTop: 16 },
  commandHeader: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: 14,
    marginHorizontal: -20,
    marginTop: -16,
    paddingBottom: 22,
    paddingHorizontal: 20,
    paddingTop: 30,
    shadowColor: "#5c5872",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    zIndex: 4,
    elevation: 8,
  },

  // ── Hero Card ──
  heroCard: {
    backgroundColor: "transparent",
    gap: 18,
  },
  heroTop: { alignItems: "center", flexDirection: "row", gap: 14, justifyContent: "space-between" },
  heroTextBlock: { flex: 1, minWidth: 0 },
  heroDate: {
    color: colors.inkSoft,
    fontFamily: fonts.extraBold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroGreeting: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 16, fontWeight: "700", marginTop: 14 },
  heroName: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 30, fontWeight: "900", letterSpacing: -0.2, marginTop: 6 },
  heroSubtitle: { color: colors.inkSoft, fontFamily: fonts.extraBold, fontSize: 12, fontWeight: "800", marginTop: 4 },
  heroSideCol: { alignItems: "center", flexDirection: "row", gap: 10 },
  heroBell: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    position: "relative",
    width: 44,
  },
  bellBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.white,
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    justifyContent: "center",
    minWidth: 18,
    position: "absolute",
    right: -5,
    top: -5,
  },
  bellBadgeText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 9, fontWeight: "900" },
  heroAvatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 17,
    height: 44,
    overflow: "hidden",
    justifyContent: "center",
    width: 44,
  },
  heroAvatarPressed: {
    opacity: 0.76,
  },
  heroAvatarImage: {
    height: "100%",
    width: "100%",
  },
  heroAvatarText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 14, fontWeight: "900" },

  heroStatsRow: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: 13,
  },
  heroStat: { alignItems: "center", flex: 1, gap: 4 },
  heroStatValue: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 21, fontWeight: "900", letterSpacing: -0.3 },
  heroStatValueHighlight: { color: colors.danger },
  heroStatLabel: {
    color: colors.inkSoft,
    fontFamily: fonts.extraBold,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroStatRule: { backgroundColor: colors.line, height: 28, width: 1 },

  heroCtaRow: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    height: 46,
    justifyContent: "center",
    paddingHorizontal: 18,
    alignSelf: "flex-start",
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  heroCtaRowPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  heroCtaText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 14, fontWeight: "900" },
  notificationDropdown: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 14,
    shadowColor: "#5c5872",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 12,
  },
  notificationDot: {
    backgroundColor: colors.primary,
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  notificationDotRead: {
    backgroundColor: colors.line,
  },
  notificationDropHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  notificationDropMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  notificationDropTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  notificationEmpty: {
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    gap: 4,
    padding: 16,
  },
  notificationEmptyMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  notificationEmptyTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  notificationPreviewBody: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  notificationPreviewList: {
    gap: 8,
  },
  notificationPreviewRow: {
    alignItems: "flex-start",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  notificationPreviewText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  notificationPreviewTime: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  notificationPreviewTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  notificationViewAll: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  notificationViewAllText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  commandRow: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: 12,
  },

  // ── Search ──
  heroAccentLine: {
    backgroundColor: colors.primary,
    borderRadius: 2,
    display: "none",
    height: 3,
    marginHorizontal: 4,
    opacity: 0.7,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 18,
    shadowColor: "#5c5872",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  searchInput: { color: colors.foreground, flex: 1, fontFamily: fonts.semiBold, fontSize: 15, fontWeight: "700", minHeight: 46, paddingVertical: 0 },
  searchClearBtn: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 13,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  searchPanel: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 12,
    shadowColor: "#5c5872",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  searchPanelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  searchPanelTitle: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 13, fontWeight: "900" },
  searchPanelMeta: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 11, fontWeight: "800" },
  searchHint: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  searchError: { color: colors.danger, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "800", lineHeight: 18 },
  searchResultStack: { gap: 6 },
  searchResultRow: {
    alignItems: "center",
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  searchResultPressed: { backgroundColor: colors.panelMuted },
  searchResultBadge: { alignItems: "center", borderRadius: 13, height: 36, justifyContent: "center", width: 36 },
  searchResultBadgeText: { fontFamily: fonts.extraBold, fontSize: 11, fontWeight: "900" },
  searchResultText: { flex: 1, minWidth: 0 },
  searchResultTitle: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 13, fontWeight: "900" },
  searchResultSubtitle: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 11, fontWeight: "700", marginTop: 2 },
  searchResultType: { color: colors.inkSoft, fontFamily: fonts.extraBold, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },

  // ── Quick Actions ──
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  quickAction: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 92,
    paddingVertical: 17,
    shadowColor: "#5c5872",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.045,
    shadowRadius: 20,
    width: "47.5%",
    elevation: 2,
  },
  quickActionPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  quickIconWrap: {
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  quickLabel: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 13, fontWeight: "900" },
  aiHomeCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: "#eadfbb",
    borderLeftColor: colors.primary,
    borderLeftWidth: 5,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 16,
    minHeight: 132,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: "#5c5872",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.075,
    shadowRadius: 28,
    elevation: 3,
  },
  aiHomeCardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  aiHomeIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderRadius: 18,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    width: 56,
  },
  aiHomeText: { flex: 1, minWidth: 0 },
  aiHomeEyebrow: {
    color: colors.primaryDark,
    fontFamily: fonts.extraBold,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  aiHomeTitle: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 18, fontWeight: "900", lineHeight: 23 },
  aiHomeSub: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 5 },

  // ── Loading / Error ──
  loadingBox: { alignItems: "center", gap: 12, paddingVertical: 48 },
  loadingText: { color: colors.inkSoft, fontSize: 14, fontWeight: "700" },
  errorBox: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  errorTitle: { color: colors.danger, fontSize: 16, fontWeight: "900" },
  errorBody: { color: colors.danger, fontSize: 13, fontWeight: "700", textAlign: "center" },
  retryBtn: {
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: colors.accent, fontSize: 14, fontWeight: "900" },

  // ── Section Header ──
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  sectionTitleRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, minWidth: 0 },
  sectionIconWrap: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  sectionTitle: { color: colors.foreground, flexShrink: 1, fontFamily: fonts.extraBold, fontSize: 17, fontWeight: "900" },
  sectionAction: { alignItems: "center", flexDirection: "row", gap: 4, paddingLeft: 10, paddingVertical: 4 },
  sectionActionText: { color: colors.accent, fontFamily: fonts.extraBold, fontSize: 13, fontWeight: "800" },

  // ── Project Cards ──
  projectCards: { gap: 12 },
  projectCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    borderLeftWidth: 3,
    gap: 13,
    padding: 15,
    shadowColor: "#5c5872",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.045,
    shadowRadius: 22,
    elevation: 2,
  },
  projectCardPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  projectCardTop: { alignItems: "center", flexDirection: "row", gap: 11 },
  projectCardIcon: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  projectCardBody: { flex: 1, minWidth: 0 },
  projectCardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  projectCardName: { color: colors.foreground, flex: 1, fontFamily: fonts.extraBold, fontSize: 15, fontWeight: "900" },
  projectCardMeta: {
    color: colors.inkSoft,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 5,
    textTransform: "uppercase",
  },
  projectHealthBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  projectHealthBadgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  progressRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: 99,
    flex: 1,
    flexDirection: "row",
    height: 5,
    overflow: "hidden",
  },
  progressPct: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", textAlign: "right", width: 32 },

  showMoreBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 16,
  },
  showMoreText: { color: colors.accent, fontSize: 14, fontWeight: "800" },

  // ── Task Cards ──
  taskCards: { gap: 10 },
  taskCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: "#c9c6d4",
    borderRadius: radii.xl,
    borderWidth: 1.5,
    flexDirection: "row",
    overflow: "hidden",
  },
  taskRail: { alignSelf: "stretch", width: 4 },
  taskBody: { flex: 1, gap: 5, minWidth: 0, paddingLeft: 14, paddingVertical: 16 },
  taskTitle: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 15, fontWeight: "900" },
  taskMeta: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  taskRight: { alignItems: "center", flexDirection: "row", gap: 8, paddingRight: 14 },

  // ── Empty states ──
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 10,
    padding: 40,
    ...shadow.card,
  },
  emptyIconWrap: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    height: 58,
    justifyContent: "center",
    marginBottom: 4,
    width: 58,
  },
  emptyIconGreen: { backgroundColor: colors.greenSoft },
  emptyTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900" },
  emptyMeta: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", textAlign: "center" },
}));
