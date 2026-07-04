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
  purchasePackage, restorePremium, PRODUCT_IDS,
} from "../lib/iap";
import { useAuthStore } from "../lib/auth-store";
import { useTheme, AppColors } from "../lib/theme";
import { PREMIUM_PRICES } from "../lib/pricing";

type PlanKey = "monthly" | "yearly" | "lifetime";

export default function UpgradeScreen() {
  const router = useRouter();
  const { setUser, user } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("yearly");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [isPremium, setIsPremium] = useState(user?.isPaid ?? false);
  const [iapReady, setIapReady] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const FEATURES = [
    { icon: "infinity",            label: t("upgrade.feat_subscriptions"),  free: t("upgrade.free_subscriptions"), premium: "Unlimited" },
    { icon: "chart-bar",           label: t("upgrade.feat_categories"),     free: t("upgrade.free_categories"),    premium: "Full breakdown" },
    { icon: "lightbulb-on",        label: t("upgrade.feat_ai"),             free: t("upgrade.free_ai"),            premium: "All insights" },
    { icon: "target",              label: t("upgrade.feat_budget"),         free: "—",                             premium: "✓" },
    { icon: "clock-alert-outline", label: t("upgrade.feat_trial"),          free: "—",                             premium: "✓" },
    { icon: "tag-multiple",        label: t("upgrade.feat_customCat"),      free: "—",                             premium: "✓" },
    { icon: "file-chart",          label: t("upgrade.feat_export"),         free: "—",                             premium: "✓" },
    { icon: "email-fast-outline",  label: t("upgrade.feat_email"),          free: "—",                             premium: "✓" },
    { icon: "headset",             label: t("upgrade.feat_support"),        free: "—",                             premium: "✓" },
  ];

  const PLANS: { key: PlanKey; label: string; price: string; sub: string; badge?: string }[] = [
    { key: "monthly",  label: t("upgrade.monthly"),  price: PREMIUM_PRICES.monthly, sub: t("upgrade.perMonth") },
    { key: "yearly",   label: t("upgrade.yearly"),   price: PREMIUM_PRICES.yearly,  sub: t("upgrade.perYear"),   badge: t("upgrade.save44") },
    { key: "lifetime", label: t("upgrade.lifetime"), price: PREMIUM_PRICES.lifetime, sub: t("upgrade.oneTime"), badge: t("upgrade.bestValue") },
  ];

  useEffect(() => {
    (async () => {
      const ready = await setupIAP(user?.openId);
      setIapReady(ready);
      if (ready) {
        const [pkgs, premium] = await Promise.all([getOfferings(), checkIsPremium()]);
        setPackages(pkgs);
        setIsPremium(premium);
      }
    })();
  }, []);

  const getPackageForPlan = (plan: PlanKey): PurchasesPackage | undefined =>
    packages.find((p) => p.product.identifier === PRODUCT_IDS[plan]);

  const handleBuy = async () => {
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
      const { active, synced } = await purchasePackage(pkg);
      if (active && synced) {
        setIsPremium(true);
        if (user) setUser({ ...user, isPaid: true });
        Alert.alert(t("upgrade.welcomeTitle"), t("upgrade.welcomeMsg"), [
          { text: t("upgrade.welcomeBtn"), onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(t("upgrade.purchaseReceivedTitle"), t("upgrade.purchaseReceivedMsg"));
      }
    } catch (e: any) {
      if (!e?.message?.toLowerCase().includes("cancel")) {
        Alert.alert(t("upgrade.purchaseFailedTitle"), t("upgrade.purchaseFailedMsg"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!iapReady) return;
    setRestoring(true);
    try {
      const { active, synced } = await restorePremium();
      if (active && synced) {
        setIsPremium(true);
        if (user) setUser({ ...user, isPaid: true });
        Alert.alert(t("upgrade.restoredTitle"), t("upgrade.restoredMsg"));
      } else if (active) {
        Alert.alert(t("upgrade.almostThereTitle"), t("upgrade.almostThereMsg"));
      } else {
        Alert.alert(t("upgrade.noPurchaseTitle"), t("upgrade.noPurchaseMsg"));
      }
    } catch {
      Alert.alert(t("upgrade.errRestoreTitle"), t("upgrade.errRestoreMsg"));
    } finally {
      setRestoring(false);
    }
  };

  const selectedPlanInfo = PLANS.find((p) => p.key === selectedPlan)!;

  return (
    <>
      <Stack.Screen options={{ title: t("upgrade.title"), headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        <View style={styles.hero}>
          <MaterialCommunityIcons name="crown" size={48} color="#FCD34D" style={{ marginBottom: 12 }} />
          <Text style={styles.heroTitle}>{t("upgrade.heroTitle")}</Text>
          <Text style={styles.heroSub}>{t("upgrade.heroSubtitle")}</Text>
        </View>

        {isPremium ? (
          <View style={styles.body}>
            <View style={styles.alreadyCard}>
              <MaterialCommunityIcons name="check-circle" size={40} color={c.success} />
              <Text style={styles.alreadyTitle}>{t("upgrade.alreadyPremiumTitle")}</Text>
              <Text style={styles.alreadySub}>{t("upgrade.alreadyPremiumSub")}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.hookCard}>
              <Text style={styles.hookText}>
                <Text style={styles.hookBold}>{t("upgrade.stopLeaking")}</Text>{t("upgrade.stopLeakingSuffix")}
              </Text>
              <Text style={styles.hookSub}>{t("upgrade.costNote")}</Text>
            </View>

            <Text style={styles.sectionLabel}>{t("upgrade.choosePlan")}</Text>
            <View style={styles.planRow}>
              {PLANS.map((plan) => {
                const active = selectedPlan === plan.key;
                return (
                  <TouchableOpacity
                    key={plan.key}
                    style={[styles.planCard, active && styles.planCardActive]}
                    onPress={() => setSelectedPlan(plan.key)}
                  >
                    {plan.badge && (
                      <View style={[styles.planBadge, active && styles.planBadgeActive]}>
                        <Text style={styles.planBadgeText}>{plan.badge}</Text>
                      </View>
                    )}
                    <Text style={[styles.planLabel, active && styles.planLabelActive]}>{plan.label}</Text>
                    <Text style={[styles.planPrice, active && styles.planPriceActive]}>{plan.price}</Text>
                    <Text style={[styles.planSub, active && styles.planSubActive]}>{plan.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>{t("upgrade.whatsIncluded")}</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.col, styles.featureCol]} />
                <Text style={[styles.col, styles.headerText]}>{t("upgrade.free")}</Text>
                <Text style={[styles.col, styles.headerText, styles.premiumColText]}>{t("upgrade.premium")}</Text>
              </View>
              {FEATURES.map((f, i) => (
                <View key={f.label} style={[styles.row, i % 2 === 0 && styles.rowAlt]}>
                  <View style={[styles.col, styles.featureCol, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                    <MaterialCommunityIcons name={f.icon as any} size={13} color={c.textSecondary} />
                    <Text style={styles.featureText} numberOfLines={2}>{f.label}</Text>
                  </View>
                  <Text style={[styles.col, styles.freeText]}>{f.free}</Text>
                  <Text style={[styles.col, styles.premiumText, styles.premiumColText]}>{f.premium}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.buyButton} onPress={handleBuy} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.buyButtonText}>
                    {t("upgrade.unlockButton", { price: selectedPlanInfo.price })}
                  </Text>
                  <Text style={styles.buyButtonSub}>{selectedPlanInfo.sub}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={restoring}>
              <Text style={styles.restoreText}>{restoring ? t("upgrade.restoring") : t("upgrade.restorePurchase")}</Text>
            </TouchableOpacity>

            <Text style={styles.legalNote}>{t("upgrade.legalNote")}</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    hero: {
      backgroundColor: c.primary, paddingTop: 36, paddingBottom: 32,
      alignItems: "center", paddingHorizontal: 24,
    },
    heroTitle: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", marginBottom: 6 },
    heroSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", textAlign: "center" },
    body: { padding: 20 },
    hookCard: {
      backgroundColor: c.primaryLight, borderRadius: 12, padding: 16, marginBottom: 20,
      borderWidth: 1, borderColor: c.primary,
    },
    hookText: { fontSize: 14, color: c.text, lineHeight: 22, marginBottom: 6 },
    hookBold: { fontWeight: "800", color: c.primary },
    hookSub: { fontSize: 12, color: c.textSecondary },
    sectionLabel: { fontSize: 13, fontWeight: "700", color: c.text, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
    planRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
    planCard: {
      flex: 1, borderRadius: 12, borderWidth: 2, borderColor: c.border,
      backgroundColor: c.card, padding: 12, alignItems: "center",
    },
    planCardActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    planBadge: { backgroundColor: c.border, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, marginBottom: 4 },
    planBadgeActive: { backgroundColor: c.primary },
    planBadgeText: { fontSize: 9, fontWeight: "700", color: "#FFFFFF", textTransform: "uppercase" },
    planLabel: { fontSize: 11, fontWeight: "600", color: c.textSecondary, marginBottom: 4, textTransform: "uppercase" },
    planLabelActive: { color: c.primary },
    planPrice: { fontSize: 18, fontWeight: "800", color: c.text },
    planPriceActive: { color: c.primary },
    planSub: { fontSize: 9, color: c.textMuted, textAlign: "center", marginTop: 2 },
    planSubActive: { color: c.primary },
    table: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: c.border, marginBottom: 24 },
    tableHeader: { flexDirection: "row", backgroundColor: c.border, paddingVertical: 10, paddingHorizontal: 12 },
    row: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12 },
    rowAlt: { backgroundColor: c.bg },
    col: { flex: 1, fontSize: 12 },
    featureCol: { flex: 2 },
    featureText: { fontSize: 12, color: c.text, flex: 1 },
    headerText: { fontWeight: "700", color: c.textSecondary, textAlign: "center" },
    premiumColText: { color: c.primary },
    freeText: { color: c.textMuted, textAlign: "center", fontSize: 12 },
    premiumText: { fontWeight: "700", textAlign: "center", fontSize: 12 },
    buyButton: {
      backgroundColor: c.primary, borderRadius: 14, paddingVertical: 18,
      alignItems: "center", marginBottom: 14,
    },
    buyButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
    buyButtonSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 3 },
    restoreButton: { alignItems: "center", paddingVertical: 8 },
    restoreText: { color: c.textMuted, fontSize: 13 },
    legalNote: { fontSize: 10, color: c.textMuted, textAlign: "center", marginTop: 12, lineHeight: 15 },
    alreadyCard: {
      backgroundColor: c.card, borderRadius: 14, padding: 24,
      alignItems: "center", borderWidth: 1, borderColor: c.success,
    },
    alreadyTitle: { fontSize: 18, fontWeight: "700", color: c.success, marginTop: 12, marginBottom: 6 },
    alreadySub: { fontSize: 13, color: c.textSecondary, textAlign: "center", lineHeight: 20 },
  });
}
