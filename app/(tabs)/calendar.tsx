import { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import apiClient from "../../lib/api";
import { useFmt } from "../../lib/currency-store";
import { useTheme, AppColors } from "../../lib/theme";
import { MonthCalendarGrid } from "../../components/MonthCalendarGrid";
import { LogoImage } from "../../components/LogoImage";
import { getOccurrencesInMonth } from "../../lib/recurrence";

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function CalendarScreen() {
  const router = useRouter();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const fmtC = useFmt();
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

  const markedDates = useMemo(() => new Set(occurrencesByDay.keys()), [occurrencesByDay]);
  const selectedDaySubs = selectedDate ? occurrencesByDay.get(dayKey(selectedDate)) ?? [] : [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.scrollContent}>
        {isLoading ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 48 }} />
        ) : (
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
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subName}>{sub.name}</Text>
                    <Text style={styles.subMeta}>{fmtC(sub.price)} / {sub.billingCycle}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={c.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: 32 },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: c.text, marginTop: 20, marginBottom: 10 },
    emptyState: { alignItems: "center", paddingVertical: 32 },
    emptyStateText: { fontSize: 14, color: c.textSecondary, textAlign: "center" },
    subCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: c.border,
    },
    subName: { fontSize: 14, fontWeight: "600", color: c.text },
    subMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  });
}
