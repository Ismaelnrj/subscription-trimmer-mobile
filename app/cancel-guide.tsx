import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getCancellationGuide } from "../lib/cancellation-guides";
import { useTheme, AppColors } from "../lib/theme";

export default function CancelGuideScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const c = useTheme();
  const styles = makeStyles(c);
  const guide = getCancellationGuide(name ?? "");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>How to cancel {name}</Text>

      {guide.note && (
        <View style={styles.noteBox}>
          <MaterialCommunityIcons name="information-outline" size={16} color="#A78BFA" style={{ marginTop: 1 }} />
          <Text style={styles.noteText}>{guide.note}</Text>
        </View>
      )}

      <View style={styles.stepsContainer}>
        {guide.steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {!!guide.url && (
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => Linking.openURL(guide.url)}
        >
          <MaterialCommunityIcons name="open-in-new" size={18} color="#FFFFFF" />
          <Text style={styles.linkButtonText}>Open cancellation page</Text>
        </TouchableOpacity>
      )}

      <View style={styles.footerNote}>
        <MaterialCommunityIcons name="shield-check-outline" size={14} color={c.textMuted} />
        <Text style={styles.footerNoteText}>
          Steps are based on current service UIs and may change. Always confirm cancellation via email.
        </Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 48 },
    heading: { fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 },
    noteBox: {
      flexDirection: "row", gap: 8, backgroundColor: "#2D1B69",
      borderRadius: 12, padding: 14, marginBottom: 24, alignItems: "flex-start",
    },
    noteText: { flex: 1, fontSize: 13, color: "#A78BFA", lineHeight: 20 },
    stepsContainer: { gap: 16, marginBottom: 32 },
    stepRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
    stepNumber: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: c.primary, justifyContent: "center", alignItems: "center", flexShrink: 0,
    },
    stepNumberText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    stepText: { flex: 1, fontSize: 14, color: c.text, lineHeight: 22, paddingTop: 4 },
    linkButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, backgroundColor: c.danger, borderRadius: 12,
      paddingVertical: 15, marginBottom: 20,
      shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    },
    linkButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
    footerNote: {
      flexDirection: "row", gap: 8, alignItems: "flex-start",
      backgroundColor: c.card, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: c.border,
    },
    footerNoteText: { flex: 1, fontSize: 12, color: c.textMuted, lineHeight: 17 },
  });
}
