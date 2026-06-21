import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ProjectSelector } from "@/features/projects/ProjectSelector";
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
  kind: ProjectRecordKind | null;
  onClose: () => void;
  onSubmit: (kind: ProjectRecordKind, values: ProjectRecordValues) => Promise<void>;
  visible: boolean;
};

const titles: Record<ProjectRecordKind, string> = {
  budget: "Add budget",
  changeRequest: "Add change request",
  decision: "Add decision",
  dependency: "Add dependency",
  milestone: "Add milestone",
  risk: "Add risk",
  stakeholder: "Add stakeholder",
};

export function ProjectRecordModal({ kind, onClose, onSubmit, visible }: ProjectRecordModalProps) {
  const [values, setValues] = useState<ProjectRecordValues>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setValues(defaultValues(kind));
      setError("");
    }
  }, [kind, visible]);

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
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{titles[kind]}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <X color={colors.foreground} size={20} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <RecordFields kind={kind} onChange={patch} values={values} />
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <Button label="Save item" loading={saving} onPress={submit} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RecordFields({
  kind,
  onChange,
  values,
}: {
  kind: ProjectRecordKind;
  onChange: (key: string, value: string) => void;
  values: ProjectRecordValues;
}) {
  if (kind === "budget") {
    return (
      <>
        <View style={styles.row}>
          <View style={styles.currency}>
            <Field label="Currency" onChangeText={(value) => onChange("currency", value.toUpperCase().slice(0, 3))} placeholder="USD" value={values.currency} />
          </View>
          <View style={styles.flex}>
            <Field keyboardType="decimal-pad" label="Planned" onChangeText={(value) => onChange("planned", numberText(value))} placeholder="100000" value={values.planned} />
          </View>
        </View>
        <Field keyboardType="decimal-pad" label="Actual" onChangeText={(value) => onChange("actual", numberText(value))} placeholder="25000" value={values.actual} />
        <Field label="Notes" multiline onChangeText={(value) => onChange("notes", value)} placeholder="Budget notes" value={values.notes} />
      </>
    );
  }

  if (kind === "stakeholder") {
    return (
      <>
        <Field label="Name" onChangeText={(value) => onChange("name", value)} placeholder="Sarah Johnson" value={values.name} />
        <Field keyboardType="email-address" label="Email" onChangeText={(value) => onChange("email", value)} placeholder="sarah@acme.com" value={values.email} />
        <Field label="Role" onChangeText={(value) => onChange("role", value)} placeholder="Executive sponsor" value={values.role} />
        <Field label="Organization" onChangeText={(value) => onChange("organization", value)} placeholder="Acme Corporation" value={values.organization} />
        <ProjectSelector
          label="Influence"
          onChange={(value) => onChange("influence", value)}
          options={["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({ label: value, value }))}
          value={values.influence ?? "MEDIUM"}
        />
        <Field label="Notes" multiline onChangeText={(value) => onChange("notes", value)} placeholder="Relationship notes" value={values.notes} />
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
          options={["LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"].map((value) => ({ label: value, value }))}
          value={values.severity ?? "MEDIUM"}
        />
        <Field label="Mitigation" multiline onChangeText={(value) => onChange("mitigation", value)} placeholder="What reduces this risk?" value={values.mitigation} />
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
          options={["OPEN", "BLOCKED", "RESOLVED", "CANCELLED"].map((value) => ({ label: value, value }))}
          value={values.status ?? "OPEN"}
        />
        <Field label="Owner" onChangeText={(value) => onChange("ownerName", value)} placeholder="Owner name" value={values.ownerName} />
        <Field label="Due date" onChangeText={(value) => onChange("dueDate", value)} placeholder="2026-08-01" value={values.dueDate} />
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
          options={["PROPOSED", "DECIDED", "SUPERSEDED", "REOPENED"].map((value) => ({ label: value, value }))}
          value={values.status ?? "PROPOSED"}
        />
        <Field label="Owner" onChangeText={(value) => onChange("ownerName", value)} placeholder="Owner name" value={values.ownerName} />
        <Field label="Outcome" multiline onChangeText={(value) => onChange("outcome", value)} placeholder="Decision outcome" value={values.outcome} />
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
          options={["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "IMPLEMENTED", "CANCELLED"].map((value) => ({ label: value, value }))}
          value={values.status ?? "DRAFT"}
        />
        <Field label="Reason" multiline onChangeText={(value) => onChange("reason", value)} placeholder="Why this change is needed" value={values.reason} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field keyboardType="decimal-pad" label="Budget impact" onChangeText={(value) => onChange("budgetImpact", numberText(value))} placeholder="7500" value={values.budgetImpact} />
          </View>
          <View style={styles.flex}>
            <Field keyboardType="number-pad" label="Days" onChangeText={(value) => onChange("scheduleImpactDays", value.replace(/[^0-9-]/g, ""))} placeholder="5" value={values.scheduleImpactDays} />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <TitleDescription values={values} onChange={onChange} />
      <Field label="Due date" onChangeText={(value) => onChange("dueDate", value)} placeholder="2026-08-01" value={values.dueDate} />
    </>
  );
}

function TitleDescription({ onChange, values }: { onChange: (key: string, value: string) => void; values: ProjectRecordValues }) {
  return (
    <>
      <Field label="Title" onChangeText={(value) => onChange("title", value)} placeholder="Item title" value={values.title} />
      <Field label="Description" multiline onChangeText={(value) => onChange("description", value)} placeholder="Important details" value={values.description} />
    </>
  );
}

function defaultValues(kind: ProjectRecordKind | null): ProjectRecordValues {
  if (kind === "budget") return { actual: "", currency: "USD", notes: "", planned: "" };
  if (kind === "stakeholder") return { email: "", influence: "MEDIUM", name: "", notes: "", organization: "", role: "" };
  if (kind === "risk") return { description: "", mitigation: "", severity: "MEDIUM", title: "" };
  if (kind === "dependency") return { dependencyType: "", description: "", dueDate: "", ownerName: "", status: "OPEN", title: "" };
  if (kind === "decision") return { description: "", outcome: "", ownerName: "", status: "PROPOSED", title: "" };
  if (kind === "changeRequest") return { budgetImpact: "", description: "", reason: "", scheduleImpactDays: "", status: "DRAFT", title: "" };
  return { description: "", dueDate: "", title: "" };
}

function numberText(value: string) {
  return value.replace(/[^0-9.]/g, "");
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(17,17,17,0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  content: {
    gap: 14,
    paddingBottom: 26,
  },
  currency: {
    width: 96,
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "88%",
    padding: 18,
    ...shadow.heavy,
  },
  title: {
    color: colors.foreground,
    flex: 1,
    fontSize: 22,
    fontWeight: "900",
  },
});
