import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { useTheme, AppColors } from "../lib/theme";

/* The canonical host, not the Railway one: the bare service hostname was
   showing in a privacy context, and it breaks the day the service is renamed.
   Language aware too, because /privacy-policy is English only and a German
   reader was being sent to it regardless of the app's language. */
const PRIVACY_URL = (lang: string) =>
  lang?.startsWith("de")
    ? "https://www.subtrimio.com/de/datenschutz"
    : "https://www.subtrimio.com/privacy-policy";

/* Four honest states rather than a boolean, the same reasoning as the purchase
   screen's price: "checking" and "found nothing" and "could not reach the
   server" are three different answers and collapsing them is how a silent
   failure reads as success. There is no "idle" success state on purpose, since
   a successful fetch reloads the app and this component stops existing. */
type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "downloading" }
  | { kind: "uptodate" }
  | { kind: "error"; message: string };

export default function HelpSupportScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t, i18n } = useTranslation();

  const FAQ = [
    { q: t("helpSupport.faq1Q"), a: t("helpSupport.faq1A") },
    { q: t("helpSupport.faq2Q"), a: t("helpSupport.faq2A") },
    { q: t("helpSupport.faq3Q"), a: t("helpSupport.faq3A") },
    { q: t("helpSupport.faq4Q"), a: t("helpSupport.faq4A") },
    { q: t("helpSupport.faq5Q"), a: t("helpSupport.faq5A") },
    { q: t("helpSupport.faq6Q"), a: t("helpSupport.faq6A") },
  ];

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  const [updateState, setUpdateState] = useState<UpdateState>({ kind: "idle" });
  const updateBusy = updateState.kind === "checking" || updateState.kind === "downloading";

  /* WHY THIS EXISTS. `updates.fallbackToCacheTimeout` is 0, so the app never
     waits at startup: it launches the bundle it already has, fetches in the
     background, and applies on the NEXT launch. That is the right trade for a
     cold start and it means confirming a publish took two force stops and two
     launches, with no way to tell a slow download from a failed one. This
     collapses it to one tap.
     IT RELOADS IMMEDIATELY rather than offering to restart later. Safe here
     and nowhere else: Help & Support holds no unsaved input, so there is
     nothing a restart can discard. Do not lift this onto a screen with a
     form. */
  const checkForUpdate = async () => {
    if (updateBusy) return;
    setUpdateState({ kind: "checking" });
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setUpdateState({ kind: "uptodate" });
        return;
      }
      setUpdateState({ kind: "downloading" });
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      /* The message is the diagnostic, so it is shown rather than swallowed
         into a generic string. This panel exists to be read. */
      setUpdateState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const updateStatusLine =
    updateState.kind === "checking" ? t("helpSupport.checkingForUpdates")
    : updateState.kind === "downloading" ? t("helpSupport.downloadingUpdate")
    : updateState.kind === "uptodate" ? t("helpSupport.upToDate")
    : updateState.kind === "error" ? t("helpSupport.updateCheckFailed", { message: updateState.message })
    : null;

  return (
    <>
      <Stack.Screen options={{ title: t("screenTitles.helpSupport") }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <Text style={styles.sectionTitle}>{t("helpSupport.faq")}</Text>
          <View style={styles.faqCard}>
            {FAQ.map((item, i) => (
              <View key={i} style={[styles.faqItem, i === FAQ.length - 1 && styles.faqItemLast]}>
                <TouchableOpacity style={styles.faqQuestion} onPress={() => toggle(i)}>
                  <Text style={styles.faqQuestionText}>{item.q}</Text>
                  <MaterialCommunityIcons name={openIndex === i ? "chevron-up" : "chevron-down"} size={20} color={c.textMuted} />
                </TouchableOpacity>
                {openIndex === i && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{item.a}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>{t("helpSupport.contactUs")}</Text>
          <View style={styles.contactCard}>
            <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL("mailto:Trimio@subtrimio.com")}>
              <MaterialCommunityIcons name="email-outline" size={22} color={c.primary} />
              <View>
                <Text style={styles.contactLabel}>{t("helpSupport.emailSupport")}</Text>
                <Text style={styles.contactValue}>Trimio@subtrimio.com</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactItem, styles.contactItemLast]} onPress={() => Linking.openURL(PRIVACY_URL(i18n.language))}>
              <MaterialCommunityIcons name="shield-outline" size={22} color={c.primary} />
              <View>
                <Text style={styles.contactLabel}>{t("helpSupport.privacyPolicy")}</Text>
                <Text style={styles.contactValue}>{t("helpSupport.viewPrivacyPolicy")}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <Text style={styles.contactNote}>{t("helpSupport.footerNote")}</Text>

          <Text style={styles.sectionTitle}>Build Info</Text>
          <View style={styles.contactCard}>
            <View style={{ padding: 16, gap: 6 }}>
              <Text style={styles.debugText}>App version: {Constants.expoConfig?.version ?? "n/a"}</Text>
              <Text style={styles.debugText}>Native build: {Constants.expoConfig?.android?.versionCode ?? "n/a"}</Text>
              <Text style={styles.debugText}>Channel: {Updates.channel ?? "n/a"}</Text>
              <Text style={styles.debugText}>Runtime version: {Updates.runtimeVersion ?? "n/a"}</Text>
              <Text style={styles.debugText}>Embedded launch (no OTA applied): {String(Updates.isEmbeddedLaunch)}</Text>
              <Text style={styles.debugText}>Update ID: {Updates.updateId ?? "none"}</Text>
              <Text style={styles.debugText}>Update published: {Updates.createdAt?.toISOString() ?? "n/a"}</Text>
            </View>
            {Updates.isEnabled ? (
              <TouchableOpacity
                style={styles.updateButton}
                onPress={checkForUpdate}
                disabled={updateBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: updateBusy, busy: updateBusy }}
                accessibilityLabel={t("helpSupport.checkForUpdates")}
              >
                {updateBusy
                  ? <ActivityIndicator size="small" color={c.primary} />
                  : <MaterialCommunityIcons name="cloud-download-outline" size={20} color={c.primary} />}
                <Text style={styles.updateButtonText}>{t("helpSupport.checkForUpdates")}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.updateStatus}>{t("helpSupport.updatesDisabled")}</Text>
            )}
            {updateStatusLine && <Text style={styles.updateStatus}>{updateStatusLine}</Text>}
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
    sectionTitle: {
      fontSize: 12, fontWeight: "600", color: c.textSecondary, textTransform: "uppercase",
      letterSpacing: 0.5, marginBottom: 8, marginTop: 8,
    },
    faqCard: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: "hidden", marginBottom: 16 },
    faqItem: { borderBottomWidth: 1, borderBottomColor: c.border },
    faqItemLast: { borderBottomWidth: 0 },
    faqQuestion: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
    faqQuestionText: { fontSize: 14, fontWeight: "600", color: c.text, flex: 1, marginRight: 8 },
    faqAnswer: { paddingHorizontal: 16, paddingBottom: 16 },
    faqAnswerText: { fontSize: 13, color: c.textSecondary, lineHeight: 20 },
    contactCard: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: "hidden", marginBottom: 16 },
    contactItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
    contactItemLast: { borderBottomWidth: 0 },
    contactLabel: { fontSize: 14, fontWeight: "500", color: c.text },
    contactValue: { fontSize: 12, color: c.primary, marginTop: 2 },
    contactNote: { fontSize: 11, color: c.textMuted, lineHeight: 16, marginTop: -8, marginBottom: 8 },
    debugText: { fontSize: 11, color: c.textMuted, fontFamily: "monospace" },
    /* minHeight rather than padding: padding leaves the height at the mercy of
       the font size, and 48 is Android's floor. */
    updateButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      minHeight: 48, paddingHorizontal: 16,
      borderTopWidth: 1, borderTopColor: c.border,
    },
    updateButtonText: { fontSize: 14, fontWeight: "600", color: c.primary },
    updateStatus: { fontSize: 11, color: c.textMuted, lineHeight: 16, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, textAlign: "center" },
  });
}
