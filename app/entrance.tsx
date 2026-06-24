import { useEffect, useState } from "react";
import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Blocks } from "lucide-react-native";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii } from "@/lib/theme/tokens";

export default function EntranceScreen() {
  const { initializing, user } = useAuthSession();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (initializing || user) return;
    const id = setTimeout(() => setReady(true), 840);
    return () => clearTimeout(id);
  }, [initializing, user]);

  if (!initializing && user) {
    return <Redirect href="/(workspace)" />;
  }

  if (!ready || initializing) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={colors.foreground} style="light" />

      {/* ── Brand hero ─────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.emblemWrap}>
          <View style={styles.emblemGlow} />
          <View style={styles.emblem}>
            <Blocks color={colors.black} size={38} strokeWidth={2.8} />
          </View>
        </View>

        <Text style={styles.appName}>TaskBricks</Text>
        <Text style={styles.appTag}>Enterprise</Text>
      </View>

      {/* ── Tagline ────────────────────────────────────── */}
      <Text style={styles.tagline}>
        Projects, sprints, teams and docs — in one mobile workspace.
      </Text>

      {/* ── CTAs ───────────────────────────────────────── */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/login")}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
        >
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/signup")}
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
        >
          <Text style={styles.ghostBtnText}>Create workspace</Text>
        </Pressable>

        <Text style={styles.legal}>Terms of Service · Privacy Policy</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Splash ──────────────────────────────────────────────────────────────────

function SplashScreen() {
  return (
    <SafeAreaView style={styles.splash}>
      <StatusBar backgroundColor={colors.foreground} style="light" />
      <View style={styles.splashMark}>
        <Blocks color={colors.black} size={32} strokeWidth={2.8} />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Root ──
  safe: {
    backgroundColor: colors.foreground,
    flex: 1,
    paddingBottom: 32,
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  splash: {
    alignItems: "center",
    backgroundColor: colors.foreground,
    flex: 1,
    justifyContent: "center",
  },
  splashMark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii["2xl"],
    height: 76,
    justifyContent: "center",
    width: 76,
  },

  // ── Hero ──
  hero: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 48,
  },
  emblemWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
  },
  emblemGlow: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 110,
    opacity: 0.13,
    position: "absolute",
    width: 110,
  },
  emblem: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii["2xl"],
    height: 84,
    justifyContent: "center",
    width: 84,
  },
  appName: {
    color: colors.white,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 4,
  },
  appTag: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.8,
    marginTop: 8,
    opacity: 0.82,
    textTransform: "uppercase",
  },

  // ── Tagline ──
  tagline: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 36,
    maxWidth: 300,
    textAlign: "center",
    alignSelf: "center",
  },

  // ── Actions ──
  actions: {
    gap: 12,
  },
  primaryBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    height: 58,
    justifyContent: "center",
  },
  primaryBtnPressed: {
    opacity: 0.88,
  },
  primaryBtnText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  ghostBtn: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: radii.xl,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
  },
  ghostBtnPressed: {
    borderColor: "rgba(255,255,255,0.32)",
    opacity: 0.76,
  },
  ghostBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  legal: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },
});
