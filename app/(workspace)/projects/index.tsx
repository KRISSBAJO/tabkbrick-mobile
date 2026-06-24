import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowRight, CalendarDays, FolderKanban, Plus, Search } from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import { ProjectCreateModal } from "@/features/projects/ProjectCreateModal";
import {
  formatDate,
  humanize,
  projectHealth,
  projectStatuses,
  statusTone,
  summarizeProject,
  type ProjectStatus,
} from "@/features/projects/projectFormat";
import { listProjects } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Project } from "@/lib/types";

const ALL = "ALL";
type StatusFilter = ProjectStatus | typeof ALL;

export default function ProjectsScreen() {
  const { accessToken } = useAuthSession();
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await listProjects(accessToken, {
        limit: 100,
        search: search.trim() || undefined,
        status: statusFilter === ALL ? undefined : statusFilter,
      });
      setProjects(Array.isArray(result) ? result : result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load projects.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const summary = useMemo(() => ({
    active: projects.filter((p) => p.status === "ACTIVE").length,
    planning: projects.filter((p) => p.status === "PLANNING" || p.status === "ON_HOLD").length,
    total: projects.length,
  }), [projects]);

  const listData = loading || error ? [] : projects;

  function openProject(project: Project) {
    router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: project.id } });
  }

  const statusOptions: { label: string; value: StatusFilter }[] = [
    { label: "All", value: ALL },
    ...projectStatuses.map((s) => ({ label: humanize(s), value: s })),
  ];

  const ListHeader = (
    <View style={styles.headerStack}>
      {/* ── Title row ── */}
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Projects</Text>
          <Text style={styles.subtitle}>{summary.total} total · {summary.active} active · {summary.planning} on hold</Text>
        </View>
        <Pressable
          accessibilityLabel="Create project"
          accessibilityRole="button"
          onPress={() => setCreatingProject(true)}
          style={styles.addBtn}
        >
          <Plus color={colors.black} size={22} strokeWidth={3} />
        </Pressable>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchBar}>
        <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
        <TextInput
          autoCapitalize="none"
          onChangeText={setSearch}
          placeholder="Search projects…"
          placeholderTextColor={colors.inkSoft}
          style={styles.searchInput}
          value={search}
        />
        {search ? (
          <Pressable accessibilityRole="button" onPress={() => setSearch("")} style={styles.searchClear}>
            <Text style={styles.searchClearText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── Status filter chips ── */}
      <ScrollView contentContainerStyle={styles.chipRail} horizontal showsHorizontalScrollIndicator={false}>
        {statusOptions.map((opt) => {
          const active = opt.value === statusFilter;
          return (
            <Pressable
              accessibilityRole="button"
              key={opt.value}
              onPress={() => setStatusFilter(opt.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Loading / error ── */}
      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading projects…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Count label ── */}
      {!loading && !error && listData.length > 0 && (
        <View style={styles.countRow}>
          <View style={styles.countTitleRow}>
            <View style={styles.countIconWrap}>
              <FolderKanban color={colors.accent} size={16} strokeWidth={2.7} />
            </View>
            <Text numberOfLines={1} style={styles.countText}>Project directory</Text>
          </View>
          <Text style={styles.countMuted}>{listData.length} {listData.length === 1 ? "project" : "projects"}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <FlatList
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={!loading && !error ? <EmptyState onCreate={() => setCreatingProject(true)} /> : null}
        ListFooterComponent={<View style={{ height: 120 }} />}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.content}
        data={listData}
        keyExtractor={(p) => p.id}
        onRefresh={() => void load(true)}
        refreshing={refreshing}
        renderItem={({ item }) => (
          <ProjectCard onPress={() => openProject(item)} project={item} />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
      <ProjectCreateModal
        onClose={() => setCreatingProject(false)}
        onCreated={(project) => {
          setCreatingProject(false);
          void load();
          router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: project.id } });
        }}
        visible={creatingProject}
      />
    </SafeAreaView>
  );
}

// ── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ onPress, project }: { onPress: () => void; project: Project }) {
  const swatch = statusSwatch(project.status);
  const iconTint = statusIconTint(project.status);
  const health = projectHealth(project);
  const progress = Math.min(Math.max(project.progress ?? 0, 0), 100);
  const meta = summarizeProject(project).replaceAll(" - ", " · ");

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderTopColor: swatch }, pressed && { opacity: 0.7 }]}
    >
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: iconTint }]}>
          <FolderKanban color={swatch} size={18} strokeWidth={2.5} />
        </View>
        <View style={styles.cardTitleBlock}>
          <Text numberOfLines={1} style={styles.cardTitle}>{project.name}</Text>
          <Text numberOfLines={1} style={styles.cardMeta}>{project.key} · {meta}</Text>
        </View>
        <ArrowRight color={colors.inkSoft} size={18} strokeWidth={2.5} />
      </View>

      {/* Description */}
      {project.description ? (
        <Text numberOfLines={2} style={styles.cardDesc}>{project.description.trim()}</Text>
      ) : null}

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={{ flex: progress, height: 6, backgroundColor: swatch, borderRadius: 99 }} />
          <View style={{ flex: 100 - progress, height: 6 }} />
        </View>
        <Text style={styles.progressPct}>{progress}%</Text>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.dateRow}>
          <CalendarDays color={colors.inkSoft} size={13} strokeWidth={2.5} />
          <Text style={styles.dateText}>{formatDate(project.dueDate)}</Text>
        </View>
        <View style={styles.pillRow}>
          <StatusPill label={humanize(project.status)} tone={statusTone(project.status)} />
          <StatusPill label={health.label} tone={health.tone} />
        </View>
      </View>
    </Pressable>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <FolderKanban color={colors.accent} size={28} strokeWidth={2.5} />
      </View>
      <Text style={styles.emptyTitle}>No projects found</Text>
      <Text style={styles.emptyMeta}>Create a project or adjust the filters.</Text>
      <Pressable accessibilityRole="button" onPress={onCreate} style={styles.emptyBtn}>
        <Plus color={colors.black} size={17} strokeWidth={3} />
        <Text style={styles.emptyBtnText}>New project</Text>
      </Pressable>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusSwatch(status?: string | null): string {
  if (status === "ACTIVE") return colors.success;
  if (status === "PLANNING") return colors.accent;
  if (status === "ON_HOLD") return colors.warning;
  if (status === "COMPLETED") return "#475569";
  return "#94a3b8";
}

function statusIconTint(status?: string | null): string {
  if (status === "ACTIVE") return colors.greenSoft;
  if (status === "PLANNING") return colors.blueSoft;
  if (status === "ON_HOLD") return colors.orangeSoft;
  return colors.panelMuted;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create(withFontStyles({
  safe: { backgroundColor: colors.background, flex: 1 },
  list: { backgroundColor: colors.background, flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16 },

  // Header
  headerStack: { gap: 14, paddingBottom: 14 },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 14 },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { color: colors.foreground, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", marginTop: 3 },
  addBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    height: 48,
    justifyContent: "center",
    width: 48,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },

  // Search
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 18,
    ...shadow.card,
  },
  searchInput: { color: colors.foreground, flex: 1, fontSize: 15, fontWeight: "700" },
  searchClear: { padding: 4 },
  searchClearText: { color: colors.inkSoft, fontSize: 14, fontWeight: "900" },

  // Filter chips
  chipRail: { gap: 8, paddingRight: 4 },
  chip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  chipText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800" },
  chipTextActive: { color: colors.white },

  // Loading / error
  loadingCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 14,
    padding: 40,
    ...shadow.card,
  },
  loadingText: { color: colors.inkSoft, fontSize: 14, fontWeight: "700" },
  errorBox: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "800", textAlign: "center" },
  retryBtn: { backgroundColor: colors.panel, borderRadius: radii.md, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: colors.accent, fontSize: 14, fontWeight: "900" },

  // Count label
  countRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 2 },
  countTitleRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10, minWidth: 0 },
  countIconWrap: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: radii.md, height: 34, justifyContent: "center", width: 34 },
  countText: { color: colors.foreground, flexShrink: 1, fontSize: 17, fontWeight: "900", letterSpacing: -0.1 },
  countMuted: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },

  // Project card
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderTopWidth: 4,
    borderWidth: 1,
    gap: 14,
    padding: 16,
    ...shadow.card,
  },
  cardTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  cardIcon: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  cardTitleBlock: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900" },
  cardMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", marginTop: 3 },
  cardDesc: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", lineHeight: 19 },

  // Progress
  progressRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: 99,
    flex: 1,
    flexDirection: "row",
    height: 6,
    overflow: "hidden",
  },
  progressPct: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", width: 34 },

  // Card footer
  cardFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  dateRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  dateText: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },
  pillRow: { alignItems: "center", flexDirection: "row", gap: 6 },

  // Empty state
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 10,
    padding: 48,
    ...shadow.card,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    height: 60,
    justifyContent: "center",
    marginBottom: 6,
    width: 60,
  },
  emptyTitle: { color: colors.foreground, fontSize: 18, fontWeight: "900" },
  emptyMeta: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", textAlign: "center" },
  emptyBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  emptyBtnText: { color: colors.black, fontSize: 14, fontWeight: "900" },
}));
