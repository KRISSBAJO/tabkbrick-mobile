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
      const result = await signUp({
        email,
        firstName,
        lastName,
        password,
        tenantName,
        tenantSlug,
      });
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
        title="Create workspace"
      >
        <View style={styles.stack}>
          <Field
            label="Organization"
            value={tenantName}
            onChangeText={setTenantName}
            placeholder="Acme Inc."
            leftAccessory={<Building2 color={colors.inkSoft} size={18} strokeWidth={2.3} />}
          />

          <Field
            label="Workspace"
            value={tenantSlug}
            onChangeText={(value) => setTenantSlug(slugify(value))}
            placeholder="acme"
            leftAccessory={<Text style={styles.atIcon}>@</Text>}
          />

          <Field
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Ada"
            leftAccessory={<UserRound color={colors.inkSoft} size={18} strokeWidth={2.3} />}
          />

          <Field label="Last name" value={lastName} onChangeText={setLastName} placeholder="Lovelace" />

          <Field
            label="Work email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="ada@acme.com"
            leftAccessory={<Mail color={colors.inkSoft} size={18} strokeWidth={2.3} />}
          />

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
                onPress={() => setPasswordVisible((visible) => !visible)}
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

          {error ? <Message text={error} /> : null}
          {notice ? <Notice devLink={notice.devLink} message={notice.message} /> : null}

          <Button
            label="Create workspace"
            loading={loading}
            onPress={submit}
            rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
          />

          <View style={styles.footerLink}>
            <Text style={styles.footerText}>Already have a workspace?</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push("/login")}>
              <Text style={styles.footerAction}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </AuthShell>
    </KeyboardAvoidingView>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View style={styles.errorMessage}>
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

function Notice({ devLink, message }: { devLink?: string; message: string }) {
  return (
    <View style={styles.noticeMessage}>
      <Text style={styles.noticeText}>{message}</Text>
      {devLink ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void WebBrowser.openBrowserAsync(devLink)} style={styles.noticeLinkWrap}>
          <Text style={styles.noticeLink}>Open local verification link</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "");
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
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  footerAction: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  footerLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    paddingTop: 4,
  },
  footerText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  keyboard: {
    flex: 1,
  },
  noticeLink: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  noticeLinkWrap: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  noticeMessage: {
    backgroundColor: colors.greenSoft,
    borderColor: "#bbf7d0",
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
  },
  noticeText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  passwordToggle: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  stack: {
    gap: 20,
  },
});
