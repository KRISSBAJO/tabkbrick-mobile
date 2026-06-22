import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Check, CircleDollarSign, X } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ProjectDateField, ProjectDatePickerSheet } from "@/features/projects/ProjectDatePicker";
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

type DateFieldKey = "dueDate" | "startDate";
type DatePickerState = { field: DateFieldKey; title: string } | null;

const noTeam = "__none__";
const steps = [
  { label: "Basics", title: "Name and workspace" },
  { label: "Schedule", title: "Dates and access" },
  { label: "Details", title: "Client and budget" },
] as const;

export function ProjectCreateModal({ onClose, onCreated, visible }: ProjectCreateModalProps) {
  const { accessToken } = useAuthSession();
  const [datePicker, setDatePicker] = useState<DatePickerState>(null);
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
    setDatePicker(null);
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

  const currentDateValue = datePicker ? draft[datePicker.field] : "";

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
              <Text style={styles.subtitle}>{steps[step]?.title ?? steps[0].title}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          <StepIndicator currentStep={step} />

          {loadingMeta ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.foreground} />
              <Text style={styles.muted}>Loading workspace options</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {step === 0 ? <BasicsStep draft={draft} onChange={patch} teams={teams} workspaces={workspaces} /> : null}
              {step === 1 ? <PlanStep draft={draft} onChange={patch} onOpenDatePicker={setDatePicker} /> : null}
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

      <ProjectDatePickerSheet
        onClose={() => setDatePicker(null)}
        onSelect={(value) => {
          if (!datePicker) return;
          patch({ [datePicker.field]: value });
          setDatePicker(null);
        }}
        title={datePicker?.title ?? ""}
        value={currentDateValue}
        visible={Boolean(datePicker)}
      />
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

type PlanStepProps = StepProps & {
  onOpenDatePicker: (picker: DatePickerState) => void;
};

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.steps}>
      {steps.map((item, index) => {
        const active = index === currentStep;
        const complete = index < currentStep;
        return (
          <View key={item.label} style={styles.stepItem}>
            <View style={[styles.stepCircle, active ? styles.stepCircleActive : null, complete ? styles.stepCircleComplete : null]}>
              {complete ? (
                <Check color={colors.white} size={14} strokeWidth={3} />
              ) : (
                <Text style={[styles.stepNumber, active ? styles.stepNumberActive : null]}>{index + 1}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, active ? styles.stepLabelActive : null]}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function BasicsStep({ draft, onChange, teams, workspaces }: BasicsStepProps) {
  function updateName(name: string) {
    onChange({ key: draft.key || keyFromName(name), name });
  }

  return (
    <SectionCard
      description="Start with the required identity for this project. You can refine budget, client, and location later."
      icon={<BriefcaseBusiness color={colors.foreground} size={18} strokeWidth={2.6} />}
      title="Project basics"
    >
      <Field
        autoCapitalize="words"
        helperText="Use a clear delivery name your team will recognize."
        label="Project name"
        onChangeText={updateName}
        placeholder="Client delivery program"
        value={draft.name}
      />
      <Field
        autoCapitalize="characters"
        helperText="Short code used in project and task references."
        label="Project key"
        onChangeText={(value) => onChange({ key: value.replace(/[^a-z0-9-]/gi, "").toUpperCase().slice(0, 12) })}
        placeholder="TB"
        value={draft.key}
      />
      <Field
        helperText="Optional, but useful for scope and handoff context."
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
    </SectionCard>
  );
}

function PlanStep({ draft, onChange, onOpenDatePicker }: PlanStepProps) {
  return (
    <SectionCard
      description="Set the operating state and timeline. Date fields include quick helpers and a calendar picker."
      icon={<CalendarDays color={colors.foreground} size={18} strokeWidth={2.6} />}
      title="Schedule and access"
    >
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
      <ProjectDateField
        label="Start date"
        onClear={() => onChange({ startDate: "" })}
        onPress={() => onOpenDatePicker({ field: "startDate", title: "Start date" })}
        placeholder="Set start date"
        value={draft.startDate}
      />
      <ProjectDateField
        label="Due date"
        onClear={() => onChange({ dueDate: "" })}
        onPress={() => onOpenDatePicker({ field: "dueDate", title: "Due date" })}
        placeholder="Set due date"
        value={draft.dueDate}
      />
      <ProgressSelector value={draft.progress} onChange={(progress) => onChange({ progress })} />
    </SectionCard>
  );
}

function DetailsStep({ draft, onChange }: StepProps) {
  return (
    <SectionCard
      description="Add commercial and client context when it is available. These fields are optional."
      icon={<CircleDollarSign color={colors.foreground} size={18} strokeWidth={2.6} />}
      title="Optional details"
    >
      <Field
        autoCapitalize="characters"
        helperText="ISO currency code, for example USD."
        label="Currency"
        onChangeText={(currency) => onChange({ currency: currency.toUpperCase().slice(0, 3) })}
        placeholder="USD"
        value={draft.currency}
      />
      <Field
        keyboardType="decimal-pad"
        label="Contract value"
        onChangeText={(contractValue) => onChange({ contractValue: contractValue.replace(/[^0-9.]/g, "") })}
        placeholder="125000"
        value={draft.contractValue}
      />
      <Field label="Client name" onChangeText={(clientName) => onChange({ clientName })} placeholder="Acme Corporation" value={draft.clientName} />
      <Field
        keyboardType="email-address"
        label="Client email"
        onChangeText={(clientEmail) => onChange({ clientEmail })}
        placeholder="stakeholder@acme.com"
        value={draft.clientEmail}
      />
      <Field label="City" onChangeText={(city) => onChange({ city })} placeholder="Chicago" value={draft.city} />
      <Field label="Country" onChangeText={(country) => onChange({ country })} placeholder="US" value={draft.country} />
    </SectionCard>
  );
}

function SectionCard({ children, description, icon, title }: { children: ReactNode; description: string; icon: ReactNode; title: string }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>{icon}</View>
        <View style={styles.sectionText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ProgressSelector({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const options = ["0", "25", "50", "75", "100"];
  return (
    <View style={styles.progressWrap}>
      <Text style={styles.fieldLabel}>Progress</Text>
      <View style={styles.progressOptions}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <Pressable accessibilityRole="button" key={option} onPress={() => onChange(option)} style={[styles.progressOption, selected ? styles.progressOptionActive : null]}>
              <Text style={[styles.progressOptionText, selected ? styles.progressOptionTextActive : null]}>{option}%</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function keyFromName(name: string) {
  return name
    .trim()
    .replace(/[^a-z0-9\s-]/gi, "")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 8);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  clearDateButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  dateField: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
  },
  dateFieldWrap: {
    gap: 8,
  },
  dateHint: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  dateIcon: {
    alignItems: "center",
    backgroundColor: colors.yellowSoft,
    borderRadius: 16,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  datePickerBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  datePickerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  datePickerSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    gap: 18,
    padding: 20,
    paddingBottom: 28,
    ...shadow.heavy,
  },
  datePickerTitle: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
  },
  datePlaceholder: {
    color: colors.inkSoft,
  },
  dateTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  dateValue: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  dayButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  dayButtonSelected: {
    backgroundColor: colors.primary,
  },
  dayButtonToday: {
    borderColor: colors.accent,
    borderWidth: 1,
  },
  dayCell: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: "14.285%",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "800",
  },
  dayTextSelected: {
    color: colors.black,
    fontWeight: "900",
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: 14,
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
  fieldLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 16,
  },
  formContent: {
    paddingBottom: 4,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    marginBottom: 18,
    width: 42,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    padding: 18,
  },
  monthButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  monthHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
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
  progressOption: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  progressOptionActive: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.primary,
  },
  progressOptions: {
    flexDirection: "row",
    gap: 8,
  },
  progressOptionText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  progressOptionTextActive: {
    color: colors.foreground,
  },
  progressWrap: {
    gap: 8,
  },
  quickDate: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickDates: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickDateText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16,16,15,0.34)",
  },
  secondaryAction: {
    flex: 0.75,
  },
  sectionBody: {
    gap: 18,
  },
  sectionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 20,
    padding: 20,
    ...shadow.card,
  },
  sectionDescription: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  sectionIcon: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 16,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  sectionText: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    maxHeight: "94%",
    padding: 22,
    paddingBottom: 24,
    ...shadow.heavy,
  },
  stepCircle: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  stepCircleComplete: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
    gap: 7,
  },
  stepLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
  },
  stepLabelActive: {
    color: colors.foreground,
  },
  stepNumber: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  stepNumberActive: {
    color: colors.black,
  },
  steps: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
    marginTop: 22,
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 32,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  weekRow: {
    flexDirection: "row",
  },
  weekday: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    width: "14.285%",
  },
});
