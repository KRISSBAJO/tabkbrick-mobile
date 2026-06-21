import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Screen } from "@/components/ui/Screen";
import { Surface } from "@/components/ui/Surface";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii, shadow } from "@/lib/theme/tokens";

export default function LoginScreen() {
  const { mfaChallenge, signIn, verifyMfa } = useAuthSession();
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitPassword() {
    setLoading(true);
    setError("");
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
      <Screen>
        <View style={styles.hero}>
          <BrandMark />
          <Text style={styles.title}>Secure workspace command</Text>
          <Text style={styles.subtitle}>Project delivery, meetings, work queues, and operational controls in one mobile cockpit.</Text>
        </View>

        <Surface style={styles.form}>
          {!mfaChallenge ? (
            <View style={styles.stack}>
              <Field label="Tenant" value={tenantSlug} onChangeText={setTenantSlug} placeholder="demo" />
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@company.com" />
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Sign in" loading={loading} onPress={submitPassword} />
            </View>
          ) : (
            <View style={styles.stack}>
              <View style={styles.mfaBadge}>
                <ShieldCheck color={colors.black} size={20} />
              </View>
              <Text style={styles.mfaTitle}>Verify sign-in</Text>
              <Text style={styles.mfaText}>{mfaChallenge.message}</Text>
              <Field label="Authenticator code" value={mfaCode} onChangeText={setMfaCode} keyboardType="number-pad" placeholder="123456" />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Verify and continue" loading={loading} onPress={submitMfa} />
            </View>
          )}
        </Surface>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  error: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    padding: 12,
  },
  form: {
    marginTop: 6,
  },
  hero: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 16,
    padding: 20,
    ...shadow.card,
  },
  keyboard: {
    flex: 1,
  },
  mfaBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  mfaText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  mfaTitle: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "900",
  },
  stack: {
    gap: 14,
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    maxWidth: 310,
  },
  title: {
    color: colors.foreground,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 36,
    maxWidth: 310,
  },
});
