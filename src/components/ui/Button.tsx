import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii } from "@/lib/theme/tokens";

type ButtonVariant = "primary" | "dark" | "outline" | "ghost";

type ButtonProps = PressableProps & {
  label: string;
  leftIcon?: ReactNode;
  loading?: boolean;
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
};

export function Button({ disabled, label, leftIcon, loading = false, rightIcon, style, variant = "primary", ...props }: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.disabled : null,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.black : colors.white} size="small" />
      ) : (
        <>
          {leftIcon}
          <Text style={[styles.label, variant === "primary" || variant === "outline" || variant === "ghost" ? styles.darkLabel : styles.lightLabel]}>
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  dark: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  darkLabel: {
    color: colors.black,
  },
  disabled: {
    opacity: 0.55,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  label: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0,
  },
  lightLabel: {
    color: colors.white,
  },
  outline: {
    backgroundColor: colors.white,
    borderColor: colors.line,
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
