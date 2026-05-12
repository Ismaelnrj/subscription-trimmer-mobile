import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, AppColors } from "../lib/theme";

type Props = {
  title: string;
  description: string;
};

export function PremiumGate({ title, description }: Props) {
  const router = useRouter();
  const c = useTheme();
  const styles = makeStyles(c);

  return (
    <TouchableOpacity style={styles.container} onPress={() => router.push("/upgrade")} activeOpacity={0.85}>
      <View style={styles.crownRow}>
        <MaterialCommunityIcons name="crown" size={22} color={c.warning} />
        <Text style={styles.premiumLabel}>Premium</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      <View style={styles.button}>
        <MaterialCommunityIcons name="lock-open-outline" size={15} color="#fff" />
        <Text style={styles.buttonText}>Unlock Premium — from $1.99/mo</Text>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: c.warningLight, borderRadius: 14, padding: 20,
      borderWidth: 1.5, borderColor: c.warningBorder, alignItems: "center",
      marginBottom: 12,
    },
    crownRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
    premiumLabel: { fontSize: 12, fontWeight: "700", color: c.warning, textTransform: "uppercase", letterSpacing: 0.5 },
    title: { fontSize: 15, fontWeight: "700", color: c.text, textAlign: "center", marginBottom: 6 },
    desc: { fontSize: 13, color: c.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 16 },
    button: {
      backgroundColor: c.primary, borderRadius: 10, paddingVertical: 11,
      paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 6,
    },
    buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  });
}
