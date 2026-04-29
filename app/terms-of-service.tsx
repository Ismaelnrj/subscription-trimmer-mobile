import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Stack } from "expo-router";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By downloading or using Trimio, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.",
  },
  {
    title: "2. Description of Service",
    body: "Trimio is a personal subscription tracking app that helps you monitor, organise, and manage your recurring subscriptions. We do not connect to your bank, payment providers, or third-party services — all subscription data is entered manually by you.",
  },
  {
    title: "3. User Accounts",
    body: "You must provide a valid email address to create an account. You are responsible for maintaining the confidentiality of your password and for all activity that occurs under your account. You must notify us immediately of any unauthorised use at Trimio@subtrimio.com.",
  },
  {
    title: "4. Free and Premium Plans",
    body: "Trimio offers a free plan with up to 5 subscriptions and a one-time Premium purchase that unlocks additional features. Premium is a non-recurring, one-time payment. Refunds are subject to the Google Play Store refund policy.",
  },
  {
    title: "5. User Data",
    body: "You retain ownership of all subscription data you enter into Trimio. We store your data securely to provide the service. We do not sell your personal data to third parties. For full details, see our Privacy Policy.",
  },
  {
    title: "6. Acceptable Use",
    body: "You agree not to misuse the service, attempt to access other users' data, reverse-engineer the app, or use the service for any unlawful purpose. We reserve the right to suspend accounts that violate these terms.",
  },
  {
    title: "7. Accuracy of Information",
    body: "Trimio displays information based on what you manually enter. We are not responsible for inaccurate subscription data, missed billing dates, or financial decisions made based on information shown in the app.",
  },
  {
    title: "8. Affiliate Links & Deals",
    body: "The Deals section may contain affiliate links. If you sign up for a service through these links, Trimio may earn a small commission at no extra cost to you. All deals are independently selected.",
  },
  {
    title: "9. Modifications to the Service",
    body: "We reserve the right to modify or discontinue the service at any time. We will make reasonable efforts to notify users of significant changes. Continued use of the app after changes constitutes acceptance of the updated terms.",
  },
  {
    title: "10. Termination",
    body: "You may delete your account at any time from Profile → Account Settings. Upon deletion, all your data is permanently removed from our servers. We may terminate accounts that violate these terms.",
  },
  {
    title: "11. Limitation of Liability",
    body: "Trimio is provided 'as is' without warranties of any kind. To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app.",
  },
  {
    title: "12. Contact",
    body: "If you have questions about these terms, please contact us at Trimio@subtrimio.com.",
  },
];

export default function TermsOfServiceScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Terms of Service", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.updated}>Last updated: April 2026</Text>
          <Text style={styles.intro}>
            Please read these Terms of Service carefully before using Trimio.
          </Text>
          {SECTIONS.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              <Text style={styles.sectionBody}>{s.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 20, paddingBottom: 48 },
  updated: { fontSize: 12, color: "#9CA3AF", marginBottom: 12 },
  intro: {
    fontSize: 14, color: "#374151", lineHeight: 22,
    marginBottom: 24, fontStyle: "italic",
  },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937", marginBottom: 6 },
  sectionBody: { fontSize: 13, color: "#6B7280", lineHeight: 21 },
});
