import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/api";
import { useCurrencyStore, fmt } from "../lib/currency-store";

type Sub = {
  id: number;
  name: string;
  price: number;
  billingCycle: string;
  category: string;
  nextBillingDate: string;
  trialEndDate?: string | null;
};

type Tip = {
  id: string;
  icon: string;
  color: string;
  bg: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

function toMonthly(price: number, cycle: string) {
  if (cycle === "weekly") return (price * 52) / 12;
  if (cycle === "yearly") return price / 12;
  return price;
}

function buildTips(subs: Sub[], currencySymbol: string): Tip[] {
  if (subs.length === 0) return [];
  const tips: Tip[] = [];
  const now = new Date();

  const totalMonthly = subs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);

  // Group by category
  const byCategory: Record<string, Sub[]> = {};
  for (const s of subs) {
    byCategory[s.category] = byCategory[s.category] || [];
    byCategory[s.category].push(s);
  }

  // 3+ in same category
  for (const [cat, list] of Object.entries(byCategory)) {
    if (list.length >= 3) {
      const catTotal = list.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
      tips.push({
        id: `cat3-${cat}`,
        icon: "layers-outline",
        color: "#DC2626",
        bg: "#FEF2F2",
        title: `${list.length} "${cat}" subscriptions`,
        detail: `You have ${list.map(s => s.name).join(", ")} — all in the same category, costing ${fmt(catTotal, currencySymbol)}/mo. Could you cut one?`,
        priority: "high",
      });
    } else if (list.length === 2) {
      tips.push({
        id: `cat2-${cat}`,
        icon: "content-duplicate",
        color: "#D97706",
        bg: "#FEF3C7",
        title: `2 "${cat}" subscriptions`,
        detail: `${list[0].name} and ${list[1].name} are both in the same category. Do you actively use both?`,
        priority: "medium",
      });
    }
  }

  // Trials ending in 7 days
  for (const s of subs) {
    if (!s.trialEndDate) continue;
    const days = Math.ceil((new Date(s.trialEndDate).getTime() - now.getTime()) / 86400000);
    if (days >= 0 && days <= 7) {
      tips.push({
        id: `trial-${s.id}`,
        icon: "clock-alert-outline",
        color: "#DC2626",
        bg: "#FEF2F2",
        title: `${s.name} trial ends ${days === 0 ? "today" : `in ${days} day${days !== 1 ? "s" : ""}`}`,
        detail: `You'll be charged ${fmt(s.price, currencySymbol)} automatically. If you don't want to continue, cancel before the trial ends.`,
        priority: "high",
      });
    }
  }

  // High total spend
  if (totalMonthly >= 100) {
    tips.push({
      id: "high-spend",
      icon: "trending-up",
      color: "#DC2626",
      bg: "#FEF2F2",
      title: `${fmt(totalMonthly, currencySymbol)}/mo is above average`,
      detail: `The average person spends $50–80/month on subscriptions. You're at ${fmt(totalMonthly, currencySymbol)} (${fmt(totalMonthly * 12, currencySymbol)}/yr). A quick audit could free up cash.`,
      priority: "high",
    });
  }

  // Expensive individual subscriptions
  for (const s of subs) {
    if (toMonthly(s.price, s.billingCycle) >= 25) {
      tips.push({
        id: `exp-${s.id}`,
        icon: "cash-remove",
        color: "#7C3AED",
        bg: "#F5F3FF",
        title: `${s.name} costs ${fmt(toMonthly(s.price, s.billingCycle), currencySymbol)}/mo`,
        detail: `That's ${fmt(toMonthly(s.price, s.billingCycle) * 12, currencySymbol)}/year. Check if a lower tier or family-sharing plan is available.`,
        priority: "medium",
      });
    }
  }

  // Switch monthly → yearly
  const monthlySubs = subs.filter(s => s.billingCycle === "monthly" && s.price >= 5);
  if (monthlySubs.length > 0) {
    const saving = monthlySubs.reduce((sum, s) => sum + s.price * 0.17, 0) * 12;
    tips.push({
      id: "yearly-switch",
      icon: "tag-outline",
      color: "#059669",
      bg: "#ECFDF5",
      title: "Switch to yearly and save",
      detail: `Most services offer 15–20% off for annual billing. Switching your ${monthlySubs.length} monthly plan${monthlySubs.length > 1 ? "s" : ""} could save roughly ${fmt(saving, currencySymbol)}/year.`,
      priority: "medium",
    });
  }

  // Multiple renewals this week
  const thisWeek = subs.filter(s => {
    const days = Math.ceil((new Date(s.nextBillingDate).getTime() - now.getTime()) / 86400000);
    return days >= 0 && days <= 7;
  });
  if (thisWeek.length >= 2) {
    const weekTotal = thisWeek.reduce((sum, s) => sum + s.price, 0);
    tips.push({
      id: "renewals-week",
      icon: "calendar-clock",
      color: "#2563EB",
      bg: "#EFF6FF",
      title: `${thisWeek.length} renewals this week`,
      detail: `${thisWeek.map(s => s.name).join(", ")} — totalling ${fmt(weekTotal, currencySymbol)} — renew in the next 7 days.`,
      priority: "low",
    });
  }

  // All looks fine
  if (tips.length === 0) {
    tips.push({
      id: "all-good",
      icon: "check-decagram",
      color: "#059669",
      bg: "#ECFDF5",
      title: "Everything looks good!",
      detail: `You have ${subs.length} subscription${subs.length !== 1 ? "s" : ""} totalling ${fmt(totalMonthly, currencySymbol)}/mo. No issues detected right now. Check back as you add more subscriptions.`,
      priority: "low",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return tips.sort((a, b) => order[a.priority] - order[b.priority]);
}

const PRIORITY_LABEL: Record<string, string> = { high: "Action needed", medium: "Worth reviewing", low: "FYI" };
const PRIORITY_COLOR: Record<string, string> = { high: "#DC2626", medium: "#D97706", low: "#6B7280" };

export default function InsightsScreen() {
  const router = useRouter();
  const { currency } = useCurrencyStore();

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<Sub[]>({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => (await apiClient.get("/trpc/subscriptions.list")).data.result.data,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => (await apiClient.get("/trpc/analytics.summary")).data.result.data,
  });

  const isLoading = subsLoading || summaryLoading;
  const tips = buildTips(subscriptions, currency.symbol);
  const monthlyTotal: number = summary?.monthlyTotal ?? 0;
  const highCount = tips.filter(t => t.priority === "high").length;

  return (
    <>
      <Stack.Screen options={{ title: "Recommendations", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

          {/* Summary banner */}
          <View style={styles.banner}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={26} color="#4F46E5" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.bannerTitle}>Spending snapshot</Text>
              <Text style={styles.bannerSub}>
                {subscriptions.length} subscription{subscriptions.length !== 1 ? "s" : ""}
                {"  ·  "}{fmt(monthlyTotal, currency.symbol)}/mo
                {"  ·  "}{fmt(monthlyTotal * 12, currency.symbol)}/yr
              </Text>
            </View>
            {highCount > 0 && (
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{highCount}</Text>
              </View>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
          ) : subscriptions.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="inbox-outline" size={52} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No subscriptions yet</Text>
              <Text style={styles.emptyText}>
                Add your subscriptions and we'll analyse your spending and flag anything worth reviewing.
              </Text>
              <TouchableOpacity style={styles.addButton} onPress={() => router.push("/(tabs)/subscriptions")}>
                <Text style={styles.addButtonText}>Add Subscription</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>
                {tips.length} recommendation{tips.length !== 1 ? "s" : ""}
                {highCount > 0 ? `  ·  ${highCount} need${highCount === 1 ? "s" : ""} attention` : ""}
              </Text>

              {tips.map(tip => (
                <View key={tip.id} style={[styles.card, { borderLeftColor: tip.color }]}>
                  <View style={styles.cardRow}>
                    <View style={[styles.iconBox, { backgroundColor: tip.bg }]}>
                      <MaterialCommunityIcons name={tip.icon as any} size={22} color={tip.color} />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{tip.title}</Text>
                        <View style={[styles.badge, { backgroundColor: tip.bg }]}>
                          <Text style={[styles.badgeText, { color: PRIORITY_COLOR[tip.priority] }]}>
                            {PRIORITY_LABEL[tip.priority]}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardDetail}>{tip.detail}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 40 },
  banner: {
    backgroundColor: "#EEF2FF", borderRadius: 12, padding: 16, marginBottom: 20,
    flexDirection: "row", alignItems: "center",
  },
  bannerTitle: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  bannerSub: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  alertBadge: {
    backgroundColor: "#DC2626", borderRadius: 12, minWidth: 24, height: 24,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 6,
  },
  alertBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  loading: { paddingTop: 60, alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937", marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22 },
  addButton: {
    marginTop: 20, backgroundColor: "#4F46E5", borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 32,
  },
  addButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  sectionLabel: { fontSize: 13, color: "#6B7280", fontWeight: "500", marginBottom: 12 },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E7EB", borderLeftWidth: 4,
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconBox: {
    width: 44, height: 44, borderRadius: 10,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardTitleRow: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", marginBottom: 6, gap: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937", flex: 1 },
  badge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  cardDetail: { fontSize: 13, color: "#6B7280", lineHeight: 20 },
});
