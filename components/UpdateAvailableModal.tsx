import { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { nativeBuild } from "../lib/app-build";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";

export function UpdateAvailableModal() {
  const { t } = useTranslation();
  const c = useTheme();
  const styles = makeStyles(c);
  const [visible, setVisible] = useState(false);
  const [updateUrl, setUpdateUrl] = useState("https://play.google.com/store/apps/details?id=com.trimio.app");

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get("/trpc/appVersion.check")
      .then(({ data }) => {
        if (cancelled) return;
        // The INSTALLED build, not the update's app.json: see lib/app-build.ts.
        const currentVersionCode = nativeBuild().versionCode ?? 0;
        if (data?.minVersionCode > currentVersionCode) {
          if (data.updateUrl) setUpdateUrl(data.updateUrl);
          setVisible(true);
        }
      })
      .catch(() => {
        // Silently ignore — an outdated version check failing should never
        // block the app from being used.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <MaterialCommunityIcons name="cellphone-arrow-down" size={40} color={c.text} />
          <Text style={styles.title}>{t("updateAvailable.title")}</Text>
          <Text style={styles.message}>{t("updateAvailable.message")}</Text>
          <TouchableOpacity style={styles.updateButton} onPress={() => Linking.openURL(updateUrl)}>
            <Text style={styles.updateButtonText}>{t("updateAvailable.updateNow")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterButton} onPress={() => setVisible(false)}>
            <Text style={styles.laterButtonText}>{t("updateAvailable.later")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* Every number below comes from the scale in lib/theme.ts. The button is ink:
   white on dark primary is 4.02:1, under the text floor. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", alignItems: "center", padding: space.xl },
    card: {
      backgroundColor: c.card, borderRadius: radius.l, padding: space.xl, alignItems: "center", width: "100%", maxWidth: 340,
    },
    title: { ...typeScale.title, color: c.text, marginTop: space.m, marginBottom: space.s, textAlign: "center" },
    message: { ...typeScale.body, color: c.textSecondary, textAlign: "center", marginBottom: space.xl },
    updateButton: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 52, width: "100%",
      alignItems: "center", justifyContent: "center",
    },
    updateButtonText: { ...typeScale.bodyStrong, color: c.bg },
    laterButton: { marginTop: space.s, minHeight: 48, justifyContent: "center", paddingHorizontal: space.l },
    laterButtonText: { ...typeScale.bodyStrong, color: c.textSecondary },
  });
}
