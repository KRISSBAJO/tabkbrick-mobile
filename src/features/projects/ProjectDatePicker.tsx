import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { colors, radii, shadow } from "@/lib/theme/tokens";

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

type ProjectDateFieldProps = {
  helperText?: string;
  label: string;
  onClear: () => void;
  onPress: () => void;
  placeholder: string;
  value: string;
};

type ProjectDatePickerSheetProps = {
  onClose: () => void;
  onSelect: (value: string) => void;
  title: string;
  value: string;
  visible: boolean;
};

export function ProjectDateField({ helperText, label, onClear, onPress, placeholder, value }: ProjectDateFieldProps) {
  return (
    <View style={styles.dateFieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.dateField}>
        <View style={styles.dateIcon}>
          <CalendarDays color={colors.foreground} size={18} strokeWidth={2.6} />
        </View>
        <View style={styles.dateTextWrap}>
          <Text style={[styles.dateValue, value ? null : styles.datePlaceholder]}>{value || placeholder}</Text>
          <Text style={styles.dateHint}>{helperText ?? "Tap to choose from calendar"}</Text>
        </View>
        {value ? (
          <Pressable accessibilityRole="button" onPress={onClear} style={styles.clearDateButton}>
            <X color={colors.inkSoft} size={16} strokeWidth={2.8} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

export function ProjectDatePickerSheet({ onClose, onSelect, title, value, visible }: ProjectDatePickerSheetProps) {
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const selectedTime = selectedDate?.getTime();
  const [viewDate, setViewDate] = useState(() => selectedDate ?? new Date());
  const calendarDays = useMemo(() => monthGrid(viewDate), [viewDate]);
  const today = new Date();

  useEffect(() => {
    if (!visible) return;
    setViewDate(selectedDate ?? new Date());
  }, [selectedDate, selectedTime, visible]);

  function moveMonth(amount: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  function quickSelect(kind: "clear" | "endOfMonth" | "nextWeek" | "today" | "tomorrow") {
    if (kind === "clear") {
      onSelect("");
      return;
    }
    if (kind === "today") onSelect(formatDateValue(today));
    if (kind === "tomorrow") onSelect(formatDateValue(addDays(today, 1)));
    if (kind === "nextWeek") onSelect(formatDateValue(addDays(today, 7)));
    if (kind === "endOfMonth") onSelect(formatDateValue(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
      <View style={styles.datePickerBackdrop}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.scrim} />
        <View style={styles.datePickerSheet}>
          <View style={styles.datePickerHeader}>
            <View>
              <Text style={styles.eyebrow}>Date picker</Text>
              <Text style={styles.datePickerTitle}>{title}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          <View style={styles.monthHeader}>
            <Pressable accessibilityRole="button" onPress={() => moveMonth(-1)} style={styles.monthButton}>
              <ChevronLeft color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
            <Text style={styles.monthTitle}>{monthTitle(viewDate)}</Text>
            <Pressable accessibilityRole="button" onPress={() => moveMonth(1)} style={styles.monthButton}>
              <ChevronRight color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {weekDays.map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>
            ))}
          </View>

          <View style={styles.dayGrid}>
            {calendarDays.map((day, index) => {
              const selected = day && selectedDate ? sameDate(day, selectedDate) : false;
              const isToday = day ? sameDate(day, today) : false;
              return (
                <View key={`${day?.toISOString() ?? "empty"}-${index}`} style={styles.dayCell}>
                  {day ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onSelect(formatDateValue(day))}
                      style={[styles.dayButton, selected ? styles.dayButtonSelected : null, isToday && !selected ? styles.dayButtonToday : null]}
                    >
                      <Text style={[styles.dayText, selected ? styles.dayTextSelected : null]}>{day.getDate()}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.quickDates}>
            <QuickDate label="Today" onPress={() => quickSelect("today")} />
            <QuickDate label="Tomorrow" onPress={() => quickSelect("tomorrow")} />
            <QuickDate label="Next week" onPress={() => quickSelect("nextWeek")} />
            <QuickDate label="Month end" onPress={() => quickSelect("endOfMonth")} />
            <QuickDate label="Clear" onPress={() => quickSelect("clear")} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function QuickDate({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.quickDate}>
      <Text style={styles.quickDateText}>{label}</Text>
    </Pressable>
  );
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
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

function monthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const days: Array<Date | null> = [];
  for (let index = 0; index < first.getDay(); index += 1) days.push(null);
  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push(new Date(date.getFullYear(), date.getMonth(), day));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function monthTitle(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sameDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

const styles = StyleSheet.create({
  clearDateButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    height: 42,
    justifyContent: "center",
    width: 42,
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
  dateFieldWrap: {
    gap: 8,
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
  datePickerBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  datePickerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  datePickerSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    gap: 18,
    padding: 20,
    paddingBottom: 28,
    ...shadow.heavy,
  },
  datePickerTitle: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
  },
  datePlaceholder: {
    color: colors.inkSoft,
  },
  dateTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  dateValue: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  dayButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  dayButtonSelected: {
    backgroundColor: colors.primary,
  },
  dayButtonToday: {
    borderColor: colors.accent,
    borderWidth: 1,
  },
  dayCell: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: "14.285%",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "800",
  },
  dayTextSelected: {
    color: colors.black,
    fontWeight: "900",
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  fieldLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  monthButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  monthHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  quickDate: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickDates: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickDateText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16,16,15,0.34)",
  },
  weekRow: {
    flexDirection: "row",
  },
  weekday: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    width: "14.285%",
  },
});
