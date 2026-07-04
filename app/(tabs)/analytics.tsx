import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "../../lib/api";
import { useFmt } from "../../lib/currency-store";
import { useAuthStore } from "../../lib/auth-store";
import { PremiumGate } from "../../components/PremiumGate";
import { useTheme, AppColors } from "../../lib/theme";

export default function AnalyticsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const fmtC = useFmt();
  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const c = useTheme();
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

  const maxAmount = Math.max(...(summary?.categoryBreakdown?.map((cat: any) => cat.amount) || [1]), 0.001);
  const budgetGoal = settings?.budgetGoal;
  const monthly = summary?.monthlyTotal ?? 0;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
    >
      <View style={styles.scrollContent}>
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
        ) : isPremium ? (
          summary.categoryBreakdown
            .sort((a: any, b: any) => b.amount - a.amount)
            .map((cat: any) => {
              const pct = (cat.amount / maxAmount) * 100;
              return (
                <View key={cat.category} style={styles.categoryItem}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{cat.category}</Text>
                    <Text style={styles.categoryAmount}>{fmtC(cat.amount)}/mo</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })
        ) : (
          <>
            {[...summary.categoryBreakdown].sort((a: any, b: any) => b.amount - a.amount).slice(0, 1).map((cat: any) => {
              const pct = (cat.amount / maxAmount) * 100;
              return (
                <View key={cat.category} style={styles.categoryItem}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{cat.category}</Text>
                    <Text style={styles.categoryAmount}>{fmtC(cat.amount)}/mo</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
            {summary.categoryBreakdown.length > 1 && (
              <PremiumGate
                title={t("analytics.hiddenCategories", { count: summary.categoryBreakdown.length - 1 })}
                description={t("analytics.hiddenCategoriesDesc")}
              />
            )}
          </>
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
    summaryCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: c.border,
    },
    summaryTitle: {
      fontSize: 12, color: c.textSecondary, marginBottom: 8,
      textTransform: "uppercase", letterSpacing: 0.5,
    },
    summaryValue: { fontSize: 28, fontWeight: "700", color: c.text },
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
    categoryItem: {
      backgroundColor: c.card, borderRadius: 12, padding: 12, marginBottom: 8,
      borderWidth: 1, borderColor: c.border,
    },
    categoryHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
    },
    categoryName: {
      fontSize: 14, fontWeight: "600", color: c.text, textTransform: "capitalize",
    },
    categoryAmount: { fontSize: 14, fontWeight: "700", color: c.primary },
    progressBar: { height: 6, backgroundColor: c.border, borderRadius: 3, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: c.primary, borderRadius: 3 },
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
