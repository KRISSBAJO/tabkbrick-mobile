import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
  Bell,
  Blocks,
  ChartBar,
  ClipboardCheck,
  ChevronRight,
  Code2,
  HelpCircle,
  LogOut,
  PlugZap,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCircle,
  UsersRound,
} from "lucide-react-native";
import { getUnreadNotificationCount } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";

export default function ProfileScreen() {
  const { accessToken, signOut, user } = useAuthSession();
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    try {
      const unread = await getUnreadNotificationCount(accessToken);
      setUnreadCount(unread.total);
    } catch {
      setUnreadCount(0);
    } finally {
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim().toUpperCase()
    || user.email.slice(0, 2).toUpperCase();
  const avatarBg = avatarColor(name);
  const canManageAi = hasAiManagerAccess(user);
  const workspaceMail = user.internalEmail ?? user.internalMailbox?.address ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void load(true)} refreshing={refreshing} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── HERO PROFILE CARD ───────────────────────────────── */}
        <View style={styles.heroCard}>

          {/* Top row: brand mark + admin badge */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroMark}>
              <Blocks color={colors.black} size={16} strokeWidth={2.8} />
            </View>
            <Text style={styles.heroEyebrow}>Account</Text>
            {user.isPlatformAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>

          {/* Avatar + identity */}
          <View style={styles.heroIdentity}>
            <View style={[styles.heroAvatar, { backgroundColor: avatarBg }]}>
              <Text style={styles.heroInitials}>{initials}</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text numberOfLines={1} style={styles.heroName}>{name}</Text>
              <Text numberOfLines={1} style={styles.heroWorkspaceMail}>{workspaceMail ?? "Creating workspace mail..."}</Text>
              <Text numberOfLines={1} style={styles.heroEmail}>Login: {user.email}</Text>
            </View>
          </View>

          {/* Role pills */}
          {user.roles.length > 0 && (
            <View style={styles.rolePills}>
              {user.roles.slice(0, 4).map((role) => (
                <View key={role} style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{role}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            <StatCell label="Roles" value={user.roles.length} />
            <View style={styles.statsDivider} />
            <StatCell label="Permissions" value={user.permissions.length} />
            <View style={styles.statsDivider} />
            <StatCell label="Status" value={user.isPlatformAdmin ? "Platform" : "Active"} />
          </View>
        </View>

        {/* ─── NOTIFICATIONS ───────────────────────────────────── */}
        <Section title="Notifications">
          <SettingsRow
            badge={unreadCount > 0 ? String(unreadCount) : undefined}
            icon={Bell}
            iconTint={colors.blueSoft}
            iconColor={colors.accent}
            label="Notification center"
            onPress={() => router.push("/(workspace)/notifications")}
            subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          />
          <SettingsRow
            icon={SlidersHorizontal}
            iconTint={colors.blueSoft}
            iconColor={colors.accent}
            label="Notification settings"
            onPress={() => router.push("/(workspace)/notification-settings")}
            subtitle="Email, push, SMS, webhook"
          />
        </Section>

        {/* ─── WORKSPACES ──────────────────────────────────────── */}
        <Section title="Workspaces">
          <SettingsRow
            icon={ClipboardCheck}
            iconTint={colors.blueSoft}
            iconColor={colors.accent}
            label="Approval Center"
            onPress={() => router.push("/(workspace)/approvals")}
            subtitle="Pending decisions, approval routes, history"
          />
          <SettingsRow
            icon={ChartBar}
            iconTint={colors.blueSoft}
            iconColor={colors.accent}
            label="Reports"
            onPress={() => router.push("/(workspace)/reports")}
            subtitle="Dashboards, analytics, saved reports"
          />
          <SettingsRow
            icon={UsersRound}
            iconTint={colors.blueSoft}
            iconColor={colors.accent}
            label="Team management"
            onPress={() => router.push("/(workspace)/team")}
            subtitle="Teams, members, invites, roles"
          />
          <SettingsRow
            icon={Blocks}
            iconTint={colors.greenSoft}
            iconColor={colors.success}
            label="Your workspaces"
            onPress={() => router.push("/(workspace)/account-workspaces")}
            subtitle="Switch or manage workspaces"
          />
          <SettingsRow
            icon={UserCircle}
            iconTint={colors.greenSoft}
            iconColor={colors.success}
            label="Guest workspaces"
            onPress={() => router.push("/(workspace)/guest-workspaces")}
            subtitle="Spaces you've been invited to"
          />
        </Section>

        {/* ─── SECURITY & TOOLS ────────────────────────────────── */}
        <Section title="Security & tools">
          <SettingsRow
            icon={Sparkles}
            iconTint={colors.yellowSoft}
            iconColor={colors.primaryDark}
            label="AI assistant"
            onPress={() => router.push("/(workspace)/ai")}
            subtitle="Workspace intelligence and recommendations"
          />
          <SettingsRow
            badge={canManageAi ? "Owner" : undefined}
            icon={Sparkles}
            iconTint={colors.yellowSoft}
            iconColor={colors.primaryDark}
            label="AI settings"
            onPress={() => {
              if (canManageAi) {
                router.push({ pathname: "/(workspace)/ai", params: { view: "settings" } });
                return;
              }
              Alert.alert("AI settings", "Only tenant owners or AI managers can change workspace AI settings.");
            }}
            subtitle={canManageAi ? "Enable AI, provider, model, limits" : "Tenant owner access required"}
          />
          <SettingsRow
            icon={ShieldCheck}
            iconTint={colors.yellowSoft}
            iconColor={colors.primaryDark}
            label="Security center"
            onPress={() => router.push("/(workspace)/security-center")}
            subtitle="Password, MFA, login history, devices"
          />
          <SettingsRow
            icon={PlugZap}
            iconTint={colors.blueSoft}
            iconColor={colors.accent}
            label="Integrations"
            onPress={() => router.push("/(workspace)/integrations")}
            subtitle="Connected providers, sync, secrets, logs"
          />
          <SettingsRow
            icon={Code2}
            iconTint={colors.orangeSoft}
            iconColor={colors.warning}
            label="Developer tools"
            onPress={() => router.push("/(workspace)/developer-tools")}
            subtitle="API keys, base URL, diagnostics"
          />
          <SettingsRow
            icon={HelpCircle}
            iconTint={colors.blueSoft}
            iconColor={colors.accent}
            label="Help and support"
            onPress={() => router.push("/(workspace)/help-support")}
            subtitle="Documentation and support"
          />
          <SettingsRow
            icon={Sparkles}
            iconTint={colors.yellowSoft}
            iconColor={colors.primaryDark}
            label="Beta features"
            onPress={() => notifyLater("Beta features")}
            subtitle="Early mobile capabilities"
          />
        </Section>

        {/* ─── SIGN OUT ────────────────────────────────────────── */}
        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.signOutBtn, pressed ? styles.signOutBtnPressed : null]}
        >
          <View style={styles.signOutIconBox}>
            <LogOut color={colors.danger} size={18} strokeWidth={2.5} />
          </View>
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>

        {/* ─── VERSION ─────────────────────────────────────────── */}
        <View style={styles.versionRow}>
          <View style={styles.versionMark}>
            <Blocks color={colors.black} size={13} strokeWidth={2.8} />
          </View>
          <Text style={styles.versionText}>TaskBricks · Expo SDK 54</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── StatCell ────────────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ─── SettingsRow ─────────────────────────────────────────────────────────────

function SettingsRow({
  badge,
  icon: Icon,
  iconColor,
  iconTint,
  label,
  onPress,
  subtitle,
}: {
  badge?: string;
  icon: LucideIcon;
  iconColor: string;
  iconTint: string;
  label: string;
  onPress: () => void;
  subtitle?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <View style={[styles.rowIconBox, { backgroundColor: iconTint }]}>
        <Icon color={iconColor} size={18} strokeWidth={2.4} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <ChevronRight color={colors.line} size={17} strokeWidth={2.5} />
    </Pressable>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function notifyLater(label: string) {
  Alert.alert(label, "This will be wired up as the mobile surface grows.");
}

function hasAiManagerAccess(user: { isPlatformAdmin?: boolean; permissions?: string[]; roles?: string[] }) {
  if (user.isPlatformAdmin) return true;
  const permissions = new Set(user.permissions ?? []);
  if (permissions.has("manage:ai") || permissions.has("manage:all")) return true;
  return (user.roles ?? []).some((role) => /owner|admin/i.test(role));
}

const avatarPalette = [
  "#2563eb", "#059669", "#d97706", "#7c3aed",
  "#be185d", "#0891b2", "#16a34a", "#dc2626",
];

function avatarColor(name: string): string {
  const index = (name.charCodeAt(0) + (name.charCodeAt(1) ?? 0)) % avatarPalette.length;
  return avatarPalette[index] ?? "#2563eb";
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create(withFontStyles({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: 18,
    paddingBottom: 130,
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  // ── Hero card ──
  heroCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 14,
    overflow: "hidden",
    padding: 18,
    ...shadow.card,
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  heroMark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  heroEyebrow: {
    color: colors.inkSoft,
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  adminBadge: {
    backgroundColor: colors.yellowSoft,
    borderColor: "#f4d24a",
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  adminBadgeText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  heroIdentity: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
  },
  heroAvatar: {
    alignItems: "center",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  heroInitials: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "900",
  },
  heroCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  heroName: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroEmail: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  heroWorkspaceMail: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  rolePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  rolePill: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  rolePillText: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "capitalize",
  },

  // ── Stats strip ──
  statsStrip: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  statCell: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    paddingVertical: 14,
  },
  statsDivider: {
    backgroundColor: colors.line,
    width: 1,
  },
  statValue: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statLabel: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // ── Sections ──
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginLeft: 4,
    textTransform: "uppercase",
  },
  sectionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    overflow: "hidden",
    ...shadow.card,
  },

  // ── Settings row ──
  row: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: colors.panelMuted,
  },
  rowIconBox: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rowText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowLabel: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  rowSub: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  unreadBadge: {
    backgroundColor: colors.accent,
    borderRadius: 99,
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },

  // ── Sign out ──
  signOutBtn: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: "#fecaca",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    ...shadow.card,
  },
  signOutBtnPressed: {
    backgroundColor: colors.redSoft,
  },
  signOutIconBox: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  signOutLabel: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "900",
  },

  // ── Version ──
  versionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingBottom: 8,
    paddingTop: 4,
  },
  versionMark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 7,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  versionText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
}));
