import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useTheme, AppColors } from "../lib/theme";

// Affiliate links — sign up at each program and replace these URLs with your
// personalised affiliate link. Each one earns a commission when a user signs up.
// NordVPN: https://affiliates.nordvpn.com
// ExpressVPN: https://www.expressvpn.com/affiliates
// Surfshark: https://surfshark.com/affiliates
// NordPass: https://nordpass.com/affiliate-program
// Notion: https://www.notion.so/affiliates
// Canva: https://www.canva.com/affiliates
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
    name: "ExpressVPN",
    category: "Security",
    desc: "30-day money-back guarantee. Ultra-fast servers in 105 countries.",
    badge: "Top Rated",
    badgeColor: "#6366F1",
    icon: "vpn",
    iconColor: "#EF4444",
    url: "https://expressvpn.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "30-day guarantee",
  },
  {
    name: "Surfshark",
    category: "Security",
    desc: "Unlimited devices on one plan. 85% off + 3 months extra free.",
    badge: "Unlimited Devices",
    badgeColor: "#10B981",
    icon: "shield-lock",
    iconColor: "#06B6D4",
    url: "https://surfshark.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "Save 85%",
  },
  {
    name: "NordPass",
    category: "Productivity",
    desc: "Password manager by the makers of NordVPN. Family plan available.",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "lock-check",
    iconColor: "#4F46E5",
    url: "https://nordpass.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "30 days free",
  },
  {
    name: "Notion",
    category: "Productivity",
    desc: "All-in-one workspace for notes, tasks, wikis, and databases. Free plan available.",
    badge: "Popular",
    badgeColor: "#8B5CF6",
    icon: "notebook-outline",
    iconColor: "#1F2937",
    url: "https://notion.so/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "Free forever plan",
  },
  {
    name: "Canva Pro",
    category: "Design",
    desc: "Create stunning designs in minutes. 30-day free trial of Pro features.",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "palette",
    iconColor: "#7C3AED",
    url: "https://canva.com/pro/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "30 days free",
  },
  {
    name: "Amazon Prime",
    category: "Shopping",
    desc: "30-day free trial — fast shipping, Prime Video, Prime Music and more.",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "package-variant",
    iconColor: "#F59E0B",
    url: "https://amazon.com/prime?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "30 days free",
  },
  {
    name: "Microsoft 365",
    category: "Productivity",
    desc: "Word, Excel, PowerPoint + 1TB OneDrive. 1 month free for new subscribers.",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "microsoft",
    iconColor: "#0078D4",
    url: "https://microsoft.com/microsoft-365?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "1 month free",
  },
  {
    name: "Spotify Premium",
    category: "Music",
    desc: "Ad-free music, offline listening, and unlimited skips. 1 month free.",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "music",
    iconColor: "#1DB954",
    url: "https://spotify.com/premium?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "1 month free",
  },
  {
    name: "Disney+",
    category: "Streaming",
    desc: "Marvel, Star Wars, Pixar, Disney classics and National Geographic.",
    badge: "Popular",
    badgeColor: "#8B5CF6",
    icon: "television-play",
    iconColor: "#113CCF",
    url: "https://disneyplus.com/?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "Cancel anytime",
  },
  {
    name: "Duolingo Plus",
    category: "Education",
    desc: "Learn 40+ languages ad-free with offline access and progress tracking.",
    badge: "Popular",
    badgeColor: "#8B5CF6",
    icon: "school",
    iconColor: "#58CC02",
    url: "https://duolingo.com/plus?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "2 weeks free",
  },
  {
    name: "YouTube Premium",
    category: "Video",
    desc: "Ad-free videos, background play, and YouTube Music included.",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "youtube",
    iconColor: "#EF4444",
    url: "https://youtube.com/premium?utm_source=trimio&utm_medium=app&utm_campaign=deals",
    savings: "1 month free",
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
