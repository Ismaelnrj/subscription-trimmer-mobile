import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import apiClient from "../lib/api";
import { useTheme, AppColors } from "../lib/theme";

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const c = useTheme();
  const styles = makeStyles(c);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", "history"],
    queryFn: async () => (await apiClient.get("/trpc/notifications.getHistory?limit=50")).data.result.data,
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: async () => (await apiClient.get("/trpc/notifications.getUnreadCount")).data.result.data,
  });

  const unreadCount = unreadData?.unreadCount ?? 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (id?: number) =>
      (await apiClient.post("/trpc/notifications.markAsRead", id ? { id } : {})).data.result.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "renewal_alert": return "calendar-alert";
      case "expensive_alert": return "alert-circle";
      case "payment_received": return "check-circle";
      default: return "bell";
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case "renewal_alert": return c.warning;
      case "expensive_alert": return c.danger;
      case "payment_received": return c.success;
      default: return c.primary;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications" }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={() => markAsReadMutation.mutate(undefined)}>
              <Text style={styles.markAllButtonText}>Mark all as read</Text>
            </TouchableOpacity>
          )}

          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bell-outline" size={48} color={c.border} style={styles.emptyStateIcon} />
              <Text style={styles.emptyStateText}>No notifications yet</Text>
            </View>
          ) : (
            notifications.map((n: any) => (
              <View key={n.id} style={[styles.notificationCard, !n.read && styles.notificationCardUnread]}>
                <View style={styles.notificationIcon}>
                  <MaterialCommunityIcons name={getIcon(n.type)} size={20} color={getIconColor(n.type)} />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>{n.title}</Text>
                  <Text style={styles.notificationMessage}>{n.message}</Text>
                  <Text style={styles.notificationTime}>{new Date(n.createdAt).toLocaleDateString()}</Text>
                  {!n.read && (
                    <View style={styles.notificationActions}>
                      <TouchableOpacity style={styles.actionButton} onPress={() => markAsReadMutation.mutate(n.id)}>
                        <Text style={styles.actionButtonText}>Mark as read</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))
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
    notificationCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: c.border, flexDirection: "row", gap: 12,
    },
    notificationCardUnread: {
      backgroundColor: c.primaryLight, borderLeftWidth: 4, borderLeftColor: c.primary,
    },
    notificationIcon: {
      width: 40, height: 40, borderRadius: 8, backgroundColor: c.primaryLight,
      justifyContent: "center", alignItems: "center",
    },
    notificationContent: { flex: 1 },
    notificationTitle: { fontSize: 14, fontWeight: "600", color: c.text, marginBottom: 4 },
    notificationMessage: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 4 },
    notificationTime: { fontSize: 11, color: c.textMuted },
    notificationActions: { flexDirection: "row", gap: 8, marginTop: 8 },
    actionButton: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, backgroundColor: c.border },
    actionButtonText: { fontSize: 11, fontWeight: "600", color: c.primary },
    markAllButton: {
      backgroundColor: c.primaryLight, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16,
      marginBottom: 16, alignItems: "center",
    },
    markAllButtonText: { fontSize: 13, fontWeight: "600", color: c.primary },
    emptyState: { alignItems: "center", paddingVertical: 48 },
    emptyStateIcon: { marginBottom: 12 },
    emptyStateText: { fontSize: 14, color: c.textSecondary, textAlign: "center" },
  });
}
