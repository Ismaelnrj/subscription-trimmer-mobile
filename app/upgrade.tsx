import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PurchasesPackage } from "react-native-purchases";
import {
  setupIAP, checkIsPremium, getOfferings,
  purchasePackage, restorePremium, isUserCancelled, PRODUCT_IDS,
  type PremiumSync,
} from "../lib/iap";
import { useAuthStore } from "../lib/auth-store";
import { hasPaidPlan, freePremiumUntil } from "../lib/premium-status";
import { parseApiDate } from "../lib/utils";
import { useDateFormat } from "../lib/date-locale";
import { useTheme, AppColors, space, radius, type as typeScale, tabular } from "../lib/theme";
import { track } from "../lib/analytics";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/api";

type PlanKey = "monthly" | "yearly" | "lifetime";

/* Only for the render before settings resolve, and for a backend that does not
   send the field. Kept equal to the server default, which a test asserts. */
const FREE_LIMIT_FALLBACK = 5;

export default function UpgradeScreen() {
  const router = useRouter();
  const { setUser, user } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("yearly");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  /* A PURCHASE, not Premium: a trial or referral account is Premium and
     still sees the plans, with when its free Premium ends above them. */
  const [isPremium, setIsPremium] = useState(hasPaidPlan(user));
  const freeUntil = freePremiumUntil(user);
  const fmtD = useDateFormat();
  const [iapReady, setIapReady] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  /* Separate from `packages.length > 0`, because an empty array is two
     different situations: the offerings have not come back yet, or they came
     back with nothing. The first must show a placeholder and the second must
     say the price is unavailable, and conflating them is how a wrong currency
     gets shown indefinitely. */
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  /* THE SAME QUERY KEY THE DASHBOARD USES, so react-query serves this from cache
     whenever settings have already loaded, which is the normal path onto this
     screen. Only a cold entry costs a request, and one request on a screen the
     user opened deliberately is a better trade than a comparison table that
     says "Up to 5" while the server allows ten.
     `staleTime` is long because a deployment constant does not change while
     somebody is reading a purchase screen. */
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
    staleTime: 5 * 60 * 1000,
  });
  const serverLimit = Number(settings?.freeSubscriptionLimit);
  const freeLimit = Number.isFinite(serverLimit) && serverLimit >= 1 ? serverLimit : FREE_LIMIT_FALLBACK;

  /* WHAT EACH TIER REALLY GETS, checked against the code on 2026-11-07.
     true and false draw a check or a dash with a spoken label; a string is a
     limit. Two rows were wrong and are gone from the Premium only side:
     trial tracking is free (nothing gates the trial switch or its reminder,
     on the phone or the server), and "Priority support" named a queue that
     does not exist (one address, the same for everybody). */
  const FEATURES: { label: string; free: string | boolean; premium: string | boolean }[] = [
    { label: t("upgrade.feat_subscriptions"), free: t("upgrade.free_subscriptions", { count: freeLimit }), premium: t("upgrade.premium_unlimited") },
    { label: t("upgrade.feat_categories"),    free: t("upgrade.free_categories"), premium: t("upgrade.premium_fullBreakdown") },
    { label: t("upgrade.feat_ai"),            free: t("upgrade.free_ai"),         premium: t("upgrade.premium_allInsights") },
    { label: t("upgrade.feat_budget"),        free: false, premium: true },
    { label: t("upgrade.feat_customCat"),     free: false, premium: true },
    { label: t("upgrade.feat_export"),        free: false, premium: true },
    { label: t("upgrade.feat_email"),         free: false, premium: true },
    { label: t("upgrade.feat_trial"),         free: true,  premium: true },
  ];

  /* THIS SCREEN NEVER NAMES A PRICE GOOGLE PLAY DID NOT GIVE IT.

     It used to fall back to PREMIUM_PRICES, which is hardcoded USD. That was
     sold as "a fallback for the moment before the offerings resolve", and the
     moment is the problem: an Austrian opening this screen read "$2.99" until
     RevenueCat answered, and read it FOREVER if RevenueCat never did. A
     fallback that shows the wrong currency is not a fallback, it is a wrong
     answer with a timer on it.

     Hardcoding EUR instead would just move the lie. There are only three
     honest states, so the price is a tagged value rather than a string:
       loading      the offerings are still in flight, show a placeholder
       real         a priceString from Play, the only thing allowed to look
                    like money
       unavailable  offerings failed or this package is missing, say so and
                    refuse the purchase

     `real` is what the buy button reads to decide whether it can be pressed,
     so the UI cannot offer to charge somebody an amount it could not name. */
  type PlanPrice = { text: string; real: boolean };

  const priceFor = (plan: PlanKey): PlanPrice => {
    if (!offeringsLoaded) return { text: t("upgrade.priceLoading"), real: false };
    const pkg = packages.find((p) => p.product.identifier === PRODUCT_IDS[plan]);
    return pkg
      ? { text: pkg.product.priceString, real: true }
      : { text: t("upgrade.priceUnavailable"), real: false };
  };

  /* THE YEARLY SAVING IS WORKED OUT FROM PLAY'S OWN PRICES, never written in.
     It used to be the string "Save 44%", which was true of 2.99 and 19.99 and
     nothing else: the day the Play price moved, the purchase screen would state
     a saving the prices beside it did not add up to, and Play rounds each
     country's price separately, so one fixed figure cannot be right
     everywhere anyway. Rounded DOWN so it never claims more than the real
     difference, and absent whenever either real price is, the same rule as the
     prices themselves. */
  const yearlySaving = (): number | null => {
    const monthly = packages.find((p) => p.product.identifier === PRODUCT_IDS.monthly)?.product.price;
    const yearly = packages.find((p) => p.product.identifier === PRODUCT_IDS.yearly)?.product.price;
    if (typeof monthly !== "number" || typeof yearly !== "number" || !(monthly > 0) || !(yearly > 0)) return null;
    const percent = Math.floor((1 - yearly / (monthly * 12)) * 100);
    return percent >= 1 ? percent : null;
  };
  const saving = yearlySaving();

  const PLANS: { key: PlanKey; label: string; price: PlanPrice; sub: string; badge?: string }[] = [
    { key: "yearly",   label: t("upgrade.yearly"),   price: priceFor("yearly"),   sub: t("upgrade.perYear"),   badge: saving !== null ? t("upgrade.savePercent", { percent: saving }) : undefined },
    { key: "monthly",  label: t("upgrade.monthly"),  price: priceFor("monthly"),  sub: t("upgrade.perMonth") },
    { key: "lifetime", label: t("upgrade.lifetime"), price: priceFor("lifetime"), sub: t("upgrade.oneTime") },
  ];

  useEffect(() => {
    track("paywall_viewed");
  }, []);

  useEffect(() => {
    (async () => {
      const ready = await setupIAP(user?.openId);
      setIapReady(ready);
      try {
        if (ready) {
          const [pkgs, premium] = await Promise.all([getOfferings(), checkIsPremium()]);
          setPackages(pkgs);
          /* null means the LOOKUP FAILED, which is not the same as "not
             premium". `isPremium` is already seeded from the server's own
             `user.isPaid`, so leaving it alone is strictly better than
             overwriting a known-good answer with a failure. */
          if (premium !== null) setIsPremium(premium);
        }
      } finally {
        /* In a finally, and set even when setupIAP said not ready, or the
           screen sits on the loading placeholder forever on a device where
           IAP is unavailable. Resolved-with-nothing is a real answer here:
           it renders as "price unavailable", which is true. */
        setOfferingsLoaded(true);
      }
    })();
  }, []);

  const getPackageForPlan = (plan: PlanKey): PurchasesPackage | undefined =>
    packages.find((p) => p.product.identifier === PRODUCT_IDS[plan]);

  /* APPLIES THE SERVER'S USER, AND RETURNS THE SERVER'S VERDICT.
     Both handlers used to do `setUser({ ...user, isPaid: true })`, which
     MANUFACTURES a paid account out of the old one by flipping a field. The
     server already returns the real updated user from verify-premium and that
     was thrown away, so a 200 carrying `isPaid: false` produced a Premium
     welcome and an account that lost Premium on the next load.
     THE VERDICT IS hasPaidPlan, NOT isPaid. isPaid is also true for free
     Premium (the trial, a referral bonus), so on a trial account a purchase
     the server has NOT confirmed still came back isPaid: true and was greeted
     as a welcome. hasPaidPlan is true only when a purchase stands behind it.
     The account's free Premium is untouched either way: setUser writes the
     server's user, whose isPaid still includes it.
     Returns true/false for a real verdict, or null when the server gave none,
     which the callers must not read as "no". */
  const applyServerVerdict = (sync: PremiumSync): boolean | null => {
    if (sync.status !== "verified") return null;
    /* Never write another account's user into this session. The response is
       for whoever the request was authenticated as, so a mismatch means the
       session changed underneath this call. */
    if (!user || sync.user.id !== user.id) return null;
    setUser(sync.user as any);
    const paid = hasPaidPlan(sync.user as any);
    setIsPremium(paid);
    return paid;
  };

  const handleBuy = async () => {
    // One store operation at a time: a second tap must not start a second one.
    if (loading || restoring) return;
    if (!iapReady) {
      Alert.alert(t("common.error"), t("upgrade.errNotAvailable"));
      return;
    }
    const pkg = getPackageForPlan(selectedPlan);
    if (!pkg) {
      Alert.alert(t("common.error"), t("upgrade.errPlanNotAvailable"));
      return;
    }
    setLoading(true);
    try {
      const { sync } = await purchasePackage(pkg);
      if (applyServerVerdict(sync) === true) {
        track("upgrade_completed", { plan: selectedPlan });
        Alert.alert(t("upgrade.welcomeTitle"), t("upgrade.welcomeMsg"), [
          { text: t("upgrade.welcomeBtn"), onPress: () => router.back() },
        ]);
      } else {
        /* CHARGED, NOT YET CONFIRMED. Reached either because the server could
           not be asked or because it has not seen the entitlement yet. Never a
           failure message: the money has already moved, and telling somebody a
           payment failed is how they buy it twice. */
        Alert.alert(t("upgrade.purchaseReceivedTitle"), t("upgrade.purchaseReceivedMsg"));
      }
    } catch (e: any) {
      // Typed flag first, so a reworded SDK message cannot turn a cancellation
      // into a "purchase failed" alert.
      if (!isUserCancelled(e)) {
        Alert.alert(t("upgrade.purchaseFailedTitle"), t("upgrade.purchaseFailedMsg"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (loading || restoring) return;
    if (!iapReady) return;
    setRestoring(true);
    try {
      const result = await restorePremium();
      // The person chose to stop. Saying anything here would be noise.
      if (result.status === "cancelled") return;
      /* THE LOOKUP ITSELF FAILED, so nothing is known. This is the case that
         used to render as "No purchase found": offline, or RevenueCat down,
         reported to a paying customer as never having bought anything. The
         retry copy already existed and was simply unreachable. */
      if (result.status === "error") {
        Alert.alert(t("upgrade.errRestoreTitle"), t("upgrade.errRestoreMsg"));
        return;
      }

      const verdict = applyServerVerdict(result.sync);
      if (verdict === true) {
        Alert.alert(t("upgrade.restoredTitle"), t("upgrade.restoredMsg"));
      } else if (verdict === null || result.status === "restored") {
        /* Either the server gave no verdict, or it has not caught up with a
           purchase the SDK can already see. Both are "wait a moment", not
           "you have nothing". */
        Alert.alert(t("upgrade.almostThereTitle"), t("upgrade.almostThereMsg"));
      } else {
        // The server CHECKED with RevenueCat and this account has nothing.
        Alert.alert(t("upgrade.noPurchaseTitle"), t("upgrade.noPurchaseMsg"));
      }
    } finally {
      setRestoring(false);
    }
  };

  const selectedPlanInfo = PLANS.find((p) => p.key === selectedPlan)!;

  const cell = (v: string | boolean, premium: boolean) =>
    typeof v === "string" ? (
      <Text style={[styles.cellText, premium && styles.cellTextStrong]}>{v}</Text>
    ) : (
      <MaterialCommunityIcons
        name={v ? "check" : "minus"}
        size={20}
        color={v ? c.text : c.textSecondary}
        accessibilityLabel={v ? t("upgrade.included") : t("upgrade.notIncluded")}
      />
    );

  /* REDONE 2026-11-07 on the dashboard's scale. It was a navy (green in dark
     mode) hero with an off-palette yellow crown, a tinted hook card, three
     cramped plan columns with 9px badges, a twelve point table, and the buy
     button below all of it. Now: one headline, the plans as a list with the
     price where the eye ends, the button and its terms straight after, and
     what Premium adds underneath for whoever wants it. Same handlers. */
  return (
    <>
      <Stack.Screen options={{ title: t("upgrade.title"), headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{t("upgrade.heroTitle")}</Text>
        {/* The pitch is for somebody deciding; a paying customer gets the card. */}
        {!isPremium && <Text style={styles.headline} accessibilityRole="header">{t("upgrade.headline")}</Text>}

        {isPremium ? (
          <View style={[styles.card, styles.cardFirst]}>
            <View style={styles.cardRow}>
              <MaterialCommunityIcons name="check-circle" size={24} color={c.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t("upgrade.alreadyPremiumTitle")}</Text>
                <Text style={styles.cardBody}>{t("upgrade.alreadyPremiumSub")}</Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            {freeUntil && (
              <View style={[styles.card, styles.cardAfter]}>
                <View style={styles.cardRow}>
                  <MaterialCommunityIcons name="crown-outline" size={22} color={c.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {t("upgrade.freeUntilTitle", { date: fmtD(parseApiDate(freeUntil)!, "PP") })}
                    </Text>
                    <Text style={styles.cardBody}>{t("upgrade.freeUntilBody")}</Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={styles.section}>{t("upgrade.choosePlan")}</Text>
            <View style={styles.plans} accessibilityRole="radiogroup">
              {PLANS.map((plan) => {
                const active = selectedPlan === plan.key;
                return (
                  <TouchableOpacity
                    key={plan.key}
                    style={[styles.plan, active && styles.planOn]}
                    onPress={() => setSelectedPlan(plan.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.radio, active && styles.radioOn]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.planTop}>
                        <Text style={styles.planLabel}>{plan.label}</Text>
                        {plan.badge && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{plan.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.planSub}>{plan.sub}</Text>
                    </View>
                    <Text style={[styles.planPrice, !plan.price.real && styles.planPriceUnset]}>
                      {plan.price.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Disabled until there is a real price. handleBuy already refuses a
                missing package with an alert, but a button that offers to charge
                you an amount the screen could not name should not be pressable in
                the first place. The label drops the price rather than
                interpolating the placeholder into "Unlock Premium, Loading". */}
            <TouchableOpacity
              style={[styles.buyButton, !selectedPlanInfo.price.real && styles.buyButtonDisabled]}
              onPress={handleBuy}
              disabled={loading || !selectedPlanInfo.price.real}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading || !selectedPlanInfo.price.real }}
            >
              {loading ? <ActivityIndicator color={c.bg} /> : (
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.buyButtonText}>
                    {selectedPlanInfo.price.real
                      ? t("upgrade.unlockButton", { price: selectedPlanInfo.price.text })
                      : selectedPlanInfo.price.text}
                  </Text>
                  <Text style={styles.buyButtonSub}>{selectedPlanInfo.sub}</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.legalNote}>{t("upgrade.legalNote")}</Text>

            <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={restoring}>
              <Text style={styles.restoreText}>{restoring ? t("upgrade.restoring") : t("upgrade.restorePurchase")}</Text>
            </TouchableOpacity>

            <Text style={styles.section}>{t("upgrade.whatsIncluded")}</Text>
            <View style={styles.card}>
              <View style={styles.tableHead}>
                <View style={styles.featureCol} />
                <Text style={styles.headText}>{t("upgrade.free")}</Text>
                <Text style={styles.headText}>{t("upgrade.premium")}</Text>
              </View>
              {FEATURES.map((f) => (
                <View key={f.label} style={styles.tableRow}>
                  <Text style={[styles.featureCol, styles.featureText]}>{f.label}</Text>
                  <View style={styles.valueCol}>{cell(f.free, false)}</View>
                  <View style={styles.valueCol}>{cell(f.premium, true)}</View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: space.xl, paddingBottom: space.xxl * 2 },
    kicker: { ...typeScale.label, color: c.textSecondary },
    headline: { ...typeScale.title, fontSize: 24, lineHeight: 30, color: c.text, marginTop: space.xs, marginBottom: space.xl },
    section: { ...typeScale.heading, color: c.text, marginTop: space.xl, marginBottom: space.m },
    card: {
      backgroundColor: c.card, borderRadius: radius.l, padding: space.l,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.cardBorder,
    },
    cardAfter: { marginBottom: space.s },
    cardFirst: { marginTop: space.l },
    cardRow: { flexDirection: "row", gap: space.m, alignItems: "flex-start" },
    cardTitle: { ...typeScale.bodyStrong, color: c.text },
    cardBody: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },
    plans: { gap: space.s },
    plan: {
      flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 72,
      paddingHorizontal: space.l, paddingVertical: space.m, borderRadius: radius.m,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    },
    /* Chosen is an ink outline and a filled radio, the same ink the add form
       uses for a chosen option; never white on primary. */
    planOn: { borderWidth: 2, borderColor: c.text, paddingHorizontal: space.l - 1 },
    radio: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.textSecondary,
      alignItems: "center", justifyContent: "center",
    },
    radioOn: { borderColor: c.text },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.text },
    planTop: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.s },
    planLabel: { ...typeScale.bodyStrong, color: c.text },
    planSub: { ...typeScale.caption, color: c.textSecondary },
    badge: {
      borderRadius: radius.pill, borderWidth: 1, borderColor: c.success,
      paddingHorizontal: space.s, paddingVertical: 1,
    },
    badgeText: { ...typeScale.label, color: c.success },
    planPrice: { ...typeScale.heading, ...tabular, color: c.text },
    /* Smaller and muted, because "Preis nicht verfügbar" is far longer than any
       price and must not read as one. */
    planPriceUnset: { ...typeScale.caption, color: c.textSecondary, maxWidth: 110, textAlign: "right" },
    buyButton: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 60, marginTop: space.l,
      alignItems: "center", justifyContent: "center", paddingVertical: space.s,
    },
    buyButtonDisabled: { opacity: 0.5 },
    buyButtonText: { ...typeScale.bodyStrong, fontFamily: "Montserrat-SemiBold", color: c.bg },
    buyButtonSub: { ...typeScale.caption, color: c.bg, marginTop: 2 },
    legalNote: { ...typeScale.caption, color: c.textSecondary, textAlign: "center", marginTop: space.m },
    restoreButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: space.s },
    restoreText: { ...typeScale.bodyStrong, color: c.text },
    tableHead: { flexDirection: "row", alignItems: "center", paddingBottom: space.s },
    headText: { flex: 1, ...typeScale.label, color: c.textSecondary, textAlign: "center" },
    tableRow: {
      flexDirection: "row", alignItems: "center", minHeight: 48, paddingVertical: space.s,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    },
    featureCol: { flex: 1.6, paddingRight: space.s },
    featureText: { ...typeScale.caption, color: c.text, flexShrink: 1 },
    valueCol: { flex: 1, alignItems: "center" },
    cellText: { ...typeScale.caption, color: c.textSecondary, textAlign: "center" },
    cellTextStrong: { fontFamily: "Montserrat-Medium", color: c.text },
  });
}
