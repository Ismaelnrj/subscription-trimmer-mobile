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
import { useTranslation } from "react-i18next";
import { useDateFormat, weekdayInitials, weekStartsOnFor, dateLocaleFor } from "../lib/date-locale";

interface Props {
  month: Date;
  /* Distinct category colours per day, which is what the dots draw. It is
     deliberately deduplicated, so its length is a count of categories and not
     of renewals: three streaming subscriptions falling on one day produce a
     single colour. Announcing that as "1 renewal" understates the day to the
     one person who cannot see the dots, which is why the real count arrives
     separately below rather than being inferred from this. */
  markedDates: Map<string, string[]>;
  /** Actual number of renewals per day, for the spoken label. */
  renewalCounts?: Map<string, number>;
  /* What each day actually costs. Dots say a day has renewals; they cannot say
     whether it is 4.99 or 80, and on a spend tracker that difference is the
     entire question. Rendered rounded to whole units, because at seven columns
     the cents cost more width than they carry meaning. */
  dayTotals?: Map<string, number>;
  /* Formats a day's total for the grid. Takes the raw base-currency amount,
     NOT a pre-rounded one: rounding before the store converts would round in
     the wrong currency and disagree with the day header below. */
  formatDayTotal?: (amount: number) => string;
  /** Honours the reader's reduce-motion setting; the pulse is off when true. */
  reduceMotion?: boolean;
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

export function MonthCalendarGrid({ month, markedDates, renewalCounts, dayTotals, formatDayTotal, reduceMotion, selectedDate, onSelectDate, onChangeMonth, c }: Props) {
  const styles = makeStyles(c);
  const { t, i18n } = useTranslation();
  const fmtD = useDateFormat();
  // With the locale, so a German grid starts on Monday like every other German
  // calendar. Without it date-fns defaults to Sunday whatever the language.
  const weekOpts = { locale: dateLocaleFor(i18n.language),
                     weekStartsOn: weekStartsOnFor(i18n.language) };
  const gridStart = startOfWeek(startOfMonth(month), weekOpts);
  const gridEnd = endOfWeek(endOfMonth(month), weekOpts);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => onChangeMonth(subMonths(month, 1))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={t("calendar.a11yPrevMonth")}
        >
          <MaterialCommunityIcons name="chevron-left" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{fmtD(month, "MMMM yyyy")}</Text>
        <TouchableOpacity
          onPress={() => onChangeMonth(addMonths(month, 1))}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel={t("calendar.a11yNextMonth")}
        >
          <MaterialCommunityIcons name="chevron-right" size={22} color={c.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {weekdayInitials(i18n.language).map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const selected = selectedDate != null && isSameDay(day, selectedDate);
          const dotColors = markedDates.get(dayKey(day)) ?? [];
          // Falls back to the colour count only when no real count is supplied,
          // so the label degrades to the old behaviour instead of saying zero.
          const renewals = renewalCounts?.get(dayKey(day)) ?? dotColors.length;
          const total = dayTotals?.get(dayKey(day)) ?? 0;
          const today = isToday(day);
          // Three dots is what fits. Silently dropping the fourth made a heavy
          // day look identical to a light one, so the surplus is counted.
          const extraDots = Math.max(0, dotColors.length - 3);

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
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: !inMonth }}
              accessibilityLabel={
                renewals > 0
                  /* The amount belongs in the label too. A sighted reader gets
                     it from the number under the dots; without it here, the one
                     person relying on the label is told a day is busy and not
                     what it costs, which is the half that matters. */
                  ? t(total > 0 && formatDayTotal
                        ? "calendar.a11yDayRenewalsTotal"
                        : "calendar.a11yDayRenewals", {
                      date: fmtD(day, "EEEE, d MMMM yyyy"),
                      count: renewals,
                      total: formatDayTotal ? formatDayTotal(total) : "",
                    })
                  : selected
                    ? t("calendar.a11yDaySelected", { date: fmtD(day, "EEEE, d MMMM yyyy") })
                    : t("calendar.a11yDay", { date: fmtD(day, "EEEE, d MMMM yyyy") })
              }
            >
              {today && !selected && !reduceMotion ? <TodayPulse>{circle}</TodayPulse> : circle}
              {/* The dots and the amount live in a slot that is ALWAYS there,
                  even on a day with neither. Rendering them conditionally made
                  a cell 23px taller when it had renewals, so week rows changed
                  height according to their contents and the grid visibly
                  wobbled from one row to the next.

                  Reserving it also fixes something less visible and worse: an
                  empty cell was 4 + 32 + 4 = 40dp tall, under Android's 48dp
                  minimum touch target, while a busy one cleared it at 63dp. So
                  the days that were hardest to hit were the empty ones, which
                  are exactly the days somebody taps to ask "is anything due
                  here?". Every cell is now 63dp. */}
              <View style={styles.dayMeta}>
                <View style={styles.dotRow}>
                  {dotColors.slice(0, 3).map((color, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: color }]} />
                  ))}
                  {extraDots > 0 && <Text style={styles.dotOverflow}>+{extraDots}</Text>}
                </View>
                {total > 0 && formatDayTotal ? (
                  <Text
                    style={[styles.dayTotal, selected && styles.dayTotalSelected]}
                    numberOfLines={1}
                  >
                    {formatDayTotal(total)}
                  </Text>
                ) : null}
              </View>
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
    /* 23 = the dot row's 3 margin and 8 height, plus the amount's 1 margin and
       11 line height. Fixed rather than derived so an amount with no dots, or
       dots with no amount, still sit at the same y as everywhere else in the
       grid: a number that drifts up half a row on one cell is more distracting
       than one that is simply absent. */
    dayMeta: { height: 23, alignItems: "center" },
    dotRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3, height: 8 },
    dot: { width: 5, height: 5, borderRadius: 2.5 },
    /* Both of these are c.text, and the obvious choices were all measured and
       rejected. This is the smallest type in the app at 8 and 9px, so it is the
       worst possible place for a low contrast token: textMuted lands at 2.98:1
       on the light card and 3.77:1 on the dark one, and dark primary at 3.94:1,
       all under the 4.5:1 floor. Mint is worse still at 1.9:1. c.text measures
       14.1:1 light and 14.0:1 dark, and size plus weight already keep these
       subordinate to the day number without borrowing contrast to do it.
       An amount is information, not decoration: if it cannot be read it may as
       well not be drawn. */
    dotOverflow: { fontSize: 8, lineHeight: 8, fontWeight: "700", color: c.text },
    dayTotal: { fontSize: 9, lineHeight: 11, marginTop: 1, color: c.text, fontWeight: "600" },
    dayTotalSelected: { fontWeight: "800" },
  });
}
