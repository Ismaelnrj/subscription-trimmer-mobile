import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, AccessibilityInfo } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatMoney } from "../../lib/currencies";
import { OfflineNotice } from "../../components/OfflineNotice";
import { format, differenceInCalendarDays, addMonths, subMonths, startOfDay } from "date-fns";
import { fetchSubscriptionList } from "../../lib/subscription-list";
import { useFmt, useCurrencyStore, sumMixedInBase, isMixedCurrency } from "../../lib/currency-store";
import { useDateFormat, dayMonthPattern } from "../../lib/date-locale";
import { useCycleAdjective } from "../../lib/cycle-label";
import { useTheme, AppColors, space, radius, type as typeScale, tabular } from "../../lib/theme";
import { FAB_SCROLL_CLEARANCE } from "../../components/GlobalFab";
import { MonthCalendarGrid } from "../../components/MonthCalendarGrid";
import { LogoImage } from "../../components/LogoImage";
import { getOccurrencesInMonth, getUpcomingOccurrences, isPhantomOccurrence, livePlanned } from "../../lib/recurrence";
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
  const { t, i18n } = useTranslation();
  const fmtC = useFmt();
  /* The grid gets whole units. Seven columns on a phone cannot spare the width
     for cents, and "15.99" against "16" tells a reader nothing extra about
     whether a day is heavy. Converts before rounding, so the rounding happens
     in the currency the number is displayed in. */
  const { currency, convert, rates, baseCurrencyCode } = useCurrencyStore();
  /* One row's price in the base currency, the unit every total on this screen
     is in. The grid's day amounts, the selected day's total, the month total
     and the month's highest charge all added raw prices, so a 49 EUR row and a
     24.99 USD row made one total of 73.99 "euros", and a dollar price could
     outrank a larger euro one. Same fix as the dashboard and Stats. */
  const inBase = useCallback((sub: any) => {
    const price = Number(sub.price) || 0;
    return sumMixedInBase({ [sub.currency || ""]: price }, rates, baseCurrencyCode, price);
  }, [rates, baseCurrencyCode]);
  /* A sum that moved through an exchange rate is marked as an estimate, the
     dashboard's test: any part priced in another currency. */
  const fmtSum = (amount: number, subs: any[]) => {
    const byCurrency: Record<string, number> = {};
    for (const sub of subs) byCurrency[sub.currency || ""] = 1;
    const text = fmtC(amount);
    return isMixedCurrency(byCurrency, currency.code) && !text.startsWith("~") ? `~${text}` : text;
  };
  const fmtCompact = (amount: number) => formatMoney(Math.round(convert(amount)), currency.symbol, 0, i18n.language);
  const fmtD = useDateFormat();
  const cycleAdjective = useCycleAdjective();
  const categoryLabel = useCategoryLabel();
  const [view, setView] = useState<ViewMode>("timeline");
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());

  /* isLoadingError, not isError: a refetch that fails (offline, or the server
     restarting) keeps the data it already had, the saved offline copy included,
     and that data should stay on screen rather than be replaced by an error. */
  const { data: subscriptions = [], isLoading, isLoadingError: isError, isRefetchError: isStale } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: fetchSubscriptionList,
  });

  /* Fixed once per mount rather than read per render, so the memo below does
     not recompute on every pass. A calendar left open across midnight keeps
     yesterday's answer until the screen remounts, which is a day boundary
     nobody is watching and not worth a timer for. */
  const today = useMemo(() => startOfDay(new Date()), []);

  /* Paused rows have no planned charge. Computed ONCE and used by all three
     consumers below (the day map, the timeline and the Next up list), for the
     same reason isPhantomOccurrence is applied in one place: three separate
     filters are three chances for one to be forgotten, and a missed one draws
     a dot for money that will never move. */
  const planned = useMemo(() => livePlanned(subscriptions as any[]), [subscriptions]);

  const occurrencesByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const sub of planned) {
      const dates = getOccurrencesInMonth(sub, month);
      for (const date of dates) {
        /* Drops the impossible band, `[today, anchor)`. Without this the grid
           drew a dot on a FUTURE day of the current month for a charge that
           never happens, and the Next up list beneath it correctly named the
           real date in the next month, so the two halves of this screen
           disagreed and the half with the dot was the wrong one.

           Filtered HERE rather than inside getOccurrencesInMonth because this
           one map feeds all of it: the dots, the spoken renewal counts, the
           day totals, the legend and the list you get when you tap a day. One
           filter, and none of them can drift apart. */
        if (isPhantomOccurrence(sub, date, today)) continue;
        const key = dayKey(date);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(sub);
      }
    }
    return map;
  }, [planned, month, today]);

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
      map.set(key, subs.reduce((sum: number, sub: any) => sum + inBase(sub), 0))
    );
    return map;
  }, [occurrencesByDay, inBase]);

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
  const selectedDayTotal = selectedDaySubs.reduce((sum: number, sub: any) => sum + inBase(sub), 0);

  const upcoming = useMemo(
    () => getUpcomingOccurrences(planned, new Date(), TIMELINE_WINDOW_DAYS),
    [planned]
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
        ? getUpcomingOccurrences(planned, selectedDate, NEXT_UP_WINDOW_DAYS)
            .slice(0, NEXT_UP_COUNT)
        : [],
    [planned, selectedDate]
  );

  const monthSummary = useMemo(() => {
    const all: any[] = [];
    for (const subs of occurrencesByDay.values()) all.push(...subs);
    const total = all.reduce((sum, sub) => sum + inBase(sub), 0);
    const highest = all.reduce((max: any, sub: any) => (max === null || inBase(sub) > inBase(max) ? sub : max), null);
    return { total, count: all.length, highest, all };
  }, [occurrencesByDay, inBase]);

  const goToToday = () => {
    setMonth(new Date());
    setSelectedDate(new Date());
  };

  const dueLabel = (date: Date) => {
    const days = differenceInCalendarDays(date, new Date());
    if (days <= 0) return t("dashboard.dueToday");
    if (days === 1) return t("dashboard.dueTomorrow");
    if (days <= 6) return t("dashboard.dueInDays", { count: days });
    return fmtD(date, dayMonthPattern(i18n.language));
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          {isStale && <OfflineNotice />}
          {/* A segmented control: exactly one view is always chosen. Chosen is
              ink, never white on primary (4.02:1 in dark mode). */}
          <View style={styles.segmented} accessibilityRole="radiogroup">
            {(["timeline", "calendar", "month"] as const).map((mode) => {
              const on = view === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.segment, on && styles.segmentOn]}
                  onPress={() => setView(mode)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                    {mode === "timeline" ? t("calendar.timeline") : mode === "calendar" ? t("calendar.calendarView") : t("calendar.month")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 48 }} />
          ) : isError ? (
            /* Without this branch a failed fetch fell through to the empty
               state, telling people they had no upcoming payments when the
               request had simply failed. */
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="alert-circle-outline" size={36} color={c.textMuted} style={{ marginBottom: space.s }} />
              <Text style={styles.emptyStateText}>{t("calendar.couldntLoad")}</Text>
            </View>
          ) : view === "timeline" ? (
            upcoming.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={36} color={c.textMuted} style={{ marginBottom: space.s }} />
                <Text style={styles.emptyStateText}>{t("calendar.noUpcoming")}</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {upcoming.map(({ sub, date }, i) => (
                  <TouchableOpacity
                    key={`${sub.id}-${date.toISOString()}-${i}`}
                    style={[styles.row, i > 0 && styles.rowDivider]}
                    onPress={() => router.push(`/subscription-details?id=${sub.id}`)}
                  >
                    <LogoImage name={sub.name} category={sub.category} />
                    <View style={styles.rowText}>
                      <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
                      <Text style={styles.subMeta}>{dueLabel(date)}</Text>
                    </View>
                    <Text style={styles.subPrice}>{fmtC(sub.price, sub.currency)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
                <TouchableOpacity style={styles.todayButton} onPress={goToToday} accessibilityRole="button">
                  <MaterialCommunityIcons name="calendar-today" size={16} color={c.text} />
                  <Text style={styles.todayButtonText}>{t("calendar.today")}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dayHeaderRow}>
                <Text style={styles.sectionTitle}>
                  {selectedDate ? fmtD(selectedDate, dayMonthPattern(i18n.language, { weekday: true })) : t("calendar.selectDay")}
                </Text>
                {selectedDayTotal > 0 && (
                  <Text style={styles.dayHeaderTotal}>{fmtSum(selectedDayTotal, selectedDaySubs)}</Text>
                )}
              </View>

              {selectedDaySubs.length === 0 ? (
                <>
                  {/* Tighter than the standalone empty state, because it is no
                      longer the last thing on the screen. At 32 it pushed the
                      rows below it out of the first glance. */}
                  <View style={[styles.emptyState, nextUp.length > 0 && styles.emptyStateCompact]}>
                    <Text style={styles.emptyStateText}>{t("calendar.noRenewals")}</Text>
                  </View>
                  {nextUp.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>{t("calendar.nextUp")}</Text>
                      <View style={styles.card}>
                        {nextUp.map(({ sub, date }, i) => (
                          <TouchableOpacity
                            key={`next-${sub.id}-${date.toISOString()}-${i}`}
                            style={[styles.row, i > 0 && styles.rowDivider]}
                            onPress={() => router.push(`/subscription-details?id=${sub.id}`)}
                          >
                            <LogoImage name={sub.name} category={sub.category} />
                            <View style={styles.rowText}>
                              <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
                              <Text style={styles.subMeta}>{dueLabel(date)}</Text>
                            </View>
                            <Text style={styles.subPrice}>{fmtC(sub.price, sub.currency)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                </>
              ) : (
                <View style={styles.card}>
                  {selectedDaySubs.map((sub: any, i: number) => (
                    <TouchableOpacity
                      key={`${sub.id}-${i}`}
                      style={[styles.row, i > 0 && styles.rowDivider]}
                      onPress={() => router.push(`/subscription-details?id=${sub.id}`)}
                    >
                      <LogoImage name={sub.name} category={sub.category} />
                      <View style={styles.rowText}>
                        <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
                        <Text style={styles.subMeta}>{cycleAdjective(sub.billingCycle)}</Text>
                      </View>
                      <Text style={styles.subPrice}>{fmtC(sub.price, sub.currency)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.monthHeader}>
                <TouchableOpacity
                  onPress={() => setMonth(subMonths(month, 1))}
                  style={styles.navButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("calendar.a11yPrevMonth")}
                >
                  <MaterialCommunityIcons name="chevron-left" size={22} color={c.text} />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{fmtD(month, "MMMM yyyy")}</Text>
                <TouchableOpacity
                  onPress={() => setMonth(addMonths(month, 1))}
                  style={styles.navButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("calendar.a11yNextMonth")}
                >
                  <MaterialCommunityIcons name="chevron-right" size={22} color={c.text} />
                </TouchableOpacity>
              </View>

              {/* One open figure, as on the dashboard and Stats, then rows.
                  Two columns truncated the highest charge's name. */}
              <View style={styles.monthSummary}>
                <Text style={styles.monthSummaryLabel}>{t("calendar.monthTotal")}</Text>
                <Text style={styles.monthSummaryTotal}>{fmtSum(monthSummary.total, monthSummary.all)}</Text>
              </View>

              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.statLabel}>{t("calendar.payments")}</Text>
                  <Text style={styles.subPrice}>{monthSummary.count}</Text>
                </View>
                {monthSummary.highest && (
                  <View style={[styles.row, styles.rowDivider]}>
                    <View style={styles.rowText}>
                      <Text style={styles.statLabel}>{t("calendar.highest")}</Text>
                      <Text style={styles.subMeta} numberOfLines={1}>{monthSummary.highest.name}</Text>
                    </View>
                    <Text style={styles.subPrice}>{fmtC(monthSummary.highest.price, monthSummary.highest.currency)}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

    </View>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { paddingHorizontal: space.l, paddingTop: space.l, paddingBottom: FAB_SCROLL_CLEARANCE },
    segmented: {
      flexDirection: "row", padding: 4, borderRadius: radius.m, gap: 4, marginBottom: space.l,
      backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    segment: { flex: 1, minHeight: 40, borderRadius: radius.s, alignItems: "center", justifyContent: "center" },
    segmentOn: { backgroundColor: c.text },
    segmentText: { ...typeScale.label, color: c.textSecondary },
    segmentTextOn: { color: c.bg, fontFamily: "Montserrat-SemiBold" },

    sectionTitle: { ...typeScale.heading, color: c.text, marginTop: space.xl, marginBottom: space.s, flexShrink: 1 },
    dayHeaderRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.m },
    /* The day list showed each price and never their sum, so the one number a
       person actually wants from a day, what it costs them, had to be added up
       in their head. */
    dayHeaderTotal: { ...typeScale.heading, ...tabular, color: c.text, marginTop: space.xl, marginBottom: space.s },
    emptyState: { alignItems: "center", paddingVertical: space.xxl },
    emptyStateCompact: { paddingVertical: space.l },
    emptyStateText: { ...typeScale.body, color: c.textSecondary, textAlign: "center" },

    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder, paddingHorizontal: space.l,
    },
    row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingVertical: space.m, gap: space.m },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowText: { flex: 1 },
    subName: { ...typeScale.bodyStrong, color: c.text },
    subMeta: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },
    subPrice: { ...typeScale.bodyStrong, ...tabular, color: c.text },
    statLabel: { ...typeScale.body, color: c.text, flex: 1 },

    navButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
    monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    monthTitle: { ...typeScale.heading, color: c.text },
    monthSummary: { marginTop: space.m, marginBottom: space.xl },
    monthSummaryLabel: { ...typeScale.caption, color: c.textSecondary },
    monthSummaryTotal: { ...typeScale.display, color: c.text, marginTop: space.xs },

    calendarActions: { flexDirection: "row", marginTop: space.m },
    // A quiet secondary action beside the calendar, not a second floating
    // button competing with the add button.
    todayButton: {
      flexDirection: "row", alignItems: "center", gap: space.s, minHeight: 40,
      paddingHorizontal: space.l, borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.card,
    },
    todayButtonText: { ...typeScale.label, color: c.text },
  });
}
