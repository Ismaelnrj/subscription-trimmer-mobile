import { View, Text, ScrollView, Switch, StyleSheet, Alert, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../lib/auth-store";
import { Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/api";
import { useTheme, AppColors } from "../lib/theme";

export default function NotificationPreferencesScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const c = useTheme();
  const styles = makeStyles(c);

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: async () => (await apiClient.get("/trpc/notifications.getPreferences")).data.result.data,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) =>
      (await apiClient.post("/trpc/notifications.updatePreferences", data)).data.result.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] }),
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
          <Text style={{ color: c.textSecondary }}>Loading...</Text>
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
                trackColor={{ false: c.border, true: c.primary }}
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
                trackColor={{ false: c.border, true: c.primary }}
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
                trackColor={{ false: c.border, true: c.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.rowLabel}>Push Notifications</Text>
                <Text style={styles.rowDesc}>Enable all push notifications from Trimio</Text>
              </View>
              <Switch
                value={prefs.pushEnabled}
                onValueChange={(v) => toggle("pushEnabled", v)}
                trackColor={{ false: c.border, true: c.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={[styles.row, styles.rowLast]}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.rowLabel}>
                  Email Reminders{!isPremium ? "  🔒" : ""}
                </Text>
                <Text style={styles.rowDesc}>
                  {isPremium
                    ? "Get an email 7 days before any subscription renews"
                    : "Premium feature — upgrade to enable email reminders"}
                </Text>
              </View>
              {isPremium ? (
                <Switch
                  value={prefs.emailReminders ?? false}
                  onValueChange={(v) => toggle("emailReminders", v)}
                  trackColor={{ false: c.border, true: c.primary }}
                  thumbColor="#FFFFFF"
                />
              ) : (
                <TouchableOpacity
                  onPress={() => router.push("/upgrade")}
                  style={{ backgroundColor: c.primary, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 }}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: 32 },
    card: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: "hidden", marginBottom: 16 },
    row: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { fontSize: 14, fontWeight: "500", color: c.text },
    rowDesc: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    sectionTitle: { fontSize: 12, fontWeight: "600", color: c.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  });
}
