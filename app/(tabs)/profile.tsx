import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../lib/auth-store";
import { freePremiumUntil } from "../../lib/premium-status";
import { parseApiDate } from "../../lib/utils";
import { useDateFormat } from "../../lib/date-locale";
import { useTheme, AppColors, space, radius, type as typeScale } from "../../lib/theme";
import { useLanguageStore } from "../../lib/language-store";
import { useThemeStore, ThemeMode } from "../../lib/theme-store";
import { FAB_SCROLL_CLEARANCE } from "../../components/GlobalFab";

/* Each language by its own name, never translated: somebody who cannot read
   the current language must still find theirs. */
const LANGUAGES: { code: "en" | "de"; name: string }[] = [
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
];

type RowProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  sub?: string;
  onPress: () => void;
  first?: boolean;
  tone?: "accent" | "danger";
  styles: ReturnType<typeof makeStyles>;
  c: AppColors;
};

/* One tappable row: icon, label, an optional second line, a chevron. The
   label shrinks so a long one wraps instead of running under the chevron:
   "Refer a Friend, get up to 30 days free" did exactly that on a phone. */
function Row({ icon, label, sub, onPress, first, tone, styles, c }: RowProps) {
  const color = tone === "danger" ? c.danger : tone === "accent" ? c.warning : c.textSecondary;
  return (
    <TouchableOpacity
      style={[styles.row, !first && styles.rowDivider]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
    >
      <View style={styles.menuItemLeft}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
        <View style={styles.rowText}>
          <Text style={[styles.menuItemLabel, tone === "danger" && { color: c.danger }]}>{label}</Text>
          {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        </View>
      </View>
      {tone !== "danger" && <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  /* Free Premium (the trial, a referral bonus) has no Google Play subscription
     behind it, so the row opening Play's subscription page would land on
     nothing. Those accounts get when it ends and the way to keep it. */
  const freeUntil = freePremiumUntil(user);
  const fmtD = useDateFormat();
  const router = useRouter();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const { mode, setMode } = useThemeStore();

  const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
    { value: "system", label: t("profile.themeSystem") },
    { value: "light", label: t("profile.themeLight") },
    { value: "dark", label: t("profile.themeDark") },
  ];

  /* Initials from the name, else the first letter of the address. The old
     fallbacks were the English words "U", "User" and "No email". */
  const getInitials = (name?: string | null, email?: string | null) => {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (email ?? "").trim().slice(0, 1).toUpperCase();
  };

  const handleLogout = () => {
    Alert.alert(t("profile.signOutTitle"), t("profile.signOutConfirm"), [
      { text: t("subscriptions.cancel"), style: "cancel" },
      { text: t("profile.signOut"), style: "destructive", onPress: logout },
    ]);
  };

  const rowProps = { styles, c };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.name, user?.email)}</Text>
          </View>
          <View style={styles.profileText}>
            {user?.name ? <Text style={styles.profileName} numberOfLines={1}>{user.name}</Text> : null}
            {user?.email ? (
              <Text style={user?.name ? styles.profileEmail : styles.profileName} numberOfLines={1}>{user.email}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          {freeUntil ? (
            <Row
              {...rowProps}
              first
              tone="accent"
              icon="crown"
              label={t("profile.freePremiumUntil", { date: fmtD(parseApiDate(freeUntil)!, "PP") })}
              sub={t("profile.freePremiumSub")}
              onPress={() => router.push("/upgrade")}
            />
          ) : isPremium ? (
            <Row
              {...rowProps}
              first
              tone="accent"
              icon="crown"
              label={t("profile.premiumMember")}
              sub={t("profile.manageSubscription")}
              onPress={() => Linking.openURL("https://play.google.com/store/account/subscriptions?package=com.trimio.app")}
            />
          ) : (
            <Row {...rowProps} first tone="accent" icon="crown" label={t("profile.unlockPremium")} onPress={() => router.push("/upgrade")} />
          )}
          <Row {...rowProps} icon="archive-outline" label={t("profile.cancelled")} onPress={() => router.push("/cancelled")} />
          <Row
            {...rowProps}
            icon="account-multiple-plus-outline"
            label={t("profile.referAFriend")}
            sub={t("profile.referAFriendSub")}
            onPress={() => router.push("/refer-a-friend")}
          />
          {!isPremium && (
            <Row {...rowProps} icon="heart-outline" label={t("profile.tipJar")} sub={t("profile.tipJarSub")} onPress={() => router.push("/tip-jar")} />
          )}
        </View>

        <Text style={styles.sectionTitle}>{t("profile.settings")}</Text>
        <View style={styles.card}>
          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>{t("profile.appearance")}</Text>
            {/* A segmented control: exactly one is always chosen. Chosen is
                ink, never white on primary (4.02:1 in dark mode). */}
            <View style={styles.segmented} accessibilityRole="radiogroup">
              {THEME_OPTIONS.map((opt) => {
                const on = mode === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.segment, on && styles.segmentOn]}
                    onPress={() => setMode(opt.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={[styles.controlRow, styles.rowDivider]}>
            <Text style={styles.controlLabel}>{t("profile.language")}</Text>
            <View style={styles.segmented} accessibilityRole="radiogroup">
              {LANGUAGES.map((lang) => {
                const on = language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.segment, on && styles.segmentOn]}
                    onPress={() => setLanguage(lang.code)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{lang.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <Row {...rowProps} icon="bell-outline" label={t("profile.notifications")} onPress={() => router.push("/notification-preferences")} />
          <Row {...rowProps} icon="account-cog-outline" label={t("profile.accountSettings")} onPress={() => router.push("/account-settings")} />
        </View>

        <Text style={styles.sectionTitle}>{t("profile.helpLegal")}</Text>
        <View style={styles.card}>
          <Row {...rowProps} first icon="help-circle-outline" label={t("profile.helpSupport")} onPress={() => router.push("/help-support")} />
          <Row {...rowProps} icon="shield-lock-outline" label={t("profile.privacyPolicy")} onPress={() => router.push("/privacy-policy")} />
          <Row {...rowProps} icon="file-document-outline" label={t("profile.termsOfService")} onPress={() => router.push("/terms-of-service")} />
        </View>

        <View style={[styles.card, styles.cardAfter]}>
          <Row {...rowProps} first tone="danger" icon="logout" label={t("profile.signOut")} onPress={handleLogout} />
        </View>
      </View>
    </ScrollView>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { paddingHorizontal: space.l, paddingTop: space.xl, paddingBottom: FAB_SCROLL_CLEARANCE },

    profileHeader: { flexDirection: "row", alignItems: "center", gap: space.l, marginBottom: space.xl },
    avatar: {
      width: 56, height: 56, borderRadius: radius.pill, backgroundColor: c.text,
      justifyContent: "center", alignItems: "center",
    },
    avatarText: { ...typeScale.title, color: c.bg },
    profileText: { flex: 1 },
    profileName: { ...typeScale.title, color: c.text },
    profileEmail: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },

    sectionTitle: { ...typeScale.heading, color: c.text, marginTop: space.xl, marginBottom: space.s },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder, paddingHorizontal: space.l,
    },
    cardAfter: { marginTop: space.xl },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 56, paddingVertical: space.m },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    /* flexShrink on the label, or a long one runs under the chevron instead of
       wrapping: "Refer a Friend, get up to 30 days free" did exactly that on a
       real phone, and the German line is longer still. */
    menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 12 },
    rowText: { flexShrink: 1 },
    menuItemLabel: { ...typeScale.body, color: c.text, flexShrink: 1 },
    rowSub: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },

    controlRow: { paddingVertical: space.m, gap: space.s },
    controlLabel: { ...typeScale.body, color: c.text },
    segmented: {
      flexDirection: "row", padding: 4, borderRadius: radius.m, gap: 4,
      backgroundColor: c.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    segment: { flex: 1, minHeight: 40, borderRadius: radius.s, alignItems: "center", justifyContent: "center" },
    segmentOn: { backgroundColor: c.text },
    segmentText: { ...typeScale.label, color: c.textSecondary },
    segmentTextOn: { color: c.bg, fontFamily: "Montserrat-SemiBold" },
  });
}
