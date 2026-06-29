import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useTheme, AppColors } from "../lib/theme";

const SECTIONS = [
  { title: "1. Who We Are", body: "Trimio is operated by Ismael Naranjo, based in Vienna, Austria, who acts as the data controller under the General Data Protection Regulation (GDPR). You can reach us at Trimio@subtrimio.com." },
  { title: "2. Information We Collect", body: "We collect only what's necessary to operate Trimio: account information (email address, encrypted password, account creation date, and account identifier — passwords are hashed using bcrypt and never stored in plain text); the subscription data you manually enter (service name, billing amount and currency, billing cycle, renewal date, and category); premium subscription information from RevenueCat (subscription status, purchase and expiration dates, premium entitlement status, and anonymous customer identifiers — we never receive or store your payment card details, as all payments are processed by Google Play Billing); and device and diagnostic information (device model, OS version, app version, crash reports, and anonymous performance metrics) to help us maintain and improve the Service." },
  { title: "3. How We Use Your Information", body: "We use your information to create and manage your account, authenticate your identity, deliver the core subscription tracking features, verify active Premium subscriptions, send renewal reminder emails and notifications where enabled, improve application performance and stability, detect and prevent fraud or abuse, respond to support requests, and comply with legal obligations. We do not sell your personal information and do not use it for advertising purposes." },
  { title: "4. Legal Basis for Processing (GDPR)", body: "Account creation and authentication, storing the subscription data you enter, and verifying Premium subscription status are necessary for the performance of a contract (Art. 6(1)(b) GDPR). Sending renewal reminder emails relies on your consent (Art. 6(1)(a) GDPR), which you may withdraw at any time without affecting the lawfulness of prior processing. Crash reporting, diagnostics, and fraud prevention rely on our legitimate interest in maintaining a stable and secure service (Art. 6(1)(f) GDPR). Any processing required to comply with legal obligations relies on Art. 6(1)(c) GDPR." },
  { title: "5. Third-Party Service Providers", body: "Trimio uses a small number of trusted providers to operate the Service, each bound by appropriate data processing agreements: Railway (cloud hosting infrastructure, United States), RevenueCat (subscription management, United States), Google Play Billing (payment processing, United States), Sentry (crash reporting and diagnostics, United States), and Brevo/Sendinblue (transactional and reminder emails, European Union)." },
  { title: "6. International Data Transfers", body: "Some of our service providers are located in the United States. When your personal data is transferred outside the European Economic Area (EEA), we ensure appropriate safeguards are in place in accordance with GDPR Chapter V — for transfers to US-based providers (Railway, RevenueCat, Google, Sentry) we rely on Standard Contractual Clauses (SCCs) approved by the European Commission, or an equivalent transfer mechanism where applicable." },
  { title: "7. Payments", body: "All purchases are handled by Google Play Billing, and subscription validation is performed using RevenueCat. Trimio never has access to your credit or debit card details, bank account information, or any other payment credentials." },
  { title: "8. Data Security", body: "We implement appropriate technical and organizational safeguards, including HTTPS encrypted communication, secure password hashing (bcrypt), restricted server access, secure cloud infrastructure (Railway), regular software updates, and access controls to protect personal information. No online service can guarantee absolute security — if you become aware of any security concern, contact us immediately at Trimio@subtrimio.com." },
  { title: "9. Data Retention", body: "We retain personal information only for as long as necessary to provide the Service, maintain your account, fulfill contractual obligations, comply with applicable laws, resolve disputes, and prevent fraud. When you delete your account, your personal information is permanently deleted within 30 days, unless a longer retention period is required by applicable law." },
  { title: "10. Account Deletion", body: "You may permanently delete your account at any time through the Account Settings screen inside the app. If you cannot access your account, contact us at Trimio@subtrimio.com. Once processed, your personal information will be permanently deleted within 30 days unless legal obligations require otherwise." },
  { title: "11. Your Privacy Rights", body: "Under the GDPR, you have the right to access a copy of the personal information we hold about you, rectify inaccurate or incomplete information, request erasure of your personal information, restrict how we process your information, object to processing based on legitimate interests, receive your data in a structured, commonly used, machine-readable format (available to all users regardless of subscription tier), and withdraw consent at any time where processing is based on consent. To exercise any of these rights, contact us at Trimio@subtrimio.com — we aim to respond within the timeframe required by applicable law, generally within 30 days." },
  { title: "12. Right to Lodge a Complaint", body: "If you believe we have not handled your personal information in accordance with applicable law, you have the right to lodge a complaint with the competent supervisory authority. For users in Austria, this is the Österreichische Datenschutzbehörde (DSB), Barichgasse 40-42, 1030 Vienna, Austria (www.dsb.gv.at, dsb@dsb.gv.at). We encourage you to contact us first so we can address your concern directly." },
  { title: "13. Data Sharing", body: "We do not sell, rent, lease, or trade your personal information. We share information only when necessary to operate the Service through our listed providers, process Premium subscriptions, provide customer support, detect fraud or abuse, comply with legal obligations, or protect the rights, safety, and security of our users or our business." },
  { title: "14. Children's Privacy", body: "Trimio is not intended for children under the age of 14. In accordance with Article 8 of the GDPR as implemented under Austrian law, we do not knowingly collect personal information from children under 14 without verifiable parental consent. If we become aware that personal information has been collected from a child under 14 without appropriate consent, we will promptly delete that information." },
  { title: "15. Cookies and Analytics", body: "Trimio does not use advertising cookies or advertising identifiers. We may collect anonymous diagnostic and performance data to improve application stability and user experience; this data cannot be used to identify you individually." },
  { title: "16. Business Transfers", body: "If Trimio is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. Any successor will remain bound by the commitments in this Privacy Policy." },
  { title: "17. Changes to This Privacy Policy", body: "We may update this Privacy Policy periodically to reflect legal, technical, or operational changes. When significant updates are made, we will revise the \"Last Updated\" date and notify users within the application where appropriate. Continued use of the Service after an update constitutes acceptance of the revised Privacy Policy." },
  { title: "18. Contact Us", body: "For any questions, requests, or concerns regarding this Privacy Policy or our privacy practices, contact us at Trimio@subtrimio.com. We aim to respond to all privacy-related inquiries within 30 days." },
];

export default function PrivacyPolicyScreen() {
  const c = useTheme();
  const styles = makeStyles(c);

  return (
    <>
      <Stack.Screen options={{ title: "Privacy Policy", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.updated}>Effective date: April 27, 2025 · Last updated: June 29, 2026</Text>
          <Text style={styles.intro}>
            Thank you for choosing Trimio. This Privacy Policy explains how Trimio collects, uses, stores, protects, and shares your information when you use the Trimio mobile application and related services (the "Service"). By creating an account or using the Service, you acknowledge that you have read and understood this Privacy Policy.
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
