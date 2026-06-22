import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "@/lib/theme/tokens";

type Option = {
  label: string;
  value: string;
};

type ProjectSelectorProps<TValue extends string> = {
  label: string;
  onChange: (value: TValue) => void;
  options: readonly Option[];
  value: TValue;
};

export function ProjectSelector<TValue extends string>({ label, onChange, options, value }: ProjectSelectorProps<TValue>) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => onChange(option.value as TValue)}
              style={[styles.option, selected ? styles.optionSelected : null]}
            >
              <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  option: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  optionText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  optionTextSelected: {
    color: colors.black,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  wrap: {
    gap: 8,
  },
});
