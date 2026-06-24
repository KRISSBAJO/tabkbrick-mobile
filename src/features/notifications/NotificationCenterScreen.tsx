import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  Inbox,
  MailOpen,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
} from "lucide-react-native";
import {
  deleteNotification,
  deleteReadNotifications,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Notification } from "@/lib/types";

type FilterKey = "all" | "unread";

export function NotificationCenterScreen() {
  const { accessToken } = useAuthSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [now] = useState(() => Date.now());

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [page, unread] = await Promise.all([
        listNotifications(accessToken, { limit: 80, page: 1 }),
        getUnreadNotificationCount(accessToken),
      ]);
      setNotifications(page.data);
      setTotal(page.total);
      setUnreadTotal(unread.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return notifications.filter((notification) => {
      if (filter === "unread" && notification.readAt) return false;
      if (!needle) return true;
      return `${notification.title} ${notification.body ?? ""} ${notification.channel}`.toLowerCase().includes(needle);
    });
  }, [filter, notifications, search]);

  async function markAllRead() {
    if (!accessToken || !unreadTotal) return;
    setBusy(true);
    setError("");
    try {
      await markAllNotificationsRead(accessToken);
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnreadTotal(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to mark notifications read.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteRead() {
    if (!accessToken) return;
    Alert.alert("Delete read notifications?", "Unread notifications will stay in your inbox.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError("");
            try {
              await deleteReadNotifications(accessToken);
              setNotifications((items) => items.filter((item) => !item.readAt));
              setTotal((value) => Math.max(unreadTotal, value - notifications.filter((item) => item.readAt).length));
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete read notifications.");
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  async function toggleRead(notification: Notification) {
    if (!accessToken) return;
    setBusy(true);
    setError("");
    try {
      const next = notification.readAt
        ? await markNotificationUnread(accessToken, notification.id)
        : await markNotificationRead(accessToken, notification.id);
      setNotifications((items) => items.map((item) => (item.id === notification.id ? next : item)));
      setUnreadTotal((value) => Math.max(0, value + (notification.readAt ? 1 : -1)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update notification.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(notification: Notification) {
    if (!accessToken) return;
    Alert.alert("Delete notification?", notification.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError("");
            try {
              await deleteNotification(accessToken, notification.id);
              setNotifications((items) => items.filter((item) => item.id !== notification.id));
              setTotal((value) => Math.max(0, value - 1));
              if (!notification.readAt) setUnreadTotal((value) => Math.max(0, value - 1));
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete notification.");
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  async function openNotification(notification: Notification) {
    if (!notification.readAt) {
      await toggleRead(notification);
    }

    const taskId = readDataString(notification.data, "taskId");
    const projectId = readDataString(notification.data, "projectId");
    const meetingId = readDataString(notification.data, "meetingId");

    if (taskId) {
      router.push({ pathname: "/(workspace)/tasks/[taskId]", params: { returnTo: "/(workspace)/notifications", taskId } });
      return;
    }
    if (projectId) {
      router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId } });
      return;
    }
    if (meetingId) {
      router.push("/(workspace)/meetings");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerPanel}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading notifications</Text>
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
            <Text style={styles.eyebrow}>Account</Text>
            <Text style={styles.title}>Notifications</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)/notification-settings")} style={styles.headerIcon}>
            <Settings2 color={colors.foreground} size={20} strokeWidth={2.7} />
          </Pressable>
        </View>

        <View style={styles.summaryPanel}>
          <View style={styles.summaryMain}>
            <View style={styles.summaryIcon}>
              <Bell color={colors.black} size={22} strokeWidth={2.8} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>{unreadTotal} unread</Text>
              <Text style={styles.summaryMeta}>{total} total notifications</Text>
            </View>
          </View>
          <View style={styles.summaryActions}>
            <ActionButton disabled={!unreadTotal || busy} icon={<CheckCheck color={colors.black} size={16} strokeWidth={2.8} />} label="Read all" onPress={() => void markAllRead()} />
            <ActionButton disabled={busy} icon={<Trash2 color={colors.foreground} size={16} strokeWidth={2.6} />} label="Clear read" onPress={confirmDeleteRead} secondary />
          </View>
        </View>

        <View style={styles.searchBar}>
          <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
          <TextInput
            onChangeText={setSearch}
            placeholder="Search notifications"
            placeholderTextColor={colors.inkSoft}
            style={styles.searchInput}
            value={search}
          />
        </View>

        <View style={styles.filterRow}>
          <FilterChip active={filter === "all"} count={notifications.length} label="All" onPress={() => setFilter("all")} />
          <FilterChip active={filter === "unread"} count={unreadTotal} label="Unread" onPress={() => setFilter("unread")} />
          <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.refreshChip}>
            <RefreshCw color={colors.foreground} size={15} strokeWidth={2.7} />
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {filtered.length ? (
          <View style={styles.list}>
            {filtered.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                now={now}
                onDelete={() => confirmDelete(notification)}
                onOpen={() => void openNotification(notification)}
                onToggleRead={() => void toggleRead(notification)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <Inbox color={colors.accent} size={30} strokeWidth={2.5} />
            <Text style={styles.emptyTitle}>{filter === "unread" ? "Nothing unread" : "No notifications"}</Text>
            <Text style={styles.emptyMeta}>Project, task, meeting, and workflow alerts will land here.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationRow({
  notification,
  now,
  onDelete,
  onOpen,
  onToggleRead,
}: {
  notification: Notification;
  now: number;
  onDelete: () => void;
  onOpen: () => void;
  onToggleRead: () => void;
}) {
  const unread = !notification.readAt;
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.notificationRow, unread && styles.notificationRowUnread, pressed && styles.rowPressed]}>
      <View style={[styles.notificationIcon, unread ? styles.notificationIconUnread : null]}>
        {unread ? <Bell color={colors.black} size={17} strokeWidth={2.8} /> : <MailOpen color={colors.inkSoft} size={17} strokeWidth={2.5} />}
      </View>
      <View style={styles.notificationBody}>
        <View style={styles.notificationTop}>
          <Text numberOfLines={1} style={styles.notificationTitle}>{notification.title}</Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        {notification.body ? <Text numberOfLines={2} style={styles.notificationText}>{notification.body}</Text> : null}
        <View style={styles.notificationMetaRow}>
          <Text style={styles.notificationMeta}>{formatRelative(notification.createdAt, now)}</Text>
          <Text style={styles.notificationMeta}>/</Text>
          <Text style={styles.notificationMeta}>{channelLabel(notification.channel)}</Text>
        </View>
      </View>
      <View style={styles.rowActions}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onToggleRead} style={styles.rowAction}>
          <CheckCheck color={unread ? colors.accent : colors.inkSoft} size={17} strokeWidth={2.7} />
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onDelete} style={styles.rowAction}>
          <Trash2 color={colors.danger} size={16} strokeWidth={2.5} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function FilterChip({ active, count, label, onPress }: { active: boolean; count: number; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
      <View style={[styles.filterCount, active && styles.filterCountActive]}>
        <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function ActionButton({
  disabled,
  icon,
  label,
  onPress,
  secondary = false,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.actionButton, secondary && styles.actionButtonSecondary, disabled && styles.disabled]}>
      {icon}
      <Text style={[styles.actionButtonText, secondary && styles.actionButtonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function readDataString(data: Notification["data"], key: string) {
  if (!data || typeof data !== "object") return "";
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function channelLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatRelative(value: string, now: number) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "Just now";
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(value));
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    height: 46,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  actionButtonSecondary: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
  },
  actionButtonText: {
    color: colors.black,
    fontSize: 13,
    fontWeight: "900",
  },
  actionButtonTextSecondary: {
    color: colors.foreground,
  },
  centerPanel: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 24,
  },
  content: {
    gap: 18,
    padding: 22,
    paddingBottom: 122,
  },
  disabled: {
    opacity: 0.45,
  },
  emptyMeta: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
  },
  emptyPanel: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 10,
    padding: 34,
    ...shadow.card,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
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
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  filterCount: {
    backgroundColor: colors.panelMuted,
    borderRadius: 999,
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  filterCountActive: {
    backgroundColor: colors.primary,
  },
  filterCountText: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  filterCountTextActive: {
    color: colors.black,
  },
  filterRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  filterText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  filterTextActive: {
    color: colors.white,
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
  list: {
    gap: 12,
  },
  loadingText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
  },
  notificationBody: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  notificationIcon: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 17,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  notificationIconUnread: {
    backgroundColor: colors.primary,
  },
  notificationMeta: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
  },
  notificationMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  notificationRow: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
    ...shadow.card,
  },
  notificationRowUnread: {
    borderColor: "#f2d24a",
  },
  notificationText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  notificationTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
  },
  notificationTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  refreshChip: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 999,
    flexDirection: "row",
    gap: 7,
    marginLeft: "auto",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  refreshText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  rowAction: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 13,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  rowActions: {
    gap: 7,
  },
  rowPressed: {
    opacity: 0.72,
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 18,
    ...shadow.card,
  },
  searchInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  summaryActions: {
    flexDirection: "row",
    gap: 10,
  },
  summaryIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 20,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  summaryMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
  },
  summaryMeta: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
  },
  summaryPanel: {
    backgroundColor: colors.black,
    borderRadius: 30,
    gap: 18,
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 7,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    color: colors.white,
    fontSize: 23,
    fontWeight: "900",
  },
  title: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  unreadDot: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
});
