import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { useTheme, AppColors } from "../lib/theme";

export default function AlertsScreen() {
  const router = useRouter();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const { data: alerts = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["alerts", "list"],
    queryFn: async () => (await apiClient.get("/trpc/alerts.list")).data.result.data,
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "expensive": return "alert-circle";
      case "renewal": return "calendar-alert";
      default: return "information";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return c.danger;
      case "medium": return c.warning;
      default: return "#3B82F6";
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case "high": return c.dangerLight;
      case "medium": return c.warningLight;
      default: return "#DBEAFE";
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Alerts" }} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[c.primary]} tintColor={c.primary} />}
      >
        <View style={styles.scrollContent}>
          {isLoading ? (
            <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 48 }} />
          ) : isError ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color={c.border} style={styles.emptyStateIcon} />
              <Text style={styles.emptyStateText}>{t("alerts.couldntLoad")}</Text>
            </View>
          ) : alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="check-circle" size={48} color={c.success} style={styles.emptyStateIcon} />
              <Text style={styles.emptyStateText}>{t("alerts.allClear")}</Text>
            </View>
          ) : (
            alerts.map((alert: any) => {
              const col = getSeverityColor(alert.severity);
              const bg = getSeverityBg(alert.severity);
              return (
                <View key={alert.id} style={[styles.alertCard, { borderLeftColor: col }]}>
                  <View style={styles.alertHeader}>
                    <MaterialCommunityIcons name={getAlertIcon(alert.type)} size={20} color={col} />
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <View style={[styles.alertBadge, { backgroundColor: bg }]}>
                      <Text style={[styles.alertBadgeText, { color: col }]}>
                        {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  {alert.subscriptionName && (
                    <View style={styles.alertAction}>
                      <Text style={{ fontSize: 12, color: c.textSecondary, marginBottom: 8 }}>
                        {t("alerts.service")} <Text style={{ fontWeight: "600" }}>{alert.subscriptionName}</Text>
                      </Text>
                      <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(tabs)/subscriptions")}>
                        <Text style={styles.actionButtonText}>{t("alerts.viewSubscription")}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: 32 },
    alertCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 12,
      borderLeftWidth: 4, borderWidth: 1, borderColor: c.border,
    },
    alertHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    alertTitle: { fontSize: 14, fontWeight: "600", color: c.text, flex: 1, marginLeft: 8 },
    alertBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, marginLeft: 8 },
    alertBadgeText: { fontSize: 11, fontWeight: "600" },
    alertMessage: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    alertAction: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
    actionButton: { backgroundColor: c.border, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center" },
    actionButtonText: { fontSize: 12, fontWeight: "600", color: c.primary },
    emptyState: { alignItems: "center", paddingVertical: 48 },
    emptyStateIcon: { marginBottom: 12 },
    emptyStateText: { fontSize: 14, color: c.textSecondary, textAlign: "center" },
  });
}
