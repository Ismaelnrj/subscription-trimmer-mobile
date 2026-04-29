import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import apiClient from "../../lib/api";
import { useCurrencyStore, fmt } from "../../lib/currency-store";
import { useAuthStore } from "../../lib/auth-store";
import { PremiumGate } from "../../components/PremiumGate";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, minWidth: "48%", backgroundColor: "#FFFFFF", borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: "#E5E7EB",
  },
  statIcon: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: "#EEF2FF",
    justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  statValue: { fontSize: 24, fontWeight: "700", color: "#1F2937", marginBottom: 4 },
  statLabel: { fontSize: 12, color: "#6B7280" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 12 },
  actionButton: {
    backgroundColor: "#4F46E5", borderRadius: 8, paddingVertical: 12,
    paddingHorizontal: 16, marginBottom: 12,
  },
  actionButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", textAlign: "center" },
  emptyState: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 24, alignItems: "center",
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  emptyStateText: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  subCard: {
    backgroundColor: "#FFFFFF", borderRadius: 10, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  subName: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  subMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  subPrice: { fontSize: 14, fontWeight: "700", color: "#4F46E5" },
  budgetCard: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  budgetRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  budgetLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  budgetAmount: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  progressTrack: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  budgetNote: { fontSize: 11, color: "#6B7280", marginTop: 6 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  verifyBanner: {
    backgroundColor: "#FEF3C7", borderRadius: 10, padding: 14, marginBottom: 16,
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#FCD34D",
  },
  verifyBannerText: { flex: 1, fontSize: 13, color: "#92400E" },
  verifyBannerLink: { fontSize: 13, fontWeight: "700", color: "#D97706" },
});

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { currency } = useCurrencyStore();

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => (await apiClient.get("/trpc/analytics.summary")).data.result.data,
  });

  const { data: subscriptions = [], isLoading: subsLoading, refetch: refetchSubs } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => (await apiClient.get("/trpc/subscriptions.list")).data.result.data,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchSubs()]);
    setRefreshing(false);
  };

  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const isLoading = summaryLoading && subsLoading;
  const recentSubs = subscriptions.slice(0, 3);
  const budgetGoal = settings?.budgetGoal;
  const monthlyTotal = summary?.monthlyTotal ?? 0;
  const budgetPct = budgetGoal ? Math.min((monthlyTotal / budgetGoal) * 100, 100) : 0;
  const budgetColor = budgetPct >= 90 ? "#EF4444" : budgetPct >= 70 ? "#F59E0B" : "#10B981";

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}
    >
      <View style={styles.scrollContent}>
        {/* Email verification banner */}
        {user && !user.isVerified && (
          <TouchableOpacity style={styles.verifyBanner} onPress={() => router.push("/verify-email")}>
            <MaterialCommunityIcons name="email-alert" size={20} color="#D97706" />
            <Text style={styles.verifyBannerText}>Please verify your email address to secure your account.</Text>
            <Text style={styles.verifyBannerLink}>Verify →</Text>
          </TouchableOpacity>
        )}

        {/* Budget goal bar — premium only */}
        {!isPremium && (
          <PremiumGate
            title="Budget Goal & Progress Bar"
            description="Set a monthly spending limit and get a visual warning when you're getting close."
          />
        )}
        {isPremium && budgetGoal != null && (
          <View style={styles.budgetCard}>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Monthly Budget</Text>
              <Text style={styles.budgetAmount}>
                {fmt(monthlyTotal, currency.symbol)} / {fmt(budgetGoal, currency.symbol)}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${budgetPct}%`, backgroundColor: budgetColor }]} />
            </View>
            {budgetPct >= 80 && (
              <Text style={[styles.budgetNote, { color: budgetColor, fontWeight: "600" }]}>
                {budgetPct >= 100 ? "⚠️ Budget exceeded!" : `⚠️ ${(100 - budgetPct).toFixed(0)}% of budget remaining`}
              </Text>
            )}
          </View>
        )}

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="credit-card" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.statValue}>{fmt(summary?.monthlyTotal ?? 0, currency.symbol)}</Text>
            <Text style={styles.statLabel}>Monthly Spend</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="chart-line" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.statValue}>{fmt(summary?.yearlyTotal ?? 0, currency.symbol)}</Text>
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

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/subscriptions")}>
          <Text style={styles.actionButtonText}>+ Add Subscription</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#6B7280" }]}
          onPress={() => router.push("/insights")}
        >
          <Text style={styles.actionButtonText}>View Recommendations</Text>
        </TouchableOpacity>

        {/* Recent subscriptions */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Subscriptions</Text>
        {recentSubs.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="inbox" size={40} color="#D1D5DB" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyStateText}>No subscriptions yet. Add your first one!</Text>
          </View>
        ) : (
          recentSubs.map((sub: any) => {
            const monthly = sub.billingCycle === "yearly"
              ? sub.price / 12
              : sub.billingCycle === "weekly"
              ? (sub.price * 52) / 12
              : null;
            return (
              <View key={sub.id} style={styles.subCard}>
                <View>
                  <Text style={styles.subName}>{sub.name}</Text>
                  <Text style={styles.subMeta}>
                    {fmt(sub.price, currency.symbol)} / {sub.billingCycle}
                    {monthly != null ? `  ·  ${fmt(monthly, currency.symbol)}/mo` : ""}
                  </Text>
                </View>
                <Text style={styles.subPrice}>{fmt(sub.price, currency.symbol)}</Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
