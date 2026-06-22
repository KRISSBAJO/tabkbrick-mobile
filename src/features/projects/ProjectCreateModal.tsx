import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, CircleDollarSign, X } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ProjectSelector } from "@/features/projects/ProjectSelector";
import { createEmptyProjectDraft, type ProjectDraft } from "@/features/projects/ProjectForm";
import { humanize, projectStatuses, projectVisibilities } from "@/features/projects/projectFormat";
import { toCreateProjectPayload } from "@/features/projects/projectPayload";
import { createProject, listTeams, listWorkspaces } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Project, Team, Workspace } from "@/lib/types";

type ProjectCreateModalProps = {
  onClose: () => void;
  onCreated: (project: Project) => void;
  visible: boolean;
};

const noTeam = "__none__";
const steps = ["Basics", "Plan", "Details"] as const;

export function ProjectCreateModal({ onClose, onCreated, visible }: ProjectCreateModalProps) {
  const { accessToken } = useAuthSession();
  const [draft, setDraft] = useState<ProjectDraft>(() => createEmptyProjectDraft());
  const [error, setError] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [teams, setTeams] = useState<Team[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const patch = useCallback((next: Partial<ProjectDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  }, []);

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
    if (!visible) return;
    setDraft(createEmptyProjectDraft());
    setError("");
    setSaving(false);
    setStep(0);
    void loadMeta();
  }, [loadMeta, visible]);

  function validateBasics() {
    if (!draft.workspaceId) return "Select a workspace before continuing.";
    if (!draft.key.trim()) return "Project key is required.";
    if (!draft.name.trim()) return "Project name is required.";
    return "";
  }

  function nextStep() {
    const basicError = step === 0 ? validateBasics() : "";
    if (basicError) {
      setError(basicError);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function submit() {
    if (!accessToken) return;
    const basicError = validateBasics();
    if (basicError) {
      setStep(0);
      setError(basicError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const project = await createProject(accessToken, toCreateProjectPayload(draft));
      onCreated(project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.scrim} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.eyebrow}>New project</Text>
              <Text style={styles.title}>Create project</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          <View style={styles.steps}>
            {steps.map((label, index) => (
              <View key={label} style={[styles.stepPill, index === step ? styles.stepPillActive : null]}>
                <Text style={[styles.stepText, index === step ? styles.stepTextActive : null]}>{label}</Text>
              </View>
            ))}
          </View>

          {loadingMeta ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.foreground} />
              <Text style={styles.muted}>Loading workspace options</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {step === 0 ? <BasicsStep draft={draft} onChange={patch} teams={teams} workspaces={workspaces} /> : null}
              {step === 1 ? <PlanStep draft={draft} onChange={patch} /> : null}
              {step === 2 ? <DetailsStep draft={draft} onChange={patch} /> : null}
            </ScrollView>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            {step > 0 ? (
              <Button
                label="Back"
                leftIcon={<ArrowLeft color={colors.black} size={16} strokeWidth={2.8} />}
                onPress={() => {
                  setError("");
                  setStep((current) => Math.max(current - 1, 0));
                }}
                style={styles.secondaryAction}
                variant="outline"
              />
            ) : null}
            <Button
              disabled={loadingMeta}
              label={step === steps.length - 1 ? "Create project" : "Continue"}
              loading={saving}
              onPress={step === steps.length - 1 ? submit : nextStep}
              rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
              style={styles.primaryAction}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type StepProps = {
  draft: ProjectDraft;
  onChange: (draft: Partial<ProjectDraft>) => void;
};

type BasicsStepProps = StepProps & {
  teams: Team[];
  workspaces: Workspace[];
};

function BasicsStep({ draft, onChange, teams, workspaces }: BasicsStepProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <BriefcaseBusiness color={colors.foreground} size={18} strokeWidth={2.6} />
        <Text style={styles.sectionTitle}>Project basics</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.keyField}>
          <Field
            autoCapitalize="characters"
            label="Key"
            onChangeText={(value) => onChange({ key: value.replace(/[^a-z0-9-]/gi, "").toUpperCase().slice(0, 12) })}
            placeholder="TB"
            value={draft.key}
          />
        </View>
        <View style={styles.flex}>
          <Field label="Project name" onChangeText={(name) => onChange({ name })} placeholder="Client delivery" value={draft.name} />
        </View>
      </View>
      <Field
        label="Description"
        multiline
        onChangeText={(description) => onChange({ description })}
        placeholder="Scope, outcome, and delivery notes"
        value={draft.description}
      />
      {workspaces.length ? (
        <ProjectSelector
          label="Workspace"
          onChange={(workspaceId) => onChange({ workspaceId })}
          options={workspaces.map((workspace) => ({ label: workspace.name, value: workspace.id }))}
          value={draft.workspaceId}
        />
      ) : (
        <Text style={styles.muted}>No workspaces were returned by the API.</Text>
      )}
      {teams.length ? (
        <ProjectSelector
          label="Team"
          onChange={(teamId) => onChange({ teamId: teamId === noTeam ? "" : teamId })}
          options={[{ label: "No team", value: noTeam }, ...teams.map((team) => ({ label: team.name, value: team.id }))]}
          value={draft.teamId || noTeam}
        />
      ) : null}
    </View>
  );
}

function PlanStep({ draft, onChange }: StepProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <CalendarDays color={colors.foreground} size={18} strokeWidth={2.6} />
        <Text style={styles.sectionTitle}>Plan and access</Text>
      </View>
      <ProjectSelector
        label="Status"
        onChange={(status) => onChange({ status })}
        options={projectStatuses.map((status) => ({ label: humanize(status), value: status }))}
        value={draft.status}
      />
      <ProjectSelector
        label="Visibility"
        onChange={(visibility) => onChange({ visibility })}
        options={projectVisibilities.map((visibility) => ({ label: humanize(visibility), value: visibility }))}
        value={draft.visibility}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="Start date" onChangeText={(startDate) => onChange({ startDate })} placeholder="2026-07-01" value={draft.startDate} />
        </View>
        <View style={styles.flex}>
          <Field label="Due date" onChangeText={(dueDate) => onChange({ dueDate })} placeholder="2026-09-30" value={draft.dueDate} />
        </View>
      </View>
      <Field
        keyboardType="number-pad"
        label="Progress"
        onChangeText={(progress) => onChange({ progress: progress.replace(/[^0-9]/g, "").slice(0, 3) })}
        placeholder="0"
        value={draft.progress}
      />
    </View>
  );
}

function DetailsStep({ draft, onChange }: StepProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <CircleDollarSign color={colors.foreground} size={18} strokeWidth={2.6} />
        <Text style={styles.sectionTitle}>Optional details</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.currencyField}>
          <Field
            autoCapitalize="characters"
            label="Currency"
            onChangeText={(currency) => onChange({ currency: currency.toUpperCase().slice(0, 3) })}
            placeholder="USD"
            value={draft.currency}
          />
        </View>
        <View style={styles.flex}>
          <Field
            keyboardType="decimal-pad"
            label="Contract value"
            onChangeText={(contractValue) => onChange({ contractValue: contractValue.replace(/[^0-9.]/g, "") })}
            placeholder="125000"
            value={draft.contractValue}
          />
        </View>
      </View>
      <Field label="Client name" onChangeText={(clientName) => onChange({ clientName })} placeholder="Acme Corporation" value={draft.clientName} />
      <Field
        keyboardType="email-address"
        label="Client email"
        onChangeText={(clientEmail) => onChange({ clientEmail })}
        placeholder="stakeholder@acme.com"
        value={draft.clientEmail}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="City" onChangeText={(city) => onChange({ city })} placeholder="Chicago" value={draft.city} />
        </View>
        <View style={styles.flex}>
          <Field label="Country" onChangeText={(country) => onChange({ country })} placeholder="US" value={draft.country} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  currencyField: {
    width: 100,
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
  },
  formContent: {
    paddingBottom: 4,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    marginBottom: 16,
    width: 42,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  keyField: {
    width: 104,
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    padding: 16,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  primaryAction: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16,16,15,0.34)",
  },
  secondaryAction: {
    flex: 0.7,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    maxHeight: "92%",
    padding: 20,
    paddingBottom: 24,
    ...shadow.heavy,
  },
  stepPill: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 34,
    justifyContent: "center",
  },
  stepPillActive: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.primary,
  },
  steps: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    marginTop: 18,
  },
  stepText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  stepTextActive: {
    color: colors.foreground,
  },
  title: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 30,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
});
