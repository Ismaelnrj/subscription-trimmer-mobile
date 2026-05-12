import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { PurchasesPackage } from "react-native-purchases";
import {
  setupIAP, checkIsPremium, getOfferings,
  purchasePackage, restorePremium, PRODUCT_IDS,
} from "../lib/iap";
import { useAuthStore } from "../lib/auth-store";

const FEATURES = [
  { icon: "infinity",            label: "Subscriptions",             free: "Up to 5",    premium: "Unlimited" },
  { icon: "chart-bar",           label: "Spending by category",      free: "Top 1 only", premium: "Full breakdown" },
  { icon: "lightbulb-on",        label: "AI Recommendations",        free: "Top 2 only", premium: "All insights" },
  { icon: "target",              label: "Budget goal & progress bar", free: "—",          premium: "✓" },
  { icon: "clock-alert-outline", label: "Trial date tracker",        free: "—",          premium: "✓" },
  { icon: "tag-multiple",        label: "Custom categories",         free: "—",          premium: "✓" },
  { icon: "file-chart",          label: "Export report (CSV)",       free: "—",          premium: "✓" },
  { icon: "email-fast-outline",  label: "Email renewal reminders",   free: "—",          premium: "✓" },
  { icon: "headset",             label: "Priority support",          free: "—",          premium: "✓" },
];

type PlanKey = "monthly" | "yearly" | "lifetime";

const PLANS: { key: PlanKey; label: string; price: string; sub: string; badge?: string }[] = [
  { key: "monthly",  label: "Monthly",  price: "$1.99", sub: "per month",          },
  { key: "yearly",   label: "Yearly",   price: "$14.99", sub: "per year",  badge: "Save 37%" },
  { key: "lifetime", label: "Lifetime", price: "$4.99",  sub: "one-time · forever", badge: "Best Value" },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const { setUser, user } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("yearly");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [isPremium, setIsPremium] = useState(user?.isPaid ?? false);
  const [iapReady, setIapReady] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);

  useEffect(() => {
    (async () => {
      const ready = await setupIAP();
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
      Alert.alert("Not available", "Purchases are not available in this build. Please update the app from the Play Store.");
      return;
    }
    const pkg = getPackageForPlan(selectedPlan);
    if (!pkg) {
      Alert.alert("Not available", "This plan is not available yet. Please try another.");
      return;
    }
    setLoading(true);
    try {
      await purchasePackage(pkg);
      setIsPremium(true);
      Alert.alert("Welcome to Premium! 🎉", "All features are now unlocked. Thank you for supporting Trimio!", [
        { text: "Let's go!", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      if (!e?.message?.toLowerCase().includes("cancel")) {
        Alert.alert("Purchase failed", "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!iapReady) return;
    setRestoring(true);
    try {
      const restored = await restorePremium();
      if (restored) {
        setIsPremium(true);
        Alert.alert("Restored!", "Your premium access has been restored.");
      } else {
        Alert.alert("No purchase found", "No previous purchase was found for this account.");
      }
    } catch {
      Alert.alert("Error", "Could not restore purchases. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  const selectedPlanInfo = PLANS.find((p) => p.key === selectedPlan)!;

  return (
    <>
      <Stack.Screen options={{ title: "Upgrade to Premium", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        <View style={styles.hero}>
          <MaterialCommunityIcons name="crown" size={48} color="#FCD34D" style={{ marginBottom: 12 }} />
          <Text style={styles.heroTitle}>Trimio Premium</Text>
          <Text style={styles.heroSub}>Cancel anytime · Instant access · Supports the developer</Text>
        </View>

        {isPremium ? (
          <View style={styles.body}>
            <View style={styles.alreadyCard}>
              <MaterialCommunityIcons name="check-circle" size={40} color="#059669" />
              <Text style={styles.alreadyTitle}>You're a Premium user!</Text>
              <Text style={styles.alreadySub}>All features are unlocked. Thank you for supporting Trimio.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.body}>

            <View style={styles.hookCard}>
              <Text style={styles.hookText}>
                The average Trimio user finds <Text style={styles.hookBold}>$230+/year</Text> in subscriptions they'd forgotten about.
              </Text>
              <Text style={styles.hookSub}>Premium costs less than one coffee a month — and pays for itself on day one.</Text>
            </View>

            {/* Plan selector */}
            <Text style={styles.sectionLabel}>Choose your plan</Text>
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

            {/* Feature table */}
            <Text style={styles.sectionLabel}>What's included</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.col, styles.featureCol]} />
                <Text style={[styles.col, styles.headerText]}>Free</Text>
                <Text style={[styles.col, styles.headerText, styles.premiumColText]}>Premium</Text>
              </View>
              {FEATURES.map((f, i) => (
                <View key={f.label} style={[styles.row, i % 2 === 0 && styles.rowAlt]}>
                  <View style={[styles.col, styles.featureCol, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                    <MaterialCommunityIcons name={f.icon as any} size={13} color="#6B7280" />
                    <Text style={styles.featureText} numberOfLines={2}>{f.label}</Text>
                  </View>
                  <Text style={[styles.col, styles.freeText]}>{f.free}</Text>
                  <Text style={[styles.col, styles.premiumText, styles.premiumColText]}>{f.premium}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity style={styles.buyButton} onPress={handleBuy} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.buyButtonText}>
                    Unlock Premium — {selectedPlanInfo.price}
                  </Text>
                  <Text style={styles.buyButtonSub}>{selectedPlanInfo.sub}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={restoring}>
              <Text style={styles.restoreText}>{restoring ? "Restoring..." : "Restore previous purchase"}</Text>
            </TouchableOpacity>

            <Text style={styles.legalNote}>
              Subscriptions auto-renew unless cancelled 24h before the renewal date. Manage in Google Play.
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  hero: {
    backgroundColor: "#4F46E5", paddingTop: 36, paddingBottom: 32,
    alignItems: "center", paddingHorizontal: 24,
  },
  heroTitle: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", marginBottom: 6 },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", textAlign: "center" },
  body: { padding: 20 },
  hookCard: {
    backgroundColor: "#EEF2FF", borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: "#C7D2FE",
  },
  hookText: { fontSize: 14, color: "#1F2937", lineHeight: 22, marginBottom: 6 },
  hookBold: { fontWeight: "800", color: "#4F46E5" },
  hookSub: { fontSize: 12, color: "#6B7280" },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  planRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  planCard: {
    flex: 1, borderRadius: 12, borderWidth: 2, borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF", padding: 12, alignItems: "center",
  },
  planCardActive: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  planBadge: { backgroundColor: "#E5E7EB", borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, marginBottom: 4 },
  planBadgeActive: { backgroundColor: "#4F46E5" },
  planBadgeText: { fontSize: 9, fontWeight: "700", color: "#FFFFFF", textTransform: "uppercase" },
  planLabel: { fontSize: 11, fontWeight: "600", color: "#6B7280", marginBottom: 4, textTransform: "uppercase" },
  planLabelActive: { color: "#4F46E5" },
  planPrice: { fontSize: 18, fontWeight: "800", color: "#1F2937" },
  planPriceActive: { color: "#4F46E5" },
  planSub: { fontSize: 9, color: "#9CA3AF", textAlign: "center", marginTop: 2 },
  planSubActive: { color: "#6366F1" },
  table: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 24 },
  tableHeader: { flexDirection: "row", backgroundColor: "#F3F4F6", paddingVertical: 10, paddingHorizontal: 12 },
  row: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12 },
  rowAlt: { backgroundColor: "#FAFAFA" },
  col: { flex: 1, fontSize: 12 },
  featureCol: { flex: 2 },
  featureText: { fontSize: 12, color: "#374151", flex: 1 },
  headerText: { fontWeight: "700", color: "#6B7280", textAlign: "center" },
  premiumColText: { color: "#4F46E5" },
  freeText: { color: "#9CA3AF", textAlign: "center", fontSize: 12 },
  premiumText: { fontWeight: "700", textAlign: "center", fontSize: 12 },
  buyButton: {
    backgroundColor: "#4F46E5", borderRadius: 14, paddingVertical: 18,
    alignItems: "center", marginBottom: 14,
  },
  buyButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  buyButtonSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 3 },
  restoreButton: { alignItems: "center", paddingVertical: 8 },
  restoreText: { color: "#9CA3AF", fontSize: 13 },
  legalNote: { fontSize: 10, color: "#9CA3AF", textAlign: "center", marginTop: 12, lineHeight: 15 },
  alreadyCard: {
    backgroundColor: "#ECFDF5", borderRadius: 14, padding: 24,
    alignItems: "center", borderWidth: 1, borderColor: "#6EE7B7",
  },
  alreadyTitle: { fontSize: 18, fontWeight: "700", color: "#059669", marginTop: 12, marginBottom: 6 },
  alreadySub: { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 20 },
});
