import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useState } from "react";

const FAQ = [
  {
    q: "How do I add a subscription?",
    a: "Go to the Subscriptions tab and tap the '+ Add Subscription' button. Fill in the name, price, billing cycle and category.",
  },
  {
    q: "Can I edit a subscription?",
    a: "Yes. On the Subscriptions tab, tap the pencil icon on any subscription to edit its details.",
  },
  {
    q: "How is monthly spend calculated?",
    a: "Weekly subscriptions are annualised (×52/12), yearly subscriptions are divided by 12, and monthly ones are taken as-is.",
  },
  {
    q: "Will my data be saved if I uninstall the app?",
    a: "Yes. Your data is stored securely on our server, so reinstalling the app and logging in restores everything.",
  },
  {
    q: "How do I get renewal alerts?",
    a: "Go to Profile → Notification Preferences and enable Renewal Alerts. You will be notified 7 days before any subscription renews.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Profile → Account Settings and scroll to the bottom. Tap 'Delete Account' and confirm. Your account and all data will be permanently deleted immediately. You can also email Trimio@subtrimio.com.",
  },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 12, fontWeight: "600", color: "#6B7280", textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 8, marginTop: 8,
  },
  faqCard: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden", marginBottom: 16 },
  faqItem: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  faqItemLast: { borderBottomWidth: 0 },
  faqQuestion: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16,
  },
  faqQuestionText: { fontSize: 14, fontWeight: "600", color: "#1F2937", flex: 1, marginRight: 8 },
  faqAnswer: { paddingHorizontal: 16, paddingBottom: 16 },
  faqAnswerText: { fontSize: 13, color: "#6B7280", lineHeight: 20 },
  contactCard: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden", marginBottom: 16 },
  contactItem: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 16,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  contactItemLast: { borderBottomWidth: 0 },
  contactLabel: { fontSize: 14, fontWeight: "500", color: "#1F2937" },
  contactValue: { fontSize: 12, color: "#4F46E5", marginTop: 2 },
});

export default function HelpSupportScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
                  <MaterialCommunityIcons
                    name={openIndex === i ? "chevron-up" : "chevron-down"}
                    size={20} color="#9CA3AF"
                  />
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
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => Linking.openURL("mailto:Trimio@subtrimio.com")}
            >
              <MaterialCommunityIcons name="email-outline" size={22} color="#4F46E5" />
              <View>
                <Text style={styles.contactLabel}>Email Support</Text>
                <Text style={styles.contactValue}>Trimio@subtrimio.com</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactItem, styles.contactItemLast]}
              onPress={() => Linking.openURL("https://trimio-privacyp.netlify.app")}
            >
              <MaterialCommunityIcons name="shield-outline" size={22} color="#4F46E5" />
              <View>
                <Text style={styles.contactLabel}>Privacy Policy</Text>
                <Text style={styles.contactValue}>trimio-privacyp.netlify.app</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
