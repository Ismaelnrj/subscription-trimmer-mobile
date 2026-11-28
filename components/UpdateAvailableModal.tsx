import { useEffect, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSegments } from "expo-router";
import { useAuthStore } from "../lib/auth-store";
import apiClient from "../lib/api";
import { nativeBuild } from "../lib/app-build";
import { readSnooze, shouldPromptUpdate, snoozeUpdatePrompt } from "../lib/update-prompt";
import { ANNOUNCEMENTS, installedAt, markSeen, readSeen, whatsNewFor, WhatsNew } from "../lib/whats-new";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";

/* Two notices, at most one per launch, never over the launch screen (`ready`):
   "a new version is on Google Play" (lib/update-prompt.ts), and otherwise,
   for somebody signed in and on the main screens, "what's new"
   (lib/whats-new.ts). The Play prompt wins: it asks for something. */
export function UpdateAvailableModal({ ready }: { ready: boolean }) {
  const { t } = useTranslation();
  const c = useTheme();
  const styles = makeStyles(c);
  const [visible, setVisible] = useState(false);
  const [minimum, setMinimum] = useState(0);
  const [checked, setChecked] = useState(false);
  const [news, setNews] = useState<WhatsNew | null>(null);
  const storeAsked = useRef(false);
  const newsDecided = useRef(false);
  const { isAuthenticated } = useAuthStore();
  const onMainScreens = useSegments()[0] === "(tabs)";
  const [updateUrl, setUpdateUrl] = useState("https://play.google.com/store/apps/details?id=com.trimio.app");

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get("/trpc/appVersion.check")
      .then(async ({ data }) => {
        if (cancelled) return;
        const min = Number(data?.minVersionCode);
        const snooze = await readSnooze();
        if (cancelled) return;
        // The INSTALLED build, not the update's app.json: see lib/app-build.ts.
        // "Later" holds for a few days per build number: lib/update-prompt.ts.
        if (shouldPromptUpdate(nativeBuild().versionCode, min, snooze, Date.now())) {
          if (data.updateUrl) setUpdateUrl(data.updateUrl);
          setMinimum(min);
          storeAsked.current = true;
          setVisible(true);
        }
      })
      .catch(() => {
        // Silently ignore — an outdated version check failing should never
        // block the app from being used.
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // What's new: decided once per launch, after the version check has
  // settled, and only if the Play prompt did not ask this launch.
  useEffect(() => {
    if (!ready || !checked || storeAsked.current || newsDecided.current) return;
    if (!isAuthenticated || !onMainScreens || !ANNOUNCEMENTS.length) return;
    newsDecided.current = true;
    let cancelled = false;
    (async () => {
      const [seen, installed] = await Promise.all([readSeen(), installedAt()]);
      // Left the main screens before the answer came: decide again on return,
      // rather than lose the card for the whole launch.
      if (cancelled) { newsDecided.current = false; return; }
      if (seen === "unknown") return;
      // Everything this phone has not seen yet, as one card.
      setNews(whatsNewFor(ANNOUNCEMENTS, seen, installed, Date.now()));
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, checked, isAuthenticated, onMainScreens]);

  const gotIt = () => {
    if (news) markSeen(news.id);
    setNews(null);
  };

  const later = () => {
    setVisible(false);
    snoozeUpdatePrompt(minimum);
  };

  return (
    <>
    <Modal visible={visible && ready} transparent animationType="fade" onRequestClose={later}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <MaterialCommunityIcons name="cellphone-arrow-down" size={40} color={c.text} />
          <Text style={styles.title}>{t("updateAvailable.title")}</Text>
          <Text style={styles.message}>{t("updateAvailable.message")}</Text>
          <TouchableOpacity style={styles.updateButton} onPress={() => Linking.openURL(updateUrl)}>
            <Text style={styles.updateButtonText}>{t("updateAvailable.updateNow")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterButton} onPress={later}>
            <Text style={styles.laterButtonText}>{t("updateAvailable.later")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <Modal visible={!!news && ready} transparent animationType="fade" onRequestClose={gotIt}>
      <View style={styles.overlay}>
        <View style={[styles.card, styles.newsCard]} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">{t("whatsNew.title")}</Text>
          <View style={styles.items}>
            {news?.items.map((item) => (
              <View key={item.key} style={styles.item}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color={c.text} />
                <Text style={styles.itemText}>{t(item.key)}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.updateButton} onPress={gotIt} accessibilityRole="button">
            <Text style={styles.updateButtonText}>{t("whatsNew.gotIt")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
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
    newsCard: { alignItems: "stretch" },
    items: { gap: space.l, marginTop: space.s, marginBottom: space.xl },
    item: { flexDirection: "row", alignItems: "flex-start", gap: space.m },
    itemText: { ...typeScale.body, color: c.text, flex: 1 },
  });
}
