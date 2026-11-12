import { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { fetchSubscriptionList } from "../lib/subscription-list";
import { isPendingRow, removePending } from "../lib/pending-subscriptions";
import { rescheduleRemindersFromCache } from "../lib/reminders-from-cache";
import { useFmt } from "../lib/currency-store";
import { useDateFormat, dayMonthPattern } from "../lib/date-locale";
import { useCycleAdjective } from "../lib/cycle-label";
import { useTheme, AppColors, space, radius, type as typeScale, tabular } from "../lib/theme";
import { LogoImage } from "../components/LogoImage";
import { getUpcomingOccurrences } from "../lib/recurrence";

function toMonthly(price: number, cycle: string) {
  if (cycle === "weekly") return (price * 52) / 12;
  if (cycle === "yearly") return price / 12;
  return price;
}

export default function SubscriptionDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t, i18n } = useTranslation();
  const fmtC = useFmt();
  const fmtD = useDateFormat();
  const cycleAdjective = useCycleAdjective();
  const queryClient = useQueryClient();

  /* isLoadingError, not isError: a refetch that fails (offline, or the server
     restarting) keeps the data it already had, the saved offline copy included,
     and that data should stay on screen rather than be replaced by an error. */
  const { data: subscriptions = [], isLoading, isLoadingError: isError, refetch } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: fetchSubscriptionList,
  });

  const sub = (subscriptions as any[]).find((s) => String(s.id) === id);
  const upcoming = useMemo(
    () => (sub ? getUpcomingOccurrences([sub], new Date(), 180) : []),
    [sub]
  );

  const deleteMutation = useMutation({
    mutationFn: async () => (await apiClient.post("/trpc/subscriptions.delete", { id: sub.id })).data.result.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions", "list"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "summary"] });
      router.back();
    },
    onError: () => Alert.alert(t("common.error"), t("subscriptions.errDeleteSub")),
  });

  const confirmDelete = () => {
    /* Still waiting to be saved, so there is no server row to delete: removing
       it is local and needs no connection. */
    if (isPendingRow(sub)) {
      Alert.alert(t("subscriptions.pendingTitle"), t("subscriptions.pendingBody", { name: sub.name }), [
        { text: t("subscriptions.cancel"), style: "cancel" },
        {
          text: t("subscriptions.pendingRemove"),
          style: "destructive",
          onPress: () => {
            removePending(sub.clientRef);
            rescheduleRemindersFromCache();
            router.back();
          },
        },
      ]);
      return;
    }
    Alert.alert(
      t("subscriptionDetails.deleteConfirmTitle", { name: sub.name }),
      t("subscriptionDetails.deleteConfirmMsg"),
      [
        { text: t("subscriptions.cancel"), style: "cancel" },
        { text: t("subscriptions.delete"), style: "destructive", onPress: () => deleteMutation.mutate() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  /* A failed request leaves subscriptions empty, which used to render as
     "subscription not found". The subscription exists, the network didn't. */
  if (isError) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="cloud-off-outline" size={40} color={c.textMuted} style={{ marginBottom: space.m }} />
        <Text style={styles.emptyStateText}>{t("subscriptionDetails.couldntLoad")}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button">
          <Text style={styles.retryButtonText}>{t("subscriptionDetails.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!sub) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={40} color={c.textMuted} style={{ marginBottom: space.m }} />
        <Text style={styles.emptyStateText}>{t("subscriptionDetails.notFound")}</Text>
      </View>
    );
  }

  const monthly = toMonthly(parseFloat(sub.price), sub.billingCycle);

  return (
    <>
      <Stack.Screen options={{ title: sub.name }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          {/* Open on the page, like every redone screen: the mark, the name,
              then the one figure this screen is about. The dark mode gradient
              (#245F52 to #2F8E71) was off palette. */}
          <View style={styles.header}>
            <LogoImage name={sub.name} category={sub.category} size={48} />
            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={2}>{sub.name}</Text>
              <Text style={styles.cycle}>{cycleAdjective(sub.billingCycle)}</Text>
            </View>
          </View>
          <Text style={styles.price}>{fmtC(sub.price, sub.currency)}</Text>

          {/* Derived from ONE row, so it is in that row's currency. Formatted
              without it, a 24.99 USD row was read as the base currency and
              converted a second time. Only the figure the cycle does not
              already state is shown. */}
          <View style={styles.card}>
            {sub.billingCycle !== "monthly" && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t("subscriptionDetails.monthly")}</Text>
                <Text style={styles.rowValue}>{fmtC(monthly, sub.currency)}</Text>
              </View>
            )}
            {sub.billingCycle !== "yearly" && (
              <View style={[styles.row, sub.billingCycle !== "monthly" && styles.rowDivider]}>
                <Text style={styles.rowLabel}>{t("subscriptionDetails.yearly")}</Text>
                <Text style={styles.rowValue}>{fmtC(monthly * 12, sub.currency)}</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>{t("subscriptionDetails.upcomingRenewals")}</Text>
          {upcoming.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t("subscriptionDetails.noUpcoming")}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {upcoming.map(({ date }, i) => (
                <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <Text style={styles.rowLabel}>{fmtD(date, dayMonthPattern(i18n.language, { weekday: true }))}</Text>
                  <Text style={styles.rowValue}>{fmtC(sub.price, sub.currency)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.card, styles.cardAfter]}>
            {isPendingRow(sub) ? (
              /* No server id yet, so editing waits until it is saved. */
              <View style={styles.row}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={20} color={c.textSecondary} />
                <Text style={[styles.rowLabel, styles.pendingText]}>{t("subscriptions.pendingBody", { name: sub.name })}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push(`/(tabs)/subscriptions?editId=${sub.id}`)}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="pencil-outline" size={20} color={c.textSecondary} />
                <Text style={styles.rowLabel}>{t("subscriptionDetails.edit")}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.row, styles.rowDivider]}
              onPress={() => router.push("/notification-preferences")}
              accessibilityRole="button"
              accessibilityHint={t("subscriptionDetails.remindersDesc")}
            >
              <MaterialCommunityIcons name="bell-outline" size={20} color={c.textSecondary} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t("subscriptionDetails.reminders")}</Text>
                <Text style={styles.rowSub}>{t("subscriptionDetails.remindersDesc")}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.card, styles.cardAfter]}>
            <TouchableOpacity
              style={styles.row}
              onPress={confirmDelete}
              disabled={deleteMutation.isLoading}
              accessibilityRole="button"
            >
              {deleteMutation.isLoading ? (
                <ActivityIndicator color={c.danger} />
              ) : (
                <>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={c.danger} />
                  <Text style={[styles.rowLabel, { color: c.danger }]}>{t("subscriptionDetails.deleteSubscription")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { paddingHorizontal: space.l, paddingTop: space.xl, paddingBottom: space.xxl },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80, backgroundColor: c.bg },

    header: { flexDirection: "row", alignItems: "center", gap: space.m },
    headerText: { flex: 1 },
    name: { ...typeScale.title, color: c.text },
    cycle: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },
    price: { ...typeScale.display, color: c.text, marginTop: space.l, marginBottom: space.l },

    sectionTitle: { ...typeScale.heading, color: c.text, marginTop: space.xl, marginBottom: space.s },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder, paddingHorizontal: space.l,
    },
    cardAfter: { marginTop: space.xl },
    row: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingVertical: space.m, gap: space.m },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowLabel: { ...typeScale.body, color: c.text, flex: 1 },
    rowValue: { ...typeScale.bodyStrong, ...tabular, color: c.text },
    rowText: { flex: 1 },
    rowTitle: { ...typeScale.body, color: c.text },
    rowSub: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },
    pendingText: { color: c.textSecondary },

    emptyState: { paddingVertical: space.l },
    emptyStateText: { ...typeScale.body, color: c.textSecondary, textAlign: "center", paddingHorizontal: space.xxl },
    retryButton: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 48,
      paddingHorizontal: space.xl, marginTop: space.l, justifyContent: "center",
    },
    retryButtonText: { ...typeScale.bodyStrong, color: c.bg },
  });
}
