import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, AccessibilityInfo } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { format, differenceInCalendarDays, addMonths, subMonths } from "date-fns";
import apiClient from "../../lib/api";
import { useFmt, useCurrencyStore } from "../../lib/currency-store";
import { useDateFormat } from "../../lib/date-locale";
import { useCycleLabel } from "../../lib/cycle-label";
import { useTheme, AppColors } from "../../lib/theme";
import { FAB_SCROLL_CLEARANCE } from "../../components/GlobalFab";
import { MonthCalendarGrid } from "../../components/MonthCalendarGrid";
import { LogoImage } from "../../components/LogoImage";
import { getOccurrencesInMonth, getUpcomingOccurrences } from "../../lib/recurrence";
import { getCategoryIcon } from "../../lib/categories";
import { useCategoryLabel, canonicalCategory } from "../../lib/category-label";

const TIMELINE_WINDOW_DAYS = 30;
/* Three rows, not one and not the whole list. One is thin enough to feel like
   an afterthought; a full list turns the empty state into a second timeline and
   buries the calendar it belongs to. The window is wide enough that a quiet
   stretch still finds something: at 30 days an empty January would have shown
   nothing, which is the case this exists for. */
const NEXT_UP_COUNT = 3;
const NEXT_UP_WINDOW_DAYS = 120;

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

type ViewMode = "timeline" | "calendar" | "month";

export default function CalendarScreen() {
  const router = useRouter();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const fmtC = useFmt();
  /* The grid gets whole units. Seven columns on a phone cannot spare the width
     for cents, and "15.99" against "16" tells a reader nothing extra about
     whether a day is heavy. Converts before rounding, so the rounding happens
     in the currency the number is displayed in. */
  const { currency, convert } = useCurrencyStore();
  const fmtCompact = (amount: number) => `${currency.symbol}${Math.round(convert(amount))}`;
  const fmtD = useDateFormat();
  const cycleLabel = useCycleLabel();
  const categoryLabel = useCategoryLabel();
  const [view, setView] = useState<ViewMode>("timeline");
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());

  const { data: subscriptions = [], isLoading, isError } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => (await apiClient.get("/trpc/subscriptions.list")).data.result.data,
  });

  const occurrencesByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const sub of subscriptions as any[]) {
      const dates = getOccurrencesInMonth(sub, month);
      for (const date of dates) {
        const key = dayKey(date);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(sub);
      }
    }
    return map;
  }, [subscriptions, month]);

  // markedDates deduplicates by colour because that is what the dots draw.
  // The spoken label needs the real number, so it is derived separately from
  // the same source rather than from the length of the colour list.
  const renewalCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const [key, subs] of occurrencesByDay) map.set(key, subs.length);
    return map;
  }, [occurrencesByDay]);

  /* What each day costs, so the grid can say how heavy a day is rather than
     only that it has something on it. Built from occurrencesByDay for the same
     reason renewalCounts is: markedDates deduplicates by colour, so summing off
     it would undercount a day holding two subscriptions in one category. */
  const dayTotals = useMemo(() => {
    const map = new Map<string, number>();
    occurrencesByDay.forEach((subs, key) =>
      map.set(key, subs.reduce((sum: number, sub: any) => sum + (sub.price ?? 0), 0))
    );
    return map;
  }, [occurrencesByDay]);

  /* The today circle pulses forever while the screen is open. For anyone who
     has asked their phone to reduce motion, that is exactly the kind of thing
     the setting exists to stop. */
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => { if (!cancelled) setReduceMotion(on); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { cancelled = true; sub?.remove?.(); };
  }, []);

  const markedDates = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [key, subs] of occurrencesByDay) {
      const colors = [...new Set(subs.map((sub) => getCategoryIcon(sub.category).color))];
      map.set(key, colors);
    }
    return map;
  }, [occurrencesByDay]);

  /* The key to the dots. Built from occurrencesByDay for the same reason
     renewalCounts and dayTotals are, and keyed by the CANONICAL category rather
     than the raw one: getCategoryIcon resolves every unrecognised name to the
     same grey, so listing "gaming" and "books" separately would name two things
     the grid draws as one dot. Deriving from what is drawn is the rule this
     screen already follows everywhere else.

     Ordered by how many renewals each category has this month, so the colour a
     reader sees most often is the first one they read. Ties break on the
     displayed name, which keeps the order stable rather than leaving it to Map
     insertion, and therefore stable across a re-render.

     Names come out of the locale files here rather than in the grid, which is
     handed finished strings and never learns what a category is. */
  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const subs of occurrencesByDay.values()) {
      for (const sub of subs) {
        const cat = canonicalCategory(sub.category);
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([category, count]) => ({
        count,
        color: getCategoryIcon(category).color,
        name: categoryLabel(category),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map(({ color, name }) => ({ color, name }));
  }, [occurrencesByDay, categoryLabel]);

  const selectedDaySubs = selectedDate ? occurrencesByDay.get(dayKey(selectedDate)) ?? [] : [];
  const selectedDayTotal = selectedDaySubs.reduce((sum: number, sub: any) => sum + (sub.price ?? 0), 0);

  const upcoming = useMemo(
    () => getUpcomingOccurrences(subscriptions as any[], new Date(), TIMELINE_WINDOW_DAYS),
    [subscriptions]
  );

  /* What is due AFTER the day being looked at, for the days that have nothing
     on them. Most days do: a typical month has renewals on four or five of
     thirty, so "No renewals on this day" was what the bottom third of this
     screen said almost every time it was opened, and it answered a question
     nobody had while leaving the real one unanswered.

     Counted from the SELECTED day rather than from today, which is the whole
     point. Browsing forward to November and tapping an empty 8th should say
     what is next in November, not what is next this week. Selecting a past day
     still lands on genuinely future occurrences, because getUpcomingOccurrences
     never projects one earlier than the subscription's own next billing date. */
  const nextUp = useMemo(
    () =>
      selectedDate
        ? getUpcomingOccurrences(subscriptions as any[], selectedDate, NEXT_UP_WINDOW_DAYS)
            .slice(0, NEXT_UP_COUNT)
        : [],
    [subscriptions, selectedDate]
  );

  const monthSummary = useMemo(() => {
    const all: any[] = [];
    for (const subs of occurrencesByDay.values()) all.push(...subs);
    const total = all.reduce((sum, sub) => sum + sub.price, 0);
    const highest = all.reduce((max: any, sub: any) => (sub.price > (max?.price ?? -1) ? sub : max), null);
    return { total, count: all.length, highest };
  }, [occurrencesByDay]);

  const goToToday = () => {
    setMonth(new Date());
    setSelectedDate(new Date());
  };

  const dueLabel = (date: Date) => {
    const days = differenceInCalendarDays(date, new Date());
    if (days <= 0) return t("dashboard.dueToday");
    if (days === 1) return t("dashboard.dueTomorrow");
    if (days <= 6) return t("dashboard.dueInDays", { count: days });
    return fmtD(date, "MMM d");
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <View style={styles.segmentRow}>
            {(["timeline", "calendar", "month"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.segmentPill, view === mode && styles.segmentPillActive]}
                onPress={() => setView(mode)}
              >
                <Text style={[styles.segmentText, view === mode && styles.segmentTextActive]}>
                  {mode === "timeline" ? t("calendar.timeline") : mode === "calendar" ? t("calendar.calendarView") : t("calendar.month")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 48 }} />
          ) : isError ? (
            /* Without this branch a failed fetch fell through to the empty
               state, telling people they had no upcoming payments when the
               request had simply failed. */
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="alert-circle-outline" size={40} color={c.border} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyStateText}>{t("calendar.couldntLoad")}</Text>
            </View>
          ) : view === "timeline" ? (
            upcoming.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={c.border} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyStateText}>{t("calendar.noUpcoming")}</Text>
              </View>
            ) : (
              upcoming.map(({ sub, date }, i) => (
                <TouchableOpacity
                  key={`${sub.id}-${date.toISOString()}-${i}`}
                  style={styles.subCard}
                  onPress={() => router.push(`/subscription-details?id=${sub.id}`)}
                >
                  <LogoImage name={sub.name} category={sub.category} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.subName}>{sub.name}</Text>
                    <Text style={styles.subMeta}>{dueLabel(date)}</Text>
                  </View>
                  <Text style={styles.subPrice}>{fmtC(sub.price)}</Text>
                </TouchableOpacity>
              ))
            )
          ) : view === "calendar" ? (
            <>
              <MonthCalendarGrid
                month={month}
                markedDates={markedDates}
                renewalCounts={renewalCounts}
                dayTotals={dayTotals}
                formatDayTotal={fmtCompact}
                reduceMotion={reduceMotion}
                legend={legend}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onChangeMonth={setMonth}
                c={c}
              />

              {/* Sits with the calendar it controls rather than floating over
                  the day list. As an absolutely positioned button it covered
                  part of a subscription row, so a tap in that corner hit
                  nothing, and it competed with the add button for the same
                  strip of screen. */}
              <View style={styles.calendarActions}>
                <TouchableOpacity
                  style={[styles.todayButton, { backgroundColor: c.primaryLight }]}
                  onPress={goToToday}
                >
                  <MaterialCommunityIcons name="calendar-today" size={15} color={c.primary} />
                  <Text style={styles.todayButtonText}>{t("calendar.today")}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dayHeaderRow}>
                <Text style={styles.sectionTitle}>
                  {selectedDate ? fmtD(selectedDate, "EEEE, MMMM d") : t("calendar.selectDay")}
                </Text>
                {selectedDayTotal > 0 && (
                  <Text style={styles.dayHeaderTotal}>{fmtC(selectedDayTotal)}</Text>
                )}
              </View>

              {selectedDaySubs.length === 0 ? (
                <>
                  {/* Tighter than the standalone empty state, because it is no
                      longer the last thing on the screen. At 32 it pushed the
                      rows below it out of the first glance. */}
                  <View style={[styles.emptyState, nextUp.length > 0 && styles.emptyStateCompact]}>
                    <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={c.border} style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyStateText}>{t("calendar.noRenewals")}</Text>
                  </View>
                  {nextUp.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>{t("calendar.nextUp")}</Text>
                      {nextUp.map(({ sub, date }, i) => (
                        <TouchableOpacity
                          key={`next-${sub.id}-${date.toISOString()}-${i}`}
                          style={styles.subCard}
                          onPress={() => router.push(`/subscription-details?id=${sub.id}`)}
                        >
                          <LogoImage name={sub.name} category={sub.category} />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.subName}>{sub.name}</Text>
                            <Text style={styles.subMeta}>{dueLabel(date)}</Text>
                          </View>
                          <Text style={styles.subPrice}>{fmtC(sub.price)}</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </>
              ) : (
                selectedDaySubs.map((sub: any, i: number) => (
                  <TouchableOpacity
                    key={`${sub.id}-${i}`}
                    style={styles.subCard}
                    onPress={() => router.push(`/subscription-details?id=${sub.id}`)}
                  >
                    <LogoImage name={sub.name} category={sub.category} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.subName}>{sub.name}</Text>
                      <Text style={styles.subMeta}>{fmtC(sub.price)} / {cycleLabel(sub.billingCycle)}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={c.textMuted} />
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : (
            <View style={styles.monthSummaryCard}>
              <View style={styles.monthSummaryHeader}>
                <TouchableOpacity
                  onPress={() => setMonth(subMonths(month, 1))}
                  style={styles.navButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("calendar.a11yPrevMonth")}
                >
                  <MaterialCommunityIcons name="chevron-left" size={22} color={c.text} />
                </TouchableOpacity>
                <Text style={styles.monthSummaryTitle}>{t("calendar.monthSummary", { month: fmtD(month, "MMMM") })}</Text>
                <TouchableOpacity
                  onPress={() => setMonth(addMonths(month, 1))}
                  style={styles.navButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("calendar.a11yNextMonth")}
                >
                  <MaterialCommunityIcons name="chevron-right" size={22} color={c.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.monthSummaryTotal}>{fmtC(monthSummary.total)}</Text>

              <View style={styles.monthSummaryStatsRow}>
                <View style={styles.monthSummaryStat}>
                  <Text style={styles.monthSummaryStatLabel}>{t("calendar.payments")}</Text>
                  <Text style={styles.monthSummaryStatValue}>{monthSummary.count}</Text>
                </View>
                {monthSummary.highest && (
                  <View style={styles.monthSummaryStat}>
                    <Text style={styles.monthSummaryStatLabel}>{t("calendar.highest")}</Text>
                    <Text style={styles.monthSummaryStatValue} numberOfLines={1}>{monthSummary.highest.name}</Text>
                    <Text style={styles.monthSummaryStatSub}>{fmtC(monthSummary.highest.price)}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: FAB_SCROLL_CLEARANCE },
    segmentRow: {
      flexDirection: "row", gap: 4, marginBottom: 16,
      backgroundColor: c.card, borderRadius: 10, padding: 4,
      borderWidth: 1, borderColor: c.border,
    },
    segmentPill: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    segmentPillActive: { backgroundColor: c.primary },
    segmentText: { fontSize: 13, fontWeight: "600", fontFamily: "Montserrat-SemiBold", color: c.textSecondary },
    segmentTextActive: { color: "#FFFFFF" },
    sectionTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Montserrat-Bold", color: c.text, marginTop: 20, marginBottom: 10 },
    dayHeaderRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
    /* The day list showed each price and never their sum, so the one number a
       person actually wants from a day, what it costs them, had to be added up
       in their head. */
    dayHeaderTotal: { fontSize: 15, fontWeight: "700", fontFamily: "Montserrat-Bold", color: c.primary, marginTop: 20, marginBottom: 10 },
    emptyState: { alignItems: "center", paddingVertical: 32 },
    emptyStateCompact: { paddingVertical: 20 },
    emptyStateText: { fontSize: 14, color: c.textSecondary, textAlign: "center" },
    subCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: c.border,
    },
    subName: { fontSize: 14, fontWeight: "600", fontFamily: "Montserrat-SemiBold", color: c.text },
    subMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    subPrice: { fontSize: 14, fontWeight: "700", fontFamily: "Montserrat-Bold", color: c.text },
    navButton: { padding: 6 },
    monthSummaryCard: { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 20 },
    monthSummaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    monthSummaryTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Montserrat-Bold", color: c.text },
    monthSummaryTotal: { fontSize: 34, fontWeight: "700", fontFamily: "Montserrat-Bold", color: c.primary, marginBottom: 20 },
    monthSummaryStatsRow: { flexDirection: "row", gap: 16 },
    monthSummaryStat: { flex: 1 },
    monthSummaryStatLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 4 },
    monthSummaryStatValue: { fontSize: 16, fontWeight: "700", fontFamily: "Montserrat-Bold", color: c.text },
    monthSummaryStatSub: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    calendarActions: { flexDirection: "row", marginTop: 12 },
    // In the flow now, so it needs no shadow to lift it off the content and
    // no white on navy: it is a quiet secondary action beside the calendar,
    // not a second floating button competing with the add button.
    todayButton: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    },
    todayButtonText: { color: c.primary, fontSize: 13, fontWeight: "700", fontFamily: "Montserrat-Bold" },
  });
}
