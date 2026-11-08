import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";

type Props = {
  title: string;
  description: string;
};

export function PremiumGate({ title, description }: Props) {
  const router = useRouter();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push("/upgrade")}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${t("profile.unlockPremium")}`}
    >
      <View style={styles.crownRow}>
        <MaterialCommunityIcons name="crown" size={16} color={c.warning} />
        <Text style={styles.premiumLabel}>Premium</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      <View style={styles.button}>
        <MaterialCommunityIcons name="lock-open-outline" size={16} color={c.bg} />
        {/* NO PRICE ON THIS BANNER, deliberately. It used to read
            "Unlock Premium, from $2.99/mo" with the figure coming from
            PREMIUM_PRICES, which is hardcoded USD. Google Play charges each
            market its own localised price, so an Austrian reader was quoted
            dollars for a purchase that bills in euros: the same defect the
            upgrade screen was fixed for, surviving on the banner that leads
            to it.

            The banner is not where anybody decides to pay, so the cheapest
            correct fix is to stop quoting a price here rather than to fetch
            RevenueCat offerings from every gate, which would be four extra
            round trips for one line of marketing copy. app/upgrade.tsx stays
            the single surface responsible for a price, and it names only the
            localized priceString Google Play gives it, never a fallback. */}
        <Text style={styles.buttonText}>{t("profile.unlockPremium")}</Text>
      </View>
    </TouchableOpacity>
  );
}

/* A quiet card on the shared scale, left aligned like every row around it.
   It was an amber block with a centred crown, which read as an advert dropped
   into the screen. The button is ink, not primary: white on dark primary is
   4.02:1, under the text floor. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: c.card, borderRadius: radius.m, padding: space.l,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    crownRow: { flexDirection: "row", alignItems: "center", gap: space.xs, marginBottom: space.s },
    premiumLabel: { ...typeScale.label, color: c.warning },
    title: { ...typeScale.heading, color: c.text, marginBottom: space.xs },
    desc: { ...typeScale.caption, color: c.textSecondary, marginBottom: space.l },
    button: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 48, paddingHorizontal: space.l,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s,
    },
    buttonText: { ...typeScale.bodyStrong, color: c.bg },
  });
}
