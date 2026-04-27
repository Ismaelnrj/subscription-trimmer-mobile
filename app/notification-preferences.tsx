import { View, Text, ScrollView, Switch, StyleSheet, Alert } from "react-native";
import { Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/api";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden", marginBottom: 16 },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 14, fontWeight: "500", color: "#1F2937" },
  rowDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
});

export default function NotificationPreferencesScreen() {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: async () => {
      const response = await apiClient.get("/trpc/notifications.getPreferences");
      return response.data.result.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post("/trpc/notifications.updatePreferences", data);
      return response.data.result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
    onError: () => Alert.alert("Error", "Failed to save preferences. Please try again."),
  });

  const toggle = (key: string, value: boolean) => {
    if (!prefs) return;
    updateMutation.mutate({ ...prefs, [key]: value });
  };

  if (isLoading || !prefs) {
    return (
      <>
        <Stack.Screen options={{ title: "Notification Preferences" }} />
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <Text style={{ color: "#6B7280" }}>Loading...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Notification Preferences" }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Alerts</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.rowLabel}>Renewal Alerts</Text>
                <Text style={styles.rowDesc}>Get notified 7 days before a subscription renews</Text>
              </View>
              <Switch
                value={prefs.renewalAlerts}
                onValueChange={(v) => toggle("renewalAlerts", v)}
                trackColor={{ false: "#D1D5DB", true: "#4F46E5" }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={[styles.row, styles.rowLast]}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.rowLabel}>Spending Alerts</Text>
                <Text style={styles.rowDesc}>Get notified when monthly spend is high</Text>
              </View>
              <Switch
                value={prefs.spendingAlerts}
                onValueChange={(v) => toggle("spendingAlerts", v)}
                trackColor={{ false: "#D1D5DB", true: "#4F46E5" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowLast]}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.rowLabel}>Weekly Summary</Text>
                <Text style={styles.rowDesc}>Receive a weekly overview of your spending</Text>
              </View>
              <Switch
                value={prefs.weeklySummary}
                onValueChange={(v) => toggle("weeklySummary", v)}
                trackColor={{ false: "#D1D5DB", true: "#4F46E5" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowLast]}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.rowLabel}>Push Notifications</Text>
                <Text style={styles.rowDesc}>Enable all push notifications from SubTrimmer</Text>
              </View>
              <Switch
                value={prefs.pushEnabled}
                onValueChange={(v) => toggle("pushEnabled", v)}
                trackColor={{ false: "#D1D5DB", true: "#4F46E5" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
