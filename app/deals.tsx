import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";

const DEALS = [
  {
    name: "NordVPN",
    category: "Security",
    desc: "Up to 69% off + 3 months free on 2-year plans",
    badge: "Best Deal",
    badgeColor: "#EF4444",
    icon: "shield-check",
    iconColor: "#4F46E5",
    url: "https://nordvpn.com",
    savings: "Save ~$80/yr",
  },
  {
    name: "Spotify Premium",
    category: "Music",
    desc: "1 month free trial for new subscribers",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "music",
    iconColor: "#1DB954",
    url: "https://spotify.com/premium",
    savings: "1 month free",
  },
  {
    name: "YouTube Premium",
    category: "Video",
    desc: "Ad-free videos + background play. Try free for 1 month",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "youtube",
    iconColor: "#EF4444",
    url: "https://youtube.com/premium",
    savings: "1 month free",
  },
  {
    name: "Amazon Prime",
    category: "Shopping",
    desc: "30-day free trial. Shipping, Prime Video, Prime Music included",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "package-variant",
    iconColor: "#F59E0B",
    url: "https://amazon.com/prime",
    savings: "30 days free",
  },
  {
    name: "ExpressVPN",
    category: "Security",
    desc: "30-day money-back guarantee. Blazing fast servers worldwide",
    badge: "Top Rated",
    badgeColor: "#6366F1",
    icon: "vpn",
    iconColor: "#EF4444",
    url: "https://expressvpn.com",
    savings: "30-day guarantee",
  },
  {
    name: "Microsoft 365",
    category: "Productivity",
    desc: "1 month free. Word, Excel, PowerPoint + 1TB OneDrive",
    badge: "Free Trial",
    badgeColor: "#10B981",
    icon: "microsoft",
    iconColor: "#0078D4",
    url: "https://microsoft.com/microsoft-365",
    savings: "1 month free",
  },
  {
    name: "Disney+",
    category: "Streaming",
    desc: "Stream Marvel, Star Wars, Disney classics and more",
    badge: "Popular",
    badgeColor: "#8B5CF6",
    icon: "television-play",
    iconColor: "#113CCF",
    url: "https://disneyplus.com",
    savings: "Cancel anytime",
  },
  {
    name: "Duolingo Plus",
    category: "Education",
    desc: "Learn languages ad-free with offline access and progress tracking",
    badge: "Popular",
    badgeColor: "#8B5CF6",
    icon: "school",
    iconColor: "#58CC02",
    url: "https://duolingo.com/plus",
    savings: "2 weeks free",
  },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  headerTitle: { fontSize: 13, color: "#6B7280", lineHeight: 18 },
  body: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  iconBox: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
  },
  cardMeta: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  cardCategory: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  badge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
  cardDesc: { fontSize: 13, color: "#4B5563", lineHeight: 18, marginBottom: 12 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  savingsText: { fontSize: 12, fontWeight: "600", color: "#059669" },
  ctaButton: {
    backgroundColor: "#4F46E5", borderRadius: 8, paddingVertical: 8,
    paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 4,
  },
  ctaText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  disclaimer: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 8, lineHeight: 16 },
});

export default function DealsScreen() {
  const openLink = (url: string, name: string) => {
    Alert.alert(
      `Opening ${name}`,
      "You're about to open an external link. SubTrimmer may earn a small commission if you subscribe, at no extra cost to you.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => Linking.openURL(url) },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Deals & Partnerships", headerShown: true }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Exclusive deals and free trials from popular services. SubTrimmer may earn a commission when you sign up — at no extra cost to you.
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
            Links marked as deals may be affiliate links. SubTrimmer earns a small commission at no extra cost to you. All deals are independently selected.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
