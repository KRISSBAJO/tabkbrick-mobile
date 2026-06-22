import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "@/lib/theme/tokens";

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  tone?: "dark" | "light" | "yellow";
  value: string;
};

export function MetricCard({ icon: Icon, label, tone = "light", value }: MetricCardProps) {
  const dark = tone === "dark";
  const yellow = tone === "yellow";

  return (
    <View style={[styles.card, dark ? styles.dark : yellow ? styles.yellow : styles.light]}>
      <View style={[styles.icon, dark ? styles.darkIcon : styles.lightIcon]}>
        <Icon color={dark ? colors.primary : colors.black} size={18} strokeWidth={2.6} />
      </View>
      <Text style={[styles.value, dark ? styles.lightText : styles.darkText]}>{value}</Text>
      <Text style={[styles.label, dark ? styles.subtleLight : styles.subtleDark]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flex: 1,
    minHeight: 128,
    minWidth: 0,
    padding: 15,
  },
  dark: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  darkIcon: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  darkText: {
    color: colors.foreground,
  },
  icon: {
    alignItems: "center",
    borderRadius: radii.lg,
    height: 38,
    justifyContent: "center",
    marginBottom: 14,
    width: 38,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
    marginTop: 3,
  },
  light: {
    backgroundColor: colors.white,
  },
  lightIcon: {
    backgroundColor: colors.panelMuted,
  },
  lightText: {
    color: colors.white,
  },
  subtleDark: {
    color: colors.inkSoft,
  },
  subtleLight: {
    color: "rgba(255,255,255,0.58)",
  },
  value: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0,
  },
  yellow: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
});
