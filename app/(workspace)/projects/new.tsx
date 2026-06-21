import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { ProjectForm, createEmptyProjectDraft, type ProjectDraft } from "@/features/projects/ProjectForm";
import { toCreateProjectPayload } from "@/features/projects/projectPayload";
import { createProject, listTeams, listWorkspaces } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii } from "@/lib/theme/tokens";
import type { Team, Workspace } from "@/lib/types";

export default function NewProjectScreen() {
  const { accessToken } = useAuthSession();
  const [draft, setDraft] = useState<ProjectDraft>(() => createEmptyProjectDraft());
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadMeta = useCallback(async () => {
    if (!accessToken) return;
    setLoadingMeta(true);
    setError("");
    try {
      const [workspacePage, teamPage] = await Promise.all([
        listWorkspaces(accessToken, { limit: 50 }),
        listTeams(accessToken, { limit: 50 }),
      ]);
      const nextWorkspaces = Array.isArray(workspacePage) ? workspacePage : workspacePage.data;
      const nextTeams = Array.isArray(teamPage) ? teamPage : teamPage.data;
      setWorkspaces(nextWorkspaces);
      setTeams(nextTeams);
      setDraft((current) => ({
        ...current,
        workspaceId: current.workspaceId || nextWorkspaces[0]?.id || "",
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load workspace options.");
    } finally {
      setLoadingMeta(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  async function submit() {
    if (!accessToken) return;
    setError("");
    if (!draft.workspaceId) {
      setError("Select a workspace before creating the project.");
      return;
    }
    if (!draft.key.trim() || !draft.name.trim()) {
      setError("Project key and name are required.");
      return;
    }

    setSaving(true);
    try {
      const project = await createProject(accessToken, toCreateProjectPayload(draft));
      router.replace({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: project.id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.safe}>
      <View style={styles.header}>
        <Button
          label="Back"
          leftIcon={<ArrowLeft color={colors.black} size={16} />}
          onPress={() => router.back()}
          style={styles.backButton}
          variant="outline"
        />
        <View>
          <Text style={styles.eyebrow}>New project</Text>
          <Text style={styles.title}>Create delivery space</Text>
        </View>
      </View>

      {loadingMeta ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.foreground} />
          <Text style={styles.muted}>Loading workspace data</Text>
        </View>
      ) : (
        <ProjectForm draft={draft} mode="create" onChange={setDraft} teams={teams} workspaces={workspaces} />
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button
        disabled={loadingMeta}
        label="Create project"
        loading={saving}
        onPress={submit}
        rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    height: 40,
  },
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 112,
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 13,
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
  header: {
    gap: 14,
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 16,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  title: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 34,
  },
});
