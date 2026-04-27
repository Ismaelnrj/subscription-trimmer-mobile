import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { setupIAP, buyPremium, checkIsPremium, restorePremium } from "../lib/iap";

const FEATURES = [
  { icon: "infinity",         label: "Unlimited subscriptions",      desc: "Free plan limited to 5" },
  { icon: "chart-bar",        label: "Advanced analytics",           desc: "Category breakdown & trends" },
  { icon: "lightbulb-on",     label: "AI-powered insights",          desc: "Personalized saving tips" },
  { icon: "target",           label: "Budget goals & alerts",        desc: "Set monthly spending limits" },
  { icon: "calendar-clock",   label: "Trial date tracker",           desc: "Never forget to cancel a trial" },
  { icon: "file-export",      label: "Export to CSV",                desc: "Backup your data anytime" },
  { icon: "headset",          label: "Priority support",             desc: "Faster responses via email" },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  hero: {
    backgroundColor: "#4F46E5", padding: 28, alignItems: "center",
  },
  heroIcon: { marginBottom: 12 },
  heroTitle: { fontSize: 26, fontWeight: "800", color: "#FFFFFF", marginBottom: 8 },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20,
    paddingVertical: 4, paddingHorizontal: 14,
  },
  heroBadgeText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  body: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937", marginBottom: 14, marginTop: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  featureIcon: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: "#EEF2FF",
    justifyContent: "center", alignItems: "center",
  },
  featureLabel: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  featureDesc: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 20 },
  buyButton: {
    backgroundColor: "#4F46E5", borderRadius: 12, paddingVertical: 16,
    alignItems: "center", marginBottom: 12,
  },
  buyButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  buyButtonSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  restoreButton: { alignItems: "center", paddingVertical: 10 },
  restoreButtonText: { color: "#6B7280", fontSize: 13 },
  alreadyCard: {
    backgroundColor: "#ECFDF5", borderRadius: 12, padding: 16,
    alignItems: "center", borderWidth: 1, borderColor: "#6EE7B7",
  },
  alreadyText: { fontSize: 15, fontWeight: "700", color: "#059669", marginTop: 8 },
  alreadyDesc: { fontSize: 13, color: "#6B7280", marginTop: 4 },
});

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
      Alert.alert("Welcome to Premium!", "Thank you for your purchase. All features are now unlocked.", [
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
        Alert.alert("Restored!", "Your premium purchase has been restored.");
      } else {
        Alert.alert("No purchase found", "No previous premium purchase was found for this account.");
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
          <MaterialCommunityIcons name="crown" size={48} color="#FCD34D" style={styles.heroIcon} />
          <Text style={styles.heroTitle}>SubTrimmer Premium</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>One-time purchase • No subscription</Text>
          </View>
        </View>

        <View style={styles.body}>
          {isPremium ? (
            <View style={styles.alreadyCard}>
              <MaterialCommunityIcons name="check-circle" size={36} color="#059669" />
              <Text style={styles.alreadyText}>You're a Premium user!</Text>
              <Text style={styles.alreadyDesc}>All features are unlocked. Thank you for your support.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Everything included</Text>
              {FEATURES.map((f) => (
                <View key={f.label} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <MaterialCommunityIcons name={f.icon as any} size={20} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureLabel}>{f.label}</Text>
                    <Text style={styles.featureDesc}>{f.desc}</Text>
                  </View>
                  <MaterialCommunityIcons name="check" size={18} color="#10B981" />
                </View>
              ))}

              <View style={styles.divider} />

              <TouchableOpacity style={styles.buyButton} onPress={handleBuy} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.buyButtonText}>Unlock Premium — $3.99</Text>
                    <Text style={styles.buyButtonSub}>One-time payment, forever</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={restoring}>
                <Text style={styles.restoreButtonText}>
                  {restoring ? "Restoring..." : "Restore previous purchase"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}
