import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme, AppColors } from "../lib/theme";

/* SAYS THE NUMBERS ARE NOT LIVE.

   Rendered when a screen's refetch failed but it still holds data, which is
   what the offline copy in lib/offline-cache.ts produces. Without it a total
   from last week reads exactly like a total from a second ago, on an app whose
   whole promise is saying what is about to be debited.

   Quiet on purpose: slate on the card ground, 6.19:1 light and 6.10:1 dark,
   measured with trimio-design check_contrast.py. It is information, not an
   error, so it does not borrow the danger or warning colours. */
export function OfflineNotice() {
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  return (
    <View style={styles.box} accessibilityRole="alert">
      <MaterialCommunityIcons name="cloud-off-outline" size={18} color={c.textSecondary} />
      <Text style={styles.text}>{t("common.offlineSaved")}</Text>
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
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    text: { flex: 1, fontSize: 13, color: c.textSecondary },
  });
