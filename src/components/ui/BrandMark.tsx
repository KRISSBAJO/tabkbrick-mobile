import { Blocks } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "@/lib/theme/tokens";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <View style={styles.row}>
      <View style={styles.mark}>
        <Blocks color={colors.black} size={compact ? 18 : 22} strokeWidth={2.8} />
      </View>
      {!compact ? (
        <View>
          <Text style={styles.brand}>TaskBricks</Text>
          <Text style={styles.sub}>Enterprise</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  mark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  brand: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0,
  },
  sub: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: -1,
    textTransform: "uppercase",
  },
});
