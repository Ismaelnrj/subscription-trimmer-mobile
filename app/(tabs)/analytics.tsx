import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "../../lib/api";
import { useFmt } from "../../lib/currency-store";
import { useAuthStore } from "../../lib/auth-store";
import { PremiumGate } from "../../components/PremiumGate";
import { DonutChart } from "../../components/DonutChart";
import { WeeklyBarChart } from "../../components/WeeklyBarChart";
import { useTheme, useIsDark, AppColors } from "../../lib/theme";
import { getCategoryIcon } from "../../lib/categories";
import { getOccurrencesInMonth } from "../../lib/recurrence";

// 4, not 5 - a 5th bucket would only ever cover 0-3 leftover days (0 in a
// 28-day February, up to 3 in a 31-day month) but render with the same
// visual weight as a real 7-day bar, misleadingly implying a spending drop
// that's really just a shorter bucket. Folding those leftover days into the
// 4th bucket instead keeps every bar an honest, comparable width.
const WEEK_COUNT = 4;

export default function AnalyticsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const fmtC = useFmt();
  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const c = useTheme();
  const isDark = useIsDark();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => (await apiClient.get("/trpc/analytics.summary")).data.result.data,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => (await apiClient.get("/trpc/subscriptions.list")).data.result.data,
  });

  const weeklyBuckets = useMemo(() => {
    const buckets = new Array(WEEK_COUNT).fill(0);
    const now = new Date();
    for (const sub of subscriptions as any[]) {
      for (const date of getOccurrencesInMonth(sub, now)) {
        const weekIndex = Math.min(Math.floor((date.getDate() - 1) / 7), WEEK_COUNT - 1);
        buckets[weekIndex] += sub.price;
      }
    }
    return buckets;
  }, [subscriptions]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={c.border} style={{ marginBottom: 12 }} />
        <Text style={styles.emptyStateText}>{t("analytics.couldntLoad")}</Text>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={onRefresh}>
          <Text style={{ color: c.primary, fontWeight: "600" }}>{t("common.tryAgain")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const budgetGoal = settings?.budgetGoal;
  const monthly = summary?.monthlyTotal ?? 0;

  const sortedCategories = [...(summary?.categoryBreakdown ?? [])].sort((a: any, b: any) => b.amount - a.amount);
  const visibleCategories = isPremium ? sortedCategories : sortedCategories.slice(0, 1);
  const hiddenTotal = isPremium ? 0 : sortedCategories.slice(1).reduce((sum: number, cat: any) => sum + cat.amount, 0);
  const donutSegments = [
    ...visibleCategories.map((cat: any) => ({ value: cat.amount, color: getCategoryIcon(cat.category).color })),
    ...(hiddenTotal > 0 ? [{ value: hiddenTotal, color: c.border }] : []),
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
    >
      <View style={styles.scrollContent}>
        {isDark ? (
          <LinearGradient
            colors={["#6C3EF4", "#6A47EA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.heroLabelOnGradient}>{t("analytics.totalSpending")}</Text>
            <Text style={styles.heroValueOnGradient}>{fmtC(monthly)}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.heroCard, styles.heroCardLight]}>
            <Text style={styles.heroLabel}>{t("analytics.totalSpending")}</Text>
            <Text style={styles.heroValue}>{fmtC(monthly)}</Text>
          </View>
        )}

        <View style={styles.summaryRowCompact}>
          <View style={styles.summaryCardCompact}>
            <Text style={styles.summaryTitleCompact}>{t("analytics.monthlySpend")}</Text>
            <Text style={styles.summaryValueCompact}>{fmtC(monthly)}</Text>
            {budgetGoal != null && (
              <Text style={{ fontSize: 11, color: monthly > budgetGoal ? c.danger : c.textSecondary, marginTop: 2 }}>
                {monthly > budgetGoal ? t("analytics.overBudget") : t("analytics.budgetLeft", { amount: fmtC(budgetGoal - monthly) })}
              </Text>
            )}
          </View>

          <View style={styles.summaryCardCompact}>
            <Text style={styles.summaryTitleCompact}>{t("analytics.yearlyProjection")}</Text>
            <Text style={styles.summaryValueCompact}>{fmtC(summary?.yearlyTotal ?? 0)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t("analytics.spendingByCategory")}</Text>

        {(!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) ? (
          <View style={styles.emptyStateCompact}>
            <MaterialCommunityIcons name="chart-box-outline" size={28} color={c.border} style={{ marginBottom: 6 }} />
            <Text style={styles.emptyStateText}>{t("analytics.noSpendingData")}</Text>
          </View>
        ) : (
          <View style={styles.donutCard}>
            <View style={styles.donutRow}>
              <DonutChart segments={donutSegments} trackColor={c.border} />
              <View style={styles.legendColumn}>
                {visibleCategories.map((cat: any) => (
                  <View key={cat.category} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: getCategoryIcon(cat.category).color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.legendName} numberOfLines={1}>{cat.category}</Text>
                      <Text style={styles.legendAmount}>{fmtC(cat.amount)}/mo</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {!isPremium && sortedCategories.length > 1 && (
          <PremiumGate
            title={t("analytics.hiddenCategories", { count: sortedCategories.length - 1 })}
            description={t("analytics.hiddenCategoriesDesc")}
          />
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t("analytics.weeklySpending")}</Text>
        {isPremium ? (
          <View style={styles.weeklyCard}>
            <WeeklyBarChart
              values={weeklyBuckets}
              labels={weeklyBuckets.map((_, i) => t("analytics.week", { number: i + 1 }))}
              c={c}
            />
          </View>
        ) : (
          <PremiumGate title={t("analytics.weeklySpending")} description={t("analytics.weeklySpendingDesc")} />
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t("analytics.summary")}</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.statPair}>
              <Text style={styles.statPairLabel}>{t("analytics.activeNow")}</Text>
              <Text style={styles.statPairValue}>{summary?.activeSubscriptions ?? 0}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statPair}>
              <Text style={styles.statPairLabel}>{t("analytics.totalAdded")}</Text>
              <Text style={styles.statPairValue}>{summary?.totalSubscriptions ?? 0}</Text>
            </View>
          </View>
        </View>
        {(summary?.activeSubscriptions ?? 0) > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.statPair}>
                <Text style={styles.statPairLabel}>{t("analytics.avgPerSub")}</Text>
                <Text style={styles.statPairValue}>{fmtC(monthly / (summary?.activeSubscriptions ?? 1))}/mo</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statPair}>
                <Text style={styles.statPairLabel}>{t("analytics.avgPerYear")}</Text>
                <Text style={styles.statPairValue}>{fmtC((monthly / (summary?.activeSubscriptions ?? 1)) * 12)}/yr</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: 32 },
    heroCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
    heroCardLight: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    heroLabel: { fontSize: 13, color: c.textSecondary, marginBottom: 6 },
    heroValue: { fontSize: 34, fontWeight: "700", color: c.text },
    heroLabelOnGradient: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 6 },
    heroValueOnGradient: { fontSize: 34, fontWeight: "700", color: "#FFFFFF" },
    summaryCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: c.border,
    },
    summaryRow: { flexDirection: "row", justifyContent: "space-between" },
    summaryRowCompact: { flexDirection: "row", gap: 12, marginBottom: 12 },
    summaryCardCompact: {
      flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: c.border,
    },
    summaryTitleCompact: {
      fontSize: 11, color: c.textSecondary, marginBottom: 4,
      textTransform: "uppercase", letterSpacing: 0.5,
    },
    summaryValueCompact: { fontSize: 20, fontWeight: "700", color: c.text },
    sectionTitle: {
      fontSize: 16, fontWeight: "600", color: c.text, marginBottom: 12, marginTop: 8,
    },
    donutCard: {
      backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 8,
      borderWidth: 1, borderColor: c.border,
    },
    donutRow: { flexDirection: "row", alignItems: "center", gap: 20 },
    legendColumn: { flex: 1, gap: 12 },
    legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendName: { fontSize: 13, fontWeight: "600", color: c.text, textTransform: "capitalize" },
    legendAmount: { fontSize: 12, color: c.textSecondary, marginTop: 1 },
    weeklyCard: {
      backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 8,
      borderWidth: 1, borderColor: c.border,
    },
    emptyState: { alignItems: "center", paddingVertical: 48 },
    emptyStateCompact: { alignItems: "center", paddingVertical: 16 },
    emptyStateText: { fontSize: 14, color: c.textSecondary, textAlign: "center" },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    statPair: { flex: 1 },
    statPairLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
    statPairValue: { fontSize: 20, fontWeight: "700", color: c.text },
    divider: { width: 1, backgroundColor: c.border, marginHorizontal: 12 },
  });
}
