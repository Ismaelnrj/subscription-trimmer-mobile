import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { OfflineNotice } from "../../components/OfflineNotice";
import apiClient from "../../lib/api";
import { fetchSubscriptionList } from "../../lib/subscription-list";
import { useFmt, useCurrencyStore, sumMixedInBase, isMixedCurrency } from "../../lib/currency-store";
import { useAuthStore } from "../../lib/auth-store";
import { PremiumGate } from "../../components/PremiumGate";
import { WeeklyBarChart } from "../../components/WeeklyBarChart";
import { useTheme, AppColors, space, radius, type as typeScale, tabular } from "../../lib/theme";
import { FAB_SCROLL_CLEARANCE } from "../../components/GlobalFab";
import { getCategoryIcon } from "../../lib/categories";
import { useCategoryLabel } from "../../lib/category-label";
import { getOccurrencesInMonth, isPhantomOccurrence, livePlanned } from "../../lib/recurrence";

// 4, not 5 - a 5th bucket would only ever cover 0-3 leftover days (0 in a
// 28-day February, up to 3 in a 31-day month) but render with the same
// visual weight as a real 7-day bar, misleadingly implying a spending drop
// that's really just a shorter bucket. Folding those leftover days into the
// 4th bucket instead keeps every bar an honest, comparable width.
const WEEK_COUNT = 4;

export default function AnalyticsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const fmtC = useFmt();
  const { currency, rates, baseCurrencyCode } = useCurrencyStore();
  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();

  /* isLoadingError, not isError: a refetch that fails (offline, or the server
     restarting) keeps the data it already had, the saved offline copy included,
     and that data should stay on screen rather than be replaced by an error. */
  const { data: summary, isLoading, isLoadingError: isError, isRefetchError: isStale, refetch } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => (await apiClient.get("/trpc/analytics.summary")).data.result.data,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: fetchSubscriptionList,
  });

  /* Held in a useMemo with no dependencies rather than read inline, or the
     bucket memo below takes a new dependency on every render. Same reason the
     calendar screen holds its own `today` this way. */
  const today = useMemo(() => new Date(), []);

  const weeklyBuckets = useMemo(() => {
    const buckets = new Array(WEEK_COUNT).fill(0);
    /* Paused rows carry no planned charge, so they must not raise a weekly
       bar. Same reason the phantom filter sits here: this panel promises to
       show which weeks hit hardest, and a bar for a paused subscription is a
       week that does not hit at all. */
    for (const sub of livePlanned(subscriptions as any[])) {
      for (const date of getOccurrencesInMonth(sub, today)) {
        /* getOccurrencesInMonth projects a cycle indefinitely in both
           directions from nextBillingDate, and backwards past a point it
           invents charges: the band [today, anchor) cannot hold one, because
           the anchor IS the next charge by definition, so nothing bills
           between now and it. The calendar stopped drawing dots for those in
           September; this chart kept counting them, so the same month's money
           had two different answers on two screens.
           It matters more here than a dot does, because this panel promises
           to show "which weeks your subscriptions hit hardest" and was
           drawing a bar for a week where nothing hits. */
        if (isPhantomOccurrence(sub, date, today)) continue;
        const weekIndex = Math.min(Math.floor((date.getDate() - 1) / 7), WEEK_COUNT - 1);
        /* Converted into the base currency first, the unit every total on this
           screen is in. Adding raw prices made a 10 EUR and a 10 USD row one
           bar of 20, which is neither. */
        const price = Number(sub.price) || 0;
        buckets[weekIndex] += sumMixedInBase({ [sub.currency || ""]: price }, rates, baseCurrencyCode, price);
      }
    }
    return buckets;
  }, [subscriptions, today, rates, baseCurrencyCode]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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
        <MaterialCommunityIcons name="alert-circle-outline" size={40} color={c.textMuted} style={{ marginBottom: space.m }} />
        <Text style={styles.emptyStateText}>{t("analytics.couldntLoad")}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh} accessibilityRole="button">
          <Text style={styles.retryText}>{t("common.tryAgain")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const budgetGoal = settings?.budgetGoal;
  /* The server's monthlyTotal and categoryBreakdown ADD RAW NUMBERS ACROSS
     CURRENCIES, so a 10 EUR row and a 10 USD row read as 20. The per currency
     parts convert once into the base currency here, exactly as the dashboard
     already does, so the two screens agree. The raw fields remain the
     fallback for an older server. */
  const inBase = (byCurrency: Record<string, number> | undefined, fallback: number) =>
    sumMixedInBase(byCurrency, rates, baseCurrencyCode, fallback);
  const monthly = inBase(summary?.monthlyByCurrency, summary?.monthlyTotal ?? 0);
  const yearly = summary?.monthlyByCurrency ? monthly * 12 : (summary?.yearlyTotal ?? 0);
  /* A total that moved through an exchange rate is marked as an estimate, the
     same test the dashboard uses: any part priced in another currency. */
  const totalIsEstimate = isMixedCurrency(summary?.monthlyByCurrency, currency.code);
  const fmtTotal = (n: number) => {
    const text = fmtC(n);
    return totalIsEstimate && !text.startsWith("~") ? `~${text}` : text;
  };

  /* Six named slices, then Other.
   *
   * Six rather than all eleven because that is where the colours stop being
   * tellable apart: the category palette validates as ten distinct hues on
   * the adjacent pairlist, but slices here are ordered by amount, so any two
   * categories can end up touching and the guarantee only holds for a subset
   * on screen at once. Six also covers essentially every real list, since the
   * app ships eleven categories and nobody spreads their subscriptions across
   * all of them; the tail that gets folded is normally one or two rows worth
   * a couple of euros.
   *
   * It is not three. Three was tighter than the colours require and hid
   * categories people genuinely have. */
  const DONUT_SLICES = 6;
  const sortedCategories = (summary?.categoryBreakdown ?? []).map((cat: any) => ({
    ...cat,
    amount: inBase(summary?.categoryByCurrency?.[cat.category], cat.amount),
  })).sort((a: any, b: any) => b.amount - a.amount);
  const shownCount = isPremium ? DONUT_SLICES : 1;
  const visibleCategories = sortedCategories.slice(0, shownCount);
  const hiddenTotal = sortedCategories.slice(shownCount).reduce((sum: number, cat: any) => sum + cat.amount, 0);
  /* Each part's share of the whole, for the split bar and the rows under it.
     The whole is every category, hidden ones included, so the shares add up to
     the bar the reader sees. */
  const categoryTotal = sortedCategories.reduce((sum: number, cat: any) => sum + cat.amount, 0);
  const sharePct = (amount: number) => {
    if (categoryTotal <= 0) return "";
    const pct = (amount / categoryTotal) * 100;
    return t("analytics.share", { percent: pct > 0 && pct < 1 ? "<1" : String(Math.round(pct)) });
  };
  /* The folded tail is a neutral, never a category colour. c.border was right
     for a donut's track and is invisible as a segment (1.3:1 on the card). */
  const restColor = c.textMuted;
  const parts = [
    ...visibleCategories.map((cat: any) => ({ key: cat.category, value: cat.amount, color: getCategoryIcon(cat.category).color })),
    ...(hiddenTotal > 0 ? [{ key: "__rest", value: hiddenTotal, color: restColor }] : []),
  ];
  const average = monthly / Math.max(1, summary?.activeSubscriptions ?? 1);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
    >
      <View style={styles.scrollContent}>
        {isStale && <OfflineNotice />}

        {/* One figure leads, as on the dashboard. The yearly projection was a
            card of its own and is a line under it now. */}
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{t("analytics.perMonth")}</Text>
          <Text style={styles.summaryValue}>{fmtTotal(monthly)}</Text>
          <Text style={styles.summaryMeta}>{t("analytics.perYearMeta", { amount: fmtTotal(yearly) })}</Text>
          {budgetGoal != null && (
            <Text style={[styles.budgetLine, { color: monthly > budgetGoal ? c.danger : c.textSecondary }]}>
              {monthly > budgetGoal ? t("analytics.overBudget") : t("analytics.budgetLeft", { amount: fmtTotal(budgetGoal - monthly) })}
            </Text>
          )}
        </View>

        {/* "Per month" is said once, here, rather than as "/Monat" on every
            row, which pushed German category names into an ellipsis. */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderTitle}>{t("analytics.spendingByCategory")}</Text>
          <Text style={styles.sectionHeaderNote}>{t("analytics.perMonth")}</Text>
        </View>

        {(!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyStateText}>{t("analytics.noSpendingData")}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {/* A thin split bar above rows that carry every name and figure,
                which is the dataviz skill's form for a split read beside its
                numbers. It replaced a donut: a donut is the weakest way to
                compare parts, and its side legend truncated German names.
                The rows are the readable copy, so the bar is hidden from a
                screen reader rather than read twice. */}
            <View style={styles.splitBar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {parts.map((part) => (
                <View key={part.key} style={{ flex: part.value, backgroundColor: part.color }} />
              ))}
            </View>
            {visibleCategories.map((cat: any, i: number) => (
              <View key={cat.category} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={[styles.swatch, { backgroundColor: getCategoryIcon(cat.category).color }]} />
                <Text style={styles.rowTitle} numberOfLines={1}>{categoryLabel(cat.category)}</Text>
                <Text style={styles.rowShare}>{sharePct(cat.amount)}</Text>
                <Text style={styles.rowAmount}>{fmtTotal(cat.amount)}</Text>
              </View>
            ))}
            {/* The bar already draws this part; without the row it is an
                unexplained grey block. */}
            {hiddenTotal > 0 && (
              <View style={[styles.row, styles.rowDivider]}>
                <View style={[styles.swatch, { backgroundColor: restColor }]} />
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {t("analytics.otherCategories", { count: sortedCategories.length - shownCount })}
                </Text>
                <Text style={styles.rowShare}>{sharePct(hiddenTotal)}</Text>
                <Text style={styles.rowAmount}>{fmtTotal(hiddenTotal)}</Text>
              </View>
            )}
          </View>
        )}

        {!isPremium && sortedCategories.length > 1 && (
          <View style={styles.gateGap}>
            <PremiumGate
              title={t("analytics.hiddenCategories", { count: sortedCategories.length - 1 })}
              description={t("analytics.hiddenCategoriesDesc")}
            />
          </View>
        )}

        {/* Without Premium the card below carries this title itself, so the
            section heading would say it twice. */}
        {isPremium && <Text style={styles.sectionTitle}>{t("analytics.weeklySpending")}</Text>}
        {isPremium ? (
          <View style={[styles.card, styles.chartCard]}>
            <WeeklyBarChart
              values={weeklyBuckets}
              labels={weeklyBuckets.map((_, i) => t("analytics.week", { number: i + 1 }))}
              formatValue={(n) => fmtTotal(n)}
              c={c}
            />
          </View>
        ) : (
          <View style={styles.gateAlone}>
            <PremiumGate title={t("analytics.weeklySpending")} description={t("analytics.weeklySpendingDesc")} />
          </View>
        )}

        <Text style={styles.sectionTitle}>{t("analytics.summary")}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{t("analytics.activeNow")}</Text>
            <Text style={styles.rowAmount}>{summary?.activeSubscriptions ?? 0}</Text>
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <Text style={styles.rowTitle}>{t("analytics.totalAdded")}</Text>
            <Text style={styles.rowAmount}>{summary?.totalSubscriptions ?? 0}</Text>
          </View>
          {(summary?.activeSubscriptions ?? 0) > 0 && (
            <View style={[styles.row, styles.rowDivider]}>
              <Text style={styles.rowTitle}>{t("analytics.avgPerSub")}</Text>
              <Text style={styles.rowAmount}>{fmtTotal(average)}{t("common.perMonthShort")}</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { paddingHorizontal: space.l, paddingTop: space.xl, paddingBottom: FAB_SCROLL_CLEARANCE },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, paddingHorizontal: space.xl },

    summary: { marginBottom: space.s },
    summaryLabel: { ...typeScale.caption, color: c.textSecondary },
    summaryValue: { ...typeScale.display, color: c.text, marginTop: space.xs },
    summaryMeta: { ...typeScale.body, color: c.textSecondary, marginTop: space.xs },
    budgetLine: { ...typeScale.label, marginTop: space.s },

    sectionTitle: { ...typeScale.heading, color: c.text, marginTop: space.xl, marginBottom: space.s },
    sectionHeader: {
      flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
      gap: space.m, marginTop: space.xl, marginBottom: space.s,
    },
    sectionHeaderTitle: { ...typeScale.heading, color: c.text, flexShrink: 1 },
    sectionHeaderNote: { ...typeScale.caption, color: c.textSecondary },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, paddingHorizontal: space.l,
    },
    emptyCard: { paddingVertical: space.xl, alignItems: "center" },
    chartCard: { paddingTop: space.l, paddingBottom: space.m },
    gateGap: { marginTop: space.m },
    gateAlone: { marginTop: space.xl },

    /* Thin split bar: 8px, fully rounded ends, a 2px gap in the card colour
       between parts so neighbours never need to contrast with each other. */
    splitBar: {
      flexDirection: "row", height: 8, gap: 2, borderRadius: radius.pill,
      overflow: "hidden", marginTop: space.l, marginBottom: space.m,
    },
    row: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingVertical: space.m, gap: space.m },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    swatch: { width: 10, height: 10, borderRadius: radius.pill },
    rowTitle: { ...typeScale.body, color: c.text, flex: 1 },
    rowShare: { ...typeScale.caption, ...tabular, color: c.textSecondary, minWidth: 40, textAlign: "right" },
    rowAmount: { ...typeScale.bodyStrong, ...tabular, color: c.text, minWidth: 64, textAlign: "right" },

    emptyStateText: { ...typeScale.body, color: c.textSecondary, textAlign: "center" },
    retryButton: { marginTop: space.l, minHeight: 48, paddingHorizontal: space.xl, justifyContent: "center" },
    retryText: { ...typeScale.bodyStrong, color: c.text },
  });
}
