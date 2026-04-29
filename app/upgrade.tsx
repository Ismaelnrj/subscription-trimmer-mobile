import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { setupIAP, buyPremium, checkIsPremium, restorePremium } from "../lib/iap";

const FEATURES = [
  { icon: "infinity",            label: "Subscriptions",              free: "Up to 5",    premium: "Unlimited" },
  { icon: "chart-bar",           label: "Spending by category",       free: "Top 1 only", premium: "Full breakdown" },
  { icon: "lightbulb-on",        label: "Recommendations",            free: "Top 2 only", premium: "All insights" },
  { icon: "target",              label: "Budget goal & bar",          free: "—",          premium: "✓" },
  { icon: "clock-alert-outline", label: "Trial date tracker",         free: "—",          premium: "✓" },
  { icon: "tag-multiple",        label: "Custom categories",          free: "—",          premium: "✓" },
  { icon: "file-chart",          label: "Export report (CSV + PDF)",  free: "—",          premium: "✓" },
  { icon: "headset",             label: "Priority support",           free: "—",          premium: "✓" },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [iapReady, setIapReady] = useState(false);

  useEffect(() => {
    (async () => {
      const ready = await setupIAP();
      setIapReady(ready);
      const premium = await checkIsPremium();
      setIsPremium(premium);
    })();
  }, []);

  const handleBuy = async () => {
    if (!iapReady) {
      Alert.alert("Not available", "In-app purchases are not available in this build. Please download the latest version from the Play Store.");
      return;
    }
    setLoading(true);
    try {
      await buyPremium();
      setIsPremium(true);
      Alert.alert("Welcome to Premium!", "All features are now unlocked. Thank you for supporting Trimio!", [
        { text: "Let's go!", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      if (!e?.message?.includes("cancel")) {
        Alert.alert("Purchase failed", "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
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

  return (
    <>
      <Stack.Screen options={{ title: "Upgrade to Premium", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.hero}>
          <MaterialCommunityIcons name="crown" size={48} color="#FCD34D" style={{ marginBottom: 12 }} />
          <Text style={styles.heroTitle}>Trimio Premium</Text>
          <Text style={styles.heroSub}>One-time payment · No subscription · Forever</Text>
          <View style={styles.pricePill}>
            <Text style={styles.priceText}>$3.99</Text>
          </View>
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
              <Text style={styles.hookSub}>Premium costs less than one Netflix month — paid once, yours forever.</Text>
            </View>

            <Text style={styles.tableTitle}>Free vs Premium</Text>
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

            <TouchableOpacity style={styles.buyButton} onPress={handleBuy} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.buyButtonText}>Unlock Premium — $3.99</Text>
                  <Text style={styles.buyButtonSub}>One-time · No recurring fees · Supports the developer</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={restoring}>
              <Text style={styles.restoreText}>{restoring ? "Restoring..." : "Restore previous purchase"}</Text>
            </TouchableOpacity>
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
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 16 },
  pricePill: { backgroundColor: "#FCD34D", borderRadius: 20, paddingVertical: 6, paddingHorizontal: 20 },
  priceText: { fontSize: 20, fontWeight: "800", color: "#1F2937" },
  body: { padding: 20, paddingBottom: 48 },
  hookCard: {
    backgroundColor: "#EEF2FF", borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: "#C7D2FE",
  },
  hookText: { fontSize: 14, color: "#1F2937", lineHeight: 22, marginBottom: 6 },
  hookBold: { fontWeight: "800", color: "#4F46E5" },
  hookSub: { fontSize: 12, color: "#6B7280" },
  tableTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937", marginBottom: 10 },
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
  alreadyCard: {
    backgroundColor: "#ECFDF5", borderRadius: 14, padding: 24,
    alignItems: "center", borderWidth: 1, borderColor: "#6EE7B7",
  },
  alreadyTitle: { fontSize: 18, fontWeight: "700", color: "#059669", marginTop: 12, marginBottom: 6 },
  alreadySub: { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 20 },
});
