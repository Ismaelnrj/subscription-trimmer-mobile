import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Pressable, RefreshControl } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { fetchSubscriptionList } from "../lib/subscription-list";
import { useFmt, useCurrencyStore, sumMixedInBase } from "../lib/currency-store";
import { useAuthStore } from "../lib/auth-store";
import { PremiumGate } from "../components/PremiumGate";
import { useTheme, AppColors, space, radius, type as typeScale, tabular } from "../lib/theme";
import { STREAMING_KEYWORDS, FITNESS_KEYWORDS } from "../lib/categories";
import { findTemplateByExactName, isPriceFresh } from "../lib/service-templates";
import { daysUntil } from "../lib/utils";
import { localiseCategory } from "../lib/category-label";

export type Sub = {
  id: number; name: string; price: number; billingCycle: string;
  category: string; nextBillingDate: string; trialEndDate?: string | null;
  priceIncrease?: { from: number; to: number; changedAt: string } | null;
  // The currency this row's price was ENTERED in, which is not necessarily the
  // one it is displayed in. Optional because a row written before the column
  // existed has none, and `fmtC` correctly falls back to the global base there.
  currency?: string | null;
  /* Paused. Optional and nullable to match the server's own
     `isActive: s.is_active ?? true`, so an absent value reads as active. */
  isActive?: boolean | null;
};
export type Tip = {
  id: string; icon: string; color: string;
  title: string; detail: string; priority: "high" | "medium" | "low";
  savingsHint?: string;
  savingsValue?: number;
};


const CYCLE_NOUN_KEYS: Record<string, string> = {
  monthly: "common.cycleMonthly",
  yearly: "common.cycleYearly",
  weekly: "common.cycleWeekly",
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
/* Returns null when the rates cannot support the conversion, and the caller
   stays quiet rather than guessing.

   `?? 1` used to stand in for a missing rate, which silently asserts that the
   currency is worth exactly one dollar. Three templates are priced in CHF and
   CHF is not in FALLBACK_RATES, so before the live rates load, or offline, a
   Swiss row converted about 25 percent wrong and could have produced a
   "you may be overpaying" alert from a number nothing supported.

   Unreachable today, because those three rows carry no `verified` date and
   isPriceFresh gates the insight. Verifying any one of them would make it
   reachable immediately, which is the wrong way to find out.

   This is the same argument the freshness gate below already makes in its own
   comment: an unchecked figure telling somebody they are overpaying is worse
   than saying nothing. A rate nobody has is an unchecked figure. */
function convertCurrency(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  if (from === to) return amount;
  const usable = (r: unknown): r is number => typeof r === "number" && Number.isFinite(r) && r > 0;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!usable(fromRate) || !usable(toRate)) return null;
  const converted = amount * (toRate / fromRate);
  return Number.isFinite(converted) ? converted : null;
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
  fmtC: (n: number, fromCurrency?: string | null) => string,
  t: (key: string, opts?: Record<string, unknown>) => string,
  singleSubThreshold: number = DEFAULT_SINGLE_SUB_THRESHOLD,
  currencyContext?: { baseCurrencyCode: string; rates: Record<string, number> }
): Tip[] {
  /* FILTERED HERE rather than at the call sites, and the SIGNATURE IS
     DELIBERATELY UNCHANGED. There are two callers (this screen and the
     dashboard), and a third would have to remember; filtering inside means
     none of them can forget, which is the same reason the accessibility guard
     is a scan rather than a list and the phantom filter lives in one map.

     Adding a parameter is what shipped `TypeError: 50 is not a function` to
     every dashboard in September 2026, so the fix takes no new argument.

     Paused rows must not raise a saving tip: the tip names money you are not
     currently spending, and the advice is to cancel something already paused. */
  const planned = subs.filter((s) => s.isActive !== false);
  if (planned.length === 0) return [];
  const tips: Tip[] = [];
  const now = new Date();
  /* EVERY SUM AND EVERY THRESHOLD IS IN THE BASE CURRENCY, found 2026-11-07.
     These added raw prices across currencies, so a 1500 yen row joined a
     euro total as 1500 euros, was "expensive" at a 50 euro threshold, and a
     tracked price in one currency was compared with a market price converted
     into another. fmtC treats an unlabelled amount as base, so converting
     each row once here makes every total and comparison mean what it prints.
     A missing rate leaves the amount as it was, the old behaviour, rather
     than inventing a figure; without a currency context nothing converts. */
  const toBase = (amount: number, currency?: string | null) => {
    if (!currencyContext) return amount;
    const base = currencyContext.baseCurrencyCode.toUpperCase();
    const from = (currency || base).toUpperCase();
    return convertCurrency(amount, from, base, currencyContext.rates) ?? amount;
  };
  const monthlyInBase = (s: Sub) => toBase(toMonthly(s.price, s.billingCycle), s.currency);
  const totalMonthly = planned.reduce((sum, s) => sum + monthlyInBase(s), 0);
  const byCategory: Record<string, Sub[]> = {};
  for (const s of planned) { byCategory[s.category] = byCategory[s.category] || []; byCategory[s.category].push(s); }

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
  const streamingSubs = planned.filter(s => matchesKeywords(s.name, STREAMING_KEYWORDS) || s.category === "streaming");
  if (streamingSubs.length >= 3) {
    const streamTotal = streamingSubs.reduce((sum, s) => sum + monthlyInBase(s), 0);
    const cheapest = [...streamingSubs].sort((a, b) => monthlyInBase(a) - monthlyInBase(b))[0];
    tips.push({ id: "streaming-overlap", icon: "television-play", color: "#C4544A",
      title: t("insights.streamingTitle", { count: streamingSubs.length }),
      detail: t("insights.streamingDetail", { names: streamingSubs.map(s => s.name).join(", "), total: fmtC(streamTotal) }),
      priority: "high", savingsHint: t("insights.streamingHint", { amount: fmtC(toMonthly(cheapest.price, cheapest.billingCycle), cheapest.currency) }), savingsValue: monthlyInBase(cheapest) });
    coveredCategories.add("streaming");
  }

  // Fitness overlap (2+ fitness services)
  const fitnessSubs = planned.filter(s => matchesKeywords(s.name, FITNESS_KEYWORDS) || s.category === "fitness" || s.category === "health");
  if (fitnessSubs.length >= 2) {
    const fitTotal = fitnessSubs.reduce((sum, s) => sum + monthlyInBase(s), 0);
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
      const catTotal = list.reduce((sum, s) => sum + monthlyInBase(s), 0);
      tips.push({ id: `cat3-${cat}`, icon: "layers-outline", color: "#C4544A",
        title: t("insights.catManyTitle", { count: list.length, category: localiseCategory(cat, t) }),
        detail: t("insights.catManyDetail", { names: list.map(s => s.name).join(", "), total: fmtC(catTotal) }),
        priority: "high", savingsHint: t("insights.catManyHint", { amount: fmtC(catTotal * 0.5) }), savingsValue: catTotal * 0.5 });
    } else if (list.length === 2) {
      tips.push({ id: `cat2-${cat}`, icon: "content-duplicate", color: "#96631B",
        title: t("insights.catTwoTitle", { category: localiseCategory(cat, t) }),
        detail: t("insights.catTwoDetail", { first: list[0].name, second: list[1].name }),
        priority: "medium" });
    }
  }



  // Price increase alerts
  for (const s of planned) {
    if (!s.priceIncrease) continue;
    const diff = s.priceIncrease.to - s.priceIncrease.from;
    const annualExtra = toMonthly(diff, s.billingCycle) * 12;
    tips.push({ id: `price-up-${s.id}`, icon: "trending-up", color: "#C4544A",
      title: t("insights.priceUpTitle", { name: s.name }),
      /* The cycle as a noun in the reader's language: the raw API word
         printed "pro monthly" to a German reader. */
      detail: t("insights.priceUpDetail", { from: fmtC(s.priceIncrease.from, s.currency), to: fmtC(s.priceIncrease.to, s.currency), cycle: t(CYCLE_NOUN_KEYS[s.billingCycle] ?? "common.cycleMonthly"), extra: fmtC(annualExtra, s.currency) }),
      priority: "high", savingsHint: t("insights.priceUpHint", { amount: fmtC(toMonthly(s.priceIncrease.to, s.billingCycle), s.currency) }), savingsValue: toBase(toMonthly(s.priceIncrease.to, s.billingCycle), s.currency) });
  }

  // Known market price is higher than what's tracked — this is the "before
  // you pay" signal: it doesn't require you to have noticed a charge yet,
  // just that the service's publicly known price (from our own service
  // catalog) has since risen above what you're still tracking here.
  if (currencyContext) {
    const { baseCurrencyCode, rates } = currencyContext;
    for (const s of planned) {
      const template = findTemplateByExactName(s.name, baseCurrencyCode);
      if (!template) continue;
      /* Only speak for a price somebody has actually checked recently.
         The catalogue is a few hundred hardcoded figures and services
         reprice constantly, which is the very thing this app exists to warn
         people about, so an unchecked default telling somebody they are
         overpaying is worse than saying nothing. A row with no date, or one
         older than the window, is treated as unknown rather than as true. */
      if (!isPriceFresh(template)) continue;
      const marketMonthlyInBase = convertCurrency(
        toMonthly(template.defaultPrice, template.billingCycle),
        template.currency,
        baseCurrencyCode,
        rates
      );
      // No usable rate means no comparable figure, so there is nothing to say.
      if (marketMonthlyInBase == null) continue;
      const trackedMonthly = monthlyInBase(s);
      if (marketMonthlyInBase > trackedMonthly * MARKET_PRICE_INCREASE_THRESHOLD) {
        tips.push({ id: `market-price-${s.id}`, icon: "alert-decagram-outline", color: "#C4544A",
          title: t("insights.marketPriceTitle", { name: s.name }),
          detail: t("insights.marketPriceDetail", { name: s.name, market: fmtC(marketMonthlyInBase), tracked: fmtC(trackedMonthly) }),
          priority: "high" });
      }
    }
  }

  // Trial alerts
  for (const s of planned) {
    if (!s.trialEndDate) continue;
    const days = daysUntil(s.trialEndDate, now);
    // `days != null` first: null >= 0 is TRUE in JavaScript, so a nullable
    // number compared against a threshold passes silently.
    if (days != null && days >= 0 && days <= 7) {
      tips.push({ id: `trial-${s.id}`, icon: "clock-alert-outline", color: "#C4544A",
        title: days === 0 ? t("insights.trialTitleToday", { name: s.name })
                         : t("insights.trialTitleDays", { name: s.name, count: days }),
        detail: t("insights.trialDetail", { amount: fmtC(s.price, s.currency) }),
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
  for (const s of planned) {
    if (monthlyInBase(s) >= singleSubThreshold) {
      tips.push({ id: `exp-${s.id}`, icon: "cash-remove", color: "#142B3A",
        title: t("insights.expensiveTitle", { name: s.name, amount: fmtC(toMonthly(s.price, s.billingCycle), s.currency) }),
        detail: t("insights.expensiveDetail", { yearly: fmtC(toMonthly(s.price, s.billingCycle) * 12, s.currency) }),
        priority: "medium" });
    }
  }

  // Switch monthly to yearly
  const monthlySubs = planned.filter(s => s.billingCycle === "monthly" && toBase(s.price, s.currency) >= 5);
  if (monthlySubs.length > 0) {
    const annualSaving = monthlySubs.reduce((sum, s) => sum + toBase(s.price, s.currency) * 0.17, 0) * 12;
    tips.push({ id: "yearly-switch", icon: "tag-outline", color: "#1F7A62",
      title: t("insights.yearlySwitchTitle"),
      detail: t("insights.yearlySwitchDetail", { count: monthlySubs.length, names: monthlySubs.map(s => s.name).join(", "), amount: fmtC(annualSaving) }),
      priority: "medium", savingsHint: t("insights.yearlySwitchHint", { amount: fmtC(annualSaving) }), savingsValue: annualSaving / 12 });
  }

  // No yearly plans at all — nudge harder
  const yearlyCount = planned.filter(s => s.billingCycle === "yearly").length;
  if (yearlyCount === 0 && planned.length >= 4) {
    tips.push({ id: "no-yearly", icon: "calendar-check-outline", color: "#142B3A",
      title: t("insights.noYearlyTitle"),
      detail: t("insights.noYearlyDetail", { count: planned.length }),
      priority: "medium" });
  }

  // Renewals this week
  const thisWeek = planned.filter(s => {
    const days = daysUntil(s.nextBillingDate, now);
    return days != null && days >= 0 && days <= 7;
  });
  if (thisWeek.length >= 2) {
    const weekTotal = thisWeek.reduce((sum, s) => sum + toBase(s.price, s.currency), 0);
    tips.push({ id: "renewals-week", icon: "calendar-clock", color: "#142B3A",
      title: t("insights.renewalsWeekTitle", { count: thisWeek.length }),
      detail: t("insights.renewalsWeekDetail", { names: thisWeek.map(s => s.name).join(", "), total: fmtC(weekTotal) }),
      priority: "low" });
  }

  if (tips.length === 0) {
    tips.push({ id: "all-good", icon: "check-decagram", color: "#1F7A62",
      title: t("insights.allGoodTitle"),
      detail: t("insights.allGoodDetail", { count: planned.length, total: fmtC(totalMonthly) }),
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

  const { data: subscriptions = [], isLoading: subsLoading, isLoadingError: subsError, refetch: refetchSubs, isRefetching: subsRefetching } = useQuery<Sub[]>({
    queryKey: ["subscriptions", "list"],
    queryFn: fetchSubscriptionList,
  });

  const { data: summary, isLoading: summaryLoading, isLoadingError: summaryError, refetch: refetchSummary, isRefetching: summaryRefetching } = useQuery({
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
  /* From the per currency parts, converted once, as the dashboard and Stats
     do. The raw monthlyTotal adds a 10 EUR row and a 10 USD row into 20. */
  const monthlyTotal: number = sumMixedInBase(summary?.monthlyByCurrency, rates, baseCurrencyCode, summary?.monthlyTotal ?? 0);
  const highCount = tips.filter(t => t.priority === "high").length;
  // Multiple tips can reference the same underlying subscription (e.g. a sub can be
  // both "part of a duplicate category" and "individually expensive"), so their
  // savingsValue fields aren't mutually exclusive and can't just be summed as-is.
  // Cap at the user's actual total spend, since real savings can never exceed that.
  const savingsPotential = isPremium ? Math.min(calcSavingsPotential(allTips), monthlyTotal) : 0;

  /* A tip's colour comes from its priority and the theme, never from the hex
     buildTips carries: those were fixed light-mode values, so a navy icon
     vanished on the dark card and coral badge text measured 4.12:1. */
  const toneOf = (tip: Tip) =>
    tip.id === "all-good" ? c.success : tip.priority === "high" ? c.danger : tip.priority === "medium" ? c.warning : c.textSecondary;

  return (
    <>
      <Stack.Screen options={{ title: t("insights.screenTitle"), headerShown: true }} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} colors={[c.primary]} tintColor={c.primary} />}
      >
        <View style={styles.content}>
          {/* What this screen is about, said once, open on the page: what you
              track, then what you could keep. */}
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>{t("insights.spendingSnapshot")}</Text>
            <Text style={styles.summaryMeta}>
              {t("insights.snapshot", { count: subscriptions.length, month: fmtC(monthlyTotal), year: fmtC(monthlyTotal * 12) })}
            </Text>
            {isPremium && savingsPotential > 0 && (
              <Text style={styles.savingsLine}>{t("insights.potential", { amount: fmtC(savingsPotential) })}</Text>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={c.primary} />
            </View>
          ) : isError ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="alert-circle-outline" size={40} color={c.textMuted} />
              <Text style={styles.emptyTitle}>{t("insights.couldntLoad")}</Text>
              <Text style={styles.emptyText}>{t("insights.pullToRetry")}</Text>
            </View>
          ) : subscriptions.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="inbox-outline" size={40} color={c.textMuted} />
              <Text style={styles.emptyTitle}>{t("insights.noSubsTitle")}</Text>
              <Text style={styles.emptyText}>{t("insights.noSubsDesc")}</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => router.push("/(tabs)/subscriptions")} accessibilityRole="button">
                <Text style={styles.addButtonText}>{t("insights.addSub")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t("insights.recommendationCount", { count: tips.length })}</Text>
                {highCount > 0 && (
                  <Text style={[styles.sectionNote, { color: c.danger }]}>{t("insights.needAttention", { count: highCount })}</Text>
                )}
              </View>

              <View style={styles.card}>
                {tips.map((tip, i) => {
                  const tone = toneOf(tip);
                  return (
                    <TouchableOpacity
                      key={tip.id}
                      style={[styles.tipRow, i > 0 && styles.rowDivider]}
                      onPress={() => setSelectedTip(tip)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityHint={t("insights.tapToRead")}
                    >
                      <MaterialCommunityIcons name={tip.icon as any} size={20} color={tone} style={styles.tipIcon} />
                      <View style={styles.tipBody}>
                        <Text style={[styles.priority, { color: tip.priority === "low" ? c.textSecondary : tone }]}>
                          {t(PRIORITY_LABEL_KEY[tip.priority])}
                        </Text>
                        <Text style={styles.tipTitle} numberOfLines={2}>{tip.title}</Text>
                        <Text style={styles.tipDetail} numberOfLines={2}>{tip.detail}</Text>
                        {tip.savingsHint && <Text style={styles.savingsHint}>{tip.savingsHint}</Text>}
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {lockedCount > 0 && (
                <View style={styles.gateGap}>
                  <PremiumGate
                    title={t("insights.premiumGateTitle", { count: lockedCount })}
                    description={t("insights.premiumGateDesc")}
                  />
                </View>
              )}

              <Modal visible={!!selectedTip} transparent animationType="slide" onRequestClose={() => setSelectedTip(null)}>
                <Pressable style={styles.modalOverlay} onPress={() => setSelectedTip(null)}>
                  <Pressable style={styles.modalSheet} onPress={() => {}}>
                    {selectedTip && (
                      <>
                        <View style={styles.sheetHandle} />
                        <View style={styles.modalHeader}>
                          <MaterialCommunityIcons name={selectedTip.icon as any} size={24} color={toneOf(selectedTip)} />
                          <Text style={[styles.priority, { color: selectedTip.priority === "low" ? c.textSecondary : toneOf(selectedTip) }]}>
                            {t(PRIORITY_LABEL_KEY[selectedTip.priority])}
                          </Text>
                        </View>
                        <Text style={styles.modalTitle}>{selectedTip.title}</Text>
                        <Text style={styles.modalDetail}>{selectedTip.detail}</Text>
                        {selectedTip.savingsHint && (
                          <Text style={[styles.savingsHint, styles.modalSavings]}>{selectedTip.savingsHint}</Text>
                        )}
                        <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedTip(null)} accessibilityRole="button">
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

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: space.l, paddingTop: space.xl, paddingBottom: space.xxl },

    summary: { marginBottom: space.s },
    summaryLabel: { ...typeScale.caption, color: c.textSecondary },
    summaryMeta: { ...typeScale.bodyStrong, ...tabular, color: c.text, marginTop: space.xs },
    savingsLine: { ...typeScale.label, color: c.success, marginTop: space.s },

    loading: { paddingTop: 60, alignItems: "center" },
    empty: { alignItems: "center", paddingTop: 48, paddingHorizontal: space.xl },
    emptyTitle: { ...typeScale.heading, color: c.text, marginTop: space.l, marginBottom: space.s, textAlign: "center" },
    emptyText: { ...typeScale.body, color: c.textSecondary, textAlign: "center" },
    addButton: {
      marginTop: space.xl, backgroundColor: c.text, borderRadius: radius.m,
      minHeight: 48, paddingHorizontal: space.xxl, justifyContent: "center",
    },
    addButtonText: { ...typeScale.bodyStrong, color: c.bg },

    sectionHeader: {
      flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
      gap: space.m, marginTop: space.xl, marginBottom: space.s,
    },
    sectionTitle: { ...typeScale.heading, color: c.text, flexShrink: 1 },
    sectionNote: { ...typeScale.label },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, paddingHorizontal: space.l,
    },
    gateGap: { marginTop: space.l },
    tipRow: { flexDirection: "row", alignItems: "flex-start", gap: space.m, paddingVertical: space.l },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    tipIcon: { marginTop: 2 },
    tipBody: { flex: 1 },
    priority: { ...typeScale.label, marginBottom: 2 },
    tipTitle: { ...typeScale.bodyStrong, color: c.text },
    tipDetail: { ...typeScale.caption, color: c.textSecondary, marginTop: space.xs },
    savingsHint: { ...typeScale.label, color: c.success, marginTop: space.s },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: c.card, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l,
      paddingHorizontal: space.xl, paddingTop: space.m, paddingBottom: 40,
    },
    sheetHandle: { alignSelf: "center", width: 36, height: 4, borderRadius: radius.pill, backgroundColor: c.border, marginBottom: space.l },
    modalHeader: { flexDirection: "row", alignItems: "center", gap: space.s, marginBottom: space.m },
    modalTitle: { ...typeScale.title, color: c.text, marginBottom: space.m },
    modalDetail: { ...typeScale.body, color: c.textSecondary },
    modalSavings: { marginTop: space.l },
    modalClose: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 48,
      alignItems: "center", justifyContent: "center", marginTop: space.xl,
    },
    modalCloseText: { ...typeScale.bodyStrong, color: c.bg },
  });
}
