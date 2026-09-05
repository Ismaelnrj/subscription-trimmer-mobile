import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Pressable, RefreshControl } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { useFmt, useCurrencyStore } from "../lib/currency-store";
import { useAuthStore } from "../lib/auth-store";
import { PremiumGate } from "../components/PremiumGate";
import { useTheme, AppColors } from "../lib/theme";
import { STREAMING_KEYWORDS, FITNESS_KEYWORDS } from "../lib/categories";
import { findTemplateByExactName } from "../lib/service-templates";

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

// rates are USD-based (rates[X] = units of X per 1 USD), matching how
// currency-store.ts fetches them — converts an amount between any two
// currency codes present in that table.
function convertCurrency(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate = rates[to] ?? 1;
  return amount * (toRate / fromRate);
}

// Configurable thresholds — these can be tuned without code changes if they
// turn out to be too aggressive or too lax for most users.
export const DEFAULT_SINGLE_SUB_THRESHOLD = 50; // flag a subscription costing this much or more per month
const TOTAL_SPEND_THRESHOLD = 200; // flag total monthly spend at or above this amount
const MARKET_PRICE_INCREASE_THRESHOLD = 1.05; // known price must be >5% above what's tracked to flag it

// `t` is threaded through rather than called at the call sites so every tip
// is translated at the point it is built. These strings used to be hardcoded
// English, which a German user met on a screen that is otherwise translated.
export function buildTips(
  subs: Sub[],
  fmtC: (n: number) => string,
  t: (key: string, opts?: Record<string, unknown>) => string,
  singleSubThreshold: number = DEFAULT_SINGLE_SUB_THRESHOLD,
  currencyContext?: { baseCurrencyCode: string; rates: Record<string, number> }
): Tip[] {
  if (subs.length === 0) return [];
  const tips: Tip[] = [];
  const now = new Date();
  const totalMonthly = subs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
  const byCategory: Record<string, Sub[]> = {};
  for (const s of subs) { byCategory[s.category] = byCategory[s.category] || []; byCategory[s.category].push(s); }

  /* The streaming and fitness rules are specialisations of the generic
     "several in one category" rule, so for anyone with 3 or more streaming
     subscriptions both fired and the screen showed the same finding twice,
     listing the same services under two headings. They run first now and
     claim their categories, so the generic rule only speaks for categories
     nothing more specific covers.

     The specific ones win because they say something the generic one cannot:
     which service to pause and what that saves, rather than half the category
     total as a vague ceiling. */
  const coveredCategories = new Set<string>();

  // Streaming overlap (3+ streaming services)
  const streamingSubs = subs.filter(s => matchesKeywords(s.name, STREAMING_KEYWORDS) || s.category === "streaming");
  if (streamingSubs.length >= 3) {
    const streamTotal = streamingSubs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
    const cheapest = [...streamingSubs].sort((a, b) => toMonthly(a.price ?? 0, a.billingCycle ?? "monthly") - toMonthly(b.price ?? 0, b.billingCycle ?? "monthly"))[0];
    tips.push({ id: "streaming-overlap", icon: "television-play", color: "#C4544A",
      title: t("insights.streamingTitle", { count: streamingSubs.length }),
      detail: t("insights.streamingDetail", { names: streamingSubs.map(s => s.name).join(", "), total: fmtC(streamTotal) }),
      priority: "high", savingsHint: t("insights.streamingHint", { amount: fmtC(toMonthly(cheapest.price, cheapest.billingCycle)) }), savingsValue: toMonthly(cheapest.price, cheapest.billingCycle) });
    coveredCategories.add("streaming");
  }

  // Fitness overlap (2+ fitness services)
  const fitnessSubs = subs.filter(s => matchesKeywords(s.name, FITNESS_KEYWORDS) || s.category === "fitness" || s.category === "health");
  if (fitnessSubs.length >= 2) {
    const fitTotal = fitnessSubs.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
    tips.push({ id: "fitness-overlap", icon: "dumbbell", color: "#142B3A",
      title: t("insights.fitnessTitle", { count: fitnessSubs.length }),
      detail: t("insights.fitnessDetail", { names: fitnessSubs.map(s => s.name).join(" & "), total: fmtC(fitTotal) }),
      priority: "medium", savingsHint: t("insights.fitnessHint", { amount: fmtC(fitTotal * 0.5) }), savingsValue: fitTotal * 0.5 });
    coveredCategories.add("fitness");
    coveredCategories.add("health");
  }

  // Duplicate category detection
  for (const [cat, list] of Object.entries(byCategory)) {
    if (coveredCategories.has(cat)) continue;
    if (list.length >= 3) {
      const catTotal = list.reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);
      tips.push({ id: `cat3-${cat}`, icon: "layers-outline", color: "#C4544A",
        title: t("insights.catManyTitle", { count: list.length, category: cat }),
        detail: t("insights.catManyDetail", { names: list.map(s => s.name).join(", "), total: fmtC(catTotal) }),
        priority: "high", savingsHint: t("insights.catManyHint", { amount: fmtC(catTotal * 0.5) }), savingsValue: catTotal * 0.5 });
    } else if (list.length === 2) {
      tips.push({ id: `cat2-${cat}`, icon: "content-duplicate", color: "#96631B",
        title: t("insights.catTwoTitle", { category: cat }),
        detail: t("insights.catTwoDetail", { first: list[0].name, second: list[1].name }),
        priority: "medium" });
    }
  }



  // Price increase alerts
  for (const s of subs) {
    if (!s.priceIncrease) continue;
    const diff = s.priceIncrease.to - s.priceIncrease.from;
    const annualExtra = toMonthly(diff, s.billingCycle) * 12;
    tips.push({ id: `price-up-${s.id}`, icon: "trending-up", color: "#C4544A",
      title: t("insights.priceUpTitle", { name: s.name }),
      detail: t("insights.priceUpDetail", { from: fmtC(s.priceIncrease.from), to: fmtC(s.priceIncrease.to), cycle: s.billingCycle, extra: fmtC(annualExtra) }),
      priority: "high", savingsHint: t("insights.priceUpHint", { amount: fmtC(toMonthly(s.priceIncrease.to, s.billingCycle)) }), savingsValue: toMonthly(s.priceIncrease.to, s.billingCycle) });
  }

  // Known market price is higher than what's tracked — this is the "before
  // you pay" signal: it doesn't require you to have noticed a charge yet,
  // just that the service's publicly known price (from our own service
  // catalog) has since risen above what you're still tracking here.
  if (currencyContext) {
    const { baseCurrencyCode, rates } = currencyContext;
    for (const s of subs) {
      const template = findTemplateByExactName(s.name, baseCurrencyCode);
      if (!template) continue;
      const marketMonthlyInBase = convertCurrency(
        toMonthly(template.defaultPrice, template.billingCycle),
        template.currency,
        baseCurrencyCode,
        rates
      );
      const trackedMonthly = toMonthly(s.price, s.billingCycle);
      if (marketMonthlyInBase > trackedMonthly * MARKET_PRICE_INCREASE_THRESHOLD) {
        tips.push({ id: `market-price-${s.id}`, icon: "alert-decagram-outline", color: "#C4544A",
          title: t("insights.marketPriceTitle", { name: s.name }),
          detail: t("insights.marketPriceDetail", { name: s.name, market: fmtC(marketMonthlyInBase), tracked: fmtC(trackedMonthly) }),
          priority: "high" });
      }
    }
  }

  // Trial alerts
  for (const s of subs) {
    if (!s.trialEndDate) continue;
    const days = Math.ceil((new Date(s.trialEndDate).getTime() - now.getTime()) / 86400000);
    if (days >= 0 && days <= 7) {
      tips.push({ id: `trial-${s.id}`, icon: "clock-alert-outline", color: "#C4544A",
        title: days === 0 ? t("insights.trialTitleToday", { name: s.name })
                         : t("insights.trialTitleDays", { name: s.name, count: days }),
        detail: t("insights.trialDetail", { amount: fmtC(s.price) }),
        priority: "high" });
    }
  }

  // High total spend
  if (totalMonthly >= TOTAL_SPEND_THRESHOLD) {
    tips.push({ id: "high-spend", icon: "trending-up", color: "#C4544A",
      title: t("insights.highSpendTitle", { total: fmtC(totalMonthly) }),
      detail: t("insights.highSpendDetail", { total: fmtC(totalMonthly), yearly: fmtC(totalMonthly * 12) }),
      priority: "high" });
  }

  // Individual expensive subs
  for (const s of subs) {
    if (toMonthly(s.price, s.billingCycle) >= singleSubThreshold) {
      tips.push({ id: `exp-${s.id}`, icon: "cash-remove", color: "#142B3A",
        title: t("insights.expensiveTitle", { name: s.name, amount: fmtC(toMonthly(s.price, s.billingCycle)) }),
        detail: t("insights.expensiveDetail", { yearly: fmtC(toMonthly(s.price, s.billingCycle) * 12) }),
        priority: "medium" });
    }
  }

  // Switch monthly → yearly
  const monthlySubs = subs.filter(s => s.billingCycle === "monthly" && s.price >= 5);
  if (monthlySubs.length > 0) {
    const annualSaving = monthlySubs.reduce((sum, s) => sum + s.price * 0.17, 0) * 12;
    tips.push({ id: "yearly-switch", icon: "tag-outline", color: "#1F7A62",
      title: t("insights.yearlySwitchTitle"),
      detail: t("insights.yearlySwitchDetail", { count: monthlySubs.length, names: monthlySubs.map(s => s.name).join(", "), amount: fmtC(annualSaving) }),
      priority: "medium", savingsHint: t("insights.yearlySwitchHint", { amount: fmtC(annualSaving) }), savingsValue: annualSaving / 12 });
  }

  // No yearly plans at all — nudge harder
  const yearlyCount = subs.filter(s => s.billingCycle === "yearly").length;
  if (yearlyCount === 0 && subs.length >= 4) {
    tips.push({ id: "no-yearly", icon: "calendar-check-outline", color: "#142B3A",
      title: t("insights.noYearlyTitle"),
      detail: t("insights.noYearlyDetail", { count: subs.length }),
      priority: "medium" });
  }

  // Renewals this week
  const thisWeek = subs.filter(s => {
    const days = Math.ceil((new Date(s.nextBillingDate).getTime() - now.getTime()) / 86400000);
    return days >= 0 && days <= 7;
  });
  if (thisWeek.length >= 2) {
    const weekTotal = thisWeek.reduce((sum, s) => sum + s.price, 0);
    tips.push({ id: "renewals-week", icon: "calendar-clock", color: "#142B3A",
      title: t("insights.renewalsWeekTitle", { count: thisWeek.length }),
      detail: t("insights.renewalsWeekDetail", { names: thisWeek.map(s => s.name).join(", "), total: fmtC(weekTotal) }),
      priority: "low" });
  }

  if (tips.length === 0) {
    tips.push({ id: "all-good", icon: "check-decagram", color: "#1F7A62",
      title: t("insights.allGoodTitle"),
      detail: t("insights.allGoodDetail", { count: subs.length, total: fmtC(totalMonthly) }),
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

const PRIORITY_LABEL_KEY: Record<string, string> = { high: "insights.actionNeeded", medium: "insights.worthReviewing", low: "insights.fyi" };

export default function InsightsScreen() {
  const router = useRouter();
  const fmtC = useFmt();
  const { baseCurrencyCode, rates } = useCurrencyStore();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

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
  const allTips = useMemo(
    () => buildTips(subscriptions, fmtC, t, singleSubThreshold, { baseCurrencyCode, rates }),
    // `t` belongs here: without it, switching language leaves the tips
    // rendered in the previous one until something else invalidates the memo.
    [subscriptions, fmtC, t, singleSubThreshold, baseCurrencyCode, rates]
  );
  const tips = isPremium ? allTips : allTips.slice(0, 2);
  const lockedCount = isPremium ? 0 : Math.max(0, allTips.length - 2);
  const monthlyTotal: number = summary?.monthlyTotal ?? 0;
  const highCount = tips.filter(t => t.priority === "high").length;
  // Multiple tips can reference the same underlying subscription (e.g. a sub can be
  // both "part of a duplicate category" and "individually expensive"), so their
  // savingsValue fields aren't mutually exclusive and can't just be summed as-is.
  // Cap at the user's actual total spend, since real savings can never exceed that.
  const savingsPotential = isPremium ? Math.min(calcSavingsPotential(allTips), monthlyTotal) : 0;

  return (
    <>
      <Stack.Screen options={{ title: t("insights.screenTitle"), headerShown: true }} />
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
                <Text style={styles.bannerTitle}>{t("insights.spendingSnapshot")}</Text>
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
                  {t("insights.potential", { amount: fmtC(savingsPotential) })}
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
              <Text style={styles.emptyTitle}>{t("insights.couldntLoad")}</Text>
              <Text style={styles.emptyText}>{t("insights.pullToRetry")}</Text>
            </View>
          ) : subscriptions.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="inbox-outline" size={52} color={c.border} />
              <Text style={styles.emptyTitle}>{t("insights.noSubsTitle")}</Text>
              <Text style={styles.emptyText}>{t("insights.noSubsDesc")}</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => router.push("/(tabs)/subscriptions")}>
                <Text style={styles.addButtonText}>{t("insights.addSub")}</Text>
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
                  title={t("insights.premiumGateTitle", { count: lockedCount })}
                  description={t("insights.premiumGateDesc")}
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
                            {t(PRIORITY_LABEL_KEY[tip.priority])}
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
                  <Text style={styles.tapHint}>{t("insights.tapToRead")} →</Text>
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
                              {t(PRIORITY_LABEL_KEY[selectedTip.priority])}
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
                          <Text style={styles.modalCloseText}>{t("insights.gotIt")}</Text>
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
