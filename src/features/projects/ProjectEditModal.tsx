import { useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Check, CircleDollarSign, X } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ProjectDateField, ProjectDatePickerSheet } from "@/features/projects/ProjectDatePicker";
import { type ProjectDraft } from "@/features/projects/ProjectForm";
import { ProjectSelector } from "@/features/projects/ProjectSelector";
import { humanize, projectStatuses, projectVisibilities } from "@/features/projects/projectFormat";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Team, Workspace } from "@/lib/types";

type ProjectEditModalProps = {
  draft: ProjectDraft;
  error?: string;
  onChange: (draft: ProjectDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  teams: Team[];
  visible: boolean;
  workspaces: Workspace[];
};

type DateFieldKey = "dueDate" | "startDate";
type DatePickerState = { field: DateFieldKey; title: string } | null;

const noTeam = "__none__";
const steps = [
  { label: "Basics", title: "Identity and access" },
  { label: "Schedule", title: "Timeline and progress" },
  { label: "Details", title: "Commercial and client context" },
] as const;

export function ProjectEditModal({ draft, error, onChange, onClose, onSubmit, saving, teams, visible, workspaces }: ProjectEditModalProps) {
  const [datePicker, setDatePicker] = useState<DatePickerState>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setDatePicker(null);
    setStep(0);
  }, [visible]);

  function patch(next: Partial<ProjectDraft>) {
    onChange({ ...draft, ...next });
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
              <Text style={styles.eyebrow}>Edit project</Text>
              <Text style={styles.title}>{draft.name || "Project"}</Text>
              <Text style={styles.subtitle}>{steps[step]?.title ?? steps[0].title}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          <StepIndicator currentStep={step} />

          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {step === 0 ? <BasicsStep draft={draft} onChange={patch} teams={teams} workspaces={workspaces} /> : null}
            {step === 1 ? <ScheduleStep draft={draft} onChange={patch} onOpenDatePicker={setDatePicker} /> : null}
            {step === 2 ? <DetailsStep draft={draft} onChange={patch} /> : null}
          </ScrollView>

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
                onPress={() => setStep((current) => Math.max(current - 1, 0))}
                style={styles.secondaryAction}
                variant="outline"
              />
            ) : null}
            <Button
              label={step === steps.length - 1 ? "Save changes" : "Continue"}
              loading={saving}
              onPress={step === steps.length - 1 ? onSubmit : () => setStep((current) => Math.min(current + 1, steps.length - 1))}
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

type ScheduleStepProps = StepProps & {
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
  return (
    <SectionCard
      description="Update the project identity, ownership, and visibility without leaving the project workspace."
      icon={<BriefcaseBusiness color={colors.foreground} size={18} strokeWidth={2.6} />}
      title="Project basics"
    >
      <Field label="Project name" onChangeText={(name) => onChange({ name })} placeholder="Client delivery program" value={draft.name} />
      <Field
        label="Description"
        multiline
        onChangeText={(description) => onChange({ description })}
        placeholder="Scope, outcome, and delivery notes"
        value={draft.description}
      />
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
      {workspaces.length ? (
        <ProjectSelector
          label="Workspace"
          onChange={(workspaceId) => onChange({ workspaceId })}
          options={workspaces.map((workspace) => ({ label: workspace.name, value: workspace.id }))}
          value={draft.workspaceId}
        />
      ) : null}
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

function ScheduleStep({ draft, onChange, onOpenDatePicker }: ScheduleStepProps) {
  return (
    <SectionCard
      description="Keep delivery dates and completion signal current for planning and reporting."
      icon={<CalendarDays color={colors.foreground} size={18} strokeWidth={2.6} />}
      title="Schedule"
    >
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
      description="Use these fields when client, commercial, or location details matter to the delivery record."
      icon={<CircleDollarSign color={colors.foreground} size={18} strokeWidth={2.6} />}
      title="Project details"
    >
      <Field
        autoCapitalize="characters"
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
      <Field label="Billing code" onChangeText={(billingCode) => onChange({ billingCode })} placeholder="TB-2026-001" value={draft.billingCode} />
      <Field label="Cost center" onChangeText={(costCenter) => onChange({ costCenter })} placeholder="DELIVERY-US" value={draft.costCenter} />
      <Field label="Client name" onChangeText={(clientName) => onChange({ clientName })} placeholder="Acme Corporation" value={draft.clientName} />
      <Field
        keyboardType="email-address"
        label="Client email"
        onChangeText={(clientEmail) => onChange({ clientEmail })}
        placeholder="stakeholder@acme.com"
        value={draft.clientEmail}
      />
      <Field label="Client phone" onChangeText={(clientPhone) => onChange({ clientPhone })} placeholder="+1 555 0100" value={draft.clientPhone} />
      <Field label="Location" onChangeText={(locationName) => onChange({ locationName })} placeholder="Delivery office" value={draft.locationName} />
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
    justifyContent: "center",
    minHeight: 42,
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
});
