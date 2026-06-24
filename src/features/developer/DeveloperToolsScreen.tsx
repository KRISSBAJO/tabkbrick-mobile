import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Code2,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/StatusPill";
import { createApiKey, listApiKeys, revokeApiKey, type CreateApiKeyPayload } from "@/lib/api";
import { API_BASE_URL, API_ORIGIN } from "@/lib/api/request";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { ApiKey, ApiKeyStatus, CreatedApiKey } from "@/lib/types";

type Feedback = { ok: boolean; text: string } | null;

const statusOptions: Array<"ALL" | ApiKeyStatus> = ["ALL", "ACTIVE", "EXPIRED", "REVOKED"];
const defaultScopes = "read:projects, read:tasks";

const emptyForm = {
  expiresAt: "",
  name: "",
  scopes: defaultScopes,
};

export function DeveloperToolsScreen() {
  const { accessToken, user } = useAuthSession();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Feedback>(null);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | ApiKeyStatus>("ALL");

  const canManageSecurity = useMemo(() => hasSecurityAccess(user), [user]);

  const filteredKeys = useMemo(() => {
    const text = query.trim().toLowerCase();
    return keys.filter((key) => {
      const statusMatch = selectedStatus === "ALL" || key.status === selectedStatus;
      if (!statusMatch) return false;
      if (!text) return true;
      return [key.name, key.prefix, key.status, key.createdBy?.email, key.scopes.join(" ")]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [keys, query, selectedStatus]);

  const metrics = useMemo(() => {
    const active = keys.filter((key) => key.status === "ACTIVE").length;
    const expired = keys.filter((key) => key.status === "EXPIRED").length;
    const revoked = keys.filter((key) => key.status === "REVOKED").length;
    return { active, expired, revoked, total: keys.length };
  }, [keys]);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    setMessage(null);
    try {
      const page = await listApiKeys(accessToken, { limit: 100 });
      setKeys(page.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load API keys.");
      setKeys([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateKey() {
    if (!accessToken || !form.name.trim()) return;
    setSaving(true);
    setMessage(null);
    setCreatedKey(null);
    try {
      const created = await createApiKey(accessToken, {
        expiresAt: form.expiresAt.trim() || undefined,
        name: form.name.trim(),
        scopes: parseCsv(form.scopes),
      } as CreateApiKeyPayload);
      setKeys((current) => [created, ...current.filter((key) => key.id !== created.id)]);
      setCreatedKey(created);
      setCreateOpen(false);
      setForm(emptyForm);
      setMessage({ ok: true, text: "API key created. Store the token now; it is only shown once." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to create API key." });
    } finally {
      setSaving(false);
    }
  }

  function confirmRevoke(key: ApiKey) {
    Alert.alert("Revoke API key", `Revoke ${key.name}? Existing clients using this key will stop working.`, [
      { style: "cancel", text: "Cancel" },
      {
        style: "destructive",
        text: "Revoke",
        onPress: () => void handleRevoke(key),
      },
    ]);
  }

  async function handleRevoke(key: ApiKey) {
    if (!accessToken) return;
    setMessage(null);
    try {
      const revoked = await revokeApiKey(accessToken, key.id);
      setKeys((current) => current.map((item) => item.id === revoked.id ? revoked : item));
      setMessage({ ok: true, text: "API key revoked." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to revoke API key." });
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void load(true)} refreshing={refreshing} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color={colors.foreground} size={20} strokeWidth={2.7} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Developer tools</Text>
            <Text style={styles.title}>API access</Text>
            <Text style={styles.subtitle}>Runtime diagnostics, mobile API base URL, and admin API keys.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.iconButton}>
            <RefreshCw color={colors.foreground} size={19} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.diagnostics}>
          <View style={styles.diagnosticsHeader}>
            <View style={styles.panelIcon}>
              <Server color={colors.accent} size={18} strokeWidth={2.5} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.panelTitle}>Mobile runtime</Text>
              <Text style={styles.panelSub}>These values are used by the app on this device.</Text>
            </View>
          </View>
          <Diagnostic label="API base" value={API_BASE_URL} />
          <Diagnostic label="API origin" value={API_ORIGIN} />
          <Diagnostic label="Client header" value="X-TaskBricks-Client: mobile" />
          <Diagnostic label="Expo SDK" value="54" />
        </View>

        <View style={styles.metricStrip}>
          <Metric label="Total" value={metrics.total} />
          <Metric label="Active" value={metrics.active} tone={colors.success} />
          <Metric label="Expired" value={metrics.expired} tone={colors.warning} />
          <Metric label="Revoked" value={metrics.revoked} tone={colors.danger} />
        </View>

        <View style={styles.actionRow}>
          <Button
            disabled={!canManageSecurity}
            label="New API key"
            leftIcon={<Plus color={colors.black} size={17} strokeWidth={2.7} />}
            onPress={() => setCreateOpen(true)}
            style={styles.flexButton}
          />
          <View style={styles.accessBadge}>
            {canManageSecurity ? (
              <CheckCircle2 color={colors.success} size={15} strokeWidth={2.5} />
            ) : (
              <ShieldAlert color={colors.warning} size={15} strokeWidth={2.5} />
            )}
            <Text style={styles.accessText}>{canManageSecurity ? "Owner access" : "Restricted"}</Text>
          </View>
        </View>

        {createdKey ? (
          <View style={styles.tokenPanel}>
            <View style={styles.tokenHeader}>
              <KeyRound color={colors.primaryDark} size={18} strokeWidth={2.5} />
              <View style={styles.headerCopy}>
                <Text style={styles.tokenTitle}>One-time token</Text>
                <Text style={styles.tokenSub}>Store this now. The backend will not show it again.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setCreatedKey(null)} style={styles.tokenClose}>
                <X color={colors.foreground} size={16} strokeWidth={2.7} />
              </Pressable>
            </View>
            <Text selectable style={styles.tokenText}>{createdKey.token}</Text>
          </View>
        ) : null}

        {message ? <FeedbackBox ok={message.ok} text={message.text} /> : null}
        {error ? <FeedbackBox ok={false} text={error} /> : null}

        <View style={styles.searchBox}>
          <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Search key, prefix, scope"
            placeholderTextColor="#aaa298"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
          {statusOptions.map((status) => (
            <Pressable
              accessibilityRole="button"
              key={status}
              onPress={() => setSelectedStatus(status)}
              style={[styles.filterChip, selectedStatus === status ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterText, selectedStatus === status ? styles.filterTextActive : null]}>{status === "ALL" ? "All" : titleCase(status)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Code2 color={colors.accent} size={18} strokeWidth={2.5} />
          <View>
            <Text style={styles.sectionTitle}>API keys</Text>
            <Text style={styles.sectionSub}>{filteredKeys.length} matching records</Text>
          </View>
        </View>

        {loading ? <ActivityIndicator color={colors.foreground} /> : null}

        <View style={styles.list}>
          {filteredKeys.map((key) => (
            <ApiKeyRow key={key.id} apiKey={key} onRevoke={() => confirmRevoke(key)} />
          ))}
          {!loading && !filteredKeys.length ? (
            <View style={styles.emptyState}>
              <KeyRound color={colors.inkSoft} size={26} strokeWidth={2.4} />
              <Text style={styles.emptyTitle}>No API keys found</Text>
              <Text style={styles.emptyCopy}>Create an API key when an external service needs controlled access.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <CreateKeyModal
        form={form}
        onChange={setForm}
        onClose={() => setCreateOpen(false)}
        onSubmit={() => void handleCreateKey()}
        open={createOpen}
        saving={saving}
      />
    </SafeAreaView>
  );
}

function CreateKeyModal({
  form,
  onChange,
  onClose,
  onSubmit,
  open,
  saving,
}: {
  form: typeof emptyForm;
  onChange: (next: typeof emptyForm) => void;
  onClose: () => void;
  onSubmit: () => void;
  open: boolean;
  saving: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>New token</Text>
              <Text style={styles.modalTitle}>Create API key</Text>
              <Text style={styles.modalSub}>Use the smallest scopes needed for the integration.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
              <X color={colors.foreground} size={20} strokeWidth={2.7} />
            </Pressable>
          </View>
          <View style={styles.modalContent}>
            <Field label="Key name" onChangeText={(name) => onChange({ ...form, name })} placeholder="Production automation" value={form.name} />
            <Field
              helperText="Comma separated scopes, for example read:projects, write:tasks."
              label="Scopes"
              onChangeText={(scopes) => onChange({ ...form, scopes })}
              placeholder={defaultScopes}
              value={form.scopes}
            />
            <Field
              helperText="Optional ISO date. Leave blank for no configured expiry."
              label="Expires at"
              onChangeText={(expiresAt) => onChange({ ...form, expiresAt })}
              placeholder="2026-12-31"
              value={form.expiresAt}
            />
            <Button disabled={!form.name.trim()} label="Create key" loading={saving} onPress={onSubmit} rightIcon={<ChevronRight color={colors.black} size={17} strokeWidth={2.7} />} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ApiKeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: () => void }) {
  const active = apiKey.status === "ACTIVE";
  return (
    <View style={styles.keyRow}>
      <View style={styles.keyMark}>
        <KeyRound color={active ? colors.success : colors.inkSoft} size={17} strokeWidth={2.5} />
      </View>
      <View style={styles.keyMain}>
        <View style={styles.keyTop}>
          <Text numberOfLines={1} style={styles.keyName}>{apiKey.name}</Text>
          <StatusPill label={titleCase(apiKey.status)} tone={statusTone(apiKey.status)} />
        </View>
        <Text style={styles.keyMeta}>Prefix: {apiKey.prefix}</Text>
        <Text numberOfLines={1} style={styles.keyMeta}>Scopes: {apiKey.scopes.length ? apiKey.scopes.join(", ") : "No scopes"}</Text>
        <Text style={styles.keyMeta}>Created: {formatDate(apiKey.createdAt)} - Last used: {formatDate(apiKey.lastUsedAt)}</Text>
        <View style={styles.keyActions}>
          <Text style={styles.keyExpiry}>Expires: {formatDate(apiKey.expiresAt)}</Text>
          {active ? (
            <Pressable accessibilityRole="button" onPress={onRevoke} style={styles.revokeButton}>
              <Trash2 color={colors.danger} size={15} strokeWidth={2.5} />
              <Text style={styles.revokeText}>Revoke</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.diagnosticRow}>
      <Text style={styles.diagnosticLabel}>{label}</Text>
      <Text selectable numberOfLines={2} style={styles.diagnosticValue}>{value}</Text>
    </View>
  );
}

function Metric({ label, tone = colors.foreground, value }: { label: string; tone?: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: tone }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function FeedbackBox({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={[styles.feedback, ok ? styles.feedbackOk : styles.feedbackBad]}>
      <Text style={[styles.feedbackText, ok ? styles.feedbackOkText : styles.feedbackBadText]}>{text}</Text>
    </View>
  );
}

function parseCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|_|\s)([a-z])/g, (_, prefix: string, letter: string) => `${prefix === "_" ? " " : prefix}${letter.toUpperCase()}`);
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(status: ApiKeyStatus): "blue" | "green" | "red" | "yellow" | "neutral" {
  if (status === "ACTIVE") return "green";
  if (status === "EXPIRED") return "yellow";
  if (status === "REVOKED") return "red";
  return "neutral";
}

function hasSecurityAccess(user: { isPlatformAdmin?: boolean; permissions?: string[]; roles?: string[] } | null) {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  const permissions = new Set(user.permissions ?? []);
  if (permissions.has("manage:security") || permissions.has("manage:all")) return true;
  return (user.roles ?? []).some((role) => /owner|admin/i.test(role));
}

const styles = StyleSheet.create(withFontStyles({
  accessBadge: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  accessText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  chipRow: {
    gap: 10,
    paddingRight: 18,
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 132,
  },
  diagnosticLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  diagnosticRow: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 5,
    paddingTop: 12,
  },
  diagnosticValue: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  diagnostics: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 13,
    padding: 16,
    ...shadow.card,
  },
  diagnosticsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  emptyCopy: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    padding: 28,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  feedback: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackBad: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
  },
  feedbackBadText: {
    color: colors.danger,
  },
  feedbackOk: {
    backgroundColor: colors.greenSoft,
    borderColor: "#bbf7d0",
  },
  feedbackOkText: {
    color: colors.success,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: "900",
  },
  filterChip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  filterText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  filterTextActive: {
    color: colors.white,
  },
  flexButton: {
    flex: 1,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 19,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
    ...shadow.card,
  },
  keyActions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  keyExpiry: {
    color: colors.inkSoft,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  keyMain: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  keyMark: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  keyMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  keyName: {
    color: colors.foreground,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  keyRow: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 14,
    ...shadow.card,
  },
  keyTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  list: {
    gap: 12,
  },
  metric: {
    alignItems: "center",
    flex: 1,
    gap: 3,
  },
  metricLabel: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  metricStrip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: 16,
    ...shadow.card,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  modalBackdrop: {
    backgroundColor: "rgba(16,16,15,0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalClose: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  modalContent: {
    gap: 16,
    paddingBottom: 24,
  },
  modalHandle: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: 99,
    height: 4,
    marginBottom: 18,
    width: 44,
  },
  modalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: "92%",
    padding: 22,
  },
  modalSub: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
  },
  modalTitle: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  panelIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  panelSub: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  panelTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
  },
  revokeButton: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  revokeText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "900",
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 2,
    ...shadow.card,
  },
  searchInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    height: 46,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  sectionSub: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  title: {
    color: colors.foreground,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  tokenClose: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  tokenHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  tokenPanel: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.primaryDark,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 12,
    padding: 15,
  },
  tokenSub: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  tokenText: {
    backgroundColor: colors.black,
    borderRadius: radii.lg,
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    padding: 13,
  },
  tokenTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
}));
