import type { ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "@/components/ui/BrandMark";
import { colors, radii } from "@/lib/theme/tokens";

type AuthShellProps = {
  badge?: string;
  children: ReactNode;
  subtitle?: string;
  title: string;
};

export function AuthShell({ badge, children, subtitle, title }: AuthShellProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={colors.foreground} style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Dark hero band */}
        <View style={styles.hero}>
          <BrandMark variant="light" />

          <View style={styles.heroText}>
            {badge ? (
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>{badge}</Text>
              </View>
            ) : null}
            <Text style={styles.heroTitle}>{title}</Text>
            {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        {/* Form panel */}
        <View style={styles.panel}>
          <View style={styles.panelBody}>{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badgePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,212,0,0.15)",
    borderColor: "rgba(255,212,0,0.28)",
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgePillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  hero: {
    backgroundColor: colors.foreground,
    gap: 28,
    paddingBottom: 52,
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 23,
    maxWidth: 320,
  },
  heroText: {
    gap: 10,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 44,
    maxWidth: 340,
  },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    flex: 1,
    marginTop: -28,
    minHeight: 520,
  },
  panelBody: {
    gap: 28,
    paddingBottom: 56,
    paddingHorizontal: 26,
    paddingTop: 38,
  },
  safe: {
    backgroundColor: colors.foreground,
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
});
