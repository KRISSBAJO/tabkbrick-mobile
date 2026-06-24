import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Bell,
  ChevronLeft,
  Mail,
  MessageSquareText,
  RadioTower,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Webhook,
} from "lucide-react-native";
import { listNotificationPreferences, updateNotificationPreferences } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { NotificationChannel, NotificationPreference } from "@/lib/types";

const channelMeta: Record<NotificationChannel, { description: string; icon: ComponentType<{ color: string; size: number; strokeWidth?: number }>; label: string }> = {
  EMAIL: { description: "Send important updates to your inbox.", icon: Mail, label: "Email" },
  IN_APP: { description: "Always keep workspace alerts inside TaskBricks.", icon: Bell, label: "In-app" },
  PUSH: { description: "Reserved for mobile push once device tokens are enabled.", icon: Smartphone, label: "Push" },
  SMS: { description: "Use for urgent operational alerts when enabled.", icon: MessageSquareText, label: "SMS" },
  WEBHOOK: { description: "Forward notification events to external systems.", icon: Webhook, label: "Webhook" },
};

const channelOrder: NotificationChannel[] = ["IN_APP", "EMAIL", "PUSH", "SMS", "WEBHOOK"];

export function NotificationSettingsScreen() {
  const { accessToken } = useAuthSession();
  const [busyChannel, setBusyChannel] = useState<NotificationChannel | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const enabledCount = useMemo(() => preferences.filter((preference) => preference.enabled).length, [preferences]);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      setPreferences(await listNotificationPreferences(accessToken));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load notification settings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(preference: NotificationPreference) {
    if (!accessToken || preference.locked) return;
    const nextEnabled = !preference.enabled;
    setBusyChannel(preference.channel);
    setError("");
    setPreferences((items) => items.map((item) => (item.channel === preference.channel ? { ...item, enabled: nextEnabled } : item)));

    try {
      const next = await updateNotificationPreferences(accessToken, {
        preferences: [{ channel: preference.channel, enabled: nextEnabled }],
      });
      setPreferences(next);
    } catch (caught) {
      setPreferences((items) => items.map((item) => (item.channel === preference.channel ? preference : item)));
      setError(caught instanceof Error ? caught.message : "Unable to update notification settings.");
    } finally {
      setBusyChannel(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerPanel}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading settings</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerIcon}>
            <ChevronLeft color={colors.foreground} size={22} strokeWidth={2.8} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Notifications</Text>
            <Text style={styles.title}>Settings</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.headerIcon}>
            <RefreshCw color={colors.foreground} size={19} strokeWidth={2.7} />
          </Pressable>
        </View>

        <View style={styles.statusPanel}>
          <View style={styles.statusIcon}>
            <RadioTower color={colors.black} size={24} strokeWidth={2.8} />
          </View>
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>{enabledCount} channels enabled</Text>
            <Text style={styles.statusMeta}>In-app stays locked so critical workspace alerts remain visible.</Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ShieldCheck color={colors.accent} size={18} strokeWidth={2.6} />
            <Text style={styles.sectionTitle}>Delivery channels</Text>
          </View>
          <View style={styles.preferenceList}>
            {channelOrder.map((channel) => {
              const preference = preferences.find((item) => item.channel === channel);
              if (!preference) return null;
              return (
                <PreferenceRow
                  busy={busyChannel === channel}
                  key={channel}
                  onToggle={() => void toggle(preference)}
                  preference={preference}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.notePanel}>
          <Send color={colors.accent} size={18} strokeWidth={2.5} />
          <Text style={styles.noteText}>Push delivery needs a backend device-token endpoint before it can send native phone notifications.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PreferenceRow({
  busy,
  onToggle,
  preference,
}: {
  busy: boolean;
  onToggle: () => void;
  preference: NotificationPreference;
}) {
  const meta = channelMeta[preference.channel];
  const Icon = meta.icon;
  return (
    <View style={styles.preferenceRow}>
      <View style={[styles.preferenceIcon, preference.enabled ? styles.preferenceIconActive : null]}>
        <Icon color={preference.enabled ? colors.black : colors.inkSoft} size={18} strokeWidth={2.6} />
      </View>
      <View style={styles.preferenceText}>
        <View style={styles.preferenceTitleRow}>
          <Text style={styles.preferenceTitle}>{meta.label}</Text>
          {preference.locked ? <Text style={styles.lockedBadge}>Locked</Text> : null}
        </View>
        <Text style={styles.preferenceDescription}>{meta.description}</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : (
        <Switch
          disabled={preference.locked}
          ios_backgroundColor={colors.line}
          onValueChange={onToggle}
          thumbColor={colors.white}
          trackColor={{ false: colors.line, true: colors.primary }}
          value={preference.enabled}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerPanel: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 24,
  },
  content: {
    gap: 20,
    padding: 22,
    paddingBottom: 122,
  },
  errorText: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    padding: 14,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingTop: 8,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
    ...shadow.card,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  loadingText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
  },
  lockedBadge: {
    backgroundColor: colors.blueSoft,
    borderRadius: 999,
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  notePanel: {
    alignItems: "flex-start",
    backgroundColor: colors.blueSoft,
    borderColor: "#d7e6ff",
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 16,
  },
  noteText: {
    color: colors.foreground,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  preferenceDescription: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  preferenceIcon: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 17,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  preferenceIconActive: {
    backgroundColor: colors.primary,
  },
  preferenceList: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    overflow: "hidden",
    ...shadow.card,
  },
  preferenceRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 86,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  preferenceText: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  preferenceTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  preferenceTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
  },
  statusIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 21,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  statusMeta: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  statusPanel: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: 30,
    flexDirection: "row",
    gap: 14,
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 7,
  },
  statusText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  statusTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "900",
  },
  title: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
});
