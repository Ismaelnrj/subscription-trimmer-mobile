import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import apiClient from "../../lib/api";
import { useCurrencyStore, fmt } from "../../lib/currency-store";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  summaryCard: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  summaryTitle: {
    fontSize: 12, color: "#6B7280", marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  summaryValue: { fontSize: 28, fontWeight: "700", color: "#1F2937" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: {
    fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 12, marginTop: 8,
  },
  categoryItem: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  categoryHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
  },
  categoryName: {
    fontSize: 14, fontWeight: "600", color: "#1F2937", textTransform: "capitalize",
  },
  categoryAmount: { fontSize: 14, fontWeight: "700", color: "#4F46E5" },
  progressBar: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#4F46E5", borderRadius: 3 },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyStateText: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  statPair: { flex: 1 },
  statPairLabel: { fontSize: 12, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  statPairValue: { fontSize: 20, fontWeight: "700", color: "#1F2937" },
  divider: { width: 1, backgroundColor: "#E5E7EB", marginHorizontal: 12 },
});

export default function AnalyticsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { currency } = useCurrencyStore();

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
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const maxAmount = Math.max(...(summary?.categoryBreakdown?.map((c: any) => c.amount) || [1]));
  const budgetGoal = settings?.budgetGoal;
  const monthly = summary?.monthlyTotal ?? 0;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}
    >
      <View style={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Monthly Spend</Text>
          <Text style={styles.summaryValue}>{fmt(monthly, currency.symbol)}</Text>
          {budgetGoal != null && (
            <Text style={{ fontSize: 12, color: monthly > budgetGoal ? "#EF4444" : "#6B7280", marginTop: 4 }}>
              Budget: {fmt(budgetGoal, currency.symbol)} · {monthly > budgetGoal ? "Over budget" : `${fmt(budgetGoal - monthly, currency.symbol)} remaining`}
            </Text>
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Yearly Projection</Text>
          <Text style={styles.summaryValue}>{fmt(summary?.yearlyTotal ?? 0, currency.symbol)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Spending by Category</Text>

        {(!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chart-box-outline" size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyStateText}>No spending data yet</Text>
          </View>
        ) : (
          summary.categoryBreakdown
            .sort((a: any, b: any) => b.amount - a.amount)
            .map((cat: any) => {
              const pct = (cat.amount / maxAmount) * 100;
              return (
                <View key={cat.category} style={styles.categoryItem}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{cat.category}</Text>
                    <Text style={styles.categoryAmount}>{fmt(cat.amount, currency.symbol)}/mo</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })
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
