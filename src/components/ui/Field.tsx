import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radii } from "@/lib/theme/tokens";

type FieldProps = TextInputProps & {
  label: string;
};

export function Field({ label, style, ...props }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        placeholderTextColor="#a39d90"
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    height: 48,
    paddingHorizontal: 14,
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
