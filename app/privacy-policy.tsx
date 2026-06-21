import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useTheme, AppColors } from "../lib/theme";

const SECTIONS = [
  { title: "1. Information We Collect", body: "We collect: account information (your name and email address when you register); subscription data (the subscription names, prices, billing cycles, and dates you manually enter); app settings (your currency preference, budget goal, and notification settings); and purchase information (whether you hold an active Premium entitlement via RevenueCat — we never see your payment card details)." },
  { title: "2. How We Use Your Information", body: "We use your information solely to provide and improve the Trimio service: to display your subscriptions, spending analytics, and recommendations; to send renewal reminder notifications you have opted into; to verify your Premium status and unlock paid features; and to respond to support requests. We do not sell your data, share it with advertisers, or use it for any purpose beyond operating the app." },
  { title: "3. Data Storage and Security", body: "Your data is stored on secure servers hosted by Railway (railway.app). Passwords are hashed using bcrypt and never stored in plain text. All communication between the app and our servers uses HTTPS encryption." },
  { title: "4. Third-Party Services", body: "Trimio uses RevenueCat (manages Premium purchase verification), Sentry (collects anonymised crash reports to help us fix bugs), and Google Play Billing (processes in-app purchases), each governed by their own privacy policies." },
  { title: "5. Notifications", body: "If you grant notification permission, we may send you reminders before subscription renewal dates. You can manage or disable notifications at any time in the app under Profile → Notification Preferences, or in your device settings." },
  { title: "6. Your Rights", body: "Under the General Data Protection Regulation (GDPR) and applicable law, you have the right to access all data stored in your account via the app; rectify any inaccurate or incomplete data; erase your account and data entirely (this permanently removes all your data from our systems); restrict or object to certain processing of your data; export your subscription data (if the export feature is enabled on your plan); and lodge a complaint with your local data protection supervisory authority. If you are in Austria, this is the Datenschutzbehörde (www.dsb.gv.at). To exercise any of these rights, contact us at the email below." },
  { title: "7. Children's Privacy", body: "Trimio is not intended for children under the age of 13, and we do not knowingly collect personal information from children under 13. If you believe a child under 13 has created an account, please contact us and we will delete the account promptly." },
  { title: "8. Changes to This Policy", body: "We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the date at the top of this page. Continued use of Trimio after changes constitutes acceptance of the updated policy." },
  { title: "9. Contact", body: "If you have questions about this Privacy Policy or your data, please contact us at Trimio@subtrimio.com." },
];

export default function PrivacyPolicyScreen() {
  const c = useTheme();
  const styles = makeStyles(c);

  return (
    <>
      <Stack.Screen options={{ title: "Privacy Policy", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.updated}>Effective date: April 27, 2025 · Last updated: June 16, 2026</Text>
          <Text style={styles.intro}>
            This Privacy Policy explains how Trimio ("we", "us", or "our") collects, uses, and protects your information when you use our app.
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

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 48 },
    updated: { fontSize: 12, color: c.textMuted, marginBottom: 12 },
    intro: { fontSize: 14, color: c.text, lineHeight: 22, marginBottom: 24, fontStyle: "italic" },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: c.text, marginBottom: 6 },
    sectionBody: { fontSize: 13, color: c.textSecondary, lineHeight: 21 },
  });
}
