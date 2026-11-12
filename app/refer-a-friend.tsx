import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput, Share } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react-native";
import apiClient from "../lib/api";
import { useAuthStore } from "../lib/auth-store";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
import { useDateFormat } from "../lib/date-locale";

export default function ReferAFriendScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [hasRedeemed, setHasRedeemed] = useState(false);
  const [bonusPremiumUntil, setBonusPremiumUntil] = useState<string | null>(null);
  // Defaulted rather than left null so the header reads correctly on the very
  // first paint, before referrals.me has answered with the real figure.
  const [bonusCapMonths, setBonusCapMonths] = useState(12);
  const [atBonusCap, setAtBonusCap] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const fmtD = useDateFormat();
  const setUser = useAuthStore((s) => s.setUser);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const { data } = await apiClient.get("/trpc/referrals.me");
      const result = data.result.data;
      setReferralCode(result.referralCode);
      setHasRedeemed(result.hasRedeemedReferral);
      setBonusPremiumUntil(result.bonusPremiumUntil);
      if (result.bonusCapMonths) setBonusCapMonths(result.bonusCapMonths);
      setAtBonusCap(!!result.atBonusCap);
    } catch (e) {
      Sentry.captureException(e);
      setLoadError(true);
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
      // The bonus month lands on the server, but isPaid is only re-read from
      // /auth/me at launch, so without this the person is told the code
      // worked and then finds Premium still locked until they restart.
      try {
        const me = await apiClient.get("/auth/me");
        setUser(me.data);
      } catch {
        // The redeem itself succeeded, so a failed refresh is not worth an
        // error here. The next launch picks it up.
      }
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
      <Stack.Screen options={{ title: t("referFriend.screenTitle"), headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("referFriend.title")}</Text>
          <Text style={styles.headerDesc}>{t("referFriend.desc", { months: bonusCapMonths })}</Text>
        </View>

        <View style={styles.body}>
          {loading ? (
            <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
          ) : loadError ? (
            <View style={styles.errorState}>
              <MaterialCommunityIcons name="alert-circle-outline" size={36} color={c.textMuted} />
              <Text style={styles.errorText}>{t("referFriend.loadError")}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); load(); }} accessibilityRole="button">
                <Text style={styles.retryButtonText}>{t("referFriend.retry")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {bonusActive && (
                <View style={styles.bonusCard}>
                  <MaterialCommunityIcons name="crown" size={20} color={c.warning} />
                  <Text style={styles.bonusText}>
                    {t("referFriend.bonusActive", { date: fmtD(new Date(bonusPremiumUntil!), "PP") })}
                  </Text>
                </View>
              )}

              {atBonusCap && (
                <Text style={styles.note}>
                  {t("referFriend.atCap", { months: bonusCapMonths })}
                </Text>
              )}

              <Text style={styles.sectionLabel}>{t("referFriend.yourCode")}</Text>
              <View style={styles.codeCard}>
                <Text style={styles.codeText} selectable accessibilityLabel={referralCode ? referralCode.split("").join(" ") : undefined}>
                  {referralCode || "…"}
                </Text>
                <TouchableOpacity style={styles.shareButton} onPress={handleShare} disabled={!referralCode} accessibilityRole="button">
                  <MaterialCommunityIcons name="share-variant" size={18} color={c.bg} />
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
                      placeholderTextColor={c.placeholder}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      value={redeemCode}
                      onChangeText={setRedeemCode}
                    />
                    <TouchableOpacity
                      style={[styles.redeemButton, (!redeemCode.trim() || redeeming) && { opacity: 0.5 }]}
                      onPress={handleRedeem}
                      disabled={!redeemCode.trim() || redeeming}
                      accessibilityRole="button"
                    >
                      {redeeming ? <ActivityIndicator color={c.bg} size="small" /> : <Text style={styles.redeemButtonText}>{t("referFriend.apply")}</Text>}
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

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: space.l, paddingTop: space.xl },
    headerTitle: { ...typeScale.title, color: c.text },
    headerDesc: { ...typeScale.body, color: c.textSecondary, marginTop: space.s },
    body: { paddingHorizontal: space.l, paddingTop: space.xl, paddingBottom: 40 },
    sectionLabel: { ...typeScale.heading, color: c.text, marginBottom: space.s, marginTop: space.l },
    /* The code is the thing a person reads aloud or types, so it gets the
       display size; the share button sits under it at full width. */
    codeCard: {
      backgroundColor: c.card, borderRadius: radius.m, padding: space.l, marginBottom: space.s,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.cardBorder, gap: space.l,
    },
    codeText: { ...typeScale.display, color: c.text, letterSpacing: 2, textAlign: "center" },
    shareButton: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 48,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s,
    },
    shareButtonText: { ...typeScale.bodyStrong, color: c.bg },
    redeemRow: { flexDirection: "row", gap: space.s },
    redeemInput: {
      /* minWidth 0, or the field refuses to shrink and pushes Apply off the
         right edge, which it did before this change too. */
      ...typeScale.body, flex: 1, minWidth: 0, backgroundColor: c.inputBg, borderRadius: radius.s,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      paddingHorizontal: space.m, minHeight: 48, color: c.text, letterSpacing: 1,
    },
    redeemButton: {
      backgroundColor: c.text, borderRadius: radius.m, paddingHorizontal: space.l,
      alignItems: "center", justifyContent: "center", minWidth: 80, minHeight: 48,
    },
    redeemButtonText: { ...typeScale.bodyStrong, color: c.bg },
    bonusCard: { flexDirection: "row", alignItems: "center", gap: space.s, marginBottom: space.s },
    bonusText: { ...typeScale.bodyStrong, color: c.text, flex: 1 },
    errorState: { alignItems: "center", marginTop: space.xxl, gap: space.m, paddingHorizontal: space.xl },
    errorText: { ...typeScale.body, color: c.textSecondary, textAlign: "center" },
    retryButton: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 48,
      paddingHorizontal: space.xl, justifyContent: "center",
    },
    retryButtonText: { ...typeScale.bodyStrong, color: c.bg },
    note: { ...typeScale.caption, color: c.textSecondary, marginTop: space.s },
  });
}
