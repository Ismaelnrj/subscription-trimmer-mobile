import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getCancellationGuide, hasCancellationGuide } from "../lib/cancellation-guides";
import { track } from "../lib/analytics";
import { useTheme, AppColors } from "../lib/theme";
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
          <MaterialCommunityIcons name="information-outline" size={16} color={c.primary} style={{ marginTop: 1 }} />
          <Text style={styles.noteText}>{guide.note}</Text>
        </View>
      )}

      <View style={styles.stepsContainer}>
        {guide.steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {!!guide.url && (
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() =>
            Linking.openURL(guide.url).catch(() =>
              Alert.alert(t("cancelGuide.errOpenTitle"), t("cancelGuide.errOpenMessage", { url: guide.url }))
            )
          }
        >
          <MaterialCommunityIcons name="open-in-new" size={18} color="#FFFFFF" />
          <Text style={styles.linkButtonText}>{t("cancelGuide.openPage")}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.footerNote}>
        <MaterialCommunityIcons name="shield-check-outline" size={14} color={c.textMuted} />
        <Text style={styles.footerNoteText}>{t("cancelGuide.footerNote")}</Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 48 },
    heading: { fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 },
    noteBox: {
      flexDirection: "row", gap: 8, backgroundColor: c.primaryLight,
      borderRadius: 12, padding: 14, marginBottom: 24, alignItems: "flex-start",
    },
    noteText: { flex: 1, fontSize: 13, color: c.text, lineHeight: 20 },
    stepsContainer: { gap: 16, marginBottom: 32 },
    stepRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
    stepNumber: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: c.primary, justifyContent: "center", alignItems: "center", flexShrink: 0,
    },
    stepNumberText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    stepText: { flex: 1, fontSize: 14, color: c.text, lineHeight: 22, paddingTop: 4 },
    linkButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, backgroundColor: c.danger, borderRadius: 12,
      paddingVertical: 15, marginBottom: 20,
      shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    },
    linkButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
    footerNote: {
      flexDirection: "row", gap: 8, alignItems: "flex-start",
      backgroundColor: c.card, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: c.border,
    },
    footerNoteText: { flex: 1, fontSize: 12, color: c.textMuted, lineHeight: 17 },
  });
}
