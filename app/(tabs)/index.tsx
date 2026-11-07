import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Animated, Easing } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import apiClient from "../../lib/api";
import { fetchSubscriptionList } from "../../lib/subscription-list";
import { livePlanned } from "../../lib/recurrence";
import { daysUntil, parseApiDate } from "../../lib/utils";
import { useDateFormat, dayMonthPattern } from "../../lib/date-locale";
import { useCurrencyStore, useFmt, useMixedTotalInBase, isMixedCurrency } from "../../lib/currency-store";
import { useAuthStore } from "../../lib/auth-store";
import { freePremiumUntil } from "../../lib/premium-status";
import { FirstRunCard } from "../../components/FirstRunCard";
import { scheduleRenewalReminders } from "../../lib/notification-scheduler";
import { useTheme, AppColors, space, radius, type as typeScale, tabular } from "../../lib/theme";
import { FAB_SCROLL_CLEARANCE } from "../../components/GlobalFab";
import { DashboardSkeleton } from "../../components/DashboardSkeleton";
import { LogoImage } from "../../components/LogoImage";
import { buildTips, DEFAULT_SINGLE_SUB_THRESHOLD } from "../insights";
import { useCycleLabel } from "../../lib/cycle-label";
import { USER_ESTIMATE_KEY } from "../onboarding";
import { useTranslation } from "react-i18next";
import { OfflineNotice } from "../../components/OfflineNotice";
import { PendingNotice } from "../../components/PendingNotice";
import { track } from "../../lib/analytics";

const RECO_BANNER_DISMISSED_UNTIL_KEY = "reco_banner_dismissed_until";
const ESTIMATE_BANNER_SHOWN_KEY = "estimate_banner_shown";
const INVITE_BANNER_DISMISSED_UNTIL_KEY = "invite_banner_dismissed_until";

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [recoBannerDismissed, setRecoBannerDismissed] = useState(true);
  const [inviteBannerDismissed, setInviteBannerDismissed] = useState(true);
  const [estimateBanner, setEstimateBanner] = useState<{ guess: number; actual: number } | null>(null);
  const { currency, baseCurrencyCode, rates } = useCurrencyStore();
  const fmtC = useFmt();
  const c = useTheme();
  const fmtD = useDateFormat();
  const styles = makeStyles(c);
  const { t, i18n } = useTranslation();

  const cycleLabel = useCycleLabel();
  /* isLoadingError, not isError: a refetch that fails (offline, or the server
     restarting) keeps the data it already had, the saved offline copy included,
     and that data should stay on screen rather than be replaced by an error. */
  const { data: summary, isLoading: summaryLoading, isLoadingError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => (await apiClient.get("/trpc/analytics.summary")).data.result.data,
  });

  /* The scheduler needs these, so the dashboard fetches them. They used not to
     be passed at all, which meant every switch on the notification preferences
     screen wrote a database row and changed nothing on the device.

     Same cache key the preferences screen uses, so this is usually a cache read
     rather than a second request. */
  const { data: notifPrefs } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: async () => (await apiClient.get("/trpc/notifications.getPreferences")).data.result.data,
  });

  const { data: subscriptions = [], isLoading: subsLoading, isLoadingError: subsError, isRefetchError: subsStale, refetch: refetchSubs } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: fetchSubscriptionList,
    /* `notifPrefs ?? {}` was the bug here, and it is the SAME one
       lib/language-store.ts already carries a long comment about. The
       scheduler reads an absent preference as ON, with a three day lead,
       which is the right default FOR THE SCHEDULER (dropping reminders
       because a query was slow is the failure this product cannot afford)
       and the wrong one for a caller: the two queries race, so on any cold
       start where preferences lose, this re-enabled reminders somebody had
       explicitly turned off and silently replaced a seven day choice with
       three.

       Not loaded means DO NOTHING. Nothing is lost by skipping: the effect
       below fires the moment preferences arrive and schedules with the real
       values. language-store.ts fixed exactly this and the fix was never
       applied to this caller. */
    onSuccess: (data: any[]) => {
      if (!notifPrefs) return;
      scheduleRenewalReminders(data, currency.symbol, notifPrefs);
    },
  });

  /* Reschedule when the preferences themselves change, not only when the
     subscription list refetches. Without this, turning renewal alerts off left
     the existing queue in place until something unrelated happened to refetch
     subscriptions. */
  useEffect(() => {
    if (!notifPrefs || !subscriptions.length) return;
    scheduleRenewalReminders(subscriptions as any[], currency.symbol, notifPrefs);
  }, [notifPrefs?.pushEnabled, notifPrefs?.renewalAlerts, notifPrefs?.renewalAlertDays]);

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
  const mixedTotalInBase = useMixedTotalInBase();
  const isPremium = user?.isPaid ?? false;
  const isLoading = summaryLoading || subsLoading;
  const isError = summaryError || subsError;

  const budgetGoal = settings?.budgetGoal;
  /* `summary.monthlyTotal` ADDS RAW NUMBERS ACROSS CURRENCIES, so a 10 EUR row
     and a 10 USD row arrive here as 20, and fmtC then converts that 20 as
     though it were already base currency. Load examples used to seed USD rows
     for every user, so this was the default first run for anyone outside the
     US. monthlyByCurrency carries the parts; this converts each once into the
     base currency, which is what every consumer below already assumes:
     fmtC converts base to display, and budgetGoal is a bare number with no
     currency column, so the percentage and the remaining amount are
     base-currency comparisons too. The old field is the fallback, so an older
     server keeps the previous behaviour rather than rendering nothing. */
  const monthlyTotal = mixedTotalInBase(summary?.monthlyByCurrency, summary?.monthlyTotal ?? 0);

  /* fmtC adds the `~` when the BASE differs from the display currency, which
     is the right rule for a total whose parts were all priced in the base. It
     is not enough here: a US reader with one euro row has base and display
     both USD, so fmtC sees no difference and prints an exact-looking figure
     for a number that moved through an exchange rate. Marking it whenever any
     PART was priced in something else is the honest test, and it is the
     difference between a figure that will appear on a statement and one that
     will not. */
  const totalIsEstimate = isMixedCurrency(summary?.monthlyByCurrency, currency.code);
  const fmtTotal = (n: number) => {
    const text = fmtC(n);
    return totalIsEstimate && !text.startsWith("~") ? `~${text}` : text;
  };
  const budgetRaw = budgetGoal ? (monthlyTotal / budgetGoal) * 100 : 0;
  const budgetPct = Math.min(budgetRaw, 100);
  const budgetColor = budgetRaw >= 90 ? c.danger : budgetRaw >= 70 ? c.warning : c.success;
  const budgetStatus = budgetRaw >= 100 ? t("dashboard.overBudget") : budgetRaw >= 80 ? t("dashboard.gettingClose") : t("dashboard.onTrack");

  const activeSubIds = new Set((subscriptions as any[]).map((s) => s.id));
  const activeAlertCount = (alerts as any[]).filter(
    (a) => !a.subscriptionId || activeSubIds.has(a.subscriptionId)
  ).length;

  /* Derived from the corrected monthly figure rather than read from the
     server's `yearlyTotal`, which is the mixed-currency monthlyTotal * 12 and
     therefore wrong in exactly the same way, twelve times over. */
  const yearlyTotal = monthlyTotal * 12;
  const yearlyAnim = useRef(new Animated.Value(yearlyTotal)).current;
  const [displayYearly, setDisplayYearly] = useState(yearlyTotal);
  const prevSubsCount = useRef<number | null>(null);

  useEffect(() => {
    const id = yearlyAnim.addListener(({ value }) => setDisplayYearly(value));
    return () => yearlyAnim.removeListener(id);
  }, [yearlyAnim]);

  useEffect(() => {
    if (prevSubsCount.current === null) {
      prevSubsCount.current = subscriptions.length;
      yearlyAnim.setValue(yearlyTotal);
      setDisplayYearly(yearlyTotal);
      return;
    }
    const subscriptionAdded = subscriptions.length > prevSubsCount.current;
    prevSubsCount.current = subscriptions.length;
    if (subscriptionAdded) {
      Animated.timing(yearlyAnim, {
        toValue: yearlyTotal,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      yearlyAnim.setValue(yearlyTotal);
      setDisplayYearly(yearlyTotal);
    }
  }, [yearlyTotal, subscriptions.length]);

  /* Paused rows carry no planned charge, so they raise no trial warning and
     are not your next payment. This matches the SERVER exactly: alerts.list
     filters `is_active = TRUE` before it generates a trial_alert, so without
     this the phone warned about a trial the backend had already decided was
     not live. */
  const planned = livePlanned(subscriptions as any[]);

  const trialsSoon = planned.filter((s) => {
    if (!s.trialEndDate) return false;
    const days = daysUntil(s.trialEndDate);
    return days != null && days >= 0 && days <= 14;
  }).sort((a, b) =>
    new Date(a.trialEndDate).getTime() - new Date(b.trialEndDate).getTime()
  );

  useEffect(() => {
    (async () => {
      const dismissedUntil = await SecureStore.getItemAsync(RECO_BANNER_DISMISSED_UNTIL_KEY);
      setRecoBannerDismissed(!!dismissedUntil && new Date(dismissedUntil) > new Date());
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const dismissedUntil = await SecureStore.getItemAsync(INVITE_BANNER_DISMISSED_UNTIL_KEY);
      setInviteBannerDismissed(!!dismissedUntil && new Date(dismissedUntil) > new Date());
    })();
  }, []);

  useEffect(() => {
    if (subsLoading) return;
    (async () => {
      const [estimateStr, alreadyShown] = await Promise.all([
        SecureStore.getItemAsync(USER_ESTIMATE_KEY),
        SecureStore.getItemAsync(ESTIMATE_BANNER_SHOWN_KEY),
      ]);
      if (!estimateStr || alreadyShown || subscriptions.length === 0) return;
      setEstimateBanner({ guess: parseInt(estimateStr, 10), actual: subscriptions.length });
      await SecureStore.setItemAsync(ESTIMATE_BANNER_SHOWN_KEY, "true");
    })();
  }, [subsLoading, subscriptions.length]);

  const singleSubThreshold = isPremium ? (settings?.alertThreshold ?? DEFAULT_SINGLE_SUB_THRESHOLD) : DEFAULT_SINGLE_SUB_THRESHOLD;
  const allRecoTips = subscriptions.length >= 2
    ? buildTips(subscriptions as any, fmtC, t, singleSubThreshold, { baseCurrencyCode, rates })
    : [];
  const recoTips = isPremium ? allRecoTips : allRecoTips.slice(0, 2);
  const showRecoBanner = !recoBannerDismissed && recoTips.length > 0;

  const dismissRecoBanner = async () => {
    setRecoBannerDismissed(true);
    const dismissedUntil = new Date(Date.now() + 7 * 86400000).toISOString();
    await SecureStore.setItemAsync(RECO_BANNER_DISMISSED_UNTIL_KEY, dismissedUntil);
  };

  // Only once someone has real use of the app to point back to, not on a
  // near-empty list where the invite would feel premature.
  const showInviteBanner = !inviteBannerDismissed && subscriptions.length >= 2;

  const dismissInviteBanner = async () => {
    setInviteBannerDismissed(true);
    const dismissedUntil = new Date(Date.now() + 14 * 86400000).toISOString();
    await SecureStore.setItemAsync(INVITE_BANNER_DISMISSED_UNTIL_KEY, dismissedUntil);
  };

  const handleInviteBannerPress = () => {
    track("referral_invite_tapped", { source: "dashboard_banner" });
    router.push("/refer-a-friend");
  };

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? t("dashboard.goodMorning") : greetingHour < 18 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening");
  const firstName = user?.name?.trim().split(/\s+/)[0];

  /* The next charges in date order. Paused rows are already out (`planned`),
     and a row whose date cannot be read is left out rather than shown with a
     wrong one. parseApiDate, never new Date(): the day must not move west of
     UTC (see lib/utils.ts). */
  const upcoming = planned
    .map((sub) => ({ sub, date: parseApiDate(sub.nextBillingDate), days: daysUntil(sub.nextBillingDate) }))
    .filter((x): x is { sub: any; date: Date; days: number } => x.date != null && x.days != null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 4);
  const dueText = (days: number) =>
    days <= 0 ? t("dashboard.dueToday") : days === 1 ? t("dashboard.dueTomorrow") : t("dashboard.dueInDays", { count: days });
  const dayMonth = dayMonthPattern(i18n.language);

  /* While free Premium runs (the reverse trial, a referral bonus), one quiet
     row says until when, leading to the plans. Only inside its last 30 days,
     so a referral balance of months does not sit there all season. */
  const freeUntil = freePremiumUntil(user);
  const freeDays = freeUntil ? daysUntil(freeUntil) : null;
  const freePremiumRow: MoreRow | null =
    freeUntil && freeDays != null && freeDays <= 30
      ? {
          key: "freePremium",
          icon: "crown-outline",
          title: t("dashboard.freePremiumUntil", { date: fmtD(parseApiDate(freeUntil)!, "PP") }),
          meta: freeDays <= 0 ? t("dashboard.freePremiumEndsToday") : t("dashboard.freePremiumDaysLeft", { count: freeDays }),
          onPress: () => router.push("/upgrade"),
        }
      : null;
  const moreRows: MoreRow[] = [
    ...(freePremiumRow ? [freePremiumRow] : []),
    ...(activeAlertCount > 0
      ? [{ key: "alerts", icon: "bell-outline", title: t("dashboard.alertsCount", { count: activeAlertCount }), tone: c.danger, onPress: () => router.push("/alerts") }]
      : []),
    ...(showRecoBanner
      ? [{ key: "tips", icon: "lightbulb-on-outline", title: t("dashboard.waysToSave", { count: recoTips.length }), onPress: () => router.push("/insights"), onDismiss: dismissRecoBanner }]
      : []),
    ...(!isPremium
      ? [{ key: "budget", icon: "target", title: t("dashboard.budgetUpsell"), tag: t("upgrade.premium"), onPress: () => router.push("/upgrade") }]
      /* DURING FREE PREMIUM THE SAME ROW LEADS TO THE SETTING ITSELF. A reverse
         trial only sells what somebody actually tries, and the budget was the
         one Premium feature nothing pointed a trial user at: the row above is
         for the free tier, and the budget bar only draws once a goal exists.
         Not shown to paying users, who chose not to set one. Waits for the
         settings query, so it does not flash before a saved goal arrives. */
      : freeUntil && settings && settings.budgetGoal == null
        ? [{ key: "budget", icon: "target", title: t("dashboard.budgetUpsell"), onPress: () => router.push("/account-settings") }]
        : []),
    ...(showInviteBanner
      ? [{ key: "invite", icon: "account-plus-outline", title: t("dashboard.inviteBannerCta"), meta: t("dashboard.inviteBannerText"), onPress: handleInviteBannerPress, onDismiss: dismissInviteBanner }]
      : []),
  ];


  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const isFirstRun = subscriptions.length === 0;
  const verifyBanner = user && !user.isVerified ? (
    <TouchableOpacity style={styles.verifyBanner} onPress={() => router.push("/verify-email")}>
      <MaterialCommunityIcons name="email-alert" size={20} color={c.warning} />
      <Text style={styles.verifyBannerText}>{t("dashboard.verifyEmail")}</Text>
      <Text style={styles.verifyBannerLink}>{t("dashboard.verifyLink")}</Text>
      <MaterialCommunityIcons name="chevron-right" size={18} color={c.warning} />
    </TouchableOpacity>
  ) : null;

  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={c.border} style={{ marginBottom: 12 }} />
        <Text style={styles.emptyStateText}>{t("dashboard.couldntLoad")}</Text>
        <TouchableOpacity style={[styles.actionButton, { marginTop: 16, paddingHorizontal: 24 }]} onPress={onRefresh}>
          <Text style={styles.actionButtonText}>{t("dashboard.tryAgain")}</Text>
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
        {subsStale && <OfflineNotice />}
        <PendingNotice />
        <Text style={styles.greeting}>
          {greeting}{firstName ? `, ${firstName}` : ""}
        </Text>

        {/* NOTHING ADDED YET: one focused card instead of a dashboard of zeros,
            an upsell and a warning. See components/FirstRunCard.tsx for the
            measurement behind it. The ordinary dashboard returns with the
            first subscription. */}
        {isFirstRun && <FirstRunCard verifyBanner={verifyBanner} />}
        {/* FREE PREMIUM IS SAID ON THE FIRST RUN TOO. The store listing and the
            site promise 14 days of Premium, and the quiet card that says it
            only exists once a subscription is added, so somebody who installed
            for that promise met no sign of it on the screen they land on. */}
        {isFirstRun && freePremiumRow && (
          <View style={[styles.card, styles.cardAfter]}>
            <QuietRow r={freePremiumRow} divider={false} styles={styles} c={c} dismissLabel={t("common.a11yDismiss")} />
          </View>
        )}

        {!isFirstRun && (<>
        {/* THE MONEY LEADS. Redone 2026-11-07: the total used to be the fourth
            card down, under a Premium upsell and behind a monthly/yearly
            toggle, so the one number this app exists for was the least
            visible thing on its first screen. Both figures now show at once and
            nothing sits above them. */}
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{t("dashboard.thisMonth")}</Text>
          <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {fmtTotal(monthlyTotal)}
          </Text>
          <Text style={styles.summaryMeta}>
            {t("dashboard.yearAndActive", { amount: fmtTotal(displayYearly), count: summary?.activeSubscriptions ?? 0 })}
          </Text>

          {isPremium && budgetGoal != null && (
            <View style={styles.budget}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${budgetPct}%` as any, backgroundColor: budgetColor }]} />
              </View>
              <View style={styles.budgetFooter}>
                <Text style={[styles.budgetStatus, { color: budgetColor }]}>{budgetStatus}</Text>
                <Text style={styles.budgetRemaining}>
                  {budgetRaw >= 100
                    ? t("dashboard.overLimit", { amount: fmtTotal(monthlyTotal - budgetGoal) })
                    : t("dashboard.remainingOf", { amount: fmtTotal(budgetGoal - monthlyTotal), goal: fmtC(budgetGoal) })}
                </Text>
              </View>
            </View>
          )}
        </View>

        {verifyBanner}

        {estimateBanner && (
          <View style={[styles.card, styles.note]}>
            <MaterialCommunityIcons name="target" size={20} color={c.textSecondary} />
            <Text style={styles.noteText}>
              {t("dashboard.youGuessed", { guess: estimateBanner.guess, actual: estimateBanner.actual, count: estimateBanner.actual })}
            </Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("common.a11yDismiss")} onPress={() => setEstimateBanner(null)} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {trialsSoon.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t("dashboard.trialsEndingSoon")}</Text>
            <View style={styles.card}>
              {trialsSoon.map((sub: any, i: number) => {
                // trialsSoon already filtered these to a readable date in range.
                const days = daysUntil(sub.trialEndDate) ?? 0;
                const urgency = days <= 3 ? c.danger : c.warning;
                return (
                  <TouchableOpacity key={sub.id} style={[styles.row, i > 0 && styles.rowDivider]} onPress={() => router.push(`/subscription-details?id=${sub.id}`)}>
                    <LogoImage name={sub.name} category={sub.category} size={36} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{sub.name}</Text>
                      <Text style={styles.rowMeta}>
                        {t("dashboard.chargedOnExpiry", { amount: fmtC(sub.price, sub.currency), cycle: cycleLabel(sub.billingCycle) })}
                      </Text>
                    </View>
                    <Text style={[styles.rowAside, { color: urgency }]}>
                      {days === 0 ? t("dashboard.today") : t("dashboard.daysLeft", { count: days })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* The next charges in date order, in the calendar timeline's row: logo,
            name, when, and the amount in the row's own currency on the right. */}
        <Text style={styles.sectionTitle}>{t("dashboard.upcoming")}</Text>
        <View style={styles.card}>
          {upcoming.length === 0 && (
            <View style={styles.row}>
              <Text style={styles.rowMeta}>{t("dashboard.noUpcomingPayments")}</Text>
            </View>
          )}
          {upcoming.map(({ sub, date, days }, i) => (
            <TouchableOpacity key={sub.id} style={[styles.row, i > 0 && styles.rowDivider]} onPress={() => router.push(`/subscription-details?id=${sub.id}`)}>
              <LogoImage name={sub.name} category={sub.category} size={36} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{sub.name}</Text>
                <Text style={styles.rowMeta}>{dueText(days)}, {fmtD(date, dayMonth)}</Text>
              </View>
              <Text style={styles.rowAmount}>{fmtC(sub.price, sub.currency)}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.row, styles.rowDivider]} onPress={() => router.push("/(tabs)/subscriptions")}>
            <Text style={styles.rowLink}>{t("dashboard.viewAllSubscriptions")}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Everything that is a suggestion rather than a fact, together and
            quiet, after the facts. These were five differently coloured
            banners and an amber upsell card stacked above the total. */}
        {moreRows.length > 0 && (
          <View style={[styles.card, styles.cardAfter]}>
            {moreRows.map((r, i) => (
              <QuietRow key={r.key} r={r} divider={i > 0} styles={styles} c={c} dismissLabel={t("common.a11yDismiss")} />
            ))}
          </View>
        )}
        </>)}
      </View>
    </ScrollView>
  );
}

/* One quiet row of the dashboard's suggestions card. A component rather than a
   render function, so the handlers it carries are props of a child and plainly
   not called while rendering. */
type MoreRow = {
  key: string;
  icon: string;
  title: string;
  meta?: string;
  tag?: string;
  tone?: string;
  onPress: () => void;
  onDismiss?: () => void;
};

function QuietRow({ r, divider, styles, c, dismissLabel }: {
  r: MoreRow; divider: boolean; styles: ReturnType<typeof makeStyles>; c: AppColors; dismissLabel: string;
}) {
  return (
    <TouchableOpacity style={[styles.row, divider && styles.rowDivider]} onPress={r.onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name={r.icon as any} size={22} color={r.tone ?? c.textSecondary} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, r.tone ? { color: r.tone } : null]}>{r.title}</Text>
        {r.meta ? <Text style={styles.rowMeta}>{r.meta}</Text> : null}
      </View>
      {r.tag ? (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{r.tag}</Text>
        </View>
      ) : null}
      {r.onDismiss ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={(e) => { e.stopPropagation(); r.onDismiss?.(); }}
          hitSlop={12}
        >
          <MaterialCommunityIcons name="close" size={18} color={c.textMuted} />
        </TouchableOpacity>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
      )}
    </TouchableOpacity>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { paddingHorizontal: space.l, paddingTop: space.xl, paddingBottom: FAB_SCROLL_CLEARANCE },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    greeting: { ...typeScale.label, color: c.textSecondary, marginBottom: space.xs },

    summary: { marginBottom: space.xl },
    summaryLabel: { ...typeScale.caption, color: c.textSecondary },
    summaryValue: { ...typeScale.display, ...tabular, color: c.text, marginTop: space.xs },
    summaryMeta: { ...typeScale.body, ...tabular, color: c.textSecondary, marginTop: space.xs },
    budget: { marginTop: space.l },
    progressTrack: { height: 6, borderRadius: radius.pill, backgroundColor: c.border, overflow: "hidden" },
    progressFill: { height: 6, borderRadius: radius.pill },
    budgetFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: space.s },
    budgetStatus: { ...typeScale.label },
    budgetRemaining: { ...typeScale.caption, ...tabular, color: c.textSecondary },

    sectionTitle: { ...typeScale.heading, color: c.text, marginTop: space.xl, marginBottom: space.s },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, paddingHorizontal: space.l,
    },
    cardAfter: { marginTop: space.xl },
    row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingVertical: space.m, gap: space.m },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowText: { flex: 1 },
    rowTitle: { ...typeScale.bodyStrong, color: c.text },
    rowMeta: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },
    rowAmount: { ...typeScale.bodyStrong, ...tabular, color: c.text },
    rowAside: { ...typeScale.label },
    rowLink: { ...typeScale.bodyStrong, color: c.text, flex: 1 },
    tag: { backgroundColor: c.primaryLight, borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2 },
    // c.text, not c.primary: dark primary on primaryLight is 3.35:1, under 4.5.
    tagText: { ...typeScale.label, fontSize: 12, color: c.text },

    note: { flexDirection: "row", alignItems: "center", gap: space.m, paddingVertical: space.m, marginBottom: space.l },
    noteText: { ...typeScale.caption, color: c.text, flex: 1 },

    verifyBanner: {
      flexDirection: "row", alignItems: "center", gap: space.s, backgroundColor: c.warningLight,
      borderRadius: radius.m, padding: space.m, marginBottom: space.l,
    },
    verifyBannerText: { ...typeScale.caption, color: c.text, flex: 1 },
    verifyBannerLink: { ...typeScale.label, color: c.warning },

    emptyStateText: { ...typeScale.body, color: c.textSecondary, textAlign: "center" },
    actionButton: { backgroundColor: c.primary, borderRadius: radius.m, minHeight: 48, alignItems: "center", justifyContent: "center" },
    actionButtonText: { ...typeScale.bodyStrong, color: "#FFFFFF" },
  });
}
