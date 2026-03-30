import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
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

export default function DashboardScreen() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => {
      const response = await apiClient.get("/trpc/analytics.summary");
      return response.data.result.data;
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => {
      const response = await apiClient.get("/trpc/subscriptions.list");
      return response.data.result.data;
    },
  });

  const recentSubs = subscriptions.slice(0, 3);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.scrollContent}>
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="credit-card" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.statValue}>${summary?.monthlyTotal?.toFixed(0) ?? "0"}</Text>
            <Text style={styles.statLabel}>Monthly Spend</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="chart-line" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.statValue}>${summary?.yearlyTotal?.toFixed(0) ?? "0"}</Text>
            <Text style={styles.statLabel}>Yearly Spend</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.statValue}>{summary?.activeSubscriptions ?? 0}</Text>
            <Text style={styles.statLabel}>Active Subs</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.statValue}>{summary?.alertCount ?? 0}</Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>+ Add Subscription</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: "#6B7280" }]}>
          <Text style={styles.actionButtonText}>View Recommendations</Text>
        </TouchableOpacity>

        {/* Recent Subscriptions */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Subscriptions</Text>
        {recentSubs.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="inbox"
              size={40}
              color="#D1D5DB"
              style={styles.emptyStateIcon}
            />
            <Text style={styles.emptyStateText}>No subscriptions yet. Add your first one!</Text>
          </View>
        ) : (
          recentSubs.map((sub: any) => (
            <View key={sub.id} style={[styles.statCard, { marginBottom: 8 }]}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1F2937" }}>
                {sub.name}
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                ${sub.price} / {sub.billingCycle}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
