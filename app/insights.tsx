import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Pressable, RefreshControl } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/api";
import { useFmt } from "../lib/currency-store";
import { useAuthStore } from "../lib/auth-store";
import { PremiumGate } from "../components/PremiumGate";
import { useTheme, AppColors } from "../lib/theme";
import { STREAMING_KEYWORDS, FITNESS_KEYWORDS } from "../lib/categories";

export type Sub = {
  id: number; name: string; price: number; billingCycle: string;
  category: string; nextBillingDate: string; trialEndDate?: string | null;
  priceIncrease?: { from: number; to: number; changedAt: string } | null;
};
export type Tip = {
  id: string; icon: string; color: string;
  title: string; detail: string; priority: "high" | "medium" | "low";
  savingsHint?: string;
  savingsValue?: number;
};


function toMonthly(price: number, cycle: string) {
  if (cycle === "weekly") return (price * 52) / 12;
  if (cycle === "yearly") return price / 12;
  return price;
}

function matchesKeywords(name: string, keywords: string[]): boolean {
  const n = name.toLowerCase();
  return keywords.some(k => n.includes(k));
}

// Configurable thresholds — these can be tuned without code changes if they
// turn out to be too aggressive or too lax for most users.
const DEFAULT_SINGLE_SUB_THRESHOLD = 50; // flag a subscription costing this much or more per month
const TOTAL_SPEND_THRESHOLD = 200; // flag total monthly spend at or above this amount

export function buildTips(subs: Sub[], fmtC: (n: number) => string, singleSubThreshold: number = DEFAULT_SINGLE_SUB_THRESHOLD): Tip[] {
  if (subs.length === 0) return [];
  const tips: Tip[] = [];
  const now = new Date();
  const totalMonthly = subs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
  const byCategory: Record<string, Sub[]> = {};
  for (const s of subs) { byCategory[s.category] = byCategory[s.category] || []; byCategory[s.category].push(s); }

  // Duplicate category detection
  for (const [cat, list] of Object.entries(byCategory)) {
    if (list.length >= 3) {
      const catTotal = list.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
      tips.push({ id: `cat3-${cat}`, icon: "layers-outline", color: "#DC2626",
        title: `${list.length} "${cat}" subscriptions`,
        detail: `You have ${list.map(s => s.name).join(", ")} — all in the same category, costing ${fmtC(catTotal)}/mo. Could you cut one?`,
        priority: "high", savingsHint: `Could save up to ${fmtC(catTotal * 0.5)}/mo`, savingsValue: catTotal * 0.5 });
    } else if (list.length === 2) {
      tips.push({ id: `cat2-${cat}`, icon: "content-duplicate", color: "#D97706",
        title: `2 "${cat}" subscriptions`,
        detail: `${list[0].name} and ${list[1].name} are both in the same category. Do you actively use both?`,
        priority: "medium" });
    }
  }

  // Streaming overlap (3+ streaming services)
  const streamingSubs = subs.filter(s => matchesKeywords(s.name, STREAMING_KEYWORDS) || s.category === "streaming");
  if (streamingSubs.length >= 3) {
    const streamTotal = streamingSubs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
    const cheapest = [...streamingSubs].sort((a, b) => toMonthly(a.price ?? 0, a.billingCycle ?? "monthly") - toMonthly(b.price ?? 0, b.billingCycle ?? "monthly"))[0];
    tips.push({ id: "streaming-overlap", icon: "television-play", color: "#DC2626",
      title: `${streamingSubs.length} streaming services — that's a lot`,
      detail: `${streamingSubs.map(s => s.name).join(", ")} together cost ${fmtC(streamTotal)}/mo. Most households use 1–2. Rotating them (pause one, watch the other) could save you money.`,
      priority: "high", savingsHint: `Save ~${fmtC(toMonthly(cheapest.price, cheapest.billingCycle))}/mo by pausing one`, savingsValue: toMonthly(cheapest.price, cheapest.billingCycle) });
  }

  // Fitness overlap (2+ fitness services)
  const fitnessSubs = subs.filter(s => matchesKeywords(s.name, FITNESS_KEYWORDS) || s.category === "fitness" || s.category === "health");
  if (fitnessSubs.length >= 2) {
    const fitTotal = fitnessSubs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
    tips.push({ id: "fitness-overlap", icon: "dumbbell", color: "#7C3AED",
      title: `${fitnessSubs.length} health & fitness subscriptions`,
      detail: `${fitnessSubs.map(s => s.name).join(" and ")} overlap in purpose. Are you actively using both? You're spending ${fmtC(fitTotal)}/mo in this category.`,
      priority: "medium", savingsHint: `Could trim ${fmtC(fitTotal * 0.5)}/mo`, savingsValue: fitTotal * 0.5 });
  }

  // Price increase alerts
  for (const s of subs) {
    if (!s.priceIncrease) continue;
    const diff = s.priceIncrease.to - s.priceIncrease.from;
    const annualExtra = toMonthly(diff, s.billingCycle) * 12;
    tips.push({ id: `price-up-${s.id}`, icon: "trending-up", color: "#DC2626",
      title: `${s.name} quietly raised its price`,
      detail: `It went from ${fmtC(s.priceIncrease.from)} to ${fmtC(s.priceIncrease.to)} per ${s.billingCycle}. That's an extra ${fmtC(annualExtra)} per year you may not have noticed.`,
      priority: "high", savingsHint: `Cancel to save ${fmtC(toMonthly(s.priceIncrease.to, s.billingCycle))}/mo`, savingsValue: toMonthly(s.priceIncrease.to, s.billingCycle) });
  }

  // Trial alerts
  for (const s of subs) {
    if (!s.trialEndDate) continue;
    const days = Math.ceil((new Date(s.trialEndDate).getTime() - now.getTime()) / 86400000);
    if (days >= 0 && days <= 7) {
      tips.push({ id: `trial-${s.id}`, icon: "clock-alert-outline", color: "#DC2626",
        title: `${s.name} trial ends ${days === 0 ? "today" : `in ${days} day${days !== 1 ? "s" : ""}`}`,
        detail: `You'll be charged ${fmtC(s.price)} automatically. If you don't want to continue, cancel before the trial ends.`,
        priority: "high" });
    }
  }

  // High total spend
  if (totalMonthly >= TOTAL_SPEND_THRESHOLD) {
    tips.push({ id: "high-spend", icon: "trending-up", color: "#DC2626",
      title: `${fmtC(totalMonthly)}/mo is above average`,
      detail: `The average person spends $50–80/month on subscriptions. You're at ${fmtC(totalMonthly)} (${fmtC(totalMonthly * 12)}/yr). A quick audit could free up cash.`,
      priority: "high" });
  }

  // Individual expensive subs
  for (const s of subs) {
    if (toMonthly(s.price, s.billingCycle) >= singleSubThreshold) {
      tips.push({ id: `exp-${s.id}`, icon: "cash-remove", color: "#7C3AED",
        title: `${s.name} costs ${fmtC(toMonthly(s.price, s.billingCycle))}/mo`,
        detail: `That's ${fmtC(toMonthly(s.price, s.billingCycle) * 12)}/year. Check if a lower tier or family-sharing plan is available.`,
        priority: "medium" });
    }
  }

  // Switch monthly → yearly
  const monthlySubs = subs.filter(s => s.billingCycle === "monthly" && s.price >= 5);
  if (monthlySubs.length > 0) {
    const annualSaving = monthlySubs.reduce((sum, s) => sum + s.price * 0.17, 0) * 12;
    tips.push({ id: "yearly-switch", icon: "tag-outline", color: "#059669",
      title: "Switch to yearly and save",
      detail: `Most services offer 15–20% off for annual billing. Switching your ${monthlySubs.length} monthly plan${monthlySubs.length > 1 ? "s" : ""} (${monthlySubs.map(s => s.name).join(", ")}) could save roughly ${fmtC(annualSaving)}/year.`,
      priority: "medium", savingsHint: `~${fmtC(annualSaving)}/yr`, savingsValue: annualSaving / 12 });
  }

  // No yearly plans at all — nudge harder
  const yearlyCount = subs.filter(s => s.billingCycle === "yearly").length;
  if (yearlyCount === 0 && subs.length >= 4) {
    tips.push({ id: "no-yearly", icon: "calendar-check-outline", color: "#2563EB",
      title: "No annual plans — you're paying more",
      detail: `You have ${subs.length} monthly subscriptions. Switching even half of them to yearly billing typically saves 15–20%. Check each service's pricing page for annual options.`,
      priority: "medium" });
  }

  // Renewals this week
  const thisWeek = subs.filter(s => {
    const days = Math.ceil((new Date(s.nextBillingDate).getTime() - now.getTime()) / 86400000);
    return days >= 0 && days <= 7;
  });
  if (thisWeek.length >= 2) {
    const weekTotal = thisWeek.reduce((sum, s) => sum + s.price, 0);
    tips.push({ id: "renewals-week", icon: "calendar-clock", color: "#2563EB",
      title: `${thisWeek.length} renewals this week`,
      detail: `${thisWeek.map(s => s.name).join(", ")} — totalling ${fmtC(weekTotal)} — renew in the next 7 days.`,
      priority: "low" });
  }

  if (tips.length === 0) {
    tips.push({ id: "all-good", icon: "check-decagram", color: "#059669",
      title: "Everything looks good!",
      detail: `You have ${subs.length} subscription${subs.length !== 1 ? "s" : ""} totalling ${fmtC(totalMonthly)}/mo. No issues detected right now.`,
      priority: "low" });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return tips.sort((a, b) => order[a.priority] - order[b.priority]);
}

function calcSavingsPotential(tips: Tip[]): number {
  let total = 0;
  for (const t of tips) {
    if (typeof t.savingsValue === "number") total += t.savingsValue;
  }
  return total;
}

const PRIORITY_LABEL: Record<string, string> = { high: "Action needed", medium: "Worth reviewing", low: "FYI" };

export default function InsightsScreen() {
  const router = useRouter();
  const fmtC = useFmt();
  const c = useTheme();
  const styles = makeStyles(c);

  const { data: subscriptions = [], isLoading: subsLoading, isError: subsError, refetch: refetchSubs, isRefetching: subsRefetching } = useQuery<Sub[]>({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => (await apiClient.get("/trpc/subscriptions.list")).data.result.data,
  });

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary, isRefetching: summaryRefetching } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => (await apiClient.get("/trpc/analytics.summary")).data.result.data,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
  });

  const [selectedTip, setSelectedTip] = useState<Tip | null>(null);

  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const isLoading = subsLoading || summaryLoading;
  const isError = subsError || summaryError;
  const isRefetching = subsRefetching || summaryRefetching;
  const onRefresh = () => Promise.all([refetchSubs(), refetchSummary()]).catch(() => {});
  const singleSubThreshold = isPremium ? (settings?.alertThreshold ?? DEFAULT_SINGLE_SUB_THRESHOLD) : DEFAULT_SINGLE_SUB_THRESHOLD;
  const allTips = useMemo(() => buildTips(subscriptions, fmtC, singleSubThreshold), [subscriptions, fmtC, singleSubThreshold]);
  const tips = isPremium ? allTips : allTips.slice(0, 2);
  const lockedCount = isPremium ? 0 : Math.max(0, allTips.length - 2);
  const monthlyTotal: number = summary?.monthlyTotal ?? 0;
  const highCount = tips.filter(t => t.priority === "high").length;
  const savingsPotential = isPremium ? calcSavingsPotential(allTips) : 0;

  return (
    <>
      <Stack.Screen options={{ title: "Recommendations", headerShown: true }} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[c.primary]} tintColor={c.primary} />}
      >
        <View style={styles.content}>
          <View style={styles.banner}>
            <View style={styles.bannerLeft}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={26} color={c.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.bannerTitle}>Spending snapshot</Text>
                <Text style={styles.bannerSub}>
                  {subscriptions.length} subscription{subscriptions.length !== 1 ? "s" : ""}
                  {"  ·  "}{fmtC(monthlyTotal)}/mo
                  {"  ·  "}{fmtC(monthlyTotal * 12)}/yr
                </Text>
              </View>
              {highCount > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>{highCount}</Text>
                </View>
              )}
            </View>
            {isPremium && savingsPotential > 0 && (
              <View style={styles.savingsRow}>
                <MaterialCommunityIcons name="piggy-bank-outline" size={14} color={c.success} />
                <Text style={styles.savingsText}>
                  Potential savings: up to {fmtC(savingsPotential)}/mo
                </Text>
              </View>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={c.primary} />
            </View>
          ) : isError ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="alert-circle-outline" size={52} color={c.border} />
              <Text style={styles.emptyTitle}>Couldn't load recommendations</Text>
              <Text style={styles.emptyText}>Pull down to retry.</Text>
            </View>
          ) : subscriptions.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="inbox-outline" size={52} color={c.border} />
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

              {lockedCount > 0 && (
                <PremiumGate
                  title={`${lockedCount} more recommendation${lockedCount !== 1 ? "s" : ""} available`}
                  description="Upgrade to see your full personalised analysis and every money-saving opportunity."
                />
              )}

              {tips.map(tip => (
                <TouchableOpacity key={tip.id} style={[styles.card, { borderLeftColor: tip.color }]} onPress={() => setSelectedTip(tip)} activeOpacity={0.75}>
                  <View style={styles.cardRow}>
                    <View style={[styles.iconBox, { backgroundColor: tip.color + "18" }]}>
                      <MaterialCommunityIcons name={tip.icon as any} size={22} color={tip.color} />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{tip.title}</Text>
                        <View style={[styles.badge, { backgroundColor: tip.color + "18" }]}>
                          <Text style={[styles.badgeText, { color: tip.color }]}>
                            {PRIORITY_LABEL[tip.priority]}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardDetail} numberOfLines={2}>{tip.detail}</Text>
                      {tip.savingsHint && (
                        <View style={styles.savingsHintRow}>
                          <MaterialCommunityIcons name="piggy-bank-outline" size={12} color={c.success} />
                          <Text style={styles.savingsHintText}>{tip.savingsHint}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.tapHint}>Tap to read more →</Text>
                </TouchableOpacity>
              ))}

              <Modal visible={!!selectedTip} transparent animationType="slide" onRequestClose={() => setSelectedTip(null)}>
                <Pressable style={styles.modalOverlay} onPress={() => setSelectedTip(null)}>
                  <Pressable style={styles.modalSheet} onPress={() => {}}>
                    {selectedTip && (
                      <>
                        <View style={styles.modalHeader}>
                          <View style={[styles.modalIconBox, { backgroundColor: selectedTip.color + "18" }]}>
                            <MaterialCommunityIcons name={selectedTip.icon as any} size={28} color={selectedTip.color} />
                          </View>
                          <View style={[styles.badge, { backgroundColor: selectedTip.color + "18", alignSelf: "flex-start" }]}>
                            <Text style={[styles.badgeText, { color: selectedTip.color }]}>
                              {PRIORITY_LABEL[selectedTip.priority]}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.modalTitle}>{selectedTip.title}</Text>
                        <Text style={styles.modalDetail}>{selectedTip.detail}</Text>
                        {selectedTip.savingsHint && (
                          <View style={[styles.savingsHintRow, { marginTop: 16, marginBottom: 4 }]}>
                            <MaterialCommunityIcons name="piggy-bank-outline" size={14} color={c.success} />
                            <Text style={[styles.savingsHintText, { fontSize: 14 }]}>{selectedTip.savingsHint}</Text>
                          </View>
                        )}
                        <TouchableOpacity style={[styles.modalClose, { backgroundColor: selectedTip.color }]} onPress={() => setSelectedTip(null)}>
                          <Text style={styles.modalCloseText}>Got it</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </Pressable>
                </Pressable>
              </Modal>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 40 },
    banner: {
      backgroundColor: c.primaryLight, borderRadius: 12, padding: 16, marginBottom: 20,
    },
    bannerLeft: { flexDirection: "row", alignItems: "center" },
    bannerTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    bannerSub: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    alertBadge: {
      backgroundColor: c.danger, borderRadius: 12, minWidth: 24, height: 24,
      justifyContent: "center", alignItems: "center", paddingHorizontal: 6,
    },
    alertBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    savingsRow: {
      flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10,
      paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border,
    },
    savingsText: { fontSize: 13, fontWeight: "600", color: c.success },
    loading: { paddingTop: 60, alignItems: "center" },
    empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginTop: 16, marginBottom: 8 },
    emptyText: { fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 22 },
    addButton: {
      marginTop: 20, backgroundColor: c.primary, borderRadius: 10,
      paddingVertical: 12, paddingHorizontal: 32,
    },
    addButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    sectionLabel: { fontSize: 13, color: c.textSecondary, fontWeight: "500", marginBottom: 12 },
    card: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: c.border, borderLeftWidth: 4,
    },
    cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    iconBox: { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center", flexShrink: 0 },
    cardBody: { flex: 1 },
    cardTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6, gap: 8 },
    cardTitle: { fontSize: 14, fontWeight: "700", color: c.text, flex: 1 },
    badge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, flexShrink: 0 },
    badgeText: { fontSize: 11, fontWeight: "600" },
    cardDetail: { fontSize: 13, color: c.textSecondary, lineHeight: 20 },
    savingsHintRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
    savingsHintText: { fontSize: 12, fontWeight: "600", color: c.success },
    tapHint: { fontSize: 11, color: c.textMuted, textAlign: "right", marginTop: 8 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 40,
    },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    modalIconBox: { width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    modalTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 12, lineHeight: 26 },
    modalDetail: { fontSize: 15, color: c.textSecondary, lineHeight: 24 },
    modalClose: {
      borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 24,
    },
    modalCloseText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  });
}
