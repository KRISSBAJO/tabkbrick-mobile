import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Plus, Search } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ProjectCard } from "@/features/projects/ProjectCard";
import { ProjectCreateModal } from "@/features/projects/ProjectCreateModal";
import { ProjectSelector } from "@/features/projects/ProjectSelector";
import { humanize, projectStatuses, type ProjectStatus } from "@/features/projects/projectFormat";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { listProjects } from "@/lib/api";
import { colors, radii } from "@/lib/theme/tokens";
import type { Project } from "@/lib/types";

const allStatuses = "ALL";
type StatusFilter = ProjectStatus | typeof allStatuses;

export default function ProjectsScreen() {
  const { accessToken } = useAuthSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>(allStatuses);
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
      const result = await listProjects(accessToken, {
        limit: 50,
        search: search.trim() || undefined,
        status: status === allStatuses ? undefined : status,
      });
      setProjects(Array.isArray(result) ? result : result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load projects.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, search, status]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(handle);
  }, [load]);

  const summary = useMemo(() => {
    const active = projects.filter((project) => project.status === "ACTIVE").length;
    const planning = projects.filter((project) => project.status === "PLANNING").length;
    return { active, planning, total: projects.length };
  }, [projects]);

  const data = loading || error ? [] : projects;

  return (
    <>
      <FlatList
        ListEmptyComponent={!loading && !error ? <ProjectsEmpty onCreate={() => setCreatingProject(true)} /> : null}
        ListFooterComponent={<View style={styles.bottomSpacer} />}
        ListHeaderComponent={(
          <View style={styles.headerStack}>
            <View style={styles.header}>
              <View style={styles.titleWrap}>
                <Text style={styles.eyebrow}>Projects</Text>
                <Text style={styles.title}>Delivery portfolio</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setCreatingProject(true)} style={styles.addButton}>
                <Plus color={colors.black} size={20} strokeWidth={2.8} />
              </Pressable>
            </View>

            <View style={styles.summaryGrid}>
              <SummaryTile label="Total" value={summary.total} />
              <SummaryTile label="Active" value={summary.active} />
              <SummaryTile label="Planning" value={summary.planning} />
            </View>

            <View style={styles.filters}>
              <Field
                label="Search"
                leftAccessory={<Search color={colors.inkSoft} size={18} />}
                onChangeText={setSearch}
                placeholder="Project, key, client"
                value={search}
              />
              <ProjectSelector
                label="Status"
                onChange={setStatus}
                options={[{ label: "All", value: allStatuses }, ...projectStatuses.map((item) => ({ label: humanize(item), value: item }))]}
                value={status}
              />
            </View>

            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.foreground} />
                <Text style={styles.muted}>Loading projects</Text>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Button label="Retry" onPress={() => void load()} variant="outline" />
              </View>
            ) : null}
          </View>
        )}
        ItemSeparatorComponent={ProjectSeparator}
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(project) => project.id}
        onRefresh={() => void load(true)}
        refreshing={refreshing}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: item.id } })}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.safe}
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
    </>
  );
}

function ProjectsEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No projects found</Text>
      <Text style={styles.muted}>Create a project or adjust the filter.</Text>
      <Button label="Create project" onPress={onCreate} rightIcon={<Plus color={colors.black} size={16} />} />
    </View>
  );
}

function ProjectSeparator() {
  return <View style={styles.projectSeparator} />;
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  content: {
    padding: 20,
  },
  bottomSpacer: {
    height: 112,
  },
  empty: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
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
    textTransform: "uppercase",
  },
  filters: {
    gap: 14,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  headerStack: {
    gap: 20,
    marginBottom: 12,
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
    lineHeight: 19,
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  projectSeparator: {
    height: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 10,
  },
  summaryLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  summaryTile: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: 14,
  },
  summaryValue: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "900",
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
  },
  titleWrap: {
    flex: 1,
  },
});
