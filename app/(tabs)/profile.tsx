import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../lib/auth-store";
import { useTheme, AppColors } from "../../lib/theme";
import { useLanguageStore } from "../../lib/language-store";
import { PREMIUM_PRICES } from "../../lib/pricing";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const router = useRouter();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleLogout = () => {
    Alert.alert(t("profile.signOutTitle"), t("profile.signOutConfirm"), [
      { text: t("subscriptions.cancel"), style: "cancel" },
      { text: t("profile.signOut"), style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name || "User"}</Text>
          <Text style={styles.profileEmail}>{user?.email || "No email"}</Text>
        </View>

        <Text style={styles.sectionTitle}>{t("profile.upgrade")}</Text>
        {isPremium ? (
          <View style={[styles.premiumItem, { borderColor: c.success }]}>
            <View style={styles.menuItemLeft}>
              <MaterialCommunityIcons name="crown" size={20} color={c.success} />
              <View>
                <Text style={[styles.menuItemLabel, { color: c.success }]}>{t("profile.premiumMember")}</Text>
                <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 1 }}>{t("profile.allFeaturesUnlocked")}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="check-circle" size={20} color={c.success} />
          </View>
        ) : (
          <TouchableOpacity style={styles.premiumItem} onPress={() => router.push("/upgrade")}>
            <View style={styles.menuItemLeft}>
              <MaterialCommunityIcons name="crown" size={20} color={c.primary} />
              <Text style={[styles.menuItemLabel, { color: c.primary }]}>
                {t("profile.unlockPremium", { price: PREMIUM_PRICES.monthly })}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={c.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/refer-a-friend")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>{t("profile.referAFriend")}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        {!isPremium && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/tip-jar")}>
            <View style={styles.menuItemLeft}>
              <MaterialCommunityIcons name="heart" size={20} color={c.danger} />
              <Text style={styles.menuItemLabel}>{t("profile.tipJar")}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>{t("profile.settings")}</Text>
        <View style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="translate" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>{t("profile.language")}</Text>
          </View>
          <View style={styles.langToggle}>
            <TouchableOpacity
              style={[styles.langChip, language === "en" && styles.langChipActive]}
              onPress={() => setLanguage("en")}
            >
              <Text style={[styles.langChipText, language === "en" && styles.langChipTextActive]}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langChip, language === "de" && styles.langChipActive]}
              onPress={() => setLanguage("de")}
            >
              <Text style={[styles.langChipText, language === "de" && styles.langChipTextActive]}>DE</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/notification-preferences")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="bell-outline" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>{t("profile.notifications")}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/account-settings")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="account-cog-outline" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>{t("profile.accountSettings")}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/help-support")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="help-circle-outline" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>{t("profile.helpSupport")}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/privacy-policy")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="shield-lock-outline" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>{t("profile.privacyPolicy")}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/terms-of-service")}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color={c.primary} />
            <Text style={styles.menuItemLabel}>{t("profile.termsOfService")}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
        </TouchableOpacity>
        <View style={[styles.menuItem, { opacity: 0.6 }]}>
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="apple" size={20} color={c.text} />
            <View>
              <Text style={styles.menuItemLabel}>{t("profile.iOSComingSoon")}</Text>
              <Text style={{ fontSize: 11, color: c.textSecondary, marginTop: 1 }}>{t("profile.comingSoon")}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: c.warningLight, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: c.warningBorder }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: c.warning }}>SOON</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.dangerButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={18} color={c.danger} />
          <Text style={styles.dangerButtonText}>{t("profile.signOut")}</Text>
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
    menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    menuItemLabel: { fontSize: 14, color: c.text, fontWeight: "500" },
    langToggle: { flexDirection: "row", gap: 6 },
    langChip: {
      paddingVertical: 5, paddingHorizontal: 12, borderRadius: 16,
      backgroundColor: c.border, borderWidth: 1, borderColor: c.border,
    },
    langChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    langChipText: { fontSize: 12, fontWeight: "700", color: c.textSecondary },
    langChipTextActive: { color: "#FFFFFF" },
    dangerButton: {
      backgroundColor: c.dangerLight, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16,
      marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderWidth: 1, borderColor: c.dangerBorder,
    },
    dangerButtonText: { color: c.danger, fontSize: 14, fontWeight: "600" },
  });
}
