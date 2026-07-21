import { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { format, differenceInCalendarDays, addMonths, subMonths } from "date-fns";
import apiClient from "../../lib/api";
import { useFmt } from "../../lib/currency-store";
import { useTheme, AppColors } from "../../lib/theme";
import { MonthCalendarGrid } from "../../components/MonthCalendarGrid";
import { LogoImage } from "../../components/LogoImage";
import { getOccurrencesInMonth, getUpcomingOccurrences } from "../../lib/recurrence";
import { getCategoryIcon } from "../../lib/categories";

const TIMELINE_WINDOW_DAYS = 30;

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
  const [view, setView] = useState<ViewMode>("timeline");
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());

  const { data: subscriptions = [], isLoading } = useQuery({
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

  const markedDates = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [key, subs] of occurrencesByDay) {
      const colors = [...new Set(subs.map((sub) => getCategoryIcon(sub.category).color))];
      map.set(key, colors);
    }
    return map;
  }, [occurrencesByDay]);

  const selectedDaySubs = selectedDate ? occurrencesByDay.get(dayKey(selectedDate)) ?? [] : [];

  const upcoming = useMemo(
    () => getUpcomingOccurrences(subscriptions as any[], new Date(), TIMELINE_WINDOW_DAYS),
    [subscriptions]
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
    return format(date, "MMM d");
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
                  onPress={() => router.push("/(tabs)/subscriptions")}
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
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onChangeMonth={setMonth}
                c={c}
              />

              <Text style={styles.sectionTitle}>
                {selectedDate ? format(selectedDate, "EEEE, MMMM d") : t("calendar.selectDay")}
              </Text>

              {selectedDaySubs.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={c.border} style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyStateText}>{t("calendar.noRenewals")}</Text>
                </View>
              ) : (
                selectedDaySubs.map((sub: any, i: number) => (
                  <TouchableOpacity
                    key={`${sub.id}-${i}`}
                    style={styles.subCard}
                    onPress={() => router.push("/(tabs)/subscriptions")}
                  >
                    <LogoImage name={sub.name} category={sub.category} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.subName}>{sub.name}</Text>
                      <Text style={styles.subMeta}>{fmtC(sub.price)} / {sub.billingCycle}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={c.textMuted} />
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : (
            <View style={styles.monthSummaryCard}>
              <View style={styles.monthSummaryHeader}>
                <TouchableOpacity onPress={() => setMonth(subMonths(month, 1))} style={styles.navButton}>
                  <MaterialCommunityIcons name="chevron-left" size={22} color={c.text} />
                </TouchableOpacity>
                <Text style={styles.monthSummaryTitle}>{t("calendar.monthSummary", { month: format(month, "MMMM") })}</Text>
                <TouchableOpacity onPress={() => setMonth(addMonths(month, 1))} style={styles.navButton}>
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

      {view === "calendar" && (
        <TouchableOpacity style={[styles.todayButton, { backgroundColor: c.primary }]} onPress={goToToday}>
          <Text style={styles.todayButtonText}>{t("calendar.today")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: 32 },
    segmentRow: {
      flexDirection: "row", gap: 4, marginBottom: 16,
      backgroundColor: c.card, borderRadius: 10, padding: 4,
      borderWidth: 1, borderColor: c.border,
    },
    segmentPill: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    segmentPillActive: { backgroundColor: c.primary },
    segmentText: { fontSize: 13, fontWeight: "600", color: c.textSecondary },
    segmentTextActive: { color: "#FFFFFF" },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: c.text, marginTop: 20, marginBottom: 10 },
    emptyState: { alignItems: "center", paddingVertical: 32 },
    emptyStateText: { fontSize: 14, color: c.textSecondary, textAlign: "center" },
    subCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: c.border,
    },
    subName: { fontSize: 14, fontWeight: "600", color: c.text },
    subMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    subPrice: { fontSize: 14, fontWeight: "700", color: c.text },
    navButton: { padding: 6 },
    monthSummaryCard: { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 20 },
    monthSummaryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    monthSummaryTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    monthSummaryTotal: { fontSize: 34, fontWeight: "700", color: c.primary, marginBottom: 20 },
    monthSummaryStatsRow: { flexDirection: "row", gap: 16 },
    monthSummaryStat: { flex: 1 },
    monthSummaryStatLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 4 },
    monthSummaryStatValue: { fontSize: 16, fontWeight: "700", color: c.text },
    monthSummaryStatSub: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    todayButton: {
      position: "absolute", left: 20, bottom: 24,
      paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20,
      shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
    },
    todayButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  });
}
