import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";

export default function AlertsScreen() {
  const router = useRouter();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  /* isLoadingError, not isError: a refetch that fails (offline, or the server
     restarting) keeps the data it already had, the saved offline copy included,
     and that data should stay on screen rather than be replaced by an error. */
  const { data: alerts = [], isLoading, isLoadingError: isError, refetch, isRefetching } = useQuery({
    queryKey: ["alerts", "list"],
    queryFn: async () => (await apiClient.get("/trpc/alerts.list")).data.result.data,
  });

  /* These names must match what alerts.list in backend/server.js actually
     sends: renewal_alert, trial_alert and expensive_alert. They used to read
     "renewal" and "expensive", which match NO type the server has ever sent,
     so every alert on this screen fell through to the generic "information"
     icon and the severity colour was the only thing telling them apart.
     The bare names are kept as aliases so a payload from an older or
     hand-rolled source still resolves rather than silently going generic. */
  const getAlertIcon = (type: string) => {
    switch (type) {
      case "expensive_alert":
      case "expensive": return "alert-circle";
      case "renewal_alert":
      case "renewal": return "calendar-alert";
      case "trial_alert":
      case "trial": return "clock-alert-outline";
      default: return "information";
    }
  };

  /* The badge used to render `severity.charAt(0).toUpperCase() + slice(1)`,
     which is a bare English JSX text node: a German reader got "High".
     An unknown severity falls back to the server's own string rather than
     blanking the badge. */
  const severityLabel = (severity: string) =>
    severity === "high" || severity === "medium" || severity === "low"
      ? t(`alerts.severity_${severity}`)
      : severity;

  /* From the theme, never fixed hex: low severity was Tailwind blue
     (#3B82F6 on a #DBEAFE badge), off palette in light and a pale block on
     the dark card. */
  const toneOf = (severity: string) =>
    severity === "high" ? c.danger : severity === "medium" ? c.warning : c.textSecondary;

  return (
    <>
      <Stack.Screen options={{ title: t("screenTitles.alerts") }} />
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
              <MaterialCommunityIcons name="alert-circle-outline" size={40} color={c.textMuted} style={styles.emptyStateIcon} />
              <Text style={styles.emptyStateText}>{t("alerts.couldntLoad")}</Text>
            </View>
          ) : alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="check-circle-outline" size={40} color={c.success} style={styles.emptyStateIcon} />
              <Text style={styles.emptyStateText}>{t("alerts.allClear")}</Text>
            </View>
          ) : (
            /* One grouped card. A row about a subscription opens THAT
               subscription; it used to offer "View Subscription", which went
               to the whole list. The title already names the service. */
            <View style={styles.card}>
              {alerts.map((alert: any, i: number) => {
                const tone = toneOf(alert.severity);
                const body = (
                  <>
                    <MaterialCommunityIcons name={getAlertIcon(alert.type)} size={20} color={tone} style={styles.icon} />
                    <View style={styles.rowText}>
                      <Text style={[styles.severity, { color: tone }]}>{severityLabel(alert.severity)}</Text>
                      <Text style={styles.alertTitle}>{alert.title}</Text>
                      <Text style={styles.alertMessage}>{alert.message}</Text>
                    </View>
                  </>
                );
                return alert.subscriptionId ? (
                  <TouchableOpacity
                    key={alert.id}
                    style={[styles.row, i > 0 && styles.rowDivider]}
                    onPress={() => router.push(`/subscription-details?id=${alert.subscriptionId}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${severityLabel(alert.severity)}. ${alert.title}. ${alert.message}`}
                  >
                    {body}
                    <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} style={styles.icon} />
                  </TouchableOpacity>
                ) : (
                  <View key={alert.id} style={[styles.row, i > 0 && styles.rowDivider]}>{body}</View>
                );
              })}
            </View>
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
    scrollContent: { paddingHorizontal: space.l, paddingTop: space.xl, paddingBottom: space.xxl },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, paddingHorizontal: space.l,
    },
    row: { flexDirection: "row", alignItems: "flex-start", gap: space.m, paddingVertical: space.l },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    icon: { marginTop: 2 },
    rowText: { flex: 1 },
    severity: { ...typeScale.label, marginBottom: 2 },
    alertTitle: { ...typeScale.bodyStrong, color: c.text },
    alertMessage: { ...typeScale.caption, color: c.textSecondary, marginTop: space.xs },
    emptyState: { alignItems: "center", paddingVertical: 48, paddingHorizontal: space.xl },
    emptyStateIcon: { marginBottom: space.m },
    emptyStateText: { ...typeScale.body, color: c.textSecondary, textAlign: "center" },
  });
}
