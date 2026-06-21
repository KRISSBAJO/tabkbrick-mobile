import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "@/components/ui/BrandMark";
import { colors, spacing } from "@/lib/theme/tokens";

type AuthShellProps = {
  badge?: string;
  children: ReactNode;
  subtitle?: string;
  title: string;
};

export function AuthShell({ badge, children, subtitle, title }: AuthShellProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <BrandMark />
        </View>

        <View style={styles.header}>
          {badge ? <Text style={styles.badgeText}>{badge}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badgeText: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  body: {
    gap: spacing["2xl"],
  },
  brandRow: {
    paddingTop: 10,
  },
  content: {
    gap: 34,
    padding: 24,
    paddingBottom: 54,
  },
  header: {
    gap: 10,
  },
  safe: {
    backgroundColor: "#fffdf3",
    flex: 1,
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    maxWidth: 350,
  },
  title: {
    color: colors.foreground,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 39,
    maxWidth: 360,
  },
});
