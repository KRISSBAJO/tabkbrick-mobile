import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { StatusPill } from "@/components/ui/StatusPill";
import { Surface } from "@/components/ui/Surface";
import { WorkspaceHeader } from "@/features/workspace/WorkspaceHeader";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii } from "@/lib/theme/tokens";

export default function ProfileScreen() {
  const { signOut, user } = useAuthSession();

  if (!user) return null;

  const name = `${user.firstName} ${user.lastName}`.trim() || user.email;

  return (
    <Screen>
      <WorkspaceHeader user={user} />
      <Surface eyebrow="Account" title={name}>
        <View style={styles.profile}>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.pills}>
            {user.roles.slice(0, 3).map((role) => <StatusPill key={role} label={role} tone="yellow" />)}
            {user.isPlatformAdmin ? <StatusPill label="Platform admin" tone="red" /> : null}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Tenant</Text>
            <Text numberOfLines={1} style={styles.metaValue}>{user.tenantId}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Permissions</Text>
            <Text style={styles.metaValue}>{user.permissions.length}</Text>
          </View>
          <Button label="Sign out" variant="dark" onPress={() => void signOut()} />
        </View>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
  },
  metaLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  metaRow: {
    backgroundColor: colors.muted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  metaValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  profile: {
    gap: 14,
  },
});
