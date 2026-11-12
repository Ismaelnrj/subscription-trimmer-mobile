import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getCancellationGuide, hasCancellationGuide } from "../lib/cancellation-guides";
import { track } from "../lib/analytics";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
import { useLanguageStore } from "../lib/language-store";

export default function CancelGuideScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const guide = getCancellationGuide(name ?? "", language);

  /* DELIBERATELY SENDS NO SERVICE NAME. `subscription_added` already sets the
     rule for this app: billing cycle, category and is_first_subscription, never
     the name or the price. A subscription name is the user's own data and the
     product's whole claim is that we do not see it, so "viewed the Netflix
     guide" cannot go to PostHog either.
     `matched` is what the question actually needs: whether a specific guide was
     shown or the generic fallback was. That gives both the usage rate and the
     coverage rate across the 41 guides.
     WHICH MISSING GUIDE TO WRITE NEXT is answerable WITHOUT any telemetry, and
     better: every subscription name is already in Postgres, so one query over
     `subscriptions.name` against the guide keys ranks the gaps by real demand.
     Do that rather than widening this event. */
  useEffect(() => {
    track("cancel_guide_viewed", { matched: hasCancellationGuide(name ?? "") });
  }, [name]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>
        {name ? t("cancelGuide.heading", { name }) : t("cancelGuide.headingGeneric")}
      </Text>

      {guide.note && (
        <View style={styles.noteBox}>
          <MaterialCommunityIcons name="information-outline" size={18} color={c.textSecondary} style={{ marginTop: 1 }} />
          <Text style={styles.noteText}>{guide.note}</Text>
        </View>
      )}

      {/* The steps as one numbered list in a card, each number in an ink
          circle: the reader follows them with the service's own app open
          beside this, so the number is what the eye returns to. */}
      <View style={styles.card}>
        {guide.steps.map((step, i) => (
          <View key={i} style={[styles.stepRow, i > 0 && styles.rowDivider]}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {!!guide.url && (
        /* Ink, not danger red: white on dark danger (#F0857A) measured 2.52:1,
           under even the large text floor, on the one button this feature
           exists for. Opening a page is not a destructive act anyway. */
        <TouchableOpacity
          style={styles.linkButton}
          accessibilityRole="link"
          onPress={() =>
            Linking.openURL(guide.url).catch(() =>
              Alert.alert(t("cancelGuide.errOpenTitle"), t("cancelGuide.errOpenMessage", { url: guide.url }))
            )
          }
        >
          <MaterialCommunityIcons name="open-in-new" size={18} color={c.bg} />
          <Text style={styles.linkButtonText}>{t("cancelGuide.openPage")}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.footerNote}>
        <MaterialCommunityIcons name="shield-check-outline" size={16} color={c.textSecondary} />
        <Text style={styles.footerNoteText}>{t("cancelGuide.footerNote")}</Text>
      </View>
    </ScrollView>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: space.l, paddingTop: space.xl, paddingBottom: 48 },
    heading: { ...typeScale.title, color: c.text, marginBottom: space.l },
    noteBox: { flexDirection: "row", gap: space.s, marginBottom: space.l, alignItems: "flex-start" },
    noteText: { ...typeScale.body, flex: 1, color: c.textSecondary },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder, paddingHorizontal: space.l, marginBottom: space.xl,
    },
    stepRow: { flexDirection: "row", gap: space.m, alignItems: "flex-start", paddingVertical: space.l },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    stepNumber: {
      width: 28, height: 28, borderRadius: radius.pill,
      backgroundColor: c.text, justifyContent: "center", alignItems: "center", flexShrink: 0,
    },
    stepNumberText: { ...typeScale.label, color: c.bg },
    stepText: { ...typeScale.body, flex: 1, color: c.text, paddingTop: 3 },
    linkButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: space.s, backgroundColor: c.text, borderRadius: radius.m, minHeight: 52, marginBottom: space.xl,
    },
    linkButtonText: { ...typeScale.bodyStrong, color: c.bg },
    footerNote: { flexDirection: "row", gap: space.s, alignItems: "flex-start" },
    footerNoteText: { ...typeScale.caption, flex: 1, color: c.textSecondary },
  });
}
