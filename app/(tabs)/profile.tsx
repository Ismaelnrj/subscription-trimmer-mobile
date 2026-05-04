import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../lib/auth-store";
import { useCurrencyStore, fmt } from "../../lib/currency-store";
import apiClient from "../../lib/api";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  profileHeader: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center",
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "#4F46E5",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  avatarText: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  profileName: { fontSize: 18, fontWeight: "700", color: "#1F2937", marginBottom: 4 },
  profileEmail: { fontSize: 14, color: "#6B7280" },
  sectionTitle: {
    fontSize: 14, fontWeight: "600", color: "#1F2937", marginBottom: 12,
    marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5,
  },
  menuItem: {
    backgroundColor: "#FFFFFF", borderRadius: 8, paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 8, flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB",
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuItemLabel: { fontSize: 14, color: "#1F2937", fontWeight: "500" },
  statCard: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  statLabel: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "700", color: "#1F2937" },
  dangerButton: {
    backgroundColor: "#FEE2E2", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16,
    marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  dangerButtonText: { color: "#DC2626", fontSize: 14, fontWeight: "600" },
});

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { currency } = useCurrencyStore();
  const router = useRouter();

  const { data: summary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => {
      const response = await apiClient.get("/trpc/analytics.summary");
      return response.data.result.data;
    },
  });

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleRateApp = () => {
    Linking.openURL("market://details?id=com.trimio.app");
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name || "User"}</Text>
          <Text style={styles.profileEmail}>{user?.email || "No email"}</Text>
        </View>

        <Text style={styles.sectionTitle}>Account Summary</Text>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active Subscriptions</Text>
          <Text style={styles.statValue}>{summary?.activeSubscriptions ?? 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Monthly Spend</Text>
          <Text style={styles.statValue}>{fmt(summary?.monthlyTotal ?? 0, currency.symbol)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Yearly Projection</Text>
          <Text style={styles.statValue}>{fmt(summary?.yearlyTotal ?? 0, currency.symbol)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Upgrade</Text>
        <TouchableOpacity style={[styles.menuItem, { borderColor: "#C7D2FE", backgroundColor: "#EEF2FF" }]} onPress={() => router.push("/upgrade")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="crown" size={20} color="#4F46E5" />
            <Text style={[styles.menuItemLabel, { color: "#4F46E5" }]}>Unlock Premium — $3.99</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#4F46E5" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/deals")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="tag-multiple" size={20} color="#10B981" />
            <Text style={styles.menuItemLabel}>Deals & Partnerships</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/tip-jar")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="heart" size={20} color="#EF4444" />
            <Text style={styles.menuItemLabel}>Tip Jar — Support the Dev</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Settings</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/notification-preferences")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="bell-outline" size={20} color="#4F46E5" />
            <Text style={styles.menuItemLabel}>Notification Preferences</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/account-settings")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="account-cog-outline" size={20} color="#4F46E5" />
            <Text style={styles.menuItemLabel}>Account Settings</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/help-support")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="help-circle-outline" size={20} color="#4F46E5" />
            <Text style={styles.menuItemLabel}>Help & Support</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/terms-of-service")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color="#4F46E5" />
            <Text style={styles.menuItemLabel}>Terms of Service</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={handleRateApp}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="star-outline" size={20} color="#F59E0B" />
            <Text style={styles.menuItemLabel}>Rate Trimio ⭐</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerButton} onPress={logout}>
          <MaterialCommunityIcons name="logout" size={18} color="#DC2626" />
          <Text style={styles.dangerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
