import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState, useEffect } from "react";
import { setupIAP, sendTip, TIP_IDS } from "../lib/iap";

const TIPS = [
  { id: TIP_IDS.coffee, emoji: "☕", label: "Buy me a coffee",    price: "$0.99",  desc: "A quick caffeine boost" },
  { id: TIP_IDS.lunch,  emoji: "🍕", label: "Buy me a slice",    price: "$2.99",  desc: "You're too kind!" },
  { id: TIP_IDS.dinner, emoji: "🍔", label: "Buy me dinner",     price: "$4.99",  desc: "Incredible — thank you!" },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { padding: 24, alignItems: "center", backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  headerEmoji: { fontSize: 48, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1F2937", marginBottom: 6 },
  headerDesc: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },
  body: { padding: 20, paddingBottom: 40 },
  tipCard: {
    backgroundColor: "#FFFFFF", borderRadius: 14, padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
  },
  tipLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  tipEmoji: { fontSize: 32 },
  tipLabel: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  tipDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  tipButton: {
    backgroundColor: "#4F46E5", borderRadius: 8, paddingVertical: 8,
    paddingHorizontal: 14, minWidth: 70, alignItems: "center",
  },
  tipButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  note: { textAlign: "center", fontSize: 12, color: "#9CA3AF", marginTop: 8, lineHeight: 18 },
  thankCard: {
    backgroundColor: "#ECFDF5", borderRadius: 12, padding: 16, alignItems: "center",
    borderWidth: 1, borderColor: "#6EE7B7", marginBottom: 20,
  },
  thankText: { fontSize: 15, fontWeight: "700", color: "#059669", marginTop: 8 },
});

export default function TipJarScreen() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [tipped, setTipped] = useState(false);
  const [iapReady, setIapReady] = useState(false);

  useEffect(() => {
    setupIAP().then(setIapReady);
  }, []);

  const handleTip = async (id: string) => {
    if (!iapReady) {
      Alert.alert("Not available", "In-app purchases are not available in this build. Please download the latest version from the Play Store.");
      return;
    }
    setLoadingId(id);
    try {
      await sendTip(id);
      setTipped(true);
      Alert.alert("Thank you! 🙏", "Your support means the world and helps keep Trimio free and improving!");
    } catch (e: any) {
      if (!e?.message?.includes("cancel")) {
        Alert.alert("Error", "Could not complete the purchase. Please try again.");
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Tip Jar", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>🫙</Text>
          <Text style={styles.headerTitle}>Support the Developer</Text>
          <Text style={styles.headerDesc}>
            Trimio is built and maintained by one person. If it saves you money, consider buying me a treat!
          </Text>
        </View>

        <View style={styles.body}>
          {tipped && (
            <View style={styles.thankCard}>
              <MaterialCommunityIcons name="heart" size={28} color="#EF4444" />
              <Text style={styles.thankText}>Thank you so much! 🙏</Text>
            </View>
          )}

          {TIPS.map((tip) => (
            <View key={tip.id} style={styles.tipCard}>
              <View style={styles.tipLeft}>
                <Text style={styles.tipEmoji}>{tip.emoji}</Text>
                <View>
                  <Text style={styles.tipLabel}>{tip.label}</Text>
                  <Text style={styles.tipDesc}>{tip.desc}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.tipButton}
                onPress={() => handleTip(tip.id)}
                disabled={loadingId !== null}
              >
                {loadingId === tip.id ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.tipButtonText}>{tip.price}</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}

          <Text style={styles.note}>
            Tips are optional and non-refundable.{"\n"}
            They do not unlock any additional features.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
