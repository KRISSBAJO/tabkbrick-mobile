import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { AuthShell } from "@/features/auth/AuthShell";
import { discoverSso, forgotPassword, resendVerification, startSso } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii } from "@/lib/theme/tokens";

type AuthMode = "password" | "forgot" | "resend";
type SsoDiscovery = Awaited<ReturnType<typeof discoverSso>>;
type SsoProvider = SsoDiscovery["providers"][number];

export default function LoginScreen() {
  const { cancelMfa, mfaChallenge, signIn, verifyMfa } = useAuthSession();
  const [mode, setMode] = useState<AuthMode>("password");
  const [tenantSlug, setTenantSlug] = useState("demo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const [ssoRequired, setSsoRequired] = useState(false);

  async function submitPassword() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await signIn({ tenantSlug, email, password });
      if (result.status === "authenticated") {
        router.replace("/(workspace)");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function submitMfa() {
    setLoading(true);
    setError("");
    try {
      await verifyMfa(mfaCode, true);
      router.replace("/(workspace)");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify MFA.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRecovery() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        await forgotPassword({ tenantSlug, email });
        setNotice("If that account exists, a password reset link has been sent.");
      } else {
        await resendVerification({ tenantSlug, email });
        setNotice("If that account needs verification, a new email has been sent.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send request.");
    } finally {
      setLoading(false);
    }
  }

  async function findSso() {
    setSsoLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await discoverSso({ email: email.trim() || undefined, tenantSlug: tenantSlug.trim() || undefined });
      setSsoProviders(result.providers);
      setSsoRequired(Boolean(result.ssoRequired));
      if (!result.providers.length) {
        setNotice("No active SSO provider is configured for that workspace or email domain.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to discover SSO providers.");
    } finally {
      setSsoLoading(false);
    }
  }

  async function openSso(provider: SsoProvider) {
    setSsoLoading(true);
    setError("");
    try {
      const result = await startSso({
        providerId: provider.id,
        redirectUri: "taskbricks://sso/callback",
        tenantSlug,
      });
      await WebBrowser.openBrowserAsync(result.authorizationUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start SSO.");
    } finally {
      setSsoLoading(false);
    }
  }

  const shellTitle = mfaChallenge
    ? "Verify sign-in"
    : mode === "password"
    ? "Welcome back"
    : mode === "forgot"
    ? "Reset password"
    : "Resend email";

  const shellSubtitle = mfaChallenge
    ? "Enter the code from your authenticator app"
    : mode === "password"
    ? "Sign in to your workspace"
    : mode === "forgot"
    ? "We'll send a reset link to your inbox"
    : "Get a new verification email";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
      <AuthShell title={shellTitle} subtitle={shellSubtitle}>

        {mfaChallenge ? (
          <View style={styles.stack}>
            {/* MFA card */}
            <View style={styles.mfaCard}>
              <View style={styles.mfaIconBox}>
                <ShieldCheck color={colors.black} size={22} strokeWidth={2.6} />
              </View>
              <View style={styles.mfaCopy}>
                <Text style={styles.mfaCardTitle}>Multi-factor verification</Text>
                <Text style={styles.mfaCardText}>{mfaChallenge.message}</Text>
              </View>
            </View>

            <Field
              label="Verification code"
              value={mfaCode}
              onChangeText={setMfaCode}
              keyboardType="number-pad"
              placeholder="6-digit code"
            />

            {error ? <StatusMessage text={error} tone="error" /> : null}

            <Button
              label="Verify and sign in"
              loading={loading}
              onPress={submitMfa}
              rightIcon={<ShieldCheck color={colors.black} size={16} />}
            />
            <LinkButton label="Back to password login" onPress={cancelMfa} />
          </View>

        ) : mode === "password" ? (
          <View style={styles.stack}>
            {/* Credential fields */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldGroupLabel}>Credentials</Text>
              <View style={styles.fields}>
                <Field
                  label="Workspace"
                  value={tenantSlug}
                  onChangeText={setTenantSlug}
                  placeholder="your-workspace"
                  leftAccessory={<Text style={styles.atIcon}>@</Text>}
                />
                <View style={styles.fieldDivider} />
                <Field
                  label="Email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  placeholder="you@company.com"
                  leftAccessory={<Mail color={colors.inkSoft} size={18} strokeWidth={2.3} />}
                />
                <View style={styles.fieldDivider} />
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="············"
                  secureTextEntry={!passwordVisible}
                  leftAccessory={<KeyRound color={colors.inkSoft} size={18} strokeWidth={2.3} />}
                  labelRight={<LinkButton compact label="Forgot?" onPress={() => setMode("forgot")} />}
                  rightAccessory={(
                    <Pressable
                      accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setPasswordVisible((v) => !v)}
                      style={styles.eyeBtn}
                    >
                      {passwordVisible
                        ? <EyeOff color={colors.inkSoft} size={20} strokeWidth={2.4} />
                        : <Eye color={colors.inkSoft} size={20} strokeWidth={2.4} />}
                    </Pressable>
                  )}
                />
              </View>
            </View>

            {error ? <StatusMessage text={error} tone="error" /> : null}
            {notice ? <StatusMessage text={notice} tone="success" /> : null}

            <Button
              label="Sign in"
              loading={loading}
              onPress={submitPassword}
              rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
            />

            {/* SSO divider */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            <SsoPanel
              loading={ssoLoading}
              onFind={findSso}
              onStart={openSso}
              providers={ssoProviders}
              required={ssoRequired}
            />

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.footerRow}>
                <Text style={styles.footerMuted}>New to TaskBricks?</Text>
                <LinkButton compact label="Create workspace" onPress={() => router.push("/signup")} />
              </View>
              <LinkButton label="Resend verification email" onPress={() => setMode("resend")} />
            </View>
          </View>

        ) : (
          /* Forgot / resend mode */
          <View style={styles.stack}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldGroupLabel}>Your details</Text>
              <View style={styles.fields}>
                <Field
                  label="Workspace"
                  value={tenantSlug}
                  onChangeText={setTenantSlug}
                  placeholder="your-workspace"
                  leftAccessory={<Text style={styles.atIcon}>@</Text>}
                />
                <View style={styles.fieldDivider} />
                <Field
                  label="Email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  placeholder="you@company.com"
                  leftAccessory={<Mail color={colors.inkSoft} size={18} strokeWidth={2.3} />}
                />
              </View>
            </View>

            {error ? <StatusMessage text={error} tone="error" /> : null}
            {notice ? <StatusMessage text={notice} tone="success" /> : null}

            <Button
              label={mode === "forgot" ? "Send reset link" : "Resend verification"}
              loading={loading}
              onPress={submitRecovery}
              rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
            />
            <LinkButton label="Back to sign in" onPress={() => setMode("password")} />
          </View>
        )}

      </AuthShell>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SsoPanel({
  loading,
  onFind,
  onStart,
  providers,
  required,
}: {
  loading: boolean;
  onFind: () => void;
  onStart: (provider: SsoProvider) => void;
  providers: SsoProvider[];
  required: boolean;
}) {
  return (
    <View style={styles.ssoStack}>
      <Button
        label="Find SSO provider"
        loading={loading}
        onPress={onFind}
        leftIcon={<ShieldCheck color={colors.foreground} size={15} strokeWidth={2.5} />}
        variant="outline"
      />
      {required ? (
        <StatusMessage text="This workspace requires SSO. Use one of the providers below." tone="success" />
      ) : null}
      {providers.map((provider) => (
        <Button
          key={provider.id}
          label={provider.buttonLabel || `Continue with ${provider.name}`}
          onPress={() => onStart(provider)}
          rightIcon={<ArrowRight color={colors.primary} size={16} strokeWidth={2.8} />}
          variant="dark"
        />
      ))}
    </View>
  );
}

function StatusMessage({ text, tone }: { text: string; tone: "error" | "success" }) {
  return (
    <View style={[styles.message, tone === "error" ? styles.errorMsg : styles.successMsg]}>
      <Text style={[styles.messageText, tone === "error" ? styles.errorTxt : styles.successTxt]}>{text}</Text>
    </View>
  );
}

function LinkButton({ compact = false, label, onPress }: { compact?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress}>
      <Text style={[styles.linkBtn, compact ? styles.linkBtnCompact : null]}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  atIcon: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: "900",
  },
  errorMsg: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
  },
  errorTxt: {
    color: colors.danger,
  },
  eyeBtn: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  fieldDivider: {
    backgroundColor: colors.line,
    height: 1,
    marginHorizontal: 4,
  },
  fieldGroup: {
    gap: 10,
  },
  fieldGroupLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginLeft: 2,
    textTransform: "uppercase",
  },
  fields: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  footer: {
    alignItems: "center",
    gap: 12,
    paddingTop: 4,
  },
  footerMuted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  keyboard: {
    flex: 1,
  },
  linkBtn: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  linkBtnCompact: {
    fontSize: 12,
  },
  message: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 13,
  },
  messageText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  mfaCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  mfaCardText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  mfaCardTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  mfaCopy: {
    flex: 1,
    gap: 3,
  },
  mfaIconBox: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  orLine: {
    backgroundColor: colors.line,
    flex: 1,
    height: 1,
  },
  orRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  orText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  ssoStack: {
    gap: 12,
  },
  stack: {
    gap: 22,
  },
  successMsg: {
    backgroundColor: colors.greenSoft,
    borderColor: "#bbf7d0",
  },
  successTxt: {
    color: colors.success,
  },
});
