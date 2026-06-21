import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radii } from "@/lib/theme/tokens";

type FieldProps = TextInputProps & {
  helperText?: string;
  label: string;
  labelRight?: ReactNode;
  leftAccessory?: ReactNode;
  rightAccessory?: ReactNode;
};

export function Field({ helperText, label, labelRight, leftAccessory, multiline, rightAccessory, style, ...props }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelRight}
      </View>
      <View style={[styles.inputWrap, multiline ? styles.inputWrapMultiline : null]}>
        {leftAccessory ? <View style={styles.accessory}>{leftAccessory}</View> : null}
        <TextInput
          autoCapitalize="none"
          multiline={multiline}
          placeholderTextColor="#a39d90"
          style={[
            styles.input,
            multiline ? styles.inputMultiline : null,
            leftAccessory ? styles.inputWithLeftAccessory : null,
            style,
          ]}
          {...props}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
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
  helper: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  input: {
    backgroundColor: colors.white,
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    height: 46,
    paddingHorizontal: 14,
  },
  inputWithLeftAccessory: {
    paddingLeft: 0,
  },
  inputMultiline: {
    height: 104,
    paddingTop: 13,
    textAlignVertical: "top",
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
  inputWrapMultiline: {
    alignItems: "flex-start",
    height: 106,
  },
  label: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  wrap: {
    gap: 7,
  },
});
