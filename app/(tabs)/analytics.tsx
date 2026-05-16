import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

  const { data: summary, isLoading, refetch } = useQuery({
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

  const maxAmount = Math.max(...(summary?.categoryBreakdown?.map((cat: any) => cat.amount) || [1]));
  const budgetGoal = settings?.budgetGoal;
  const monthly = summary?.monthlyTotal ?? 0;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
    >
      <View style={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Monthly Spend</Text>
          <Text style={styles.summaryValue}>{fmtC(monthly)}</Text>
          {budgetGoal != null && (
            <Text style={{ fontSize: 12, color: monthly > budgetGoal ? c.danger : c.textSecondary, marginTop: 4 }}>
              Budget: {fmtC(budgetGoal)} · {monthly > budgetGoal ? "Over budget" : `${fmtC(budgetGoal - monthly)} remaining`}
            </Text>
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Yearly Projection</Text>
          <Text style={styles.summaryValue}>{fmtC(summary?.yearlyTotal ?? 0)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Spending by Category</Text>

        {(!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chart-box-outline" size={48} color={c.border} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyStateText}>No spending data yet</Text>
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
            {summary.categoryBreakdown.slice(0, 1).map((cat: any) => {
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
                title={`${summary.categoryBreakdown.length - 1} more categor${summary.categoryBreakdown.length - 1 === 1 ? "y" : "ies"} hidden`}
                description="See your full spending breakdown by category and identify exactly where your money is going."
              />
            )}
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.statPair}>
              <Text style={styles.statPairLabel}>Active Subscriptions</Text>
              <Text style={styles.statPairValue}>{summary?.activeSubscriptions ?? 0}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statPair}>
              <Text style={styles.statPairLabel}>Total Services</Text>
              <Text style={styles.statPairValue}>{summary?.totalSubscriptions ?? 0}</Text>
            </View>
          </View>
        </View>
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
    emptyStateText: { fontSize: 14, color: c.textSecondary, textAlign: "center" },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    statPair: { flex: 1 },
    statPairLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
    statPairValue: { fontSize: 20, fontWeight: "700", color: c.text },
    divider: { width: 1, backgroundColor: c.border, marginHorizontal: 12 },
  });
}
