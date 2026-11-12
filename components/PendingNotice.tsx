import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme, AppColors, type as typeScale } from "../lib/theme";
import { usePendingStore } from "../lib/pending-subscriptions";

/* SAYS WHAT IS NOT IN THE TOTALS YET.

   A subscription saved with no connection shows in the list, the calendar and
   the reminders at once, but the totals and the Stats breakdown are computed
   by the server, which has not seen it. Without this line the dashboard total
   quietly disagrees with the list under it, on an app whose whole promise is
   the right number.

   Same look as OfflineNotice: information, not an error. Renders nothing when
   nothing is waiting. */
export function PendingNotice() {
  const count = usePendingStore((s) => s.items.length);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <View style={styles.box} accessibilityRole="text">
      <MaterialCommunityIcons name="cloud-upload-outline" size={18} color={c.textSecondary} />
      <Text style={styles.text}>{t("common.pendingNotice", { count })}</Text>
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    box: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.card,
      borderColor: c.cardBorder,
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    text: { flex: 1, ...typeScale.caption, color: c.textSecondary },
  });
