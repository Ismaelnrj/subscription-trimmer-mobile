import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme, AppColors } from "../lib/theme";

/* THE SENTENCE BEFORE ANDROID'S QUESTION.

   Shown once a subscription has been added and only while Android would still
   show its own dialog (lib/reminder-primer.ts decides). It names the thing that
   was just added, so "allow notifications" stops being an abstract request and
   becomes "remind me before Netflix renews", which is the promise the app is
   built on.

   The amber bell is the theme's warning on warningLight: 4.67:1 in light and
   7.24:1 in dark, measured with trimio-design check_contrast.py. */

type Props = {
  name: string | null;
  onAccept: () => void;
  onDecline: () => void;
};

export function ReminderPrimer({ name, onAccept, onDecline }: Props) {
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  return (
    <Modal visible={name !== null} animationType="fade" transparent onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="bell-ring-outline" size={34} color={c.warning} />
          </View>
          <Text style={styles.title}>{t("reminderPrimer.title", { name: name ?? "" })}</Text>
          <Text style={styles.body}>{t("reminderPrimer.body")}</Text>
          <TouchableOpacity style={styles.primary} onPress={onAccept} accessibilityRole="button">
            <Text style={styles.primaryText}>{t("reminderPrimer.accept")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={onDecline} accessibilityRole="button">
            <Text style={styles.secondaryText}>{t("reminderPrimer.decline")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", padding: 24 },
    sheet: { backgroundColor: c.card, borderRadius: 24, padding: 24, alignItems: "center" },
    iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.warningLight, justifyContent: "center", alignItems: "center", marginBottom: 18 },
    title: { fontSize: 20, lineHeight: 27, fontWeight: "800", fontFamily: "Montserrat-ExtraBold", color: c.text, textAlign: "center", marginBottom: 10 },
    body: { fontSize: 15, lineHeight: 22, color: c.textSecondary, textAlign: "center", marginBottom: 22 },
    primary: {
      alignSelf: "stretch", minHeight: 52, borderRadius: 14, backgroundColor: c.primary,
      justifyContent: "center", alignItems: "center", paddingHorizontal: 16,
    },
    primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", fontFamily: "Montserrat-Bold" },
    secondary: { alignSelf: "stretch", minHeight: 48, justifyContent: "center", alignItems: "center", marginTop: 6 },
    secondaryText: { color: c.textSecondary, fontSize: 15, fontFamily: "Montserrat-SemiBold" },
  });
}
