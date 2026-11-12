import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as Updates from "expo-updates";
import { nativeBuild } from "../lib/app-build";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";

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
   failure reads as success. "ready" means downloaded and waiting for the next
   cold start, which is a fourth answer, not a success that needs no words. */
type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "downloading" }
  | { kind: "ready" }
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
     collapses it to one tap and one reopen.
     IT NEVER CALLS Updates.reloadAsync, and that is measured, not cautious.
     It used to, and on 2026-11-08 the owner's phone crashed on this button
     with SIGBUS in FreeType's TT_RunIns under FT_Load_Glyph. The cause is
     expo-asset 11.1.7 (SDK 53): every font load copies the font from the APK
     into cache/ExponentAsset-<md5>.ttf, and its "is the cached copy current"
     check hashes zero bytes, so it never matches and the file is REWRITTEN IN
     PLACE every time. On a cold start nothing has it open. A reloadAsync keeps
     the process, so the old screen's typeface still has that file mapped while
     the new bundle truncates and rewrites it; a glyph read from the truncated
     part is a bus error. Reproduced on the real Montserrat-Regular.ttf with
     FreeType: same signal, same top frame. A cold start is a new process, so
     it cannot happen there. expo-asset 12 (SDK 54) reads the file before
     comparing, so reconsider this after that upgrade, not before. */
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
      /* Downloaded and marked ready: expo-updates launches the newest ready
         update on the next cold start, so one reopen applies it. */
      setUpdateState({ kind: "ready" });
    } catch (e) {
      /* The message is the diagnostic, so it is shown rather than swallowed
         into a generic string. This panel exists to be read. */
      setUpdateState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const updateStatusLine =
    updateState.kind === "checking" ? t("helpSupport.checkingForUpdates")
    : updateState.kind === "downloading" ? t("helpSupport.downloadingUpdate")
    : updateState.kind === "ready" ? t("helpSupport.updateReady")
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
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => toggle(i)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: openIndex === i }}
                >
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
              <MaterialCommunityIcons name="email-outline" size={20} color={c.textSecondary} />
              <View>
                <Text style={styles.contactLabel}>{t("helpSupport.emailSupport")}</Text>
                <Text style={styles.contactValue}>Trimio@subtrimio.com</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactItem, styles.contactItemLast]} onPress={() => Linking.openURL(PRIVACY_URL(i18n.language))}>
              <MaterialCommunityIcons name="shield-outline" size={20} color={c.textSecondary} />
              <View>
                <Text style={styles.contactLabel}>{t("helpSupport.privacyPolicy")}</Text>
                <Text style={styles.contactValue}>{t("helpSupport.viewPrivacyPolicy")}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <Text style={styles.contactNote}>{t("helpSupport.footerNote")}</Text>

          <Text style={styles.sectionTitle}>Build Info</Text>
          <View style={styles.contactCard}>
            <View style={styles.debugBlock}>
              <Text style={styles.debugText}>App version: {nativeBuild().version ?? "n/a"}</Text>
              <Text style={styles.debugText}>Native build: {nativeBuild().versionCode ?? "n/a"}</Text>
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
                  ? <ActivityIndicator size="small" color={c.text} />
                  : <MaterialCommunityIcons name="cloud-download-outline" size={20} color={c.text} />}
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

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: space.xxl },
    sectionTitle: { ...typeScale.heading, color: c.text, marginTop: space.xl, marginBottom: space.s },
    faqCard: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder, overflow: "hidden",
    },
    faqItem: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    faqItemLast: { borderBottomWidth: 0 },
    faqQuestion: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      minHeight: 56, paddingHorizontal: space.l, paddingVertical: space.m,
    },
    faqQuestionText: { ...typeScale.bodyStrong, color: c.text, flex: 1, marginRight: space.s },
    faqAnswer: { paddingHorizontal: space.l, paddingBottom: space.l },
    faqAnswerText: { ...typeScale.body, color: c.textSecondary },
    contactCard: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder, overflow: "hidden",
    },
    contactItem: {
      flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 64,
      paddingHorizontal: space.l, paddingVertical: space.m,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    contactItemLast: { borderBottomWidth: 0 },
    contactLabel: { ...typeScale.body, color: c.text },
    contactValue: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },
    contactNote: { ...typeScale.caption, color: c.textSecondary, marginTop: space.s },
    debugBlock: { padding: space.l, gap: space.xs },
    /* Monospace and English on purpose: these are EAS's own field names, quoted
       verbatim by the publish confirmation procedure. 12, not 11, the floor. */
    debugText: { fontSize: 12, lineHeight: 17, color: c.textSecondary, fontFamily: "monospace" },
    /* minHeight rather than padding: padding leaves the height at the mercy of
       the font size, and 48 is Android's floor. */
    updateButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s,
      minHeight: 48, paddingHorizontal: space.l,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    },
    updateButtonText: { ...typeScale.bodyStrong, color: c.text },
    updateStatus: { ...typeScale.caption, color: c.textSecondary, paddingHorizontal: space.l, paddingTop: space.xs, paddingBottom: space.m, textAlign: "center" },
  });
}
