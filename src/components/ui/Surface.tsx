import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, shadow } from "@/lib/theme/tokens";

type SurfaceProps = {
  children: ReactNode;
  eyebrow?: string;
  style?: StyleProp<ViewStyle>;
  title?: string;
};

export function Surface({ children, eyebrow, style, title }: SurfaceProps) {
  return (
    <View style={[styles.surface, style]}>
      {eyebrow || title ? (
        <View style={styles.header}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  header: {
    gap: 4,
    marginBottom: 14,
  },
  surface: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 18,
    ...shadow.card,
  },
  title: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
  },
});
