import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type Props = {
  title: string;
  description: string;
};

export function PremiumGate({ title, description }: Props) {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.container} onPress={() => router.push("/upgrade")} activeOpacity={0.85}>
      <View style={styles.crownRow}>
        <MaterialCommunityIcons name="crown" size={22} color="#F59E0B" />
        <Text style={styles.premiumLabel}>Premium</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      <View style={styles.button}>
        <MaterialCommunityIcons name="lock-open-outline" size={15} color="#fff" />
        <Text style={styles.buttonText}>Unlock Premium — $3.99</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFBEB", borderRadius: 14, padding: 20,
    borderWidth: 1.5, borderColor: "#FCD34D", alignItems: "center",
    marginBottom: 12,
  },
  crownRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  premiumLabel: { fontSize: 12, fontWeight: "700", color: "#D97706", textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 15, fontWeight: "700", color: "#1F2937", textAlign: "center", marginBottom: 6 },
  desc: { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 20, marginBottom: 16 },
  button: {
    backgroundColor: "#4F46E5", borderRadius: 10, paddingVertical: 11,
    paddingHorizontal: 24, flexDirection: "row", alignItems: "center", gap: 6,
  },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
