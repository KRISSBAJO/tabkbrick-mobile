import { CalendarDays, CircleDollarSign, ClipboardList, MapPin, UsersRound } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { Field } from "@/components/ui/Field";
import { ProjectSelector } from "@/features/projects/ProjectSelector";
import { humanize, projectStatuses, projectVisibilities, type ProjectStatus, type ProjectVisibility } from "@/features/projects/projectFormat";
import { colors, radii } from "@/lib/theme/tokens";
import type { Team, Workspace } from "@/lib/types";

export type ProjectDraft = {
  billingCode: string;
  city: string;
  clientEmail: string;
  clientName: string;
  clientPhone: string;
  contractValue: string;
  costCenter: string;
  country: string;
  currency: string;
  description: string;
  dueDate: string;
  key: string;
  locationName: string;
  name: string;
  progress: string;
  startDate: string;
  status: ProjectStatus;
  teamId: string;
  visibility: ProjectVisibility;
  workspaceId: string;
};

type ProjectFormProps = {
  draft: ProjectDraft;
  mode: "create" | "edit";
  onChange: (draft: ProjectDraft) => void;
  teams: Team[];
  workspaces: Workspace[];
};

const noTeam = "__none__";

export function ProjectForm({ draft, mode, onChange, teams, workspaces }: ProjectFormProps) {
  function patch(next: Partial<ProjectDraft>) {
    onChange({ ...draft, ...next });
  }

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ClipboardList color={colors.foreground} size={18} />
          <Text style={styles.sectionTitle}>Core details</Text>
        </View>
        {mode === "create" ? (
          <Field
            autoCapitalize="characters"
            label="Project key"
            onChangeText={(value) => patch({ key: value.replace(/[^a-z0-9-]/gi, "").toUpperCase().slice(0, 12) })}
            placeholder="TB"
            value={draft.key}
          />
        ) : null}
        <Field label="Project name" onChangeText={(name) => patch({ name })} placeholder="Client delivery program" value={draft.name} />
        <Field
          label="Description"
          multiline
          onChangeText={(description) => patch({ description })}
          placeholder="Scope, outcome, and delivery notes"
          value={draft.description}
        />
        <ProjectSelector
          label="Status"
          onChange={(status) => patch({ status })}
          options={projectStatuses.map((status) => ({ label: humanize(status), value: status }))}
          value={draft.status}
        />
        <ProjectSelector
          label="Visibility"
          onChange={(visibility) => patch({ visibility })}
          options={projectVisibilities.map((visibility) => ({ label: humanize(visibility), value: visibility }))}
          value={draft.visibility}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <UsersRound color={colors.foreground} size={18} />
          <Text style={styles.sectionTitle}>Workspace</Text>
        </View>
        {workspaces.length ? (
          <ProjectSelector
            label="Workspace"
            onChange={(workspaceId) => patch({ workspaceId })}
            options={workspaces.map((workspace) => ({ label: workspace.name, value: workspace.id }))}
            value={draft.workspaceId}
          />
        ) : (
          <Text style={styles.muted}>No workspaces were returned by the API.</Text>
        )}
        {teams.length ? (
          <ProjectSelector
            label="Team"
            onChange={(teamId) => patch({ teamId: teamId === noTeam ? "" : teamId })}
            options={[{ label: "No team", value: noTeam }, ...teams.map((team) => ({ label: team.name, value: team.id }))]}
            value={draft.teamId || noTeam}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <CalendarDays color={colors.foreground} size={18} />
          <Text style={styles.sectionTitle}>Schedule</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="Start date" onChangeText={(startDate) => patch({ startDate })} placeholder="2026-07-01" value={draft.startDate} />
          </View>
          <View style={styles.flex}>
            <Field label="Due date" onChangeText={(dueDate) => patch({ dueDate })} placeholder="2026-09-30" value={draft.dueDate} />
          </View>
        </View>
        <Field
          keyboardType="number-pad"
          label="Progress"
          onChangeText={(progress) => patch({ progress: progress.replace(/[^0-9]/g, "").slice(0, 3) })}
          placeholder="0"
          value={draft.progress}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <CircleDollarSign color={colors.foreground} size={18} />
          <Text style={styles.sectionTitle}>Commercials</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.currency}>
            <Field
              autoCapitalize="characters"
              label="Currency"
              onChangeText={(currency) => patch({ currency: currency.toUpperCase().slice(0, 3) })}
              placeholder="USD"
              value={draft.currency}
            />
          </View>
          <View style={styles.flex}>
            <Field
              keyboardType="decimal-pad"
              label="Contract value"
              onChangeText={(contractValue) => patch({ contractValue: contractValue.replace(/[^0-9.]/g, "") })}
              placeholder="125000"
              value={draft.contractValue}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="Billing code" onChangeText={(billingCode) => patch({ billingCode })} placeholder="TB-2026-001" value={draft.billingCode} />
          </View>
          <View style={styles.flex}>
            <Field label="Cost center" onChangeText={(costCenter) => patch({ costCenter })} placeholder="DELIVERY-US" value={draft.costCenter} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <UsersRound color={colors.foreground} size={18} />
          <Text style={styles.sectionTitle}>Client</Text>
        </View>
        <Field label="Client name" onChangeText={(clientName) => patch({ clientName })} placeholder="Acme Corporation" value={draft.clientName} />
        <Field
          keyboardType="email-address"
          label="Client email"
          onChangeText={(clientEmail) => patch({ clientEmail })}
          placeholder="stakeholder@acme.com"
          value={draft.clientEmail}
        />
        <Field label="Client phone" onChangeText={(clientPhone) => patch({ clientPhone })} placeholder="+1 555 0100" value={draft.clientPhone} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MapPin color={colors.foreground} size={18} />
          <Text style={styles.sectionTitle}>Location</Text>
        </View>
        <Field label="Location" onChangeText={(locationName) => patch({ locationName })} placeholder="Delivery office" value={draft.locationName} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="City" onChangeText={(city) => patch({ city })} placeholder="Chicago" value={draft.city} />
          </View>
          <View style={styles.flex}>
            <Field label="Country" onChangeText={(country) => patch({ country })} placeholder="US" value={draft.country} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function createEmptyProjectDraft(workspaceId = ""): ProjectDraft {
  return {
    billingCode: "",
    city: "",
    clientEmail: "",
    clientName: "",
    clientPhone: "",
    contractValue: "",
    costCenter: "",
    country: "",
    currency: "USD",
    description: "",
    dueDate: "",
    key: "",
    locationName: "",
    name: "",
    progress: "0",
    startDate: "",
    status: "PLANNING",
    teamId: "",
    visibility: "WORKSPACE",
    workspaceId,
  };
}

const styles = StyleSheet.create({
  currency: {
    width: 96,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  section: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  stack: {
    gap: 14,
  },
});
