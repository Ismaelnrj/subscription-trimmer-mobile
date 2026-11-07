import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
import { useDateFormat } from "../lib/date-locale";

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const fmtD = useDateFormat();
  const [refreshing, setRefreshing] = useState(false);

  /* isLoadingError, not isError: a refetch that fails (offline, or the server
     restarting) keeps the data it already had, the saved offline copy included,
     and that data should stay on screen rather than be replaced by an error. */
  const { data: notifications = [], isLoading, isLoadingError: isError, refetch: refetchHistory } = useQuery({
    queryKey: ["notifications", "history"],
    queryFn: async () => (await apiClient.get("/trpc/notifications.getHistory?limit=50")).data.result.data,
  });

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: async () => (await apiClient.get("/trpc/notifications.getUnreadCount")).data.result.data,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchHistory(), refetchUnread()]);
    setRefreshing(false);
  };

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
      default: return c.textSecondary;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: unreadCount > 0 ? t("notifications.titleWithCount", { count: unreadCount }) : t("notifications.title") }} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <View style={styles.scrollContent}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={() => markAsReadMutation.mutate(undefined)} accessibilityRole="button">
              <Text style={styles.markAllButtonText}>{t("notifications.markAllRead")}</Text>
            </TouchableOpacity>
          )}

          {isLoading ? (
            <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 48 }} />
          ) : isError ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="alert-circle-outline" size={40} color={c.textMuted} style={styles.emptyStateIcon} />
              <Text style={styles.emptyStateText}>{t("notifications.couldntLoad")}</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bell-outline" size={40} color={c.textMuted} style={styles.emptyStateIcon} />
              <Text style={styles.emptyStateText}>{t("notifications.noNotifications")}</Text>
            </View>
          ) : (
            /* One grouped card. Unread is a dot and a stronger title, not a
               tinted card with a coloured left edge, and tapping an unread
               row marks it read: the 11px "Mark read" button it replaces was
               a target a few dp tall. */
            <View style={styles.card}>
              {notifications.map((n: any, i: number) => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                  onPress={() => { if (!n.read) markAsReadMutation.mutate(n.id); }}
                  disabled={n.read}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !!n.read }}
                  accessibilityHint={!n.read ? t("notifications.markRead") : undefined}
                >
                  <MaterialCommunityIcons name={getIcon(n.type) as any} size={20} color={getIconColor(n.type)} style={styles.icon} />
                  <View style={styles.rowText}>
                    <Text style={[styles.title, !n.read && styles.titleUnread]}>{n.title}</Text>
                    <Text style={styles.message}>{n.message}</Text>
                    <Text style={styles.time}>{fmtD(new Date(n.createdAt), "PP")}</Text>
                  </View>
                  {!n.read && <View style={styles.unreadDot} accessibilityElementsHidden />}
                </TouchableOpacity>
              ))}
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
    scrollContent: { paddingHorizontal: space.l, paddingTop: space.l, paddingBottom: space.xxl },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, paddingHorizontal: space.l,
    },
    row: { flexDirection: "row", alignItems: "flex-start", gap: space.m, paddingVertical: space.l },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    icon: { marginTop: 2 },
    rowText: { flex: 1 },
    title: { ...typeScale.body, color: c.text },
    titleUnread: { ...typeScale.bodyStrong },
    message: { ...typeScale.caption, color: c.textSecondary, marginTop: space.xs },
    time: { ...typeScale.caption, color: c.textSecondary, marginTop: space.xs },
    unreadDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: c.text, marginTop: 7 },
    markAllButton: { alignSelf: "flex-end", minHeight: 48, justifyContent: "center", paddingHorizontal: space.xs, marginBottom: space.xs },
    markAllButtonText: { ...typeScale.label, color: c.text },
    emptyState: { alignItems: "center", paddingVertical: 48, paddingHorizontal: space.xl },
    emptyStateIcon: { marginBottom: space.m },
    emptyStateText: { ...typeScale.body, color: c.textSecondary, textAlign: "center" },
  });
}
