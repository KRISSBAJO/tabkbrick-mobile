import type { ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
  Bell,
  Boxes,
  ChevronRight,
  Code2,
  HelpCircle,
  LogOut,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCircle,
} from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";

export default function ProfileScreen() {
  const { signOut, user } = useAuthSession();

  if (!user) return null;

  const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim() || user.email.slice(0, 2).toUpperCase();

  return (
    <Screen>
      <Text style={styles.screenTitle}>Account</Text>

      <View style={styles.accountCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.identity}>
          <Text numberOfLines={1} style={styles.name}>{name}</Text>
          <Text numberOfLines={1} style={styles.email}>{user.email}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)/projects/new")} style={styles.plusButton}>
          <Plus color={colors.black} size={19} strokeWidth={2.8} />
        </Pressable>
      </View>

      <View style={styles.rolePills}>
        {user.roles.slice(0, 3).map((role) => <StatusPill key={role} label={role} tone="yellow" />)}
        {user.isPlatformAdmin ? <StatusPill label="Platform admin" tone="red" /> : null}
      </View>

      <Section title="Workspaces">
        <SettingsRow icon={Boxes} label="Your workspaces" onPress={() => router.push("/(workspace)/projects")} />
        <SettingsRow icon={UserCircle} label="Guest workspaces" />
      </Section>

      <Section title="Settings and tools">
        <SettingsRow icon={SlidersHorizontal} label="App settings" subtitle="Theme, language, notifications" />
        <SettingsRow icon={Bell} label="Sync queue" subtitle="Queued updates and retries" />
        <SettingsRow icon={Code2} label="Developer tools" subtitle="API and diagnostics" />
        <SettingsRow icon={HelpCircle} label="About and help" subtitle="Support and documentation" />
        <SettingsRow icon={ShieldCheck} label="Manage account" subtitle={`${user.permissions.length} permissions`} />
        <SettingsRow icon={Sparkles} label="Join beta testing" subtitle="Early mobile features" />
        <SettingsRow danger icon={LogOut} label="Log out" onPress={() => void signOut()} />
      </Section>

      <Text style={styles.version}>Mobile build: Expo SDK 54</Text>
    </Screen>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRow({
  danger = false,
  icon: Icon,
  label,
  onPress,
  subtitle,
}: {
  danger?: boolean;
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  subtitle?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => Alert.alert(label, "This mobile setting will be wired in a later feature pass."))}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <View style={[styles.rowIcon, danger ? styles.rowIconDanger : null]}>
        <Icon color={danger ? colors.danger : colors.primaryDark} size={18} strokeWidth={2.4} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger ? styles.rowLabelDanger : null]}>{label}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {!danger ? <ChevronRight color={colors.inkSoft} size={18} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16,
    ...shadow.card,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: 24,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  avatarText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "900",
  },
  email: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
  },
  plusButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  rolePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: -8,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowIcon: {
    alignItems: "center",
    backgroundColor: colors.yellowSoft,
    borderRadius: radii.md,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  rowIconDanger: {
    backgroundColor: colors.redSoft,
  },
  rowLabel: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  rowLabelDanger: {
    color: colors.danger,
  },
  rowPressed: {
    backgroundColor: colors.muted,
  },
  rowSubtitle: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  screenTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  sectionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    overflow: "hidden",
    ...shadow.card,
  },
  sectionTitle: {
    color: colors.inkSoft,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionWrap: {
    gap: 0,
  },
  version: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
});
