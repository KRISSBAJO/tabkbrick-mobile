import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CalendarDays, Check, X } from "lucide-react-native";
import { colors, radii, shadow } from "@/lib/theme/tokens";

type RollerDateFieldProps = {
  helperText?: string;
  label: string;
  onClear: () => void;
  onPress: () => void;
  placeholder: string;
  value: string;
};

type InlineDateRollerPickerProps = {
  onClose: () => void;
  onSelect: (value: string) => void;
  title: string;
  value: string;
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function RollerDateField({ helperText, label, onClear, onPress, placeholder, value }: RollerDateFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.dateField}>
        <View style={styles.dateIcon}>
          <CalendarDays color={colors.foreground} size={18} strokeWidth={2.6} />
        </View>
        <View style={styles.dateTextWrap}>
          <Text style={[styles.dateValue, value ? null : styles.datePlaceholder]}>{value || placeholder}</Text>
          <Text style={styles.dateHint}>{helperText ?? "Tap to choose year, month, and day"}</Text>
        </View>
        {value ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onClear} style={styles.clearDateButton}>
            <X color={colors.inkSoft} size={16} strokeWidth={2.8} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

export function InlineDateRollerPicker({ onClose, onSelect, title, value }: InlineDateRollerPickerProps) {
  const today = useMemo(() => new Date(), []);
  const initial = parseDateValue(value) ?? today;
  const currentYear = today.getFullYear();
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth() + 1);
  const [day, setDay] = useState(initial.getDate());

  const years = useMemo(() => yearRange(currentYear, year), [currentYear, year]);
  const days = useMemo(() => daysInMonth(year, month), [month, year]);

  useEffect(() => {
    const next = parseDateValue(value) ?? today;
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setDay(next.getDate());
  }, [today, value]);

  useEffect(() => {
    setDay((current) => Math.min(current, days));
  }, [days]);

  function applyDate(nextDate?: Date) {
    if (nextDate) {
      onSelect(formatDateValue(nextDate));
      return;
    }
    onSelect(formatDateValue(new Date(year, month - 1, day)));
  }

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.scrim} />
      <View style={styles.panel}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Date picker</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
            <X color={colors.foreground} size={20} strokeWidth={2.8} />
          </Pressable>
        </View>

        <View style={styles.quickRail}>
          <QuickDate active={value === formatDateValue(today)} label="Today" onPress={() => applyDate(today)} />
          <QuickDate active={value === formatDateValue(addDays(today, 1))} label="Tomorrow" onPress={() => applyDate(addDays(today, 1))} />
          <QuickDate active={value === formatDateValue(addDays(today, 7))} label="Next week" onPress={() => applyDate(addDays(today, 7))} />
          <QuickDate active={!value} label="No date" onPress={() => onSelect("")} />
        </View>

        <View style={styles.rollerWrap}>
          <RollerColumn
            label="Year"
            onSelect={setYear}
            options={years.map((item) => ({ label: String(item), value: item }))}
            value={year}
          />
          <RollerColumn
            label="Month"
            onSelect={setMonth}
            options={monthLabels.map((label, index) => ({ label, value: index + 1 }))}
            value={month}
          />
          <RollerColumn
            label="Day"
            onSelect={setDay}
            options={Array.from({ length: days }, (_, index) => ({ label: String(index + 1).padStart(2, "0"), value: index + 1 }))}
            value={day}
          />
        </View>

        <Pressable accessibilityRole="button" onPress={() => applyDate()} style={styles.applyBtn}>
          <Check color={colors.black} size={17} strokeWidth={3} />
          <Text style={styles.applyText}>Set date</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RollerColumn({
  label,
  onSelect,
  options,
  value,
}: {
  label: string;
  onSelect: (value: number) => void;
  options: Array<{ label: string; value: number }>;
  value: number;
}) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  return (
    <View style={styles.rollerColumn}>
      <Text style={styles.rollerLabel}>{label}</Text>
      <ScrollView
        contentContainerStyle={styles.rollerList}
        contentOffset={{ x: 0, y: Math.max(0, selectedIndex * 46 - 84) }}
        showsVerticalScrollIndicator={false}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              key={`${label}-${option.value}`}
              onPress={() => onSelect(option.value)}
              style={[styles.rollerItem, active ? styles.rollerItemActive : null]}
            >
              <Text style={[styles.rollerItemText, active ? styles.rollerItemTextActive : null]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function QuickDate({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.quickBtn, active ? styles.quickBtnActive : null]}>
      <Text style={[styles.quickText, active ? styles.quickTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) return null;
  return parsed;
}

function yearRange(currentYear: number, selectedYear: number) {
  const min = Math.min(currentYear - 3, selectedYear - 1);
  const max = Math.max(currentYear + 8, selectedYear + 1);
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

const styles = StyleSheet.create({
  applyBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 52,
    justifyContent: "center",
  },
  applyText: { color: colors.black, fontSize: 14, fontWeight: "900" },
  clearDateButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  closeBtn: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 16,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  dateField: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 14,
  },
  dateHint: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  dateIcon: {
    alignItems: "center",
    backgroundColor: colors.yellowSoft,
    borderRadius: 16,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  datePlaceholder: { color: colors.inkSoft },
  dateTextWrap: { flex: 1, minWidth: 0 },
  dateValue: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  fieldLabel: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  fieldWrap: { gap: 8 },
  header: { alignItems: "flex-start", flexDirection: "row", gap: 14, justifyContent: "space-between" },
  layer: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 30 },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    gap: 16,
    padding: 20,
    paddingBottom: 28,
    ...shadow.heavy,
  },
  quickBtn: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  quickBtnActive: { backgroundColor: colors.black, borderColor: colors.black },
  quickRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  quickTextActive: { color: colors.white },
  rollerColumn: { flex: 1, gap: 8, minWidth: 0 },
  rollerItem: {
    alignItems: "center",
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
  },
  rollerItemActive: { backgroundColor: colors.black },
  rollerItemText: { color: colors.inkSoft, fontSize: 15, fontWeight: "900" },
  rollerItemTextActive: { color: colors.white },
  rollerLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: "900", letterSpacing: 0.4, textAlign: "center", textTransform: "uppercase" },
  rollerList: { gap: 4, paddingVertical: 4 },
  rollerWrap: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    maxHeight: 238,
    padding: 10,
  },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,16,15,0.34)" },
  title: { color: colors.foreground, fontSize: 24, fontWeight: "900", letterSpacing: -0.4, marginTop: 3 },
});
