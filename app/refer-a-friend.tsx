import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput, Share } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { useTheme, AppColors } from "../lib/theme";

export default function ReferAFriendScreen() {
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [hasRedeemed, setHasRedeemed] = useState(false);
  const [bonusPremiumUntil, setBonusPremiumUntil] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/trpc/referrals.me");
      const result = data.result.data;
      setReferralCode(result.referralCode);
      setHasRedeemed(result.hasRedeemedReferral);
      setBonusPremiumUntil(result.bonusPremiumUntil);
    } catch {
      // ignore — leave the screen empty rather than block on a transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleShare = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message: t("referFriend.shareMessage", { code: referralCode }),
      });
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  };

  const handleRedeem = async () => {
    const code = redeemCode.trim().toUpperCase();
    if (!code) return;
    setRedeeming(true);
    try {
      await apiClient.post("/trpc/referrals.redeem", { code });
      Alert.alert(t("referFriend.codeAppliedTitle"), t("referFriend.codeAppliedMsg"));
      setRedeemCode("");
      load();
    } catch (e: any) {
      Alert.alert(t("referFriend.errRedeemTitle"), e?.response?.data?.error || t("referFriend.errRedeemMsg"));
    } finally {
      setRedeeming(false);
    }
  };

  const bonusActive = bonusPremiumUntil && new Date(bonusPremiumUntil) > new Date();

  return (
    <>
      <Stack.Screen options={{ title: "Refer a Friend", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>🎁</Text>
          <Text style={styles.headerTitle}>{t("referFriend.title")}</Text>
          <Text style={styles.headerDesc}>{t("referFriend.desc")}</Text>
        </View>

        <View style={styles.body}>
          {loading ? (
            <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
          ) : (
            <>
              {bonusActive && (
                <View style={styles.bonusCard}>
                  <MaterialCommunityIcons name="crown" size={22} color={c.success} />
                  <Text style={styles.bonusText}>
                    {t("referFriend.bonusActive", { date: new Date(bonusPremiumUntil!).toLocaleDateString() })}
                  </Text>
                </View>
              )}

              <Text style={styles.sectionLabel}>{t("referFriend.yourCode")}</Text>
              <View style={styles.codeCard}>
                <Text style={styles.codeText}>{referralCode || "—"}</Text>
                <TouchableOpacity style={styles.shareButton} onPress={handleShare} disabled={!referralCode}>
                  <MaterialCommunityIcons name="share-variant" size={16} color="#FFFFFF" />
                  <Text style={styles.shareButtonText}>{t("referFriend.share")}</Text>
                </TouchableOpacity>
              </View>

              {!hasRedeemed && (
                <>
                  <Text style={styles.sectionLabel}>{t("referFriend.haveCode")}</Text>
                  <View style={styles.redeemRow}>
                    <TextInput
                      style={styles.redeemInput}
                      placeholder={t("referFriend.codePlaceholder")}
                      placeholderTextColor={c.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      value={redeemCode}
                      onChangeText={setRedeemCode}
                    />
                    <TouchableOpacity
                      style={[styles.redeemButton, (!redeemCode.trim() || redeeming) && { opacity: 0.5 }]}
                      onPress={handleRedeem}
                      disabled={!redeemCode.trim() || redeeming}
                    >
                      {redeeming ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.redeemButtonText}>{t("referFriend.apply")}</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {hasRedeemed && (
                <Text style={styles.note}>{t("referFriend.alreadyRedeemed")}</Text>
              )}
            </>
          )}
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
    headerTitle: { fontSize: 22, fontWeight: "800", color: c.text, marginBottom: 6, textAlign: "center" },
    headerDesc: { fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 20 },
    body: { padding: 20, paddingBottom: 40 },
    sectionLabel: {
      fontSize: 13, fontWeight: "600", color: c.text, marginBottom: 10,
      marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5,
    },
    codeCard: {
      backgroundColor: c.card, borderRadius: 14, padding: 20, marginBottom: 8,
      borderWidth: 1, borderColor: c.border, flexDirection: "row",
      alignItems: "center", justifyContent: "space-between",
    },
    codeText: { fontSize: 24, fontWeight: "800", color: c.primary, letterSpacing: 2 },
    shareButton: {
      backgroundColor: c.primary, borderRadius: 8, paddingVertical: 9,
      paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6,
    },
    shareButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    redeemRow: { flexDirection: "row", gap: 10 },
    redeemInput: {
      flex: 1, backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.text, letterSpacing: 1,
    },
    redeemButton: {
      backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 18,
      alignItems: "center", justifyContent: "center", minWidth: 80,
    },
    redeemButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
    bonusCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, flexDirection: "row",
      alignItems: "center", gap: 10, borderWidth: 1, borderColor: c.success, marginBottom: 20,
    },
    bonusText: { fontSize: 13, fontWeight: "600", color: c.success, flex: 1 },
    note: { textAlign: "center", fontSize: 12, color: c.textMuted, marginTop: 8, lineHeight: 18 },
  });
}
