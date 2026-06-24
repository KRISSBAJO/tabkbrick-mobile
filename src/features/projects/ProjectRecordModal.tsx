import { useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ProjectDateField, ProjectDatePickerSheet } from "@/features/projects/ProjectDatePicker";
import { ProjectSelector } from "@/features/projects/ProjectSelector";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";

export type ProjectRecordKind =
  | "budget"
  | "changeRequest"
  | "decision"
  | "dependency"
  | "milestone"
  | "risk"
  | "stakeholder";

export type ProjectRecordValues = Record<string, string>;

type ProjectRecordModalProps = {
  initialValues?: ProjectRecordValues;
  kind: ProjectRecordKind | null;
  mode?: "create" | "edit";
  onClose: () => void;
  onSubmit: (kind: ProjectRecordKind, values: ProjectRecordValues) => Promise<void>;
  visible: boolean;
};

type ActiveDatePicker = { field: "dueDate"; title: string };

const titles: Record<ProjectRecordKind, string> = {
  budget: "Budget",
  changeRequest: "Change request",
  decision: "Decision",
  dependency: "Dependency",
  milestone: "Milestone",
  risk: "Risk",
  stakeholder: "Stakeholder",
};

const subtitles: Record<ProjectRecordKind, string> = {
  budget: "Track planned and actual spend for this project.",
  changeRequest: "Capture scope, budget, or schedule changes before approval.",
  decision: "Document the decision, owner, and outcome.",
  dependency: "Track external blockers, owners, and due dates.",
  milestone: "Add a date-based delivery checkpoint.",
  risk: "Record the risk, severity, and mitigation plan.",
  stakeholder: "Add a sponsor, client, partner, or external owner.",
};

export function ProjectRecordModal({ initialValues, kind, mode = "create", onClose, onSubmit, visible }: ProjectRecordModalProps) {
  const [datePicker, setDatePicker] = useState<ActiveDatePicker | null>(null);
  const [values, setValues] = useState<ProjectRecordValues>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setDatePicker(null);
      setValues({ ...defaultValues(kind), ...initialValues });
      setError("");
      setSaving(false);
    }
  }, [initialValues, kind, visible]);

  function patch(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (!kind) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit(kind, values);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save item.");
    } finally {
      setSaving(false);
    }
  }

  if (!kind) return null;

  return (
    <>
      <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.scrim} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.titleWrap}>
                <Text style={styles.eyebrow}>Project record</Text>
                <Text style={styles.title}>{mode === "edit" ? "Edit" : "Add"} {titles[kind].toLowerCase()}</Text>
                <Text style={styles.subtitle}>{subtitles[kind]}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
                <X color={colors.foreground} size={20} strokeWidth={2.8} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <RecordSection title={`${titles[kind]} details`}>
                <RecordFields
                  kind={kind}
                  onChange={patch}
                  onOpenDatePicker={setDatePicker}
                  values={values}
                />
              </RecordSection>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              <Button label="Cancel" onPress={onClose} style={styles.secondaryAction} variant="outline" />
              <Button label={mode === "edit" ? "Save changes" : "Save item"} loading={saving} onPress={submit} style={styles.primaryAction} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ProjectDatePickerSheet
        onClose={() => setDatePicker(null)}
        onSelect={(value) => {
          if (!datePicker) return;
          patch(datePicker.field, value);
          setDatePicker(null);
        }}
        title={datePicker?.title ?? ""}
        value={datePicker ? values[datePicker.field] ?? "" : ""}
        visible={Boolean(datePicker)}
      />
    </>
  );
}

function RecordFields({
  kind,
  onChange,
  onOpenDatePicker,
  values,
}: {
  kind: ProjectRecordKind;
  onChange: (key: string, value: string) => void;
  onOpenDatePicker: (picker: ActiveDatePicker) => void;
  values: ProjectRecordValues;
}) {
  if (kind === "budget") {
    return (
      <>
        <Field
          autoCapitalize="characters"
          helperText="Use a three-letter ISO code."
          label="Currency"
          onChangeText={(value) => onChange("currency", value.toUpperCase().slice(0, 3))}
          placeholder="USD"
          value={values.currency}
        />
        <View style={styles.fieldGrid}>
          <View style={styles.flex}>
            <Field
              keyboardType="decimal-pad"
              label="Planned"
              onChangeText={(value) => onChange("planned", numberText(value))}
              placeholder="100000"
              value={values.planned}
            />
          </View>
          <View style={styles.flex}>
            <Field
              keyboardType="decimal-pad"
              label="Actual"
              onChangeText={(value) => onChange("actual", numberText(value))}
              placeholder="25000"
              value={values.actual}
            />
          </View>
        </View>
        <Field label="Notes" multiline onChangeText={(value) => onChange("notes", value)} placeholder="Budget context, assumptions, or approval notes" value={values.notes} />
      </>
    );
  }

  if (kind === "stakeholder") {
    return (
      <>
        <Field label="Name" onChangeText={(value) => onChange("name", value)} placeholder="Sarah Johnson" value={values.name} />
        <Field label="Role" onChangeText={(value) => onChange("role", value)} placeholder="Executive sponsor" value={values.role} />
        <Field keyboardType="email-address" label="Email" onChangeText={(value) => onChange("email", value)} placeholder="sarah@acme.com" value={values.email} />
        <Field label="Organization" onChangeText={(value) => onChange("organization", value)} placeholder="Acme Corporation" value={values.organization} />
        <ProjectSelector
          label="Influence"
          onChange={(value) => onChange("influence", value)}
          options={["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({ label: humanOption(value), value }))}
          value={values.influence ?? "MEDIUM"}
        />
        <Field label="Notes" multiline onChangeText={(value) => onChange("notes", value)} placeholder="Relationship notes or follow-up context" value={values.notes} />
      </>
    );
  }

  if (kind === "risk") {
    return (
      <>
        <TitleDescription values={values} onChange={onChange} />
        <ProjectSelector
          label="Severity"
          onChange={(value) => onChange("severity", value)}
          options={["LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"].map((value) => ({ label: humanOption(value), value }))}
          value={values.severity ?? "MEDIUM"}
        />
        <Field label="Mitigation" multiline onChangeText={(value) => onChange("mitigation", value)} placeholder="What reduces or removes this risk?" value={values.mitigation} />
      </>
    );
  }

  if (kind === "dependency") {
    return (
      <>
        <TitleDescription values={values} onChange={onChange} />
        <Field label="Type" onChangeText={(value) => onChange("dependencyType", value)} placeholder="Vendor, legal, data, design" value={values.dependencyType} />
        <ProjectSelector
          label="Status"
          onChange={(value) => onChange("status", value)}
          options={["OPEN", "BLOCKED", "RESOLVED", "CANCELLED"].map((value) => ({ label: humanOption(value), value }))}
          value={values.status ?? "OPEN"}
        />
        <Field label="Owner" onChangeText={(value) => onChange("ownerName", value)} placeholder="Owner name" value={values.ownerName} />
        <ProjectDateField
          label="Due date"
          onClear={() => onChange("dueDate", "")}
          onPress={() => onOpenDatePicker({ field: "dueDate", title: "Dependency due date" })}
          placeholder="Set due date"
          value={values.dueDate ?? ""}
        />
      </>
    );
  }

  if (kind === "decision") {
    return (
      <>
        <TitleDescription values={values} onChange={onChange} />
        <ProjectSelector
          label="Status"
          onChange={(value) => onChange("status", value)}
          options={["PROPOSED", "DECIDED", "SUPERSEDED", "REOPENED"].map((value) => ({ label: humanOption(value), value }))}
          value={values.status ?? "PROPOSED"}
        />
        <Field label="Owner" onChangeText={(value) => onChange("ownerName", value)} placeholder="Decision owner" value={values.ownerName} />
        <Field label="Outcome" multiline onChangeText={(value) => onChange("outcome", value)} placeholder="What was decided and why?" value={values.outcome} />
      </>
    );
  }

  if (kind === "changeRequest") {
    return (
      <>
        <TitleDescription values={values} onChange={onChange} />
        <ProjectSelector
          label="Status"
          onChange={(value) => onChange("status", value)}
          options={["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "IMPLEMENTED", "CANCELLED"].map((value) => ({ label: humanOption(value), value }))}
          value={values.status ?? "DRAFT"}
        />
        <Field label="Reason" multiline onChangeText={(value) => onChange("reason", value)} placeholder="Why this change is needed" value={values.reason} />
        <ProjectDateField
          label="Due date"
          onClear={() => onChange("dueDate", "")}
          onPress={() => onOpenDatePicker({ field: "dueDate", title: "Change request due date" })}
          placeholder="Set target date"
          value={values.dueDate ?? ""}
        />
        <View style={styles.fieldGrid}>
          <View style={styles.flex}>
            <Field
              keyboardType="decimal-pad"
              label="Budget impact"
              onChangeText={(value) => onChange("budgetImpact", numberText(value))}
              placeholder="7500"
              value={values.budgetImpact}
            />
          </View>
          <View style={styles.flex}>
            <Field
              keyboardType="number-pad"
              label="Schedule days"
              onChangeText={(value) => onChange("scheduleImpactDays", value.replace(/[^0-9-]/g, ""))}
              placeholder="5"
              value={values.scheduleImpactDays}
            />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <TitleDescription values={values} onChange={onChange} />
      <ProjectDateField
        label="Due date"
        onClear={() => onChange("dueDate", "")}
        onPress={() => onOpenDatePicker({ field: "dueDate", title: "Milestone due date" })}
        placeholder="Set milestone date"
        value={values.dueDate ?? ""}
      />
    </>
  );
}

function RecordSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.recordSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function TitleDescription({ onChange, values }: { onChange: (key: string, value: string) => void; values: ProjectRecordValues }) {
  return (
    <>
      <Field label="Title" onChangeText={(value) => onChange("title", value)} placeholder="Item title" value={values.title} />
      <Field label="Description" multiline onChangeText={(value) => onChange("description", value)} placeholder="Important details, scope, or context" value={values.description} />
    </>
  );
}

function defaultValues(kind: ProjectRecordKind | null): ProjectRecordValues {
  if (kind === "budget") return { actual: "", currency: "USD", notes: "", planned: "" };
  if (kind === "stakeholder") return { email: "", influence: "MEDIUM", name: "", notes: "", organization: "", role: "" };
  if (kind === "risk") return { description: "", mitigation: "", severity: "MEDIUM", title: "" };
  if (kind === "dependency") return { dependencyType: "", description: "", dueDate: "", ownerName: "", status: "OPEN", title: "" };
  if (kind === "decision") return { description: "", outcome: "", ownerName: "", status: "PROPOSED", title: "" };
  if (kind === "changeRequest") return { budgetImpact: "", description: "", dueDate: "", reason: "", scheduleImpactDays: "", status: "DRAFT", title: "" };
  return { description: "", dueDate: "", title: "" };
}

function humanOption(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function numberText(value: string) {
  return value.replace(/[^0-9.]/g, "");
}

const styles = StyleSheet.create(withFontStyles({
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
  content: {
    gap: 16,
    paddingBottom: 10,
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.lg,
    borderWidth: 1,
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
  fieldGrid: {
    flexDirection: "row",
    gap: 12,
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
    marginBottom: 18,
  },
  primaryAction: {
    flex: 1,
  },
  recordSection: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 18,
    padding: 18,
    ...shadow.card,
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
  sectionTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    maxHeight: "92%",
    padding: 22,
    paddingBottom: 24,
    ...shadow.heavy,
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 3,
  },
  title: {
    color: colors.foreground,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 31,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
}));
