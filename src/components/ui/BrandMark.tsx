import { Blocks } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "@/lib/theme/tokens";

type BrandMarkProps = {
  compact?: boolean;
  variant?: "dark" | "light";
};

export function BrandMark({ compact = false, variant = "dark" }: BrandMarkProps) {
  const onDark = variant === "light";
  return (
    <View style={styles.row}>
      <View style={styles.mark}>
        <Blocks color={colors.black} size={compact ? 18 : 24} strokeWidth={2.8} />
      </View>
      {!compact ? (
        <View>
          <Text style={[styles.brand, onDark ? styles.brandLight : null]}>TaskBricks</Text>
          <Text style={[styles.sub, onDark ? styles.subLight : null]}>Enterprise</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  brandLight: {
    color: colors.white,
  },
  mark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
  },
  sub: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: -1,
    textTransform: "uppercase",
  },
  subLight: {
    color: "rgba(255,255,255,0.46)",
  },
});
