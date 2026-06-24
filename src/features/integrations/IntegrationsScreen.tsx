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
  Cloud,
  KeyRound,
  Link2,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  createIntegration,
  deleteIntegration,
  disableIntegration,
  enableIntegration,
  getIntegrationsStatus,
  listIntegrationLogs,
  listIntegrations,
  rotateIntegrationSecret,
  syncIntegration,
  type CreateIntegrationPayload,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Integration, IntegrationLog, IntegrationProvider, IntegrationStatus } from "@/lib/types";

type Provider = CreateIntegrationPayload["provider"];
type Feedback = { ok: boolean; text: string } | null;

const providerOptions: Provider[] = ["GITHUB", "SLACK", "GOOGLE", "MICROSOFT", "ZOOM", "STRIPE", "OPENAI", "CUSTOM"];
const statusOptions: Array<"ALL" | IntegrationStatus> = ["ALL", "ACTIVE", "DISABLED", "ERROR", "REVOKED"];

const emptyForm = {
  enabled: true,
  externalAccountId: "",
  name: "",
  provider: "GITHUB" as Provider,
  scopes: "",
  secretKey: "",
  secretValue: "",
};

export function IntegrationsScreen() {
  const { accessToken } = useAuthSession();
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [message, setMessage] = useState<Feedback>(null);
  const [moduleStatus, setModuleStatus] = useState<"Ready" | "Unavailable" | "Checking">("Checking");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [rotateForm, setRotateForm] = useState({ key: "", value: "" });
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | IntegrationStatus>("ALL");

  const selectedIntegration = useMemo(
    () => integrations.find((integration) => integration.id === selectedId) ?? integrations[0] ?? null,
    [integrations, selectedId],
  );

  const metrics = useMemo(() => {
    const active = integrations.filter((integration) => integration.status === "ACTIVE" && integration.enabled).length;
    const errors = integrations.filter((integration) => integration.status === "ERROR").length;
    const providers = new Set(integrations.map((integration) => integration.provider)).size;
    const secrets = integrations.filter((integration) => integration.hasSecrets).length;
    return { active, errors, providers, secrets, total: integrations.length };
  }, [integrations]);

  const filteredIntegrations = useMemo(() => {
    const text = query.trim().toLowerCase();
    return integrations.filter((integration) => {
      const statusMatch = selectedStatus === "ALL" || integration.status === selectedStatus;
      if (!statusMatch) return false;
      if (!text) return true;
      return [integration.name, integration.provider, integration.externalAccountId, integration.lastError]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [integrations, query, selectedStatus]);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    setError("");
    setMessage(null);
    try {
      await getIntegrationsStatus(accessToken);
      setModuleStatus("Ready");
    } catch {
      setModuleStatus("Unavailable");
    }
    try {
      const page = await listIntegrations(accessToken, { limit: 100 });
      setIntegrations(page.data);
      setSelectedId((current) => current || page.data[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load integrations.");
    } finally {
      setRefreshing(false);
    }
  }, [accessToken]);

  const loadLogs = useCallback(async (integrationId: string) => {
    if (!accessToken || !integrationId) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    try {
      const page = await listIntegrationLogs(accessToken, integrationId, { limit: 20 });
      setLogs(page.data);
    } catch (caught) {
      setLogs([]);
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to load integration logs." });
    } finally {
      setLogsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedIntegration?.id) void loadLogs(selectedIntegration.id);
  }, [loadLogs, selectedIntegration?.id]);

  async function handleCreateIntegration() {
    if (!accessToken || !form.name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const secrets = form.secretKey.trim() && form.secretValue
        ? { [form.secretKey.trim()]: form.secretValue }
        : undefined;
      const created = await createIntegration(accessToken, {
        enabled: form.enabled,
        externalAccountId: form.externalAccountId.trim() || undefined,
        name: form.name.trim(),
        provider: form.provider,
        scopes: parseCsv(form.scopes),
        secrets,
      } as unknown as CreateIntegrationPayload);
      setIntegrations((current) => [created, ...current.filter((integration) => integration.id !== created.id)]);
      setSelectedId(created.id);
      setForm(emptyForm);
      setCreateOpen(false);
      setMessage({ ok: true, text: "Integration created." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to create integration." });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(integration: Integration) {
    if (!accessToken) return;
    setMessage(null);
    try {
      const next = integration.enabled
        ? await disableIntegration(accessToken, integration.id)
        : await enableIntegration(accessToken, integration.id);
      replaceIntegration(next);
      setMessage({ ok: true, text: integration.enabled ? "Integration disabled." : "Integration enabled." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to update integration." });
    }
  }

  async function handleSync(integration: Integration) {
    if (!accessToken) return;
    setMessage(null);
    try {
      const result = await syncIntegration(accessToken, integration.id, { mode: "manual" });
      replaceIntegration(result.integration);
      setMessage({ ok: true, text: result.message || "Integration sync queued." });
      await loadLogs(integration.id);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to sync integration." });
    }
  }

  async function handleRotateSecret() {
    if (!accessToken || !selectedIntegration || !rotateForm.key.trim() || !rotateForm.value) return;
    setSaving(true);
    setMessage(null);
    try {
      const next = await rotateIntegrationSecret(accessToken, selectedIntegration.id, {
        key: rotateForm.key.trim(),
        value: rotateForm.value,
      });
      replaceIntegration(next);
      setRotateForm({ key: "", value: "" });
      setMessage({ ok: true, text: "Secret rotated." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to rotate secret." });
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(integration: Integration) {
    Alert.alert("Delete integration", `Remove ${integration.name}? This cannot be undone.`, [
      { style: "cancel", text: "Cancel" },
      {
        style: "destructive",
        text: "Delete",
        onPress: () => void handleDelete(integration),
      },
    ]);
  }

  async function handleDelete(integration: Integration) {
    if (!accessToken) return;
    setMessage(null);
    try {
      await deleteIntegration(accessToken, integration.id);
      setIntegrations((current) => current.filter((item) => item.id !== integration.id));
      setSelectedId("");
      setMessage({ ok: true, text: "Integration deleted." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to delete integration." });
    }
  }

  function replaceIntegration(next: Integration) {
    setIntegrations((current) => current.map((integration) => integration.id === next.id ? next : integration));
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
            <Text style={styles.eyebrow}>Integrations</Text>
            <Text style={styles.title}>Connected apps</Text>
            <Text style={styles.subtitle}>Providers, secrets, sync status, and audit logs.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.iconButton}>
            <RefreshCw color={colors.foreground} size={19} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.metricStrip}>
          <Metric label="Total" value={metrics.total} />
          <Metric label="Active" value={metrics.active} />
          <Metric label="Errors" value={metrics.errors} tone={metrics.errors ? colors.danger : colors.success} />
          <Metric label="Providers" value={metrics.providers} />
        </View>

        <View style={styles.actionRow}>
          <Button label="New integration" leftIcon={<Plus color={colors.black} size={17} strokeWidth={2.7} />} onPress={() => setCreateOpen(true)} style={styles.flexButton} />
          <View style={styles.moduleBadge}>
            <CheckCircle2 color={moduleStatus === "Ready" ? colors.success : colors.warning} size={15} strokeWidth={2.5} />
            <Text style={styles.moduleText}>{moduleStatus}</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Search provider, account, error"
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

        {message ? <FeedbackBox ok={message.ok} text={message.text} /> : null}
        {error ? <FeedbackBox ok={false} text={error} /> : null}

        <View style={styles.sectionHeader}>
          <PlugZap color={colors.accent} size={18} strokeWidth={2.5} />
          <View>
            <Text style={styles.sectionTitle}>Providers</Text>
            <Text style={styles.sectionSub}>{filteredIntegrations.length} matching records</Text>
          </View>
        </View>

        <View style={styles.list}>
          {filteredIntegrations.map((integration) => (
            <IntegrationRow
              integration={integration}
              key={integration.id}
              onDelete={() => confirmDelete(integration)}
              onSelect={() => setSelectedId(integration.id)}
              onSync={() => void handleSync(integration)}
              onToggle={() => void handleToggle(integration)}
              selected={selectedIntegration?.id === integration.id}
            />
          ))}
          {!filteredIntegrations.length ? (
            <View style={styles.emptyState}>
              <Cloud color={colors.inkSoft} size={26} strokeWidth={2.4} />
              <Text style={styles.emptyTitle}>No integrations found</Text>
              <Text style={styles.emptyCopy}>Connect a provider or adjust your filters.</Text>
            </View>
          ) : null}
        </View>

        {selectedIntegration ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelIcon}>
                <KeyRound color={colors.warning} size={18} strokeWidth={2.5} />
              </View>
              <View style={styles.panelCopy}>
                <Text style={styles.panelTitle}>Secret rotation</Text>
                <Text style={styles.panelSub}>{selectedIntegration.name}</Text>
              </View>
              <StatusPill label={`${selectedIntegration.secretKeys?.length ?? 0} keys`} tone="yellow" />
            </View>
            <View style={styles.formGrid}>
              <Field label="Secret key" onChangeText={(value) => setRotateForm((current) => ({ ...current, key: value }))} placeholder="clientSecret" value={rotateForm.key} />
              <Field label="New value" onChangeText={(value) => setRotateForm((current) => ({ ...current, value }))} placeholder="Paste new secret" secureTextEntry value={rotateForm.value} />
            </View>
            <Button disabled={!rotateForm.key.trim() || !rotateForm.value} label="Rotate secret" loading={saving} onPress={() => void handleRotateSecret()} variant="dark" />
          </View>
        ) : null}

        {selectedIntegration ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelIcon}>
                <RotateCw color={colors.accent} size={18} strokeWidth={2.5} />
              </View>
              <View style={styles.panelCopy}>
                <Text style={styles.panelTitle}>Recent logs</Text>
                <Text style={styles.panelSub}>{selectedIntegration.name}</Text>
              </View>
            </View>
            {logsLoading ? <ActivityIndicator color={colors.foreground} /> : null}
            {logs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logDot} />
                <View style={styles.logCopy}>
                  <Text numberOfLines={1} style={styles.logTitle}>{log.message}</Text>
                  <Text numberOfLines={1} style={styles.logMeta}>{log.level} - {log.eventType} - {formatDate(log.createdAt)}</Text>
                </View>
              </View>
            ))}
            {!logsLoading && !logs.length ? <Text style={styles.mutedText}>No logs recorded for this integration yet.</Text> : null}
          </View>
        ) : null}
      </ScrollView>

      <IntegrationCreateModal
        form={form}
        onChange={setForm}
        onClose={() => setCreateOpen(false)}
        onSubmit={() => void handleCreateIntegration()}
        open={createOpen}
        saving={saving}
      />
    </SafeAreaView>
  );
}

function IntegrationCreateModal({
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
              <Text style={styles.eyebrow}>New provider</Text>
              <Text style={styles.modalTitle}>Connect integration</Text>
              <Text style={styles.modalSub}>Store provider metadata and encrypted secrets.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
              <X color={colors.foreground} size={20} strokeWidth={2.7} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>Provider</Text>
            <View style={styles.providerGrid}>
              {providerOptions.map((provider) => (
                <Pressable
                  accessibilityRole="button"
                  key={provider}
                  onPress={() => onChange({ ...form, provider, name: form.name || titleCase(provider) })}
                  style={[styles.providerChip, form.provider === provider ? styles.providerChipActive : null]}
                >
                  <Text style={[styles.providerText, form.provider === provider ? styles.providerTextActive : null]}>{titleCase(provider)}</Text>
                </Pressable>
              ))}
            </View>

            <Field label="Display name" onChangeText={(name) => onChange({ ...form, name })} placeholder="Slack workspace" value={form.name} />
            <Field label="External account" helperText="Optional account, workspace, tenant, or provider identifier." onChangeText={(externalAccountId) => onChange({ ...form, externalAccountId })} placeholder="acme-slack" value={form.externalAccountId} />
            <Field label="Scopes" helperText="Comma separated scopes, for example read:channels, write:messages." onChangeText={(scopes) => onChange({ ...form, scopes })} placeholder="read:data, write:data" value={form.scopes} />
            <View style={styles.secretBox}>
              <View style={styles.secretHeader}>
                <ShieldCheck color={colors.warning} size={18} strokeWidth={2.5} />
                <View>
                  <Text style={styles.secretTitle}>Optional first secret</Text>
                  <Text style={styles.secretSub}>Values are encrypted by the backend.</Text>
                </View>
              </View>
              <Field label="Secret key" onChangeText={(secretKey) => onChange({ ...form, secretKey })} placeholder="apiKey" value={form.secretKey} />
              <Field label="Secret value" onChangeText={(secretValue) => onChange({ ...form, secretValue })} placeholder="Paste secret" secureTextEntry value={form.secretValue} />
            </View>
            <Button disabled={!form.name.trim()} label="Create integration" loading={saving} onPress={onSubmit} rightIcon={<ChevronRight color={colors.black} size={17} strokeWidth={2.7} />} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function IntegrationRow({
  integration,
  onDelete,
  onSelect,
  onSync,
  onToggle,
  selected,
}: {
  integration: Integration;
  onDelete: () => void;
  onSelect: () => void;
  onSync: () => void;
  onToggle: () => void;
  selected: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onSelect} style={[styles.integrationRow, selected ? styles.integrationRowActive : null]}>
      <View style={styles.providerMark}>
        <Link2 color={colors.accent} size={17} strokeWidth={2.5} />
      </View>
      <View style={styles.integrationMain}>
        <View style={styles.integrationTop}>
          <Text numberOfLines={1} style={styles.integrationName}>{integration.name}</Text>
          <StatusPill label={titleCase(integration.status)} tone={statusTone(integration.status)} />
        </View>
        <Text numberOfLines={1} style={styles.integrationMeta}>
          {integration.provider} - {integration.enabled ? "Enabled" : "Disabled"} - {integration.scopes.length} scopes
        </Text>
        {integration.lastError ? <Text numberOfLines={1} style={styles.errorText}>{integration.lastError}</Text> : null}
        <Text style={styles.integrationMeta}>Last sync: {formatDate(integration.lastSyncAt)}</Text>
        <View style={styles.rowActions}>
          <MiniButton label={integration.enabled ? "Disable" : "Enable"} onPress={onToggle} />
          <MiniButton label="Sync" onPress={onSync} />
          <MiniButton destructive label="Delete" onPress={onDelete} />
        </View>
      </View>
    </Pressable>
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

function MiniButton({ destructive = false, label, onPress }: { destructive?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.miniButton, destructive ? styles.miniButtonDanger : null]}>
      <Text style={[styles.miniButtonText, destructive ? styles.miniButtonDangerText : null]}>{label}</Text>
    </Pressable>
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

function statusTone(status: IntegrationProvider | IntegrationStatus): "blue" | "green" | "red" | "yellow" | "neutral" {
  if (status === "ACTIVE") return "green";
  if (status === "ERROR" || status === "REVOKED") return "red";
  if (status === "DISABLED") return "yellow";
  return "blue";
}

const styles = StyleSheet.create(withFontStyles({
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
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
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
  fieldLabel: {
    color: colors.foreground,
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
  formGrid: {
    gap: 14,
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
  integrationMain: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  integrationMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  integrationName: {
    color: colors.foreground,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  integrationRow: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 14,
    ...shadow.card,
  },
  integrationRowActive: {
    borderColor: colors.accent,
  },
  integrationTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  list: {
    gap: 12,
  },
  logCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  logDot: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  logMeta: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  logRow: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingTop: 12,
  },
  logTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "800",
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
  miniButton: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniButtonDanger: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
  },
  miniButtonDangerText: {
    color: colors.danger,
  },
  miniButtonText: {
    color: colors.foreground,
    fontSize: 11,
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
  moduleBadge: {
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
  moduleText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  mutedText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 14,
    padding: 16,
    ...shadow.card,
  },
  panelCopy: {
    flex: 1,
    gap: 3,
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  panelIcon: {
    alignItems: "center",
    backgroundColor: colors.yellowSoft,
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
  providerChip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  providerChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  providerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  providerMark: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  providerText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  providerTextActive: {
    color: colors.white,
  },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4,
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
  secretBox: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  secretHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  secretSub: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  secretTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
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
}));
