import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { setupIAP, sendTip, TIP_IDS, getOfferings } from "../lib/iap";
import { PurchasesPackage } from "react-native-purchases";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
import { useAuthStore } from "../lib/auth-store";

export default function TipJarScreen() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [tipped, setTipped] = useState(false);
  const [iapReady, setIapReady] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  /* Separate from packages.length: an empty list is both "not loaded yet" and
     "loaded and empty", and only the second may say the price is unavailable. */
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);
  const { user } = useAuthStore();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const TIPS = [
    { id: TIP_IDS.coffee, icon: "coffee-outline", label: t("tipJar.coffee"), desc: t("tipJar.coffeeDesc") },
    { id: TIP_IDS.lunch,  icon: "pizza",          label: t("tipJar.slice"),  desc: t("tipJar.sliceDesc") },
    { id: TIP_IDS.dinner, icon: "silverware-fork-knife", label: t("tipJar.dinner"), desc: t("tipJar.dinnerDesc") },
  ] as const;

  useEffect(() => {
    (async () => {
      try {
        const ready = await setupIAP(user?.openId);
        setIapReady(ready);
        if (ready) {
          const pkgs = await getOfferings();
          setPackages(pkgs);
        }
      } finally {
        // Even when IAP is not ready: "resolved with nothing" is a real answer.
        setOfferingsLoaded(true);
      }
    })();
  }, []);

  /* ONLY Play's own price looks like money. This used to fall back to
     TIP_PRICES, hardcoded USD, so an Austrian read "$0.99" until RevenueCat
     answered, and forever if it never did: the defect the purchase screen was
     fixed for on 2026-09-20, surviving here. */
  const priceFor = (id: string): { kind: "real"; text: string } | { kind: "loading" } | { kind: "unavailable" } => {
    const pkg = packages.find((p) => p.product.identifier === id);
    if (pkg) return { kind: "real", text: pkg.product.priceString };
    return offeringsLoaded ? { kind: "unavailable" } : { kind: "loading" };
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
      <Stack.Screen options={{ title: t("screenTitles.tipJar"), headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <Text style={styles.headerTitle}>{t("tipJar.title")}</Text>
          <Text style={styles.headerDesc}>{t("tipJar.desc")}</Text>

          {tipped && (
            <View style={styles.thankRow}>
              <MaterialCommunityIcons name="heart" size={20} color={c.danger} />
              <Text style={styles.thankText}>{t("tipJar.thankYou")}</Text>
            </View>
          )}

          <View style={styles.card}>
            {TIPS.map((tip, i) => {
              const price = priceFor(tip.id);
              return (
                <View key={tip.id} style={[styles.tipRow, i > 0 && styles.rowDivider]}>
                  <MaterialCommunityIcons name={tip.icon} size={22} color={c.textSecondary} />
                  <View style={styles.tipText}>
                    <Text style={styles.tipLabel}>{tip.label}</Text>
                    <Text style={styles.tipDesc}>{tip.desc}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.tipButton, price.kind !== "real" && styles.tipButtonOff]}
                    onPress={() => handleTip(tip.id)}
                    disabled={loadingId !== null || price.kind !== "real"}
                    accessibilityRole="button"
                    accessibilityLabel={price.kind === "real" ? `${tip.label}, ${price.text}` : tip.label}
                  >
                    {loadingId === tip.id ? (
                      <ActivityIndicator color={c.bg} size="small" />
                    ) : (
                      <Text style={[styles.tipButtonText, price.kind !== "real" && styles.tipButtonTextOff]}>
                        {price.kind === "real" ? price.text : price.kind === "loading" ? t("upgrade.priceLoading") : t("upgrade.priceUnavailable")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <Text style={styles.note}>{t("tipJar.footerNote")}</Text>
        </View>
      </ScrollView>
    </>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    body: { paddingHorizontal: space.l, paddingTop: space.xl, paddingBottom: space.xxl },
    headerTitle: { ...typeScale.title, color: c.text },
    headerDesc: { ...typeScale.body, color: c.textSecondary, marginTop: space.s, marginBottom: space.xl },
    thankRow: { flexDirection: "row", alignItems: "center", gap: space.s, marginBottom: space.l },
    thankText: { ...typeScale.bodyStrong, color: c.text },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, paddingHorizontal: space.l,
    },
    tipRow: { flexDirection: "row", alignItems: "center", gap: space.m, paddingVertical: space.l },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    tipText: { flex: 1 },
    tipLabel: { ...typeScale.bodyStrong, color: c.text },
    tipDesc: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },
    tipButton: {
      backgroundColor: c.text, borderRadius: radius.pill, minHeight: 40, minWidth: 80,
      paddingHorizontal: space.l, alignItems: "center", justifyContent: "center",
    },
    tipButtonOff: { backgroundColor: c.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    tipButtonText: { ...typeScale.label, color: c.bg },
    tipButtonTextOff: { color: c.textSecondary },
    note: { ...typeScale.caption, color: c.textSecondary, textAlign: "center", marginTop: space.l },
  });
}
