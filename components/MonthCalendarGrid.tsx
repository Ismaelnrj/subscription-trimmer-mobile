import { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, cancelAnimation } from "react-native-reanimated";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  format,
} from "date-fns";
import { AppColors } from "../lib/theme";

interface Props {
  month: Date;
  markedDates: Map<string, string[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onChangeMonth: (month: Date) => void;
  c: AppColors;
}

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

// Today's circle pulses subtly (scale 1.00 -> 1.08 -> 1.00) to draw the eye
// without being distracting.
function TodayPulse({ children }: { children: React.ReactNode }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      true
    );
    return () => cancelAnimation(scale);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export function MonthCalendarGrid({ month, markedDates, selectedDate, onSelectDate, onChangeMonth, c }: Props) {
  const styles = makeStyles(c);
  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onChangeMonth(subMonths(month, 1))} style={styles.navButton}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{format(month, "MMMM yyyy")}</Text>
        <TouchableOpacity onPress={() => onChangeMonth(addMonths(month, 1))} style={styles.navButton}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={c.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const selected = selectedDate != null && isSameDay(day, selectedDate);
          const dotColors = markedDates.get(dayKey(day)) ?? [];
          const today = isToday(day);

          const circle = (
            <View style={[styles.dayCircle, selected && styles.dayCircleSelected, today && !selected && styles.dayCircleToday]}>
              <Text style={[
                styles.dayText,
                !inMonth && styles.dayTextMuted,
                selected && styles.dayTextSelected,
              ]}>
                {format(day, "d")}
              </Text>
            </View>
          );

          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={styles.cell}
              onPress={() => onSelectDate(day)}
              disabled={!inMonth}
            >
              {today && !selected ? <TodayPulse>{circle}</TodayPulse> : circle}
              {dotColors.length > 0 && (
                <View style={styles.dotRow}>
                  {dotColors.slice(0, 3).map((color, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: color }]} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 12 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    navButton: { padding: 6 },
    monthLabel: { fontSize: 15, fontWeight: "700", color: c.text },
    weekdayRow: { flexDirection: "row" },
    weekdayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: c.textMuted, marginBottom: 4 },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 4 },
    dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    dayCircleSelected: { backgroundColor: c.primary },
    dayCircleToday: { borderWidth: 1, borderColor: c.primary },
    dayText: { fontSize: 13, color: c.text },
    dayTextMuted: { color: c.textMuted },
    dayTextSelected: { color: "#FFFFFF", fontWeight: "700" },
    dotRow: { flexDirection: "row", gap: 3, marginTop: 2, height: 4 },
    dot: { width: 4, height: 4, borderRadius: 2 },
  });
}
