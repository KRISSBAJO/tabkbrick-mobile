import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  History,
  HelpCircle,
  KeyRound,
  Laptop,
  Mail,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  XCircle,
} from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ProfileEditModal } from "@/features/profile/ProfileEditModal";
import {
  changePassword,
  createSupportRequest,
  disableMfa,
  enableTotp,
  getAccountHelp,
  getAccountOverview,
  getIdentitySecurityOverview,
  listAdminSessions,
  listAccountWorkspaces,
  listGuestWorkspaces,
  regenerateBackupCodes,
  revokeAdminSession,
  revokeTrustedDevice,
  setupTotp,
  type AccountHelp,
  type AccountOverview,
  type AccountWorkspace,
  type GuestWorkspace,
  type SupportRequestPayload,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { AuthSession, IdentitySecurityOverview } from "@/lib/types";

type LoadState = {
  error: string;
  loading: boolean;
  refreshing: boolean;
};

const initialLoadState: LoadState = { error: "", loading: true, refreshing: false };
const categories: SupportRequestPayload["category"][] = ["ACCOUNT", "WORKSPACE", "BILLING", "SECURITY", "TECHNICAL", "FEATURE"];
const priorities: NonNullable<SupportRequestPayload["priority"]>[] = ["NORMAL", "HIGH", "URGENT", "LOW"];

export function AccountWorkspacesScreen() {
  const { accessToken } = useAuthSession();
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState(initialLoadState);
  const [workspaces, setWorkspaces] = useState<AccountWorkspace[]>([]);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    setState((current) => ({ ...current, error: "", loading: !showRefreshing, refreshing: showRefreshing }));
    try {
      const [nextOverview, page] = await Promise.all([
        getAccountOverview(accessToken),
        listAccountWorkspaces(accessToken, { limit: 100, search: query }),
      ]);
      setOverview(nextOverview);
      setWorkspaces(page.data);
      setState({ error: "", loading: false, refreshing: false });
    } catch (caught) {
      setState({
        error: caught instanceof Error ? caught.message : "Unable to load workspaces.",
        loading: false,
        refreshing: false,
      });
    }
  }, [accessToken, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 180);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <ScreenShell
      error={state.error}
      loading={state.loading}
      onRefresh={() => void load(true)}
      refreshing={state.refreshing}
      rightAction={<HeaderIcon icon={<RefreshCw color={colors.foreground} size={18} strokeWidth={2.7} />} onPress={() => void load(true)} />}
      subtitle={`${overview?.tenant?.name ?? "Workspace"} account spaces`}
      title="Your workspaces"
    >
      <MetricStrip
        items={[
          { label: "Workspaces", value: overview?.counts.workspaces ?? workspaces.length },
          { label: "Projects", value: overview?.counts.projects ?? 0 },
          { label: "Teams", value: overview?.counts.teams ?? 0 },
        ]}
      />

      <SearchBox
        onChange={setQuery}
        placeholder="Search workspace name or slug"
        value={query}
      />

      <SectionTitle title="Workspace list" meta={`${workspaces.length} shown`} />
      <View style={styles.stack}>
        {workspaces.map((workspace) => (
          <WorkspaceAccountRow key={workspace.id} workspace={workspace} />
        ))}
        {!workspaces.length ? (
          <EmptyState
            icon={<BriefcaseBusiness color={colors.accent} size={24} strokeWidth={2.6} />}
            title="No workspaces found"
            body="Try another search or ask an owner to create a workspace for this tenant."
          />
        ) : null}
      </View>
    </ScreenShell>
  );
}

export function GuestWorkspacesScreen() {
  const { accessToken } = useAuthSession();
  const [guestWorkspaces, setGuestWorkspaces] = useState<GuestWorkspace[]>([]);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState(initialLoadState);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    setState((current) => ({ ...current, error: "", loading: !showRefreshing, refreshing: showRefreshing }));
    try {
      const page = await listGuestWorkspaces(accessToken, { limit: 100, search: query });
      setGuestWorkspaces(page.data);
      setNote(page.note);
      setState({ error: "", loading: false, refreshing: false });
    } catch (caught) {
      setState({
        error: caught instanceof Error ? caught.message : "Unable to load guest workspaces.",
        loading: false,
        refreshing: false,
      });
    }
  }, [accessToken, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 180);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <ScreenShell
      error={state.error}
      loading={state.loading}
      onRefresh={() => void load(true)}
      refreshing={state.refreshing}
      subtitle="Project spaces where you were explicitly added"
      title="Guest workspaces"
    >
      {note ? (
        <InfoPanel
          icon={<UsersRound color={colors.accent} size={18} strokeWidth={2.6} />}
          title="Access model"
          body={note}
        />
      ) : null}

      <SearchBox onChange={setQuery} placeholder="Search invited projects or spaces" value={query} />

      <SectionTitle title="Invited spaces" meta={`${guestWorkspaces.length} shown`} />
      <View style={styles.stack}>
        {guestWorkspaces.map((workspace) => (
          <GuestWorkspaceRow key={workspace.id} workspace={workspace} />
        ))}
        {!guestWorkspaces.length ? (
          <EmptyState
            icon={<UsersRound color={colors.success} size={24} strokeWidth={2.6} />}
            title="No guest spaces yet"
            body="When you are added directly to project spaces, they will appear here."
          />
        ) : null}
      </View>
    </ScreenShell>
  );
}

export function ManageAccountScreen() {
  const { accessToken, user } = useAuthSession();
  const [changeError, setChangeError] = useState("");
  const [changeSuccess, setChangeSuccess] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodeInput, setBackupCodeInput] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [identity, setIdentity] = useState<IdentitySecurityOverview | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaStatus, setMfaStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sessionNote, setSessionNote] = useState("");
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [state, setState] = useState(initialLoadState);
  const [totpSetup, setTotpSetup] = useState<Awaited<ReturnType<typeof setupTotp>> | null>(null);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    setState((current) => ({ ...current, error: "", loading: !showRefreshing, refreshing: showRefreshing }));
    try {
      const [nextOverview, nextIdentity] = await Promise.all([
        getAccountOverview(accessToken),
        getIdentitySecurityOverview(accessToken),
      ]);
      setOverview(nextOverview);
      setIdentity(nextIdentity);
      try {
        const page = await listAdminSessions(accessToken, {
          activeOnly: true,
          limit: 20,
          userId: user?.id,
        });
        setSessions(page.data);
        setSessionNote("");
      } catch {
        setSessions([]);
        setSessionNote("Detailed session controls require tenant security permissions.");
      }
      setState({ error: "", loading: false, refreshing: false });
    } catch (caught) {
      setState({
        error: caught instanceof Error ? caught.message : "Unable to load account security.",
        loading: false,
        refreshing: false,
      });
    }
  }, [accessToken, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onChangePassword() {
    if (!accessToken) return;
    setChangeError("");
    setChangeSuccess("");
    if (!currentPassword || !newPassword) {
      setChangeError("Current password and new password are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const result = await changePassword(accessToken, {
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangeSuccess(result.message ?? "Password changed.");
      await load(true);
    } catch (caught) {
      setChangeError(caught instanceof Error ? caught.message : "Unable to change password.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function onStartTotp() {
    if (!accessToken) return;
    setMfaStatus(null);
    setBackupCodes([]);
    setMfaBusy(true);
    try {
      const result = await setupTotp(accessToken, { label: user?.email ?? "TaskBricks mobile" });
      setTotpSetup(result);
      setMfaCode("");
      setMfaStatus({ tone: "success", text: "Authenticator setup started. Add the secret to your authenticator app, then enter the 6-digit code." });
    } catch (caught) {
      setMfaStatus({ tone: "error", text: caught instanceof Error ? caught.message : "Unable to start MFA setup." });
    } finally {
      setMfaBusy(false);
    }
  }

  async function onEnableTotp() {
    if (!accessToken || !totpSetup) return;
    setMfaStatus(null);
    if (!mfaCode.trim()) {
      setMfaStatus({ tone: "error", text: "Enter the 6-digit authenticator code." });
      return;
    }
    setMfaBusy(true);
    try {
      const result = await enableTotp(accessToken, {
        factorId: totpSetup.factorId,
        code: mfaCode.trim(),
      });
      setBackupCodes(result.backupCodes);
      setTotpSetup(null);
      setMfaCode("");
      setMfaStatus({ tone: "success", text: "MFA is enabled. Store the backup codes somewhere safe." });
      await load(true);
    } catch (caught) {
      setMfaStatus({ tone: "error", text: caught instanceof Error ? caught.message : "Unable to enable MFA." });
    } finally {
      setMfaBusy(false);
    }
  }

  async function onRegenerateBackupCodes() {
    if (!accessToken) return;
    setMfaStatus(null);
    if (!backupCodeInput.trim()) {
      setMfaStatus({ tone: "error", text: "Enter your current authenticator code first." });
      return;
    }
    setMfaBusy(true);
    try {
      const result = await regenerateBackupCodes(accessToken, { code: backupCodeInput.trim() });
      setBackupCodes(result.backupCodes);
      setBackupCodeInput("");
      setMfaStatus({ tone: "success", text: "Backup codes regenerated. Save the new codes now." });
      await load(true);
    } catch (caught) {
      setMfaStatus({ tone: "error", text: caught instanceof Error ? caught.message : "Unable to regenerate backup codes." });
    } finally {
      setMfaBusy(false);
    }
  }

  async function disableMfaConfirmed() {
    if (!accessToken) return;
    setMfaStatus(null);
    if (!disablePassword.trim()) {
      setMfaStatus({ tone: "error", text: "Current password is required to disable MFA." });
      return;
    }
    setMfaBusy(true);
    try {
      await disableMfa(accessToken, {
        currentPassword: disablePassword,
        code: disableCode.trim() || undefined,
      });
      setDisablePassword("");
      setDisableCode("");
      setBackupCodes([]);
      setTotpSetup(null);
      setMfaStatus({ tone: "success", text: "MFA disabled and trusted device posture refreshed." });
      await load(true);
    } catch (caught) {
      setMfaStatus({ tone: "error", text: caught instanceof Error ? caught.message : "Unable to disable MFA." });
    } finally {
      setMfaBusy(false);
    }
  }

  function onDisableMfa() {
    Alert.alert(
      "Disable MFA?",
      "This lowers account protection. Continue only if you understand the security impact.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disable", style: "destructive", onPress: () => void disableMfaConfirmed() },
      ],
    );
  }

  async function onRevokeDevice(deviceId: string) {
    if (!accessToken) return;
    try {
      await revokeTrustedDevice(accessToken, deviceId);
      await load(true);
    } catch (caught) {
      Alert.alert("Unable to revoke device", caught instanceof Error ? caught.message : "Try again.");
    }
  }

  function onRevokeSession(session: AuthSession) {
    Alert.alert(
      "Revoke session?",
      `Force logout for ${session.ipAddress ?? "this session"}? The device will need to sign in again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => void revokeSessionConfirmed(session.id),
        },
      ],
    );
  }

  async function revokeSessionConfirmed(sessionId: string) {
    if (!accessToken) return;
    try {
      await revokeAdminSession(accessToken, sessionId);
      await load(true);
    } catch (caught) {
      Alert.alert("Unable to revoke session", caught instanceof Error ? caught.message : "Try again.");
    }
  }

  const displayName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || user?.email || "Account";
  const mfaEnabled = identity?.mfa.enabled ?? false;

  return (
    <>
      <ScreenShell
        error={state.error}
        loading={state.loading}
        onRefresh={() => void load(true)}
        refreshing={state.refreshing}
        subtitle="Profile, password, MFA, login history, and trusted devices"
        title="Security center"
      >
        <View style={styles.accountHero}>
          <View style={styles.accountAvatar}>
            <Text style={styles.accountAvatarText}>{initials(displayName, user?.email ?? "")}</Text>
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.accountName}>{displayName}</Text>
            <Text numberOfLines={1} style={styles.accountEmail}>{user?.email}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setProfileEditorOpen(true)} style={styles.smallDarkButton}>
            <Text style={styles.smallDarkButtonText}>Edit</Text>
          </Pressable>
        </View>

        <MetricStrip
          items={[
            { label: "Sessions", value: overview?.counts.activeSessions ?? 0 },
            { label: "Devices", value: overview?.counts.trustedDevices ?? 0 },
            { label: "MFA", value: mfaEnabled ? "On" : "Off" },
          ]}
        />

        <Card title="Change password" icon={<KeyRound color={colors.primaryDark} size={18} strokeWidth={2.6} />}>
          <View style={styles.stack}>
            <Field
              label="Current password"
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              secureTextEntry
              value={currentPassword}
            />
            <Field
              helperText="Use at least 12 characters with uppercase, lowercase, number, and symbol."
              label="New password"
              onChangeText={setNewPassword}
              placeholder="New password"
              secureTextEntry
              value={newPassword}
            />
            <Field
              label="Confirm password"
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
              value={confirmPassword}
            />
            <View style={styles.toggleRow}>
              <View style={styles.flex}>
                <Text style={styles.toggleTitle}>Revoke other sessions</Text>
                <Text style={styles.toggleSub}>Keep this mobile session and force older devices to sign in again.</Text>
              </View>
              <Switch
                onValueChange={setRevokeOtherSessions}
                thumbColor={revokeOtherSessions ? colors.primary : colors.white}
                trackColor={{ false: colors.line, true: "#111111" }}
                value={revokeOtherSessions}
              />
            </View>
            {changeError ? <StatusBox tone="error" text={changeError} /> : null}
            {changeSuccess ? <StatusBox tone="success" text={changeSuccess} /> : null}
            <Button
              label="Update password"
              loading={savingPassword}
              onPress={() => void onChangePassword()}
              rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
            />
          </View>
        </Card>

        <Card title="Security posture" icon={<ShieldCheck color={colors.success} size={18} strokeWidth={2.6} />}>
          <View style={styles.securityGrid}>
            <SecurityTile label="MFA" value={mfaEnabled ? "Enabled" : "Disabled"} good={mfaEnabled} />
            <SecurityTile label="Backup codes" value={`${identity?.mfa.backupCodes.remaining ?? 0} left`} good={(identity?.mfa.backupCodes.remaining ?? 0) > 0} />
            <SecurityTile label="Unread alerts" value={String(overview?.counts.unreadNotifications ?? 0)} good={(overview?.counts.unreadNotifications ?? 0) === 0} />
          </View>
        </Card>

        <Card title="Multi-factor authentication" icon={<QrCode color={colors.accent} size={18} strokeWidth={2.6} />}>
          <View style={styles.stack}>
            <View style={styles.mfaSummary}>
              <View style={[styles.mfaSummaryIcon, mfaEnabled ? styles.mfaSummaryIconGood : null]}>
                <BadgeCheck color={mfaEnabled ? colors.success : colors.warning} size={19} strokeWidth={2.7} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.mfaSummaryTitle}>{mfaEnabled ? "Authenticator is active" : "Authenticator is not enabled"}</Text>
                <Text style={styles.mfaSummaryBody}>
                  {mfaEnabled
                    ? "Sign-ins can require a time-based code. Backup codes should be stored outside this phone."
                    : "Add a time-based authenticator app before using this account for sensitive workspace actions."}
                </Text>
              </View>
            </View>

            {!mfaEnabled ? (
              <>
                {!totpSetup ? (
                  <Button
                    label="Set up authenticator"
                    loading={mfaBusy}
                    onPress={() => void onStartTotp()}
                    rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
                  />
                ) : (
                  <View style={styles.stack}>
                    <View style={styles.secretPanel}>
                      <Text style={styles.secretLabel}>Manual setup key</Text>
                      <Text selectable style={styles.secretValue}>{totpSetup.secret}</Text>
                      <Text numberOfLines={2} selectable style={styles.secretUrl}>{totpSetup.otpauthUrl}</Text>
                    </View>
                    <Field
                      keyboardType="number-pad"
                      label="Authenticator code"
                      maxLength={8}
                      onChangeText={setMfaCode}
                      placeholder="123456"
                      value={mfaCode}
                    />
                    <View style={styles.actionRow}>
                      <Button
                        label="Cancel"
                        onPress={() => {
                          setTotpSetup(null);
                          setMfaCode("");
                        }}
                        style={styles.actionButton}
                        variant="outline"
                      />
                      <Button
                        label="Enable MFA"
                        loading={mfaBusy}
                        onPress={() => void onEnableTotp()}
                        style={styles.actionButton}
                        rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
                      />
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.stack}>
                <Field
                  helperText="Use this to rotate backup codes after you save the current set."
                  keyboardType="number-pad"
                  label="Authenticator code"
                  maxLength={8}
                  onChangeText={setBackupCodeInput}
                  placeholder="Code for backup-code rotation"
                  value={backupCodeInput}
                />
                <Button
                  label="Regenerate backup codes"
                  loading={mfaBusy}
                  onPress={() => void onRegenerateBackupCodes()}
                  variant="outline"
                />
                <View style={styles.divider} />
                <Field
                  label="Current password"
                  onChangeText={setDisablePassword}
                  placeholder="Required to disable MFA"
                  secureTextEntry
                  value={disablePassword}
                />
                <Field
                  helperText="Use the current authenticator code when available."
                  keyboardType="number-pad"
                  label="Authenticator code"
                  maxLength={8}
                  onChangeText={setDisableCode}
                  placeholder="123456"
                  value={disableCode}
                />
                <Pressable accessibilityRole="button" onPress={onDisableMfa} style={styles.dangerAction}>
                  <Text style={styles.dangerActionText}>Disable MFA</Text>
                </Pressable>
              </View>
            )}

            {backupCodes.length ? <BackupCodeVault codes={backupCodes} /> : null}
            {mfaStatus ? <StatusBox tone={mfaStatus.tone} text={mfaStatus.text} /> : null}
          </View>
        </Card>

        <Card title="Active sessions" icon={<ShieldCheck color={colors.primaryDark} size={18} strokeWidth={2.6} />}>
          <View style={styles.stack}>
            {sessions.map((session) => (
              <View key={session.id} style={styles.sessionRow}>
                <View style={styles.sessionIcon}>
                  <ShieldCheck color={session.revokedAt ? colors.inkSoft : colors.success} size={17} strokeWidth={2.5} />
                </View>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={styles.sessionTitle}>{session.ipAddress ?? "Unknown IP"}</Text>
                  <Text numberOfLines={1} style={styles.sessionMeta}>
                    Created {shortDateTime(session.createdAt)} - expires {shortDateTime(session.expiresAt)}
                  </Text>
                  {session.userAgent ? <Text numberOfLines={1} style={styles.sessionAgent}>{session.userAgent}</Text> : null}
                </View>
                {!session.revokedAt ? (
                  <Pressable accessibilityRole="button" onPress={() => onRevokeSession(session)} style={styles.revokeButton}>
                    <Text style={styles.revokeText}>Revoke</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {!sessions.length ? (
              <Text style={styles.mutedText}>
                {sessionNote || "No active sessions were returned for this account."}
              </Text>
            ) : null}
          </View>
        </Card>

        <Card title="Trusted devices" icon={<Laptop color={colors.accent} size={18} strokeWidth={2.6} />}>
          <View style={styles.stack}>
            {(identity?.trustedDevices ?? []).map((device) => (
              <View key={device.id} style={styles.deviceRow}>
                <View style={styles.deviceIcon}>
                  <Laptop color={colors.foreground} size={17} strokeWidth={2.5} />
                </View>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={styles.deviceTitle}>{device.name ?? "Trusted device"}</Text>
                  <Text numberOfLines={1} style={styles.deviceMeta}>{device.ipAddress ?? "Unknown IP"} - expires {shortDate(device.expiresAt)}</Text>
                </View>
                {device.status === "ACTIVE" ? (
                  <Pressable accessibilityRole="button" onPress={() => void onRevokeDevice(device.id)} style={styles.revokeButton}>
                    <Text style={styles.revokeText}>Revoke</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {!identity?.trustedDevices.length ? (
              <Text style={styles.mutedText}>No trusted devices are attached to this account yet.</Text>
            ) : null}
          </View>
        </Card>

        <Card title="Recent login history" icon={<History color={colors.primaryDark} size={18} strokeWidth={2.6} />}>
          <View style={styles.stack}>
            {(identity?.loginHistory ?? []).slice(0, 8).map((entry) => (
              <View key={entry.id} style={styles.loginRow}>
                <View style={[styles.loginStatusDot, { backgroundColor: loginStatusColor(entry.status, entry.suspicious) }]} />
                <View style={styles.flex}>
                  <View style={styles.loginTitleRow}>
                    <Text numberOfLines={1} style={styles.loginTitle}>{humanize(entry.method || "sign in")}</Text>
                    <Text style={[styles.loginStatus, { color: loginStatusColor(entry.status, entry.suspicious) }]}>
                      {entry.suspicious ? "Suspicious" : humanize(entry.status)}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={styles.loginMeta}>
                    {shortDateTime(entry.createdAt)} - {entry.ipAddress ?? "Unknown IP"}
                  </Text>
                  {entry.reason ? <Text numberOfLines={2} style={styles.loginReason}>{entry.reason}</Text> : null}
                  {entry.userAgent ? <Text numberOfLines={1} style={styles.loginAgent}>{entry.userAgent}</Text> : null}
                </View>
              </View>
            ))}
            {!identity?.loginHistory.length ? (
              <Text style={styles.mutedText}>No recent login history was returned for this account.</Text>
            ) : null}
          </View>
        </Card>
      </ScreenShell>
      <ProfileEditModal visible={profileEditorOpen} onClose={() => setProfileEditorOpen(false)} />
    </>
  );
}

export function HelpSupportScreen() {
  const { accessToken } = useAuthSession();
  const [category, setCategory] = useState<SupportRequestPayload["category"]>("WORKSPACE");
  const [help, setHelp] = useState<AccountHelp | null>(null);
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<NonNullable<SupportRequestPayload["priority"]>>("NORMAL");
  const [state, setState] = useState(initialLoadState);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    setState((current) => ({ ...current, error: "", loading: !showRefreshing, refreshing: showRefreshing }));
    try {
      setHelp(await getAccountHelp(accessToken));
      setState({ error: "", loading: false, refreshing: false });
    } catch (caught) {
      setState({
        error: caught instanceof Error ? caught.message : "Unable to load support options.",
        loading: false,
        refreshing: false,
      });
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!accessToken) return;
    setStatus(null);
    if (!subject.trim() || !message.trim()) {
      setStatus({ tone: "error", text: "Subject and message are required." });
      return;
    }
    setSubmitting(true);
    try {
      const result = await createSupportRequest(accessToken, {
        category,
        priority,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubject("");
      setMessage("");
      setStatus({ tone: "success", text: result.message });
    } catch (caught) {
      setStatus({ tone: "error", text: caught instanceof Error ? caught.message : "Unable to create support request." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenShell
      error={state.error}
      loading={state.loading}
      onRefresh={() => void load(true)}
      refreshing={state.refreshing}
      subtitle="Documentation, tenant-admin escalation, and support requests"
      title="Help and support"
    >
      <View style={styles.helpGrid}>
        {(help?.categories ?? []).map((item) => (
          <View key={item.id} style={styles.helpCard}>
            <View style={styles.helpIcon}>
              <HelpCircle color={colors.accent} size={16} strokeWidth={2.6} />
            </View>
            <Text style={styles.helpTitle}>{item.title}</Text>
            <Text style={styles.helpBody}>{item.description}</Text>
          </View>
        ))}
      </View>

      <Card title="Create support request" icon={<Mail color={colors.primaryDark} size={18} strokeWidth={2.6} />}>
        <View style={styles.stack}>
          <ChoiceGroup
            label="Category"
            onChange={(next) => setCategory(next as SupportRequestPayload["category"])}
            options={categories}
            value={category}
          />
          <ChoiceGroup
            label="Priority"
            onChange={(next) => setPriority(next as NonNullable<SupportRequestPayload["priority"]>)}
            options={priorities}
            value={priority}
          />
          <Field label="Subject" onChangeText={setSubject} placeholder="What do you need help with?" value={subject} />
          <Field
            label="Message"
            multiline
            onChangeText={setMessage}
            placeholder="Add the issue, screen, expected behavior, and what you already tried."
            value={message}
          />
          {status ? <StatusBox tone={status.tone} text={status.text} /> : null}
          <Button
            label="Send request"
            loading={submitting}
            onPress={() => void submit()}
            rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
          />
        </View>
      </Card>

      <InfoPanel
        icon={<SlidersHorizontal color={colors.foreground} size={18} strokeWidth={2.6} />}
        title="Support routing"
        body="Requests are recorded in the tenant audit trail and sent to tenant admins as in-app notifications."
      />
    </ScreenShell>
  );
}

function ScreenShell({
  children,
  error,
  loading,
  onRefresh,
  refreshing,
  rightAction,
  subtitle,
  title,
}: {
  children: ReactNode;
  error?: string;
  loading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  rightAction?: ReactNode;
  subtitle: string;
  title: string;
}) {
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading account data</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <HeaderIcon icon={<ChevronLeft color={colors.foreground} size={22} strokeWidth={2.8} />} onPress={() => router.back()} />
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Account</Text>
            <Text style={styles.title}>{title}</Text>
            <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text>
          </View>
          {rightAction}
        </View>
        {error ? <StatusBox tone="error" text={error} /> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeaderIcon({ icon, onPress }: { icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.headerIcon}>
      {icon}
    </Pressable>
  );
}

function MetricStrip({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <View style={styles.metricStrip}>
      {items.map((item, index) => (
        <View key={item.label} style={styles.metricItem}>
          <Text style={styles.metricValue}>{item.value}</Text>
          <Text style={styles.metricLabel}>{item.label}</Text>
          {index < items.length - 1 ? <View style={styles.metricDivider} /> : null}
        </View>
      ))}
    </View>
  );
}

function SearchBox({ onChange, placeholder, value }: { onChange: (value: string) => void; placeholder: string; value: string }) {
  return (
    <View style={styles.searchBox}>
      <Search color={colors.inkSoft} size={18} strokeWidth={2.6} />
      <TextInput
        autoCapitalize="none"
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9a9388"
        style={styles.searchInput}
        value={value}
      />
    </View>
  );
}

function SectionTitle({ meta, title }: { meta?: string; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

function WorkspaceAccountRow({ workspace }: { workspace: AccountWorkspace }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)/projects")} style={styles.workspaceRow}>
      <View style={styles.workspaceIcon}>
        <BriefcaseBusiness color={colors.accent} size={19} strokeWidth={2.6} />
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.rowTitle}>{workspace.name}</Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {workspace.slug} - {workspace._count?.projects ?? 0} projects - {workspace._count?.teams ?? 0} teams
        </Text>
        {workspace.description ? <Text numberOfLines={2} style={styles.rowBody}>{workspace.description}</Text> : null}
      </View>
      <View style={styles.rowAction}>
        <Text style={styles.rowActionText}>{workspace.canManage ? "Manage" : "View"}</Text>
      </View>
    </Pressable>
  );
}

function GuestWorkspaceRow({ workspace }: { workspace: GuestWorkspace }) {
  return (
    <View style={styles.workspaceRow}>
      <View style={[styles.workspaceIcon, styles.guestIcon]}>
        <UsersRound color={colors.success} size={19} strokeWidth={2.6} />
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.rowTitle}>{workspace.name}</Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {workspace.projectCount} project{workspace.projectCount === 1 ? "" : "s"} - {workspace.role ?? "member"}
        </Text>
        <View style={styles.projectChipRow}>
          {workspace.projects.slice(0, 3).map((project) => (
            <Pressable
              accessibilityRole="button"
              key={project.id}
              onPress={() => router.push({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: project.id } })}
              style={styles.projectChip}
            >
              <Text numberOfLines={1} style={styles.projectChipText}>{project.key}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function Card({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>{icon}</View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function InfoPanel({ body, icon, title }: { body: string; icon: ReactNode; title: string }) {
  return (
    <View style={styles.infoPanel}>
      <View style={styles.cardIcon}>{icon}</View>
      <View style={styles.flex}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoBody}>{body}</Text>
      </View>
    </View>
  );
}

function EmptyState({ body, icon, title }: { body: string; icon: ReactNode; title: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function StatusBox({ text, tone }: { text: string; tone: "error" | "success" }) {
  const success = tone === "success";
  return (
    <View style={[styles.statusBox, success ? styles.statusSuccess : styles.statusError]}>
      {success ? (
        <CheckCircle2 color={colors.success} size={17} strokeWidth={2.6} />
      ) : (
        <XCircle color={colors.danger} size={17} strokeWidth={2.6} />
      )}
      <Text style={[styles.statusText, success ? styles.statusSuccessText : styles.statusErrorText]}>{text}</Text>
    </View>
  );
}

function SecurityTile({ good, label, value }: { good: boolean; label: string; value: string }) {
  return (
    <View style={styles.securityTile}>
      <View style={[styles.securityDot, { backgroundColor: good ? colors.success : colors.warning }]} />
      <Text style={styles.securityValue}>{value}</Text>
      <Text style={styles.securityLabel}>{label}</Text>
    </View>
  );
}

function BackupCodeVault({ codes }: { codes: string[] }) {
  return (
    <View style={styles.backupVault}>
      <View style={styles.backupVaultHeader}>
        <Text style={styles.backupVaultTitle}>New backup codes</Text>
        <Text style={styles.backupVaultMeta}>{codes.length} one-time codes</Text>
      </View>
      <View style={styles.backupGrid}>
        {codes.map((code) => (
          <Text key={code} selectable style={styles.backupCode}>{code}</Text>
        ))}
      </View>
      <Text style={styles.backupWarning}>Save these now. They are shown only after setup or regeneration.</Text>
    </View>
  );
}

function ChoiceGroup({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceWrap}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable
              accessibilityRole="button"
              key={option}
              onPress={() => onChange(option)}
              style={[styles.choiceChip, active ? styles.choiceChipActive : null]}
            >
              <Text style={[styles.choiceText, active ? styles.choiceTextActive : null]}>{humanize(option)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function initials(name: string, email: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const text = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.trim() || email.slice(0, 2);
  return text.toUpperCase();
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function shortDate(value?: string | null) {
  if (!value) return "n/a";
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "n/a";
  }
}

function shortDateTime(value?: string | null) {
  if (!value) return "n/a";
  try {
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return "n/a";
  }
}

function loginStatusColor(status: string, suspicious: boolean) {
  if (suspicious) return colors.danger;
  if (/success|ok|pass/i.test(status)) return colors.success;
  if (/fail|error|denied|blocked/i.test(status)) return colors.danger;
  return colors.warning;
}

const styles = StyleSheet.create(withFontStyles({
  accountAvatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  accountAvatarText: {
    color: colors.black,
    fontSize: 17,
    fontWeight: "900",
  },
  accountEmail: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  accountHero: {
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
  accountName: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
  },
  actionButton: {
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  backupCode: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: "center",
    width: "48%",
  },
  backupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  backupVault: {
    backgroundColor: colors.yellowSoft,
    borderColor: "#f5d94f",
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 10,
    padding: 13,
  },
  backupVaultHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backupVaultMeta: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  backupVaultTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  backupWarning: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    overflow: "hidden",
    ...shadow.card,
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardIcon: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 13,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  choiceChip: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  choiceChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  choiceGroup: {
    gap: 9,
  },
  choiceLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  choiceText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  choiceTextActive: {
    color: colors.white,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  content: {
    gap: 18,
    paddingBottom: 130,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  deviceIcon: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 13,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  deviceMeta: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
  },
  deviceRow: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  deviceTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  dangerAction: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
  },
  dangerActionText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
  },
  divider: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: 2,
  },
  emptyBody: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    maxWidth: 260,
    textAlign: "center",
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 22,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 9,
    padding: 24,
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
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  guestIcon: {
    backgroundColor: colors.greenSoft,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
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
  helpBody: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  helpCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 8,
    padding: 14,
    width: "48%",
  },
  helpGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  helpIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 13,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  helpTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  infoBody: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  infoPanel: {
    alignItems: "flex-start",
    backgroundColor: colors.blueSoft,
    borderColor: "#d5e5ff",
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  infoTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 3,
  },
  loadingPanel: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  loginAgent: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
  loginMeta: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  loginReason: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
    marginTop: 5,
  },
  loginRow: {
    alignItems: "flex-start",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    padding: 12,
  },
  loginStatus: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  loginStatusDot: {
    borderRadius: 999,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  loginTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  loginTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  metricDivider: {
    backgroundColor: colors.line,
    bottom: 13,
    position: "absolute",
    right: 0,
    top: 13,
    width: 1,
  },
  metricItem: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    paddingVertical: 14,
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
    overflow: "hidden",
    ...shadow.card,
  },
  metricValue: {
    color: colors.foreground,
    fontSize: 19,
    fontWeight: "900",
  },
  mfaSummary: {
    alignItems: "flex-start",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 13,
  },
  mfaSummaryBody: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  mfaSummaryIcon: {
    alignItems: "center",
    backgroundColor: colors.orangeSoft,
    borderRadius: 15,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  mfaSummaryIconGood: {
    backgroundColor: colors.greenSoft,
  },
  mfaSummaryTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  mutedText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  projectChip: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 88,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  projectChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  projectChipText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
  },
  revokeButton: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  revokeText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "900",
  },
  rowAction: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rowActionText: {
    color: colors.foreground,
    fontSize: 10,
    fontWeight: "900",
  },
  rowBody: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 6,
  },
  rowMeta: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  rowTitle: {
    color: colors.foreground,
    fontSize: 15,
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
    borderRadius: 23,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 56,
    paddingHorizontal: 16,
    ...shadow.card,
  },
  searchInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    height: 54,
  },
  sessionAgent: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },
  sessionIcon: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: 13,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  sessionMeta: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  sessionRow: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  sessionTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  sectionMeta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  securityDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  securityGrid: {
    flexDirection: "row",
    gap: 8,
  },
  securityLabel: {
    color: colors.inkSoft,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  securityTile: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    padding: 12,
  },
  securityValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  secretLabel: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  secretPanel: {
    backgroundColor: "#101010",
    borderRadius: radii.xl,
    gap: 8,
    padding: 14,
  },
  secretUrl: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 15,
  },
  secretValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  smallDarkButton: {
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  smallDarkButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "900",
  },
  stack: {
    gap: 12,
  },
  statusBox: {
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 12,
  },
  statusError: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
  },
  statusErrorText: {
    color: colors.danger,
  },
  statusSuccess: {
    backgroundColor: colors.greenSoft,
    borderColor: "#bbf7d0",
  },
  statusSuccessText: {
    color: colors.success,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17,
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 4,
  },
  title: {
    color: colors.foreground,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 34,
    marginTop: 2,
  },
  toggleRow: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 13,
  },
  toggleSub: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2,
  },
  toggleTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  workspaceIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 15,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  workspaceRow: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 14,
    ...shadow.card,
  },
}));
