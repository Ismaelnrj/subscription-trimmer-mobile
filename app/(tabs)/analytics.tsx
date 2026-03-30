import { View, Text, ScrollView, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../../lib/api";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryTitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
    marginTop: 8,
  },
  categoryItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    textTransform: "capitalize",
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4F46E5",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4F46E5",
    borderRadius: 3,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyStateIcon: {
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});

export default function AnalyticsScreen() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => {
      const response = await apiClient.get("/trpc/analytics.summary");
      return response.data.result.data;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.scrollContent}>
          <Text style={{ color: "#6B7280" }}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  const maxAmount = Math.max(
    ...(summary?.categoryBreakdown?.map((c: any) => c.amount) || [1])
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.scrollContent}>
        {/* Summary Cards */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Monthly Spend</Text>
          <Text style={styles.summaryValue}>${summary?.monthlyTotal?.toFixed(2) ?? "0.00"}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Yearly Projection</Text>
          <Text style={styles.summaryValue}>${summary?.yearlyTotal?.toFixed(2) ?? "0.00"}</Text>
        </View>

        {/* Category Breakdown */}
        <Text style={styles.sectionTitle}>Spending by Category</Text>

        {(!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="chart-box-outline"
              size={48}
              color="#D1D5DB"
              style={styles.emptyStateIcon}
            />
            <Text style={styles.emptyStateText}>No spending data yet</Text>
          </View>
        ) : (
          summary.categoryBreakdown.map((category: any) => {
            const percentage = (category.amount / maxAmount) * 100;
            return (
              <View key={category.category} style={styles.categoryItem}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>{category.category}</Text>
                  <Text style={styles.categoryAmount}>${category.amount.toFixed(2)}/mo</Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${percentage}%` },
                    ]}
                  />
                </View>
              </View>
            );
          })
        )}

        {/* Stats Summary */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Summary</Text>
        <View style={styles.summaryCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <View>
              <Text style={styles.summaryTitle}>Active Subscriptions</Text>
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#1F2937" }}>
                {summary?.activeSubscriptions ?? 0}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryTitle}>Total Services</Text>
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#1F2937" }}>
                {summary?.totalSubscriptions ?? 0}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
