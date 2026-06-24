import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowRight, Building2, Eye, EyeOff, KeyRound, Mail, UserRound } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { AuthShell } from "@/features/auth/AuthShell";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii } from "@/lib/theme/tokens";

export default function SignupScreen() {
  const { signUp } = useAuthSession();
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ devLink?: string; message: string } | null>(null);

  async function submit() {
    setError("");
    setNotice(null);
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp({ email, firstName, lastName, password, tenantName, tenantSlug });
      if (result.status === "verification") {
        setNotice({ devLink: result.devLink, message: result.message });
        return;
      }
      router.replace("/(workspace)");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create workspace.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
      <AuthShell
        badge="Free to start"
        title="Create workspace"
        subtitle="Set up your team in under 2 minutes"
      >
        <View style={styles.stack}>

          {/* ── Workspace section ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldGroupLabel}>Workspace</Text>
            <View style={styles.fields}>
              <Field
                label="Organization name"
                value={tenantName}
                onChangeText={setTenantName}
                placeholder="Acme Inc."
                leftAccessory={<Building2 color={colors.inkSoft} size={18} strokeWidth={2.3} />}
              />
              <View style={styles.fieldDivider} />
              <Field
                label="Workspace URL"
                value={tenantSlug}
                onChangeText={(value) => setTenantSlug(slugify(value))}
                placeholder="acme"
                leftAccessory={<Text style={styles.atIcon}>@</Text>}
                helperText="Letters, numbers and hyphens only"
              />
            </View>
          </View>

          {/* ── Account section ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldGroupLabel}>Your account</Text>
            <View style={styles.fields}>
              <View style={styles.nameRow}>
                <View style={styles.nameField}>
                  <Field
                    label="First name"
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Ada"
                    leftAccessory={<UserRound color={colors.inkSoft} size={18} strokeWidth={2.3} />}
                  />
                </View>
                <View style={styles.nameDividerV} />
                <View style={styles.nameField}>
                  <Field
                    label="Last name"
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Lovelace"
                  />
                </View>
              </View>
              <View style={styles.fieldDivider} />
              <Field
                label="Work email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                placeholder="ada@acme.com"
                leftAccessory={<Mail color={colors.inkSoft} size={18} strokeWidth={2.3} />}
              />
              <View style={styles.fieldDivider} />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 12 characters"
                secureTextEntry={!passwordVisible}
                leftAccessory={<KeyRound color={colors.inkSoft} size={18} strokeWidth={2.3} />}
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

          {error ? <ErrorMessage text={error} /> : null}
          {notice ? <SuccessNotice devLink={notice.devLink} message={notice.message} /> : null}

          <Button
            label="Create workspace"
            loading={loading}
            onPress={submit}
            rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
          />

          {/* Trust signal */}
          <Text style={styles.trustNote}>
            By creating a workspace you agree to our Terms and Privacy Policy.
          </Text>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerMuted}>Already have a workspace?</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push("/login")}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </View>

        </View>
      </AuthShell>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ErrorMessage({ text }: { text: string }) {
  return (
    <View style={styles.errorMsg}>
      <Text style={styles.errorTxt}>{text}</Text>
    </View>
  );
}

function SuccessNotice({ devLink, message }: { devLink?: string; message: string }) {
  return (
    <View style={styles.successMsg}>
      <Text style={styles.successTxt}>{message}</Text>
      {devLink ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => void WebBrowser.openBrowserAsync(devLink)}
          style={styles.devLinkBtn}
        >
          <Text style={styles.devLinkText}>Open verification link</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "");
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  atIcon: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: "900",
  },
  devLinkBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  devLinkText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  errorMsg: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 13,
  },
  errorTxt: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
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
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
  },
  footerLink: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  footerMuted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  keyboard: {
    flex: 1,
  },
  nameDividerV: {
    backgroundColor: colors.line,
    width: 1,
  },
  nameField: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
  },
  stack: {
    gap: 22,
  },
  successMsg: {
    backgroundColor: colors.greenSoft,
    borderColor: "#bbf7d0",
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 13,
  },
  successTxt: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  trustNote: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center",
  },
});
