import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import apiClient from "../lib/api";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  alertCardHigh: {
    borderLeftColor: "#EF4444",
  },
  alertCardMedium: {
    borderLeftColor: "#F59E0B",
  },
  alertCardLow: {
    borderLeftColor: "#3B82F6",
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
  },
  alertBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  alertBadgeHigh: {
    backgroundColor: "#FEE2E2",
  },
  alertBadgeMedium: {
    backgroundColor: "#FEF3C7",
  },
  alertBadgeLow: {
    backgroundColor: "#DBEAFE",
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  alertBadgeTextHigh: {
    color: "#DC2626",
  },
  alertBadgeTextMedium: {
    color: "#D97706",
  },
  alertBadgeTextLow: {
    color: "#1E40AF",
  },
  alertMessage: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  alertAction: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  actionButton: {
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4F46E5",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyStateIcon: {
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  filterButtons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterButtonActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
});

export default function AlertsScreen() {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts", "list"],
    queryFn: async () => {
      const response = await apiClient.get("/trpc/alerts.list");
      return response.data.result.data;
    },
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "expensive":
        return "alert-circle";
      case "renewal":
        return "calendar-alert";
      case "inactive":
        return "pause-circle";
      default:
        return "information";
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "high":
        return { card: styles.alertCardHigh, badge: styles.alertBadgeHigh, text: styles.alertBadgeTextHigh };
      case "medium":
        return { card: styles.alertCardMedium, badge: styles.alertBadgeMedium, text: styles.alertBadgeTextMedium };
      default:
        return { card: styles.alertCardLow, badge: styles.alertBadgeLow, text: styles.alertBadgeTextLow };
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Alerts" }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          {alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="check-circle"
                size={48}
                color="#10B981"
                style={styles.emptyStateIcon}
              />
              <Text style={styles.emptyStateText}>All clear! No alerts at the moment.</Text>
            </View>
          ) : (
            alerts.map((alert: any) => {
              const severityStyles = getSeverityStyles(alert.severity);
              return (
                <View key={alert.id} style={[styles.alertCard, severityStyles.card]}>
                  <View style={styles.alertHeader}>
                    <MaterialCommunityIcons
                      name={getAlertIcon(alert.type)}
                      size={20}
                      color={alert.severity === "high" ? "#EF4444" : alert.severity === "medium" ? "#F59E0B" : "#3B82F6"}
                    />
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <View style={[styles.alertBadge, severityStyles.badge]}>
                      <Text style={[styles.alertBadgeText, severityStyles.text]}>
                        {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  {alert.subscriptionName && (
                    <View style={styles.alertAction}>
                      <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                        Service: <Text style={{ fontWeight: "600" }}>{alert.subscriptionName}</Text>
                      </Text>
                      <TouchableOpacity style={styles.actionButton}>
                        <Text style={styles.actionButtonText}>View Subscription</Text>
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
