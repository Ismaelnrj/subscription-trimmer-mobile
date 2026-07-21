import { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import apiClient from "../lib/api";
import { useFmt } from "../lib/currency-store";
import { useTheme, useIsDark, AppColors } from "../lib/theme";
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
  const isDark = useIsDark();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const fmtC = useFmt();
  const queryClient = useQueryClient();

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => (await apiClient.get("/trpc/subscriptions.list")).data.result.data,
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
    onError: () => Alert.alert("Error", "Could not delete subscription. Please try again."),
  });

  const confirmDelete = () => {
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

  if (!sub) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={c.border} style={{ marginBottom: 12 }} />
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
          {isDark ? (
            <LinearGradient colors={["#6C3EF4", "#6A47EA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <LogoImage name={sub.name} category={sub.category} size={56} />
              <Text style={styles.heroNameOnGradient}>{sub.name}</Text>
              <Text style={styles.heroPriceOnGradient}>{fmtC(sub.price)} / {sub.billingCycle}</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.hero, styles.heroLight]}>
              <LogoImage name={sub.name} category={sub.category} size={56} />
              <Text style={styles.heroName}>{sub.name}</Text>
              <Text style={styles.heroPrice}>{fmtC(sub.price)} / {sub.billingCycle}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push(`/(tabs)/subscriptions?editId=${sub.id}`)}
          >
            <MaterialCommunityIcons name="pencil" size={16} color={c.primary} />
            <Text style={styles.editButtonText}>{t("subscriptionDetails.edit")}</Text>
          </TouchableOpacity>

          <View style={styles.costRow}>
            <View style={styles.costCard}>
              <Text style={styles.costLabel}>{t("subscriptionDetails.monthly")}</Text>
              <Text style={styles.costValue}>{fmtC(monthly)}</Text>
            </View>
            <View style={styles.costCard}>
              <Text style={styles.costLabel}>{t("subscriptionDetails.yearly")}</Text>
              <Text style={styles.costValue}>{fmtC(monthly * 12)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t("subscriptionDetails.upcomingRenewals")}</Text>
          {upcoming.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t("subscriptionDetails.noUpcoming")}</Text>
            </View>
          ) : (
            upcoming.map(({ date }, i) => (
              <View key={i} style={styles.renewalRow}>
                <MaterialCommunityIcons name="calendar-check-outline" size={18} color={c.textSecondary} />
                <Text style={styles.renewalDate}>{format(date, "EEEE, MMMM d")}</Text>
                <Text style={styles.renewalPrice}>{fmtC(sub.price)}</Text>
              </View>
            ))
          )}

          <TouchableOpacity style={styles.reminderRow} onPress={() => router.push("/notification-preferences")}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderTitle}>{t("subscriptionDetails.reminders")}</Text>
              <Text style={styles.reminderDesc}>{t("subscriptionDetails.remindersDesc")}</Text>
            </View>
            <Text style={styles.reminderManage}>{t("subscriptionDetails.manage")}</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, styles.dangerTitle]}>{t("subscriptionDetails.dangerZone")}</Text>
          <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} disabled={deleteMutation.isLoading}>
            {deleteMutation.isLoading ? (
              <ActivityIndicator color={c.danger} />
            ) : (
              <>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={c.danger} />
                <Text style={styles.deleteButtonText}>{t("subscriptionDetails.deleteSubscription")}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: 32 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
    hero: { borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 12 },
    heroLight: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    heroName: { fontSize: 20, fontWeight: "700", color: c.text, marginTop: 12 },
    heroPrice: { fontSize: 14, color: c.textSecondary, marginTop: 4 },
    heroNameOnGradient: { fontSize: 20, fontWeight: "700", color: "#FFFFFF", marginTop: 12 },
    heroPriceOnGradient: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 4 },
    editButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      alignSelf: "center", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
      backgroundColor: c.primaryLight, marginBottom: 20,
    },
    editButtonText: { fontSize: 13, fontWeight: "600", color: c.primary },
    costRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
    costCard: {
      flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: c.border,
    },
    costLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 4 },
    costValue: { fontSize: 18, fontWeight: "700", color: c.text },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: c.text, marginBottom: 10 },
    dangerTitle: { color: c.danger, marginTop: 20 },
    emptyState: { paddingVertical: 16 },
    emptyStateText: { fontSize: 13, color: c.textSecondary },
    renewalRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: c.card, borderRadius: 10, padding: 12, marginBottom: 8,
      borderWidth: 1, borderColor: c.border,
    },
    renewalDate: { flex: 1, fontSize: 13, color: c.text },
    renewalPrice: { fontSize: 13, fontWeight: "600", color: c.text },
    reminderRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginTop: 12,
      borderWidth: 1, borderColor: c.border,
    },
    reminderTitle: { fontSize: 14, fontWeight: "600", color: c.text },
    reminderDesc: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    reminderManage: { fontSize: 13, fontWeight: "600", color: c.primary },
    deleteButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.dangerLight, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: c.dangerBorder,
    },
    deleteButtonText: { fontSize: 14, fontWeight: "600", color: c.danger },
  });
}
