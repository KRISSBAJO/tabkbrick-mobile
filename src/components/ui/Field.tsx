import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radii } from "@/lib/theme/tokens";

type FieldProps = TextInputProps & {
  label: string;
  rightAccessory?: ReactNode;
};

export function Field({ label, rightAccessory, style, ...props }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          autoCapitalize="none"
          placeholderTextColor="#a39d90"
          style={[styles.input, style]}
          {...props}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accessory: {
    alignItems: "center",
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    height: 46,
    paddingHorizontal: 14,
  },
  inputWrap: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    height: 48,
    overflow: "hidden",
  },
  label: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  wrap: {
    gap: 7,
  },
});
