import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
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

   REDONE 2026-11-07 in the dashboard's own language: open on the page, theme
   tokens only. It was a navy gradient block with a mint trim tab, an eyebrow
   pill and an ExtraBold title, the one screen every new account sees, and it
   looked like a different app from the dashboard that replaces it. */

const TILE_COUNT = 6;

type Props = { verifyBanner?: ReactNode };

export function FirstRunCard({ verifyBanner }: Props) {
  const router = useRouter();
  const c = useTheme();
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
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t("firstRun.eyebrow")}</Text>
        <Text style={styles.title}>{t("firstRun.title")}</Text>
        <Text style={styles.subtitle}>{t("firstRun.subtitle")}</Text>
      </View>

      <View style={styles.card}>
        {steps.map((s, i) => (
          <View key={s.icon} style={[styles.stepRow, i > 0 && styles.rowDivider]}>
            <MaterialCommunityIcons name={s.icon as any} size={20} color={c.textSecondary} />
            <Text style={styles.stepText}>{s.text}</Text>
          </View>
        ))}
      </View>

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

      {/* Below the tiles, not between them and the header: on a real phone the
          banner pushed the whole tile row under the fold, and the tiles are
          the one thing this card exists to get tapped. */}
      {verifyBanner ? <View style={styles.verifySlot}>{verifyBanner}</View> : null}
    </View>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    header: { marginBottom: space.l },
    eyebrow: { ...typeScale.caption, color: c.textSecondary },
    title: { ...typeScale.title, fontSize: 24, lineHeight: 31, color: c.text, marginTop: space.xs },
    subtitle: { ...typeScale.body, color: c.textSecondary, marginTop: space.s },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, paddingHorizontal: space.l,
    },
    stepRow: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 52, paddingVertical: space.m },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    stepText: { ...typeScale.body, flex: 1, color: c.text },
    sectionLabel: { ...typeScale.heading, color: c.text, marginTop: space.xl, marginBottom: space.s },
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.s },
    tile: {
      width: "31.5%",
      minHeight: 104,
      backgroundColor: c.card,
      borderRadius: radius.m,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingVertical: space.m,
      paddingHorizontal: space.s,
      alignItems: "center",
      justifyContent: "center",
    },
    tileName: { ...typeScale.label, marginTop: space.s, color: c.text, textAlign: "center" },
    actions: { flexDirection: "row", gap: space.s, marginTop: space.m },
    actionButton: {
      flex: 1,
      minHeight: 48,
      paddingVertical: space.xs,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space.s,
      borderRadius: radius.m,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: space.m,
    },
    /* Two lines, not one: on a real phone with a larger system font "Another
       service" read "Another servi..." on the first screen a new user sees.
       minHeight on the button keeps the row 48dp either way. */
    actionText: { ...typeScale.label, color: c.text, flexShrink: 1, textAlign: "center" },
    privacyRow: { flexDirection: "row", alignItems: "center", gap: space.s, marginTop: space.l },
    verifySlot: { marginTop: space.l },
    privacyText: { ...typeScale.caption, flex: 1, color: c.textSecondary },
  });
}
