import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import apiClient from "../../lib/api";
import { useCurrencyStore, fmt } from "../../lib/currency-store";
import { useAuthStore } from "../../lib/auth-store";
import { PremiumGate } from "../../components/PremiumGate";
import { scheduleRenewalReminders } from "../../lib/notification-scheduler";
import { useTheme, AppColors } from "../../lib/theme";

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { currency } = useCurrencyStore();
  const c = useTheme();
  const styles = makeStyles(c);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => (await apiClient.get("/trpc/analytics.summary")).data.result.data,
  });

  const { data: subscriptions = [], isLoading: subsLoading, refetch: refetchSubs } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => (await apiClient.get("/trpc/subscriptions.list")).data.result.data,
    onSuccess: (data: any[]) => scheduleRenewalReminders(data, currency.symbol),
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
  const budgetRaw = budgetGoal ? (monthlyTotal / budgetGoal) * 100 : 0;
  const budgetPct = Math.min(budgetRaw, 100);
  const budgetColor = budgetRaw >= 90 ? c.danger : budgetRaw >= 70 ? c.warning : c.success;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
    >
      <View style={styles.scrollContent}>
        {user && !user.isVerified && (
          <TouchableOpacity style={styles.verifyBanner} onPress={() => router.push("/verify-email")}>
            <MaterialCommunityIcons name="email-alert" size={20} color={c.warning} />
            <Text style={styles.verifyBannerText}>Please verify your email address to secure your account.</Text>
            <Text style={styles.verifyBannerLink}>Verify →</Text>
          </TouchableOpacity>
        )}

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
            {budgetRaw >= 80 && (
              <Text style={[styles.budgetNote, { color: budgetColor, fontWeight: "600" }]}>
                {budgetRaw >= 100
                  ? `⚠️ Over budget by ${fmt(monthlyTotal - budgetGoal, currency.symbol)}`
                  : `⚠️ ${fmt(budgetGoal - monthlyTotal, currency.symbol)} remaining`}
              </Text>
            )}
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="credit-card" size={20} color={c.primary} />
            </View>
            <Text style={styles.statValue}>{fmt(summary?.monthlyTotal ?? 0, currency.symbol)}</Text>
            <Text style={styles.statLabel}>Monthly Spend</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="chart-line" size={20} color={c.primary} />
            </View>
            <Text style={styles.statValue}>{fmt(summary?.yearlyTotal ?? 0, currency.symbol)}</Text>
            <Text style={styles.statLabel}>Yearly Spend</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="check-circle" size={20} color={c.primary} />
            </View>
            <Text style={styles.statValue}>{summary?.activeSubscriptions ?? 0}</Text>
            <Text style={styles.statLabel}>Active Subs</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="alert-circle" size={20} color={c.primary} />
            </View>
            <Text style={styles.statValue}>{summary?.alertCount ?? 0}</Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/subscriptions")}>
          <Text style={styles.actionButtonText}>+ Add Subscription</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: c.textSecondary }]}
          onPress={() => router.push("/insights")}
        >
          <Text style={styles.actionButtonText}>View Recommendations</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Subscriptions</Text>
        {recentSubs.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="inbox" size={40} color={c.border} style={{ marginBottom: 8 }} />
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

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: 32 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
    statCard: {
      flex: 1, minWidth: "48%", backgroundColor: c.card, borderRadius: 12,
      padding: 16, borderWidth: 1, borderColor: c.border,
    },
    statIcon: {
      width: 40, height: 40, borderRadius: 8, backgroundColor: c.primaryLight,
      justifyContent: "center", alignItems: "center", marginBottom: 8,
    },
    statValue: { fontSize: 24, fontWeight: "700", color: c.text, marginBottom: 4 },
    statLabel: { fontSize: 12, color: c.textSecondary },
    sectionTitle: { fontSize: 16, fontWeight: "600", color: c.text, marginBottom: 12 },
    actionButton: {
      backgroundColor: c.primary, borderRadius: 8, paddingVertical: 12,
      paddingHorizontal: 16, marginBottom: 12,
    },
    actionButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", textAlign: "center" },
    emptyState: {
      backgroundColor: c.card, borderRadius: 12, padding: 24, alignItems: "center",
      borderWidth: 1, borderColor: c.border,
    },
    emptyStateText: { fontSize: 14, color: c.textSecondary, textAlign: "center" },
    subCard: {
      backgroundColor: c.card, borderRadius: 10, padding: 14, marginBottom: 8,
      borderWidth: 1, borderColor: c.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    },
    subName: { fontSize: 14, fontWeight: "600", color: c.text },
    subMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    subPrice: { fontSize: 14, fontWeight: "700", color: c.primary },
    budgetCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 20,
      borderWidth: 1, borderColor: c.border,
    },
    budgetRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    budgetLabel: { fontSize: 13, fontWeight: "600", color: c.text },
    budgetAmount: { fontSize: 13, fontWeight: "700", color: c.text },
    progressTrack: { height: 8, backgroundColor: c.border, borderRadius: 4, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 4 },
    budgetNote: { fontSize: 11, color: c.textSecondary, marginTop: 6 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    verifyBanner: {
      backgroundColor: c.warningLight, borderRadius: 10, padding: 14, marginBottom: 16,
      flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: c.warningBorder,
    },
    verifyBannerText: { flex: 1, fontSize: 13, color: c.warning },
    verifyBannerLink: { fontSize: 13, fontWeight: "700", color: c.warning },
  });
}
