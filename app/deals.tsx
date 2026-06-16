import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useTheme, AppColors } from "../lib/theme";

// Affiliate links — sign up at each program and replace the URLs below with your
// personal affiliate link. Apply here:
// NordVPN:      https://affiliates.nordvpn.com
// Surfshark:    https://surfshark.com/affiliates
// 1Password:    https://1password.com/affiliates  (via impact.com)
// Dashlane:     https://dashlane.com/affiliates
// Grammarly:    https://grammarly.com/affiliates  (via impact.com)
// Canva:        https://canva.com/affiliates
// Skillshare:   https://skillshare.com/affiliates
// MasterClass:  https://masterclass.com/affiliates
// Headspace:    https://headspace.com/affiliates
// Adobe CC:     https://www.adobe.com/affiliates.html
// Notion:       https://notion.so/affiliates       (via impact.com)
// Proton:       https://proton.me/referral
const DEALS = [
  {
    name: "NordVPN",
    category: "Security",
    desc: "Up to 69% off + 3 months free on 2-year plans. The #1 rated VPN for speed and privacy.",
    badge: "Best Deal",
    badgeColor: "#EF4444",
    icon: "shield-check",
    iconColor: "#4F46E5",
    url: "https://nordvpn.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "Save ~$80/yr",
  },
  {
    name: "Surfshark",
    category: "Security",
    desc: "Unlimited devices on one plan. One of the most affordable VPNs with strong privacy features.",
    badge: "Unlimited Devices",
    badgeColor: "#10B981",
    icon: "shield-lock",
    iconColor: "#06B6D4",
    url: "https://surfshark.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "Save up to 85%",
  },
  {
    name: "Proton VPN & Mail",
    category: "Privacy",
    desc: "Swiss-based privacy suite — encrypted VPN, email, calendar and cloud storage. Free plan available.",
    badge: "Privacy First",
    badgeColor: "#6366F1",
    icon: "lock-outline",
    iconColor: "#6D4AFF",
    url: "https://proton.me/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "Free plan available",
  },
  {
    name: "1Password",
    category: "Security",
    desc: "The most trusted password manager for individuals and families. 14-day free trial.",
    badge: "Top Rated",
    badgeColor: "#6366F1",
    icon: "lock-check",
    iconColor: "#1A8CFF",
    url: "https://1password.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "14 days free",
  },
  {
    name: "Dashlane",
    category: "Security",
    desc: "Password manager with built-in VPN and dark web monitoring. Free plan for one device.",
    badge: "Free Plan",
    badgeColor: "#10B981",
    icon: "key-variant",
    iconColor: "#00B388",
    url: "https://dashlane.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "Free forever plan",
  },
  {
    name: "Grammarly",
    category: "Productivity",
    desc: "AI writing assistant that fixes grammar, clarity, tone and style. Free plan available.",
    badge: "Popular",
    badgeColor: "#8B5CF6",
    icon: "text-box-check-outline",
    iconColor: "#15C39A",
    url: "https://grammarly.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "Free plan available",
  },
  {
    name: "Notion",
    category: "Productivity",
    desc: "All-in-one workspace for notes, docs, tasks and wikis. Free plan for personal use.",
    badge: "Free Plan",
    badgeColor: "#10B981",
    icon: "notebook-outline",
    iconColor: "#1F2937",
    url: "https://notion.so/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "Free forever plan",
  },
  {
    name: "Canva Pro",
    category: "Design",
    desc: "Create stunning graphics, videos and presentations in minutes. 30-day free Pro trial.",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "palette",
    iconColor: "#7C3AED",
    url: "https://canva.com/pro/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "30 days free",
  },
  {
    name: "Adobe Creative Cloud",
    category: "Design",
    desc: "Photoshop, Illustrator, Premiere and 20+ apps. The industry standard creative suite.",
    badge: "Best Value",
    badgeColor: "#EF4444",
    icon: "brush",
    iconColor: "#FF0000",
    url: "https://adobe.com/creativecloud/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "First month free",
  },
  {
    name: "Skillshare",
    category: "Education",
    desc: "Thousands of creative and business classes. Learn design, marketing, coding and more.",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "school-outline",
    iconColor: "#00C4CC",
    url: "https://skillshare.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "1 month free",
  },
  {
    name: "MasterClass",
    category: "Education",
    desc: "Learn from the world's best — Gordon Ramsay, Serena Williams, Neil deGrasse Tyson and more.",
    badge: "Popular",
    badgeColor: "#8B5CF6",
    icon: "star-circle-outline",
    iconColor: "#C9A84C",
    url: "https://masterclass.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "30-day guarantee",
  },
  {
    name: "Headspace",
    category: "Wellness",
    desc: "Guided meditation, sleep sounds and focus music. Stress less and sleep better.",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "head-heart-outline",
    iconColor: "#FF6B35",
    url: "https://headspace.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "7 days free",
  },
];

export default function DealsScreen() {
  const c = useTheme();
  const styles = makeStyles(c);

  const openLink = (url: string, name: string) => {
    Alert.alert(
      `Opening ${name}`,
      "You're about to open an external link. Trimio may earn a small commission if you subscribe, at no extra cost to you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            Linking.openURL(url).catch(() =>
              Alert.alert("Couldn't open link", "Please try again later.")
            );
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Deals & Partnerships", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Exclusive deals and free trials from popular services. Trimio may earn a commission when you sign up — at no extra cost to you.
          </Text>
        </View>

        <View style={styles.body}>
          {DEALS.map((deal) => (
            <View key={deal.name} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconBox}>
                  <MaterialCommunityIcons name={deal.icon as any} size={24} color={deal.iconColor} />
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardName}>{deal.name}</Text>
                  <Text style={styles.cardCategory}>{deal.category}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: deal.badgeColor }]}>
                  <Text style={styles.badgeText}>{deal.badge}</Text>
                </View>
              </View>

              <Text style={styles.cardDesc}>{deal.desc}</Text>

              <View style={styles.cardBottom}>
                <Text style={styles.savingsText}>💰 {deal.savings}</Text>
                <TouchableOpacity style={styles.ctaButton} onPress={() => openLink(deal.url, deal.name)}>
                  <Text style={styles.ctaText}>View Deal</Text>
                  <MaterialCommunityIcons name="open-in-new" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={styles.disclaimer}>
            Links marked as deals may be affiliate links. Trimio earns a small commission at no extra cost to you. All deals are independently selected.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { padding: 16, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border },
    headerTitle: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
    body: { padding: 16, paddingBottom: 40 },
    card: {
      backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: c.border,
    },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
    iconBox: {
      width: 44, height: 44, borderRadius: 10, backgroundColor: c.border,
      justifyContent: "center", alignItems: "center",
    },
    cardMeta: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: "700", color: c.text },
    cardCategory: { fontSize: 11, color: c.textMuted, marginTop: 1 },
    badge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
    badgeText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
    cardDesc: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 12 },
    cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    savingsText: { fontSize: 12, fontWeight: "600", color: c.success },
    ctaButton: {
      backgroundColor: c.primary, borderRadius: 8, paddingVertical: 8,
      paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 4,
    },
    ctaText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
    disclaimer: { fontSize: 11, color: c.textMuted, textAlign: "center", marginTop: 8, lineHeight: 16 },
  });
}
