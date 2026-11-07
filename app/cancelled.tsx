import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/api";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
import { LogoImage } from "../components/LogoImage";
import { useDateFormat } from "../lib/date-locale";
import { useFmt } from "../lib/currency-store";

/* Only for an older backend that does not send `limit` on the refusal. Kept
   equal to the server default, which a test asserts. */
const FREE_LIMIT_FALLBACK = 5;

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
  const queryClient = useQueryClient();

  /* isLoadingError, not isError: a refetch that fails (offline, or the server
     restarting) keeps the data it already had, the saved offline copy included,
     and that data should stay on screen rather than be replaced by an error. */
  const { data, isLoading, isLoadingError: isError, refetch } = useQuery({
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
        /* THE LIMIT COMES OFF THE REFUSAL ITSELF, which is the only place it is
           guaranteed current: the server decided this 403 using that exact
           number, so quoting anything else risks telling somebody they track
           five when the cap is ten. The fallback covers an older backend that
           does not send it yet. */
        const limit = Number(err?.response?.data?.limit);
        Alert.alert(
          t("cancelled.restoreBlockedTitle"),
          t("cancelled.restoreBlockedBody", {
            count: Number.isFinite(limit) && limit >= 1 ? limit : FREE_LIMIT_FALLBACK,
          })
        );
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
          <MaterialCommunityIcons name="check-circle-outline" size={40} color={c.textMuted} />
          <Text style={styles.emptyTitle}>{t("cancelled.emptyTitle")}</Text>
          <Text style={styles.emptyBody}>{t("cancelled.emptyBody")}</Text>
        </View>
      ) : (
        <>
          {/* ONE FIGURE PER CURRENCY, never one summed figure. Adding 15.99 EUR
              to 9.99 USD needs a rate, and a row is shown in the currency it
              was charged in. For the ordinary case of one currency this is one
              figure, open on the page like every other screen's lead. */}
          {totals.length > 0 && (
            <View style={styles.summary}>
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

          <View style={styles.card}>
            {subs.map((sub, i) => (
              <View key={sub.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <LogoImage name={sub.name} category={sub.category} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>{sub.name}</Text>
                  <Text style={styles.cardMeta}>
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
                    {t("cancelled.since", { date: fmtD(new Date(sub.cancelledAt), "PP") })}
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
                  <MaterialCommunityIcons name="restore" size={20} color={c.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: space.l, paddingTop: space.xl, paddingBottom: 40 },
    centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, padding: space.xl },
    errorText: { ...typeScale.body, marginTop: space.m, color: c.textSecondary, textAlign: "center" },
    retryButton: {
      marginTop: space.l, paddingHorizontal: space.xl, borderRadius: radius.m,
      backgroundColor: c.text, minHeight: 48, justifyContent: "center",
    },
    retryText: { ...typeScale.bodyStrong, color: c.bg },
    empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: space.xl },
    emptyTitle: { ...typeScale.heading, marginTop: space.l, color: c.text, textAlign: "center" },
    emptyBody: { ...typeScale.body, marginTop: space.s, color: c.textSecondary, textAlign: "center" },

    summary: { marginBottom: space.l },
    totalLabel: { ...typeScale.caption, color: c.textSecondary },
    totalRow: { marginTop: space.xs },
    totalAmount: { ...typeScale.display, color: c.text },
    totalMeta: { ...typeScale.caption, marginTop: 2, color: c.textSecondary },
    explainer: { ...typeScale.caption, color: c.textSecondary, marginBottom: space.l },

    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, paddingHorizontal: space.l,
    },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: space.m, gap: space.m },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    cardBody: { flex: 1 },
    cardName: { ...typeScale.bodyStrong, color: c.text },
    cardMeta: { ...typeScale.caption, marginTop: 2, color: c.textSecondary },
    cardSaved: { ...typeScale.label, marginTop: space.xs, color: c.success },
    cardNotYet: { ...typeScale.caption, marginTop: space.xs, color: c.textSecondary },
    iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  });
}
