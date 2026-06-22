import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme/tokens";

type Tone = "blue" | "green" | "red" | "yellow" | "neutral";

const toneStyles: Record<Tone, { backgroundColor: string; color: string }> = {
  blue: { backgroundColor: colors.blueSoft, color: colors.accent },
  green: { backgroundColor: colors.greenSoft, color: colors.success },
  neutral: { backgroundColor: colors.panelMuted, color: colors.inkSoft },
  red: { backgroundColor: colors.redSoft, color: colors.danger },
  yellow: { backgroundColor: colors.yellowSoft, color: colors.warning },
};

type StatusPillProps = {
  label: string;
  tone?: Tone;
};

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  const toneStyle = toneStyles[tone];
  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.backgroundColor }]}>
      <Text style={[styles.text, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
});
