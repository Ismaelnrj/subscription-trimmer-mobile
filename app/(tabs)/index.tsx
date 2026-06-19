import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import apiClient from "../../lib/api";
import { useCurrencyStore, useFmt } from "../../lib/currency-store";
import { useAuthStore } from "../../lib/auth-store";
import { PremiumGate } from "../../components/PremiumGate";
import { scheduleRenewalReminders } from "../../lib/notification-scheduler";
import { useTheme, AppColors } from "../../lib/theme";

function toMonthly(price: number, cycle: string) {
  if (cycle === "weekly") return (price * 52) / 12;
  if (cycle === "yearly") return price / 12;
  return price;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const { currency } = useCurrencyStore();
  const fmtC = useFmt();
  const c = useTheme();
  const styles = makeStyles(c);

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => (await apiClient.get("/trpc/analytics.summary")).data.result.data,
  });

  const { data: subscriptions = [], isLoading: subsLoading, isError: subsError, refetch: refetchSubs } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => (await apiClient.get("/trpc/subscriptions.list")).data.result.data,
    onSuccess: (data: any[]) => scheduleRenewalReminders(data, currency.symbol),
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
  });

  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ["alerts", "list"],
    queryFn: async () => (await apiClient.get("/trpc/alerts.list")).data.result.data,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchSubs(), refetchAlerts()]).catch(() => {});
    setRefreshing(false);
  };

  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const isLoading = summaryLoading || subsLoading;
  const isError = summaryError || subsError;
  const recentSubs = subscriptions.slice(0, 3);

  const budgetGoal = settings?.budgetGoal;
  const monthlyTotal = summary?.monthlyTotal ?? 0;
  const budgetRaw = budgetGoal ? (monthlyTotal / budgetGoal) * 100 : 0;
  const budgetPct = Math.min(budgetRaw, 100);
  const budgetColor = budgetRaw >= 90 ? c.danger : budgetRaw >= 70 ? c.warning : c.success;
  const budgetStatus = budgetRaw >= 100 ? "Over budget" : budgetRaw >= 80 ? "Getting close" : "On track";
  const budgetStatusIcon = budgetRaw >= 80 ? "alert-circle-outline" : "check-circle-outline";

  const activeSubIds = new Set((subscriptions as any[]).map((s) => s.id));
  const activeAlertCount = (alerts as any[]).filter(
    (a) => !a.subscriptionId || activeSubIds.has(a.subscriptionId)
  ).length;

  const trialsSoon = (subscriptions as any[]).filter((s) => {
    if (!s.trialEndDate) return false;
    const days = Math.ceil((new Date(s.trialEndDate).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 14;
  }).sort((a, b) =>
    new Date(a.trialEndDate).getTime() - new Date(b.trialEndDate).getTime()
  );

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
        <Text style={styles.emptyStateText}>Couldn't load your dashboard.</Text>
        <TouchableOpacity style={[styles.actionButton, { marginTop: 16, paddingHorizontal: 24 }]} onPress={onRefresh}>
          <Text style={styles.actionButtonText}>Try Again</Text>
        </TouchableOpacity>
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
          <View style={[styles.budgetCard, { borderLeftColor: budgetColor }]}>
            <View style={styles.budgetRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.budgetLabel}>Monthly Budget</Text>
                <Text style={styles.budgetAmount}>
                  {fmtC(monthlyTotal)}{" "}
                  <Text style={styles.budgetOf}>of {fmtC(budgetGoal)}</Text>
                </Text>
              </View>
              <View style={[styles.budgetPctBadge, { backgroundColor: budgetColor + "22" }]}>
                <Text style={[styles.budgetPctText, { color: budgetColor }]}>{Math.round(budgetPct)}%</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${budgetPct}%` as any, backgroundColor: budgetColor }]} />
            </View>

            <View style={styles.budgetFooter}>
              <View style={styles.budgetStatusRow}>
                <MaterialCommunityIcons name={budgetStatusIcon as any} size={13} color={budgetColor} />
                <Text style={[styles.budgetStatus, { color: budgetColor }]}>{budgetStatus}</Text>
              </View>
              <Text style={styles.budgetRemaining}>
                {budgetRaw >= 100
                  ? `${fmtC(monthlyTotal - budgetGoal)} over limit`
                  : `${fmtC(budgetGoal - monthlyTotal)} remaining`}
              </Text>
            </View>
          </View>
        )}

        {trialsSoon.length > 0 && (
          <View style={styles.trialsSection}>
            <View style={styles.trialsSectionHeader}>
              <MaterialCommunityIcons name="clock-alert-outline" size={15} color={c.warning} />
              <Text style={styles.trialsSectionTitle}>Trials Ending Soon</Text>
            </View>
            {trialsSoon.map((sub: any) => {
              const days = Math.ceil((new Date(sub.trialEndDate).getTime() - Date.now()) / 86400000);
              const urgency = days <= 3 ? c.danger : days <= 7 ? c.warning : "#F59E0B";
              return (
                <View key={sub.id} style={[styles.trialCard, { borderLeftColor: urgency }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trialName}>{sub.name}</Text>
                    <Text style={styles.trialCharge}>
                      {fmtC(sub.price)}/{sub.billingCycle} charged on expiry
                    </Text>
                  </View>
                  <View style={[styles.trialBadge, { backgroundColor: urgency + "22" }]}>
                    <Text style={[styles.trialBadgeText, { color: urgency }]}>
                      {days === 0 ? "Today!" : `${days}d left`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.toggleRow}>
          {(["monthly", "yearly"] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.togglePill, viewMode === mode && styles.togglePillActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.toggleText, viewMode === mode && styles.toggleTextActive]}>
                {mode === "monthly" ? "Monthly" : "Yearly"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="credit-card" size={22} color={c.primary} />
          </View>
          <Text style={styles.heroValue}>{fmtC(viewMode === "monthly" ? (summary?.monthlyTotal ?? 0) : (summary?.yearlyTotal ?? 0))}</Text>
          <Text style={styles.heroLabel}>{viewMode === "monthly" ? "Monthly Spend" : "Yearly Spend"}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="chart-line" size={18} color={c.primary} />
            </View>
            <Text style={styles.statValue}>{fmtC(viewMode === "monthly" ? (summary?.yearlyTotal ?? 0) : (summary?.monthlyTotal ?? 0))}</Text>
            <Text style={styles.statLabel}>{viewMode === "monthly" ? "Yearly Spend" : "Monthly Spend"}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="check-circle" size={18} color={c.primary} />
            </View>
            <Text style={styles.statValue}>{summary?.activeSubscriptions ?? 0}</Text>
            <Text style={styles.statLabel}>Active Subs</Text>
          </View>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push("/alerts")}>
            <View style={styles.statIcon}>
              <MaterialCommunityIcons name="alert-circle" size={18} color={activeAlertCount > 0 ? c.danger : c.primary} />
            </View>
            <Text style={[styles.statValue, activeAlertCount > 0 && { color: c.danger }]}>{activeAlertCount}</Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/subscriptions")}>
          <Text style={styles.actionButtonText}>+ Add Subscription</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButtonOutline}
          onPress={() => router.push("/insights")}
        >
          <Text style={styles.actionButtonOutlineText}>View Recommendations</Text>
        </TouchableOpacity>

        {recentSubs.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Subscriptions</Text>
            {recentSubs.map((sub: any) => {
            const monthly = sub.billingCycle === "yearly"
              ? sub.price / 12
              : sub.billingCycle === "weekly"
              ? (sub.price * 52) / 12
              : null;
            return (
              <TouchableOpacity key={sub.id} style={styles.subCard} onPress={() => router.push("/(tabs)/subscriptions")}>
                <View>
                  <Text style={styles.subName}>{sub.name}</Text>
                  <Text style={styles.subMeta}>
                    {viewMode === "yearly"
                      ? `${fmtC(toMonthly(sub.price, sub.billingCycle) * 12)}/yr`
                      : `${fmtC(sub.price)} / ${sub.billingCycle}${monthly != null ? `  ·  ${fmtC(monthly)}/mo` : ""}`
                    }
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={c.textMuted} />
              </TouchableOpacity>
            );
          })}
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
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    verifyBanner: {
      backgroundColor: c.warningLight, borderRadius: 10, padding: 14, marginBottom: 16,
      flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: c.warningBorder,
    },
    verifyBannerText: { flex: 1, fontSize: 13, color: c.warning },
    verifyBannerLink: { fontSize: 13, fontWeight: "700", color: c.warning },

    budgetCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 20,
      borderWidth: 1, borderColor: c.border, borderLeftWidth: 4,
    },
    budgetRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    budgetLabel: { fontSize: 11, fontWeight: "600", color: c.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 },
    budgetAmount: { fontSize: 18, fontWeight: "800", color: c.text },
    budgetOf: { fontSize: 14, fontWeight: "400", color: c.textSecondary },
    budgetPctBadge: { borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, marginLeft: 12 },
    budgetPctText: { fontSize: 20, fontWeight: "800" },
    progressTrack: { height: 10, backgroundColor: c.border, borderRadius: 5, overflow: "hidden", marginBottom: 10 },
    progressFill: { height: "100%", borderRadius: 5 },
    budgetFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    budgetStatusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    budgetStatus: { fontSize: 12, fontWeight: "700" },
    budgetRemaining: { fontSize: 12, color: c.textSecondary },

    trialsSection: {
      backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 20,
      borderWidth: 1, borderColor: c.border,
    },
    trialsSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    trialsSectionTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    trialCard: {
      flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12,
      backgroundColor: c.bg, borderRadius: 8, marginBottom: 6, borderLeftWidth: 3,
    },
    trialName: { fontSize: 14, fontWeight: "600", color: c.text },
    trialCharge: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    trialBadge: { borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, marginLeft: 8 },
    trialBadgeText: { fontSize: 12, fontWeight: "800" },

    heroCard: {
      backgroundColor: c.card, borderRadius: 16, padding: 20, marginBottom: 12,
      borderWidth: 1, borderColor: c.border,
    },
    heroIcon: {
      width: 44, height: 44, borderRadius: 10, backgroundColor: c.primaryLight,
      justifyContent: "center", alignItems: "center", marginBottom: 12,
    },
    heroValue: { fontSize: 38, fontWeight: "800", color: c.text, marginBottom: 4 },
    heroLabel: { fontSize: 13, color: c.textSecondary },
    statsGrid: { flexDirection: "row", gap: 12, marginBottom: 24 },
    statCard: {
      flex: 1, backgroundColor: c.card, borderRadius: 12,
      padding: 14, borderWidth: 1, borderColor: c.border,
    },
    statIcon: {
      width: 34, height: 34, borderRadius: 8, backgroundColor: c.primaryLight,
      justifyContent: "center", alignItems: "center", marginBottom: 8,
    },
    statValue: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 4 },
    statLabel: { fontSize: 11, color: c.textSecondary },
    sectionTitle: { fontSize: 16, fontWeight: "600", color: c.text, marginBottom: 12 },
    actionButton: {
      backgroundColor: c.primary, borderRadius: 10, paddingVertical: 12,
      paddingHorizontal: 16, marginBottom: 12,
    },
    actionButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", textAlign: "center" },
    actionButtonOutline: {
      backgroundColor: "transparent", borderRadius: 10, paddingVertical: 12,
      paddingHorizontal: 16, marginBottom: 12, borderWidth: 1.5, borderColor: c.primary,
    },
    actionButtonOutlineText: { color: c.primary, fontSize: 14, fontWeight: "600", textAlign: "center" },
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
    toggleRow: {
      flexDirection: "row", gap: 4, marginBottom: 16,
      backgroundColor: c.card, borderRadius: 10, padding: 4,
      borderWidth: 1, borderColor: c.border, alignSelf: "flex-start",
    },
    togglePill: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8 },
    togglePillActive: { backgroundColor: c.primary },
    toggleText: { fontSize: 13, fontWeight: "600", color: c.textSecondary },
    toggleTextActive: { color: "#FFFFFF" },
  });
}
