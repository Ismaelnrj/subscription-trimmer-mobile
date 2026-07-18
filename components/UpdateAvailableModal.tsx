import { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import apiClient from "../lib/api";
import { useTheme, AppColors } from "../lib/theme";

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
        const currentVersionCode = Constants.expoConfig?.android?.versionCode ?? 0;
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
          <MaterialCommunityIcons name="cellphone-arrow-down" size={40} color={c.primary} />
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

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", alignItems: "center", padding: 24 },
    card: {
      backgroundColor: c.card, borderRadius: 16, padding: 24, alignItems: "center", width: "100%", maxWidth: 340,
    },
    title: { fontSize: 18, fontWeight: "700", color: c.text, marginTop: 12, marginBottom: 8 },
    message: { fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 20 },
    updateButton: {
      backgroundColor: c.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32, width: "100%", alignItems: "center",
    },
    updateButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    laterButton: { marginTop: 12, paddingVertical: 8 },
    laterButtonText: { color: c.textSecondary, fontSize: 14, fontWeight: "600" },
  });
}
