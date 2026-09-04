import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { useTheme, AppColors } from "../lib/theme";

const SECTIONS = [
  { title: "1. Who We Are", body: "Trimio is operated by Ismael Naranjo, based in Vienna, Austria. You can reach us at Trimio@subtrimio.com. These Terms of Service govern your use of the Trimio mobile application, the Trimio website, and related services (the \"Service\")." },
  { title: "2. Acceptance", body: "By downloading the app, creating an account, or otherwise using the Service, you agree to these Terms. If you do not agree, please do not use the Service. Your use is also governed by our Privacy Policy, which explains how your information is handled." },
  { title: "3. Eligibility", body: "You must be at least 16 years old to create a Trimio account. If you are younger, you may use the Service only with the consent and supervision of a parent or legal guardian who accepts these Terms on your behalf." },
  { title: "4. What Trimio Does and Does Not Do", body: "Trimio helps you keep track of subscriptions you tell it about, and reminds you before a renewal date you have entered. Trimio does not connect to your bank, does not read your transactions, does not hold or move money, and cannot cancel a subscription on your behalf. Every subscription in Trimio is one you added yourself, and every renewal date is one you provided or confirmed." },
  { title: "5. Your Account", body: "You must provide a valid email address to create an account. You are responsible for keeping your password confidential and for activity that happens under your account. Please tell us promptly at Trimio@subtrimio.com if you believe your account has been used without your permission." },
  { title: "6. Your Content", body: "The subscription details you enter remain yours. You grant us only the permission needed to store that information and show it back to you, and to operate features you have enabled, such as reminders. We do not sell your content and we do not use it for advertising." },
  { title: "7. Free and Premium Plans", body: "Trimio is free to use for up to five subscriptions. Premium removes that limit and unlocks additional features, described in the app at the point of purchase. Premium is offered as a monthly or yearly auto renewing subscription, or as a lifetime one time purchase. The lifetime option does not renew and is charged once." },
  { title: "8. Payments, Renewals and Refunds", body: "Premium is sold through Google Play Billing, and Google, not Trimio, is the seller of record. Prices are shown in the app before you confirm. A monthly or yearly plan renews automatically at the listed price unless you cancel at least 24 hours before the renewal date, and you manage or cancel it in your Google Play account rather than in Trimio. Refund requests are handled by Google under Google Play policies. We never see or store your card details." },
  { title: "9. Right of Withdrawal", body: "If you are a consumer in the European Union you normally have fourteen days to withdraw from a distance contract. Because Premium is delivered immediately on purchase, that right may end once delivery begins and you have acknowledged it, in line with Section 18 of the Austrian Fern und Auswaertsgeschaefte Gesetz. As Google is the seller of record, exercise any withdrawal or refund right through Google Play. Nothing here removes rights you have by law." },
  { title: "10. Reminders Are Best Effort", body: "Trimio sends reminders on a best effort basis. Delivery depends on things outside our control, including your device settings, notification permissions, battery optimisation, network availability, email filtering, and the accuracy of the dates you entered. A reminder may be delayed or may not arrive. You remain responsible for your own subscriptions, for cancelling anything you no longer want, and for any charge made by a third party. Trimio is a reminder, not a guarantee." },
  { title: "11. Accuracy and Not Financial Advice", body: "Trimio shows totals and dates based on what you entered, so its figures are only as accurate as that information. It does not provide financial, tax, legal, or investment advice, and nothing in the Service is a recommendation to buy, keep, or cancel anything." },
  { title: "12. Acceptable Use", body: "Please do not use the Service to break the law, to infringe anyone's rights, to attempt unauthorised access to our systems or another person's account, to disrupt or overload the Service, to reverse engineer it except where that right cannot lawfully be restricted, or to resell or redistribute it without our permission." },
  { title: "13. Availability and Changes", body: "We aim to keep the Service running and accurate, but it is offered as it is. We may add, change, or remove features, and we may suspend the Service for maintenance. If we plan to discontinue the Service entirely, we will give you reasonable notice so you can export or record your data." },
  { title: "14. Intellectual Property", body: "The Trimio name, logo, design, and software belong to us and are protected by law. These Terms give you a personal, non exclusive, non transferable, revocable licence to use the Service. Names and logos of the subscription services you track belong to their respective owners, and Trimio is not affiliated with or endorsed by them." },
  { title: "15. Suspension and Termination", body: "You may stop using the Service and delete your account at any time from Profile, then Account Settings. Deleting your account permanently removes your data as described in the Privacy Policy. We may suspend or close an account that breaches these Terms, that is used unlawfully, or that puts the Service or other people at risk, and where it is reasonable to do so we will tell you why and give you a chance to put things right." },
  { title: "16. Liability", body: "Nothing in these Terms limits liability that cannot be limited by law, including liability for death or personal injury caused by negligence, for fraud, or under mandatory consumer protection or product liability rules. Subject to that, the Service is provided as it is, we are not liable for indirect or consequential loss, and we are not liable for a subscription charge you incurred because a reminder was late, missing, or based on a date entered incorrectly. Our total liability in any twelve month period is limited to the greater of the amount you paid us in that period or fifty euro." },
  { title: "17. Your Statutory Rights", body: "If you are a consumer, you keep all rights given to you by the mandatory law of your country of residence. Where these Terms conflict with such a right, that right prevails." },
  { title: "18. Changes to These Terms", body: "We may update these Terms as the Service develops or the law changes. If a change is material we will give you reasonable notice in the app or by email before it takes effect. Continuing to use the Service after that point means you accept the updated Terms. If you do not accept them, you may delete your account." },
  { title: "19. Governing Law", body: "These Terms are governed by Austrian law, excluding its conflict of law rules and the UN Convention on Contracts for the International Sale of Goods. If you are a consumer, you may also rely on the mandatory law of your country of residence, and you may bring proceedings in the courts of that country. The European Commission provides an online dispute resolution platform at ec.europa.eu/consumers/odr." },
  { title: "20. Contact", body: "Questions about these Terms are welcome at Trimio@subtrimio.com." },
];

export default function TermsOfServiceScreen() {
  const c = useTheme();
  const styles = makeStyles(c);

  return (
    <>
      <Stack.Screen options={{ title: "Terms of Service", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.updated}>Last updated: September 4, 2026</Text>
          <Text style={styles.intro}>Please read these Terms of Service carefully before using Trimio.</Text>
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
