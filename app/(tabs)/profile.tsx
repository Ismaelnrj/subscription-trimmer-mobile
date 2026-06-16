import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../lib/auth-store";
import { useFmt } from "../../lib/currency-store";
import apiClient from "../../lib/api";
import { useTheme, AppColors } from "../../lib/theme";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const fmtC = useFmt();
  const router = useRouter();
  const c = useTheme();
  const styles = makeStyles(c);

  const { data: summary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => (await apiClient.get("/trpc/analytics.summary")).data.result.data,
  });

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleRateApp = async () => {
    const market = "market://details?id=com.trimio.app";
    const web = "https://play.google.com/store/apps/details?id=com.trimio.app";
    try {
      await Linking.openURL(market);
    } catch {
      try { await Linking.openURL(web); } catch {}
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: logout },
    ]);
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
          <Text style={styles.statValue}>{fmtC(summary?.monthlyTotal ?? 0)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Yearly Projection</Text>
          <Text style={styles.statValue}>{fmtC(summary?.yearlyTotal ?? 0)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Upgrade</Text>
        {isPremium ? (
          <View style={[styles.premiumItem, { borderColor: c.success }]}>
            <View style={styles.menuItemLeft}>
              <MaterialCommunityIcons name="crown" size={20} color={c.success} />
              <View>
                <Text style={[styles.menuItemLabel, { color: c.success }]}>Premium Member</Text>
                <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 1 }}>All features unlocked · Thank you!</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="check-circle" size={20} color={c.success} />
          </View>
        ) : (
          <TouchableOpacity style={styles.premiumItem} onPress={() => router.push("/upgrade")}>
            <View style={styles.menuItemLeft}>
              <MaterialCommunityIcons name="crown" size={20} color={c.primary} />
              <Text style={[styles.menuItemLabel, { color: c.primary }]}>Unlock Premium — from $2.99/mo</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={c.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/deals")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="tag-multiple" size={20} color={c.success} />
            <Text style={styles.menuItemLabel}>Deals & Partnerships</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/tip-jar")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="heart" size={20} color={c.danger} />
            <Text style={styles.menuItemLabel}>Tip Jar — Support the Dev</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Settings</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/notification-preferences")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="bell-outline" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>Notification Preferences</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/account-settings")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="account-cog-outline" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>Account Settings</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/help-support")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="help-circle-outline" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>Help & Support</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/terms-of-service")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>Terms of Service</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={handleRateApp}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="star-outline" size={20} color={c.warning} />
            <Text style={styles.menuItemLabel}>Rate Trimio ⭐</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <View style={[styles.menuItem, { opacity: 0.6 }]}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="apple" size={20} color={c.text} />
            <View>
              <Text style={styles.menuItemLabel}>Trimio for iOS</Text>
              <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 1 }}>Coming soon to the App Store</Text>
            </View>
          </View>
          <View style={{ backgroundColor: c.warningLight, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: c.warningBorder }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: c.warning }}>SOON</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.dangerButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={18} color={c.danger} />
          <Text style={styles.dangerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: 32 },
    profileHeader: {
      backgroundColor: c.card, borderRadius: 12, padding: 20, marginBottom: 16,
      borderWidth: 1, borderColor: c.border, alignItems: "center",
    },
    avatar: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: c.primary,
      justifyContent: "center", alignItems: "center", marginBottom: 12,
    },
    avatarText: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
    profileName: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 4 },
    profileEmail: { fontSize: 14, color: c.textSecondary },
    sectionTitle: {
      fontSize: 14, fontWeight: "600", color: c.text, marginBottom: 12,
      marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5,
    },
    menuItem: {
      backgroundColor: c.card, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 16,
      marginBottom: 8, flexDirection: "row", justifyContent: "space-between",
      alignItems: "center", borderWidth: 1, borderColor: c.border,
    },
    premiumItem: {
      backgroundColor: c.primaryLight, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 16,
      marginBottom: 8, flexDirection: "row", justifyContent: "space-between",
      alignItems: "center", borderWidth: 1, borderColor: c.primary,
    },
    menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    menuItemLabel: { fontSize: 14, color: c.text, fontWeight: "500" },
    statCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: c.border,
    },
    statLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 4 },
    statValue: { fontSize: 20, fontWeight: "700", color: c.text },
    dangerButton: {
      backgroundColor: c.dangerLight, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16,
      marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderWidth: 1, borderColor: c.dangerBorder,
    },
    dangerButtonText: { color: c.danger, fontSize: 14, fontWeight: "600" },
  });
}
