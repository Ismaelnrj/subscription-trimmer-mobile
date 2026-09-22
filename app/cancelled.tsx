import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/api";
import { useTheme, AppColors } from "../lib/theme";
import { useDateFormat } from "../lib/date-locale";
import { useFmt } from "../lib/currency-store";
import { useCategoryLabel } from "../lib/category-label";
import { getCategoryIcon } from "../lib/categories";

type CancelledSub = {
  id: number;
  name: string;
  price: number;
  category: string;
  currency: string | null;
  cancelledAt: string;
  chargesAvoided: number;
  amountAvoided: number;
};

type Total = { currency: string | null; amount: number; charges: number; subscriptions: number };

export default function CancelledScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const fmtD = useDateFormat();
  const fmtC = useFmt();
  const categoryLabel = useCategoryLabel();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cancelledSubscriptions"],
    queryFn: async () =>
      (await apiClient.get("/trpc/subscriptions.cancelled")).data.result.data as {
        subscriptions: CancelledSub[];
        totals: Total[];
      },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.post("/trpc/subscriptions.setCancelled", { id, cancelled: false })).data.result.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cancelledSubscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    /* RESTORING A ROW MAKES IT LIVE AGAIN, so the free tier cap applies and the
       server answers FREE_LIMIT_REACHED. Reading that code rather than showing a
       generic failure is what turns a dead end into the upgrade prompt, and it is
       the same code subscriptions.create has always returned, so this is not a
       new contract. */
    onError: (err: any) => {
      const code = err?.response?.data?.error;
      if (code === "FREE_LIMIT_REACHED") {
        Alert.alert(t("cancelled.restoreBlockedTitle"), t("cancelled.restoreBlockedBody"));
        return;
      }
      Alert.alert(t("common.error"), t("subscriptions.errUpdateSub"));
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const confirmRestore = (sub: CancelledSub) => {
    Alert.alert(t("cancelled.restoreTitle"), t("cancelled.restoreConfirm", { name: sub.name }), [
      { text: t("subscriptions.cancel"), style: "cancel" },
      { text: t("cancelled.restore"), onPress: () => restoreMutation.mutate(sub.id) },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  /* isError handled explicitly. Falling through to the empty state would tell
     somebody on a dropped connection that they have never cancelled anything,
     which this codebase has already shipped once on the subscriptions screen. */
  if (isError) {
    return (
      <View style={styles.centre}>
        <MaterialCommunityIcons name="cloud-off-outline" size={40} color={c.textMuted} />
        <Text style={styles.errorText}>{t("cancelled.loadError")}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button">
          <Text style={styles.retryText}>{t("common.tryAgain")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const subs = data?.subscriptions ?? [];
  const totals = (data?.totals ?? []).filter((x) => x.charges > 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
    >
      {subs.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="check-circle-outline" size={44} color={c.textMuted} />
          <Text style={styles.emptyTitle}>{t("cancelled.emptyTitle")}</Text>
          <Text style={styles.emptyBody}>{t("cancelled.emptyBody")}</Text>
        </View>
      ) : (
        <>
          {/* ONE CARD PER CURRENCY, never one summed figure. Adding 15.99 EUR to
              9.99 USD needs a rate, and a row is shown in the currency it was
              charged in. For the ordinary case of one currency this is one card. */}
          {totals.length > 0 && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>{t("cancelled.totalLabel")}</Text>
              {totals.map((tot) => (
                <View key={tot.currency ?? "none"} style={styles.totalRow}>
                  <Text style={styles.totalAmount}>{fmtC(tot.amount, tot.currency)}</Text>
                  {/* Pluralised on ONE number. i18next pluralises on `count`
                      alone, so a string carrying two counts gets the second one
                      wrong in every language with plural rules. The charge count
                      lives on the per row line instead, where it is the only
                      number. */}
                  <Text style={styles.totalMeta}>
                    {t("cancelled.totalMeta", { count: tot.subscriptions })}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Said plainly rather than left for somebody to work out from a zero.
              A yearly subscription cancelled last month has genuinely avoided
              nothing yet, and the honest reading is more trustworthy than a
              number that looks better. */}
          <Text style={styles.explainer}>{t("cancelled.explainer")}</Text>

          {subs.map((sub) => {
            const icon = getCategoryIcon(sub.category);
            return (
              <View key={sub.id} style={styles.card}>
                <View style={[styles.iconWrap, { backgroundColor: icon.color + "22" }]}>
                  <MaterialCommunityIcons name={icon.name as any} size={20} color={icon.color} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>{sub.name}</Text>
                  <Text style={styles.cardMeta}>
                    {categoryLabel(sub.category)}
                    {"  ·  "}
                    {/* `new Date()` IS CORRECT HERE, and this comment exists
                        because a standing grep in this repo, `new Date(sub.`,
                        flags exactly this shape as the parseApiDate defect.
                        It is not that defect. That rule covers fields that mean
                        A DAY and are stored at midnight UTC, like
                        nextBillingDate, where local conversion moves the day
                        west of UTC. cancelled_at is a genuine INSTANT, written
                        by the server's NOW(), so converting it to local time is
                        the right reading rather than a bug. Do not "fix" it to
                        parseApiDate: that would slice the UTC calendar day and
                        show the wrong one to anybody who cancelled in the
                        evening west of UTC. */}
                    {t("cancelled.since", { date: fmtD(new Date(sub.cancelledAt)) })}
                  </Text>
                  <Text style={sub.chargesAvoided > 0 ? styles.cardSaved : styles.cardNotYet}>
                    {sub.chargesAvoided > 0
                      ? t("cancelled.avoided", {
                          amount: fmtC(sub.amountAvoided, sub.currency),
                          count: sub.chargesAvoided,
                        })
                      : t("cancelled.nothingYet")}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("cancelled.a11yRestore", { name: sub.name })}
                  onPress={() => confirmRestore(sub)}
                >
                  <MaterialCommunityIcons name="restore" size={20} color={c.primary} />
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, paddingBottom: 40 },
    centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background, padding: 24 },
    errorText: { marginTop: 12, fontSize: 15, color: c.textSecondary, textAlign: "center", fontFamily: "Montserrat-Regular" },
    retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: c.primary, minHeight: 48, justifyContent: "center" },
    retryText: { color: "#fff", fontSize: 14, fontWeight: "600", fontFamily: "Montserrat-SemiBold" },
    empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
    emptyTitle: { marginTop: 14, fontSize: 17, color: c.text, fontWeight: "700", fontFamily: "Montserrat-Bold", textAlign: "center" },
    emptyBody: { marginTop: 8, fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 20, fontFamily: "Montserrat-Regular" },
    totalCard: { backgroundColor: c.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
    totalLabel: { fontSize: 13, color: c.textSecondary, fontFamily: "Montserrat-SemiBold", fontWeight: "600" },
    totalRow: { marginTop: 8 },
    totalAmount: { fontSize: 30, color: c.text, fontWeight: "700", fontFamily: "Montserrat-Bold" },
    totalMeta: { marginTop: 2, fontSize: 13, color: c.textSecondary, fontFamily: "Montserrat-Regular" },
    explainer: { fontSize: 13, color: c.textSecondary, lineHeight: 19, marginBottom: 16, fontFamily: "Montserrat-Regular" },
    card: { flexDirection: "row", alignItems: "center", backgroundColor: c.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
    iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    cardBody: { flex: 1, marginLeft: 12 },
    cardName: { fontSize: 15, color: c.text, fontWeight: "600", fontFamily: "Montserrat-SemiBold" },
    cardMeta: { marginTop: 2, fontSize: 12, color: c.textSecondary, fontFamily: "Montserrat-Regular" },
    cardSaved: { marginTop: 4, fontSize: 13, color: c.success, fontWeight: "600", fontFamily: "Montserrat-SemiBold" },
    cardNotYet: { marginTop: 4, fontSize: 13, color: c.textSecondary, fontFamily: "Montserrat-Regular" },
    iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  });
}
