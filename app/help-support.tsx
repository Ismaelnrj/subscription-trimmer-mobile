import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTheme, AppColors } from "../lib/theme";

const FAQ = [
  { q: "How do I add a subscription?", a: "Go to the Subscriptions tab and tap the '+ Add Subscription' button. Fill in the name, price, billing cycle and category." },
  { q: "Can I edit a subscription?", a: "Yes. On the Subscriptions tab, tap the pencil icon on any subscription to edit its details." },
  { q: "How is monthly spend calculated?", a: "Weekly subscriptions are annualised (×52/12), yearly subscriptions are divided by 12, and monthly ones are taken as-is." },
  { q: "Will my data be saved if I uninstall the app?", a: "Yes. Your data is stored securely on our server, so reinstalling the app and logging in restores everything." },
  { q: "How do I get renewal alerts?", a: "Go to Profile → Notification Preferences and enable Renewal Alerts. You will be notified 7 days before any subscription renews." },
  { q: "How do I delete my account?", a: "Go to Profile → Account Settings and scroll to the bottom. Tap 'Delete Account' and confirm. Your account and all data will be permanently deleted immediately. You can also email Trimio@subtrimio.com." },
];

export default function HelpSupportScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const c = useTheme();
  const styles = makeStyles(c);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <>
      <Stack.Screen options={{ title: "Help & Support" }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
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

          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.contactCard}>
            <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL("mailto:Trimio@subtrimio.com")}>
              <MaterialCommunityIcons name="email-outline" size={22} color={c.primary} />
              <View>
                <Text style={styles.contactLabel}>Email Support</Text>
                <Text style={styles.contactValue}>Trimio@subtrimio.com</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactItem, styles.contactItemLast]} onPress={() => Linking.openURL("https://subscription-trimmer-mobile-production.up.railway.app/privacy-policy")}>
              <MaterialCommunityIcons name="shield-outline" size={22} color={c.primary} />
              <View>
                <Text style={styles.contactLabel}>Privacy Policy</Text>
                <Text style={styles.contactValue}>View our privacy policy</Text>
              </View>
            </TouchableOpacity>
          </View>
          <Text style={styles.contactNote}>
            Trimio@subtrimio.com is our official support address — yes, the domain is "subtrimio.com" even though the app is called Trimio.
          </Text>
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
