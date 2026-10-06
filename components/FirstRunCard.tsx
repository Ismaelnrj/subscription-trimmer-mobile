import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useTheme, useIsDark, AppColors } from "../lib/theme";
import { useCurrencyStore } from "../lib/currency-store";
import { useLanguageStore } from "../lib/language-store";
import { getRegionalPopularTemplates, prefersDachCatalogue, ServiceTemplate } from "../lib/service-templates";
import { LogoImage } from "./LogoImage";
import { marksFirst } from "../lib/brand-marks";
import { track } from "../lib/analytics";

/* THE DASHBOARD FOR SOMEBODY WITH NOTHING ON IT YET.

   Measured 2026-10-06 on production: 20 of 30 accounts never added a single
   subscription. What they landed on was a wall of zeros (0,00 this month, 0
   active, 0 alerts), a Premium upsell and, for email signups, a yellow
   warning, with the one action that mattered two taps away and called
   "expense". So the first screen after signing up asked for money before it
   had shown anything worth paying for.

   This replaces all of that while the list is empty, and only then: one
   promise, three lines saying what happens next, and the services people most
   often pay for, each a single tap into a prefilled form. The moment one
   subscription exists the ordinary dashboard comes back unchanged.

   A TILE OPENS THE FORM, IT DOES NOT SAVE. The person still sees the name,
   price and cycle and confirms them, which is the honest version: a one-tap
   save would write a catalogue price they may not pay.

   COLOURS ARE MEASURED, not chosen by eye (trimio-design check_contrast.py):
   warm white on the navy gradient 11.00:1 at its lighter end, the secondary
   line #B7C4CC 6.68:1, mint icons 5.66:1, and the eyebrow pill is navy on mint
   at 6.96:1. Mint never carries text here, it marks. */

const TILE_COUNT = 6;

type Props = { verifyBanner?: ReactNode };

export function FirstRunCard({ verifyBanner }: Props) {
  const router = useRouter();
  const c = useTheme();
  const isDark = useIsDark();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const { currency, baseCurrencyCode } = useCurrencyStore();
  const { language } = useLanguageStore();

  const preferDach = prefersDachCatalogue(currency.code, language);
  /* Rows priced in the currency the form saves in come first, so a euro
     account sees six euro rows (Microsoft 365 rather than Adobe's dollar row).
     Where the catalogue has too few, the regional list stands and the form
     leaves the price for the person to type, see applyTemplate.
     Services with a bundled mark lead, so the row reads as logos; a popular
     service without one (Disney+, Amazon Prime) still fills a remaining slot
     with its category icon rather than being dropped. */
  const tiles = useMemo(() => {
    const popular = getRegionalPopularTemplates(preferDach);
    const sameCurrency = popular.filter((tpl) => tpl.currency === baseCurrencyCode);
    return marksFirst(sameCurrency.length >= TILE_COUNT ? sameCurrency : popular).slice(0, TILE_COUNT);
  }, [preferDach, baseCurrencyCode]);

  const openTemplate = (tpl: ServiceTemplate) => {
    // The action only, never which service: that is what somebody pays for.
    track("first_run_action", { action: "tile" });
    router.push({ pathname: "/(tabs)/subscriptions", params: { from: "template", templateId: tpl.id } });
  };
  const openOther = () => {
    track("first_run_action", { action: "other" });
    router.push({ pathname: "/(tabs)/subscriptions", params: { from: "fab" } });
  };
  const openPaste = () => {
    track("first_run_action", { action: "paste" });
    router.push({ pathname: "/(tabs)/subscriptions", params: { from: "paste" } });
  };

  const steps = [
    { icon: "plus-circle-outline", text: t("firstRun.step1") },
    { icon: "bell-ring-outline", text: t("firstRun.step2") },
    { icon: "content-cut", text: t("firstRun.step3") },
  ];

  return (
    <View>
      <LinearGradient
        colors={isDark ? (["#1A3344", "#1F3B4C"] as const) : (["#142B3A", "#1C3A4E"] as const)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.trim} />
        <View style={styles.eyebrow}>
          <Text style={styles.eyebrowText}>{t("firstRun.eyebrow")}</Text>
        </View>
        <Text style={styles.title}>{t("firstRun.title")}</Text>
        <Text style={styles.subtitle}>{t("firstRun.subtitle")}</Text>

        <View style={styles.steps}>
          {steps.map((s) => (
            <View key={s.icon} style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <MaterialCommunityIcons name={s.icon as any} size={16} color="#55C6A3" />
              </View>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <Text style={styles.sectionLabel}>{t("firstRun.popular")}</Text>
      <View style={styles.grid}>
        {tiles.map((tpl) => (
          <TouchableOpacity
            key={tpl.id}
            style={styles.tile}
            onPress={() => openTemplate(tpl)}
            accessibilityRole="button"
            accessibilityLabel={t("firstRun.a11yTile", { name: tpl.name })}
          >
            <LogoImage name={tpl.name} category={tpl.category} size={40} />
            <Text style={styles.tileName} numberOfLines={2}>{tpl.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={openOther} accessibilityRole="button">
          <MaterialCommunityIcons name="magnify" size={18} color={c.text} />
          <Text style={styles.actionText} numberOfLines={2}>{t("firstRun.otherService")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={openPaste} accessibilityRole="button">
          <MaterialCommunityIcons name="email-fast-outline" size={18} color={c.text} />
          <Text style={styles.actionText} numberOfLines={2}>{t("firstRun.pasteEmail")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.privacyRow}>
        <MaterialCommunityIcons name="shield-check-outline" size={16} color={c.success} />
        <Text style={styles.privacyText}>{t("firstRun.privacy")}</Text>
      </View>

      {/* Below the tiles, not between them and the hero: on a real phone the
          banner pushed the whole tile row under the fold, and the tiles are
          the one thing this card exists to get tapped. */}
      {verifyBanner ? <View style={styles.verifySlot}>{verifyBanner}</View> : null}
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    hero: {
      borderRadius: 24,
      padding: 22,
      paddingTop: 26,
      overflow: "hidden",
      marginBottom: 20,
    },
    // A short mint rule at the top edge: a mark, not a carrier of text.
    trim: { position: "absolute", top: 0, left: 22, width: 44, height: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: "#55C6A3" },
    eyebrow: {
      alignSelf: "flex-start",
      backgroundColor: "#55C6A3",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 14,
    },
    eyebrowText: { fontSize: 12, fontWeight: "700", fontFamily: "Montserrat-Bold", color: "#142B3A", letterSpacing: 0.3 },
    title: { fontSize: 25, lineHeight: 32, fontWeight: "800", fontFamily: "Montserrat-ExtraBold", color: "#F7F6F1", marginBottom: 8 },
    subtitle: { fontSize: 15, lineHeight: 22, color: "#B7C4CC", marginBottom: 18 },
    steps: { gap: 10 },
    stepRow: { flexDirection: "row", alignItems: "center" },
    stepIcon: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: "rgba(85,198,163,0.14)",
      justifyContent: "center", alignItems: "center", marginRight: 12,
    },
    stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: "#F7F6F1", fontFamily: "Montserrat-Medium" },
    sectionLabel: { fontSize: 16, fontWeight: "600", fontFamily: "Montserrat-SemiBold", color: c.text, marginBottom: 12 },
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
    tile: {
      width: "31.5%",
      minHeight: 104,
      backgroundColor: c.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    tileName: { marginTop: 8, fontSize: 12, lineHeight: 16, color: c.text, textAlign: "center", fontFamily: "Montserrat-SemiBold" },
    actions: { flexDirection: "row", gap: 10, marginTop: 14 },
    actionButton: {
      flex: 1,
      minHeight: 48,
      paddingVertical: 6,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 10,
    },
    /* Two lines, not one: on a real phone with a larger system font "Another
       service" read "Another servi..." on the first screen a new user sees.
       minHeight on the button keeps the row 48dp either way. */
    actionText: { fontSize: 14, lineHeight: 18, color: c.text, fontFamily: "Montserrat-SemiBold", flexShrink: 1, textAlign: "center" },
    privacyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, paddingHorizontal: 4 },
    verifySlot: { marginTop: 18 },
    privacyText: { flex: 1, fontSize: 13, lineHeight: 18, color: c.textSecondary },
  });
}
