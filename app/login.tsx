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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
      <AuthShell
        title={mfaChallenge ? "Verify sign-in" : mode === "password" ? "Welcome back" : mode === "forgot" ? "Forgot password?" : "Resend verification"}
      >
        {mfaChallenge ? (
          <View style={styles.stack}>
            <View style={styles.mfaPanel}>
              <View style={styles.mfaBadge}>
                <ShieldCheck color={colors.black} size={20} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.panelTitle}>Multi-factor verification</Text>
                <Text style={styles.panelText}>{mfaChallenge.message}</Text>
              </View>
            </View>
            <Field label="Verification code" value={mfaCode} onChangeText={setMfaCode} keyboardType="number-pad" placeholder="123456" />
            {error ? <Message text={error} tone="error" /> : null}
            <Button label="Verify and sign in" loading={loading} onPress={submitMfa} rightIcon={<ShieldCheck color={colors.black} size={16} />} />
            <TextButton label="Back to password login" onPress={cancelMfa} />
          </View>
        ) : mode === "password" ? (
          <View style={styles.stack}>
            <AuthFields
              email={email}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onPasswordVisibleChange={setPasswordVisible}
              onTenantChange={setTenantSlug}
              password={password}
              passwordVisible={passwordVisible}
              tenantSlug={tenantSlug}
              onForgot={() => setMode("forgot")}
            />
            {error ? <Message text={error} tone="error" /> : null}
            {notice ? <Message text={notice} tone="success" /> : null}
            <Button label="Sign in" loading={loading} onPress={submitPassword} rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />} />
            <SsoPanel
              loading={ssoLoading}
              onFind={findSso}
              onStart={openSso}
              providers={ssoProviders}
              required={ssoRequired}
            />
            <View style={styles.footerLinks}>
              <InlineLink leading="New workspace?" label="Create account" onPress={() => router.push("/signup")} />
              <TextButton label="Resend verification email" onPress={() => setMode("resend")} />
            </View>
          </View>
        ) : (
          <View style={styles.stack}>
            <Field
              label="Workspace"
              value={tenantSlug}
              onChangeText={setTenantSlug}
              placeholder="demo"
              leftAccessory={<Text style={styles.atIcon}>@</Text>}
            />
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="admin@taskbricks.local"
              leftAccessory={<Mail color={colors.inkSoft} size={18} strokeWidth={2.3} />}
            />
            {error ? <Message text={error} tone="error" /> : null}
            {notice ? <Message text={notice} tone="success" /> : null}
            <Button
              label={mode === "forgot" ? "Send recovery link" : "Resend verification"}
              loading={loading}
              onPress={submitRecovery}
              rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
            />
            <TextButton label="Back to sign in" onPress={() => setMode("password")} />
          </View>
        )}
      </AuthShell>
    </KeyboardAvoidingView>
  );
}

type AuthFieldsProps = {
  email: string;
  onEmailChange: (value: string) => void;
  onForgot: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordVisibleChange: (value: boolean | ((visible: boolean) => boolean)) => void;
  onTenantChange: (value: string) => void;
  password: string;
  passwordVisible: boolean;
  tenantSlug: string;
};

function AuthFields({
  email,
  onEmailChange,
  onForgot,
  onPasswordChange,
  onPasswordVisibleChange,
  onTenantChange,
  password,
  passwordVisible,
  tenantSlug,
}: AuthFieldsProps) {
  return (
    <>
      <Field label="Workspace" value={tenantSlug} onChangeText={onTenantChange} placeholder="demo" leftAccessory={<Text style={styles.atIcon}>@</Text>} />
      <Field
        label="Email address"
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        placeholder="admin@taskbricks.local"
        leftAccessory={<Mail color={colors.inkSoft} size={18} strokeWidth={2.3} />}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={onPasswordChange}
        placeholder="************"
        secureTextEntry={!passwordVisible}
        leftAccessory={<KeyRound color={colors.inkSoft} size={18} strokeWidth={2.3} />}
        labelRight={<TextButton compact label="Forgot?" onPress={onForgot} />}
        rightAccessory={(
          <Pressable
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onPasswordVisibleChange((visible) => !visible)}
            style={styles.passwordToggle}
          >
            {passwordVisible ? (
              <EyeOff color={colors.inkSoft} size={20} strokeWidth={2.4} />
            ) : (
              <Eye color={colors.inkSoft} size={20} strokeWidth={2.4} />
            )}
          </Pressable>
        )}
      />
    </>
  );
}

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
    <View style={styles.ssoPanel}>
      <Button
        label="Find SSO"
        loading={loading}
        onPress={onFind}
        leftIcon={<ShieldCheck color={colors.black} size={15} strokeWidth={2.5} />}
        variant="outline"
      />
      {required ? <Message text="This workspace requires SSO. Use one of the providers below." tone="success" /> : null}
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

function Message({ text, tone }: { text: string; tone: "error" | "success" }) {
  return (
    <View style={[styles.message, tone === "error" ? styles.errorMessage : styles.successMessage]}>
      <Text style={[styles.messageText, tone === "error" ? styles.errorText : styles.successText]}>{text}</Text>
    </View>
  );
}

function TextButton({ compact = false, label, onPress }: { compact?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress}>
      <Text style={[styles.textButton, compact ? styles.textButtonCompact : null]}>{label}</Text>
    </Pressable>
  );
}

function InlineLink({ label, leading, onPress }: { label: string; leading: string; onPress: () => void }) {
  return (
    <View style={styles.inlineLink}>
      <Text style={styles.inlineLeading}>{leading}</Text>
      <TextButton compact label={label} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  atIcon: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: "900",
  },
  errorMessage: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
  },
  errorText: {
    color: colors.danger,
  },
  flex: {
    flex: 1,
  },
  footerLinks: {
    alignItems: "center",
    gap: 14,
    paddingTop: 12,
  },
  inlineLeading: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
  },
  inlineLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  keyboard: {
    flex: 1,
  },
  message: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
  },
  messageText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  mfaBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  mfaPanel: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  panelText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  panelTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  passwordToggle: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  ssoPanel: {
    gap: 12,
    paddingTop: 2,
  },
  stack: {
    gap: 20,
  },
  successMessage: {
    backgroundColor: colors.greenSoft,
    borderColor: "#bbf7d0",
  },
  successText: {
    color: colors.success,
  },
  textButton: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  textButtonCompact: {
    fontSize: 12,
  },
});
