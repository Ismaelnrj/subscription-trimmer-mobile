import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme, AppColors } from "../lib/theme";

export default function HelpSupportScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const FAQ = [
    { q: t("helpSupport.faq1Q"), a: t("helpSupport.faq1A") },
    { q: t("helpSupport.faq2Q"), a: t("helpSupport.faq2A") },
    { q: t("helpSupport.faq3Q"), a: t("helpSupport.faq3A") },
    { q: t("helpSupport.faq4Q"), a: t("helpSupport.faq4A") },
    { q: t("helpSupport.faq5Q"), a: t("helpSupport.faq5A") },
    { q: t("helpSupport.faq6Q"), a: t("helpSupport.faq6A") },
  ];

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <>
      <Stack.Screen options={{ title: "Help & Support" }} />
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
            <TouchableOpacity style={[styles.contactItem, styles.contactItemLast]} onPress={() => Linking.openURL("https://subscription-trimmer-mobile-production.up.railway.app/privacy-policy")}>
              <MaterialCommunityIcons name="shield-outline" size={22} color={c.primary} />
              <View>
                <Text style={styles.contactLabel}>{t("helpSupport.privacyPolicy")}</Text>
                <Text style={styles.contactValue}>{t("helpSupport.viewPrivacyPolicy")}</Text>
              </View>
            </TouchableOpacity>
          </View>
          <Text style={styles.contactNote}>{t("helpSupport.footerNote")}</Text>
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
  });
}
