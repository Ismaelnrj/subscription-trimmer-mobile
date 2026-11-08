import { View, Text, ScrollView, Switch, StyleSheet, Alert, TouchableOpacity } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuthStore } from "../lib/auth-store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { fetchSubscriptionList } from "../lib/subscription-list";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
import { useDateFormat, dayMonthPattern } from "../lib/date-locale";
import { parseApiDate } from "../lib/utils";

/* How many days before a renewal the reminder email actually goes out.

   This preview used 7 while the sender selects `next_billing_date BETWEEN now
   AND now + 3 days`, so the screen named a date no email would arrive on. The
   label directly above it already said 3 days, in both languages, so the
   preview was the only thing disagreeing and there was nothing to decide.

   MUST match the window in backend/server.js's email reminder cron. There is no
   way to share a constant across the app and the server here, so
   __tests__/notification-prefs.test.js asserts both numbers instead. */
const EMAIL_LEAD_DAYS = 3;

export default function NotificationPreferencesScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const c = useTheme();
  const styles = makeStyles(c);
  const { t, i18n } = useTranslation();
  const fmtD = useDateFormat();

  const { data: subscriptions = [] } = useQuery<any[]>({
    queryKey: ["subscriptions", "list"],
    queryFn: fetchSubscriptionList,
    enabled: isPremium,
  });

  /* isLoadingError, not isError: a refetch that fails (offline, or the server
     restarting) keeps the data it already had, the saved offline copy included,
     and that data should stay on screen rather than be replaced by an error. */
  const { data: prefs, isLoading, isLoadingError: isError, refetch } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: async () => (await apiClient.get("/trpc/notifications.getPreferences")).data.result.data,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) =>
      (await apiClient.post("/trpc/notifications.updatePreferences", data)).data.result.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] }),
    onError: () => Alert.alert(t("common.error"), t("notifPrefs.errSave")),
  });

  const toggle = (key: string, value: boolean | number) => {
    if (!prefs) return;
    updateMutation.mutate({ ...prefs, [key]: value });
  };

  /* Off is a visible track: c.border measured 1.31:1 against the card, so an
     off switch read as missing. Same tokens as the add form's trial switch. */
  const track = { false: c.textSecondary, true: c.success };

  /* prefs stays undefined when the request fails, so the old
     "isLoading || !prefs" check spun forever with no way out. */
  if (isError || (!isLoading && !prefs)) {
    return (
      <>
        <Stack.Screen options={{ title: t("profile.notifications") }} />
        <View style={[styles.container, styles.centre]}>
          <MaterialCommunityIcons name="cloud-off-outline" size={40} color={c.textMuted} style={{ marginBottom: space.m }} />
          <Text style={styles.centreText}>{t("notifPrefs.couldntLoad")}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button">
            <Text style={styles.retryButtonText}>{t("notifPrefs.retry")}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (isLoading || !prefs) {
    return (
      <>
        <Stack.Screen options={{ title: t("profile.notifications") }} />
        <View style={[styles.container, styles.centre]}>
          <Text style={styles.centreText}>{t("notifPrefs.loading")}</Text>
        </View>
      </>
    );
  }

  /* Two switches are gone, deliberately: "Weekly summary" (on by default)
     promised an email no job has ever sent, and "Spending alerts" was stored
     but never read, so turning it off stopped nothing. A switch that controls
     nothing is a claim the product cannot keep. Their columns stay on the
     server untouched. */
  return (
    <>
      <Stack.Screen options={{ title: t("profile.notifications") }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <Text style={styles.sectionTitle}>{t("notifPrefs.alerts")}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{t("notifPrefs.pushNotifications")}</Text>
                <Text style={styles.rowDesc}>{t("notifPrefs.pushNotificationsDesc")}</Text>
              </View>
              <Switch
                value={prefs.pushEnabled}
                onValueChange={(v) => toggle("pushEnabled", v)}
                disabled={updateMutation.isLoading}
                trackColor={track}
                thumbColor="#FFFFFF"
                accessibilityLabel={t("notifPrefs.pushNotifications")}
              />
            </View>
            <View style={[styles.rowColumn, styles.rowDivider]}>
              <View style={styles.rowInner}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{t("notifPrefs.renewalAlerts")}</Text>
                  <Text style={styles.rowDesc}>{t("notifPrefs.renewalAlertsDesc")}</Text>
                </View>
                <Switch
                  value={prefs.renewalAlerts}
                  onValueChange={(v) => toggle("renewalAlerts", v)}
                  disabled={updateMutation.isLoading}
                  trackColor={track}
                  thumbColor="#FFFFFF"
                  accessibilityLabel={t("notifPrefs.renewalAlerts")}
                />
              </View>
              {prefs.renewalAlerts && (
                /* A segmented control: exactly one lead time is chosen. Chosen
                   is ink, never white on primary (4.02:1 in dark mode). */
                <View style={styles.segmented} accessibilityRole="radiogroup">
                  {[1, 3, 7].map((days) => {
                    const on = (prefs.renewalAlertDays ?? 3) === days;
                    return (
                      <TouchableOpacity
                        key={days}
                        style={[styles.segment, on && styles.segmentOn]}
                        onPress={() => toggle("renewalAlertDays", days)}
                        disabled={updateMutation.isLoading}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                          {t("notifPrefs.day", { count: days })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t("notifPrefs.emailSection")}</Text>
          <View style={styles.card}>
            <View style={styles.rowColumn}>
              <View style={styles.rowInner}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{t("notifPrefs.emailReminders")}</Text>
                  <Text style={styles.rowDesc}>
                    {isPremium
                      ? t("notifPrefs.emailRemindersDesc")
                      : t("notifPrefs.emailRemindersPremiumDesc")}
                  </Text>
                </View>
                {isPremium ? (
                  <Switch
                    value={prefs.emailReminders ?? false}
                    onValueChange={(v) => toggle("emailReminders", v)}
                    disabled={updateMutation.isLoading}
                    trackColor={track}
                    thumbColor="#FFFFFF"
                    accessibilityLabel={t("notifPrefs.emailReminders")}
                  />
                ) : (
                  <TouchableOpacity onPress={() => router.push("/upgrade")} style={styles.upgradeButton} accessibilityRole="button">
                    <Text style={styles.upgradeButtonText}>{t("notifPrefs.upgradeBtn")}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {isPremium && (prefs.emailReminders ?? false) && subscriptions.length > 0 && (() => {
                const now = Date.now();
                const upcoming = subscriptions
                  .map((s: any) => {
                    /* parseApiDate, so the preview names the same day the
                       reminder actually targets. new Date() on a TIMESTAMPTZ
                       gives an instant at midnight UTC, and subtracting the
                       lead time from it lands on the previous local day west of
                       UTC, so this list showed the wrong date for the same users
                       the calendar was already wrong for. */
                    const renew = parseApiDate(s.nextBillingDate);
                    if (!renew) return null;
                    const emailMs = renew.getTime() - EMAIL_LEAD_DAYS * 86400000;
                    return { name: s.name, price: s.price, emailMs };
                  })
                  .filter((s): s is { name: string; price: number; emailMs: number } => s != null && s.emailMs > now)
                  .sort((a, b) => a.emailMs - b.emailMs)
                  .slice(0, 3);

                if (upcoming.length === 0) return null;
                return (
                  <View style={styles.upcomingEmails}>
                    <Text style={styles.upcomingLabel}>{t("notifPrefs.nextEmails")}</Text>
                    {upcoming.map((s, i) => (
                      <View key={i} style={styles.upcomingRow}>
                        {/* A colon, not a dash: the copy rule forbids a dash as
                            clause punctuation. The date follows the app's
                            language and its day order. */}
                        <Text style={styles.upcomingText}>
                          {s.name}: {fmtD(new Date(s.emailMs), dayMonthPattern(i18n.language))}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
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
    centre: { justifyContent: "center", alignItems: "center", padding: space.xxl },
    centreText: { ...typeScale.body, color: c.textSecondary, textAlign: "center" },
    retryButton: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 48,
      paddingHorizontal: space.xl, marginTop: space.l, justifyContent: "center",
    },
    retryButtonText: { ...typeScale.bodyStrong, color: c.bg },
    scrollContent: { paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: space.xxl },

    sectionTitle: { ...typeScale.heading, color: c.text, marginTop: space.xl, marginBottom: space.s },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, paddingHorizontal: space.l,
    },
    row: { flexDirection: "row", alignItems: "center", gap: space.l, paddingVertical: space.l },
    rowColumn: { paddingVertical: space.l, gap: space.m },
    rowInner: { flexDirection: "row", alignItems: "center", gap: space.l },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowText: { flex: 1 },
    rowLabel: { ...typeScale.body, color: c.text },
    rowDesc: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },

    segmented: {
      flexDirection: "row", padding: 4, borderRadius: radius.m, gap: 4,
      backgroundColor: c.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    segment: { flex: 1, minHeight: 40, borderRadius: radius.s, alignItems: "center", justifyContent: "center" },
    segmentOn: { backgroundColor: c.text },
    segmentText: { ...typeScale.label, color: c.textSecondary },
    segmentTextOn: { color: c.bg, fontFamily: "Montserrat-SemiBold" },

    upgradeButton: { backgroundColor: c.text, borderRadius: radius.pill, minHeight: 40, paddingHorizontal: space.l, justifyContent: "center" },
    upgradeButtonText: { ...typeScale.label, color: c.bg },
    upcomingEmails: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: space.m, gap: space.xs },
    upcomingLabel: { ...typeScale.label, color: c.textSecondary },
    upcomingRow: { flexDirection: "row", alignItems: "center" },
    upcomingText: { ...typeScale.caption, color: c.text },
  });
}
