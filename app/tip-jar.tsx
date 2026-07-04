import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { setupIAP, sendTip, TIP_IDS, getOfferings } from "../lib/iap";
import { PurchasesPackage } from "react-native-purchases";
import { useTheme, AppColors } from "../lib/theme";
import { useAuthStore } from "../lib/auth-store";
import { TIP_PRICES } from "../lib/pricing";

export default function TipJarScreen() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [tipped, setTipped] = useState(false);
  const [iapReady, setIapReady] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const { user } = useAuthStore();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const TIPS = [
    { id: TIP_IDS.coffee, emoji: "☕", label: t("tipJar.coffee"), fallbackPrice: TIP_PRICES.coffee, desc: t("tipJar.coffeeDesc") },
    { id: TIP_IDS.lunch,  emoji: "🍕", label: t("tipJar.slice"),  fallbackPrice: TIP_PRICES.lunch,  desc: t("tipJar.sliceDesc") },
    { id: TIP_IDS.dinner, emoji: "🍔", label: t("tipJar.dinner"), fallbackPrice: TIP_PRICES.dinner, desc: t("tipJar.dinnerDesc") },
  ];

  useEffect(() => {
    (async () => {
      const ready = await setupIAP(user?.openId);
      setIapReady(ready);
      if (ready) {
        const pkgs = await getOfferings();
        setPackages(pkgs);
      }
    })();
  }, []);

  const priceFor = (id: string, fallback: string) => {
    const pkg = packages.find((p) => p.product.identifier === id);
    return pkg?.product.priceString ?? fallback;
  };

  const handleTip = async (id: string) => {
    if (!iapReady) {
      Alert.alert(t("common.error"), t("tipJar.errNotAvailable"));
      return;
    }
    setLoadingId(id);
    try {
      await sendTip(id);
      setTipped(true);
      Alert.alert(t("tipJar.thankYouTitle"), t("tipJar.thankYouMsg"));
    } catch (e: any) {
      if (!e?.message?.toLowerCase().includes("cancel")) {
        Alert.alert(t("common.error"), t("tipJar.errPurchase"));
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
          <Text style={styles.headerTitle}>{t("tipJar.title")}</Text>
          <Text style={styles.headerDesc}>{t("tipJar.desc")}</Text>
        </View>

        <View style={styles.body}>
          {tipped && (
            <View style={styles.thankCard}>
              <MaterialCommunityIcons name="heart" size={28} color={c.danger} />
              <Text style={styles.thankText}>{t("tipJar.thankYou")} 🙏</Text>
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
                  <Text style={styles.tipButtonText}>{priceFor(tip.id, tip.fallbackPrice)}</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}

          <Text style={styles.note}>{t("tipJar.footerNote")}</Text>
        </View>
      </ScrollView>
    </>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { padding: 24, alignItems: "center", backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border },
    headerEmoji: { fontSize: 48, marginBottom: 8 },
    headerTitle: { fontSize: 22, fontWeight: "800", color: c.text, marginBottom: 6 },
    headerDesc: { fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 20 },
    body: { padding: 20, paddingBottom: 40 },
    tipCard: {
      backgroundColor: c.card, borderRadius: 14, padding: 20, marginBottom: 12,
      borderWidth: 1, borderColor: c.border, flexDirection: "row",
      alignItems: "center", justifyContent: "space-between",
    },
    tipLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
    tipEmoji: { fontSize: 32 },
    tipLabel: { fontSize: 15, fontWeight: "700", color: c.text },
    tipDesc: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    tipButton: {
      backgroundColor: c.primary, borderRadius: 8, paddingVertical: 8,
      paddingHorizontal: 14, minWidth: 70, alignItems: "center",
    },
    tipButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
    note: { textAlign: "center", fontSize: 12, color: c.textMuted, marginTop: 8, lineHeight: 18 },
    thankCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, alignItems: "center",
      borderWidth: 1, borderColor: c.success, marginBottom: 20,
    },
    thankText: { fontSize: 15, fontWeight: "700", color: c.success, marginTop: 8 },
  });
}
