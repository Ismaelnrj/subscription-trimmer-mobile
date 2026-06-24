import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useTheme, AppColors } from "../lib/theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "view-dashboard-outline",
    color: "#4F46E5",
    bg: "#EEF2FF",
    bgDark: "#1E1B4B",
    title: "Track every subscription",
    desc: "Add all your subscriptions in one place and always know exactly what you're paying — monthly and yearly.",
  },
  {
    icon: "bell-alert-outline",
    color: "#F59E0B",
    bg: "#FEF3C7",
    bgDark: "#1C1508",
    title: "Never get surprised",
    desc: "Get alerts before renewal dates and track free trial end dates so you never forget to cancel.",
  },
  {
    icon: "lightbulb-on-outline",
    color: "#10B981",
    bg: "#ECFDF5",
    bgDark: "#052E16",
    title: "Save money intelligently",
    desc: "See spending by category, set a monthly budget, and get personalised tips to cut unnecessary costs.",
  },
];

const ESTIMATE_OPTIONS = [
  { label: "1-3", value: 2 },
  { label: "4-7", value: 5 },
  { label: "8-12", value: 10 },
  { label: "13+", value: 15 },
];

export const USER_ESTIMATE_KEY = "user_subscription_estimate";

export default function OnboardingScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [estimate, setEstimate] = useState<number | null>(null);
  const c = useTheme();
  const isDark = c.bg !== "#F9FAFB";
  const styles = makeStyles(c);

  const isEstimateStep = current === SLIDES.length;

  const finish = async () => {
    if (estimate !== null) {
      await SecureStore.setItemAsync(USER_ESTIMATE_KEY, String(estimate));
    }
    await SecureStore.setItemAsync("onboarding_done", "true");
    router.replace("/login");
  };

  const next = () => {
    if (current < SLIDES.length) {
      setCurrent(current + 1);
    } else {
      finish();
    }
  };

  if (isEstimateStep) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.skip} onPress={finish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF" }]}>
            <MaterialCommunityIcons name="help-circle-outline" size={64} color={c.primary} />
          </View>
          <Text style={styles.title}>How many subscriptions do you think you have?</Text>
          <Text style={styles.desc}>Just a guess. We'll show you how close you were once you've added them.</Text>

          <View style={styles.estimateRow}>
            {ESTIMATE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.estimateChip, estimate === opt.value && styles.estimateChipActive]}
                onPress={() => setEstimate(opt.value)}
              >
                <Text style={[styles.estimateChipText, estimate === opt.value && styles.estimateChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: c.primary }]} onPress={finish}>
          <Text style={styles.buttonText}>Get Started</Text>
          <MaterialCommunityIcons name="arrow-right-circle" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  const slide = SLIDES[current];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skip} onPress={finish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: isDark ? slide.bgDark : slide.bg }]}>
          <MaterialCommunityIcons name={slide.icon as any} size={64} color={slide.color} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>
      </View>

      <View style={styles.dots}>
        {[...SLIDES, null].map((_, i) => (
          <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={[styles.button, { backgroundColor: slide.color }]} onPress={next}>
        <Text style={styles.buttonText}>Next</Text>
        <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1, backgroundColor: c.bg,
      alignItems: "center", justifyContent: "center", padding: 32,
    },
    skip: { position: "absolute", top: 56, right: 24 },
    skipText: { fontSize: 14, color: c.textMuted, fontWeight: "500" },
    content: { alignItems: "center", width: "100%", marginBottom: 48 },
    iconCircle: {
      width: 140, height: 140, borderRadius: 70,
      justifyContent: "center", alignItems: "center", marginBottom: 36,
    },
    title: {
      fontSize: 26, fontWeight: "800", color: c.text,
      textAlign: "center", marginBottom: 16, lineHeight: 34,
    },
    desc: {
      fontSize: 16, color: c.textSecondary, textAlign: "center",
      lineHeight: 26, maxWidth: width * 0.8,
    },
    estimateRow: { flexDirection: "row", gap: 10, marginTop: 28, flexWrap: "wrap", justifyContent: "center" },
    estimateChip: {
      paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12,
      borderWidth: 2, borderColor: c.border, backgroundColor: c.card,
    },
    estimateChipActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    estimateChipText: { fontSize: 15, fontWeight: "700", color: c.textSecondary },
    estimateChipTextActive: { color: c.primary },
    dots: { flexDirection: "row", gap: 8, marginBottom: 40 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border },
    dotActive: { width: 24, backgroundColor: c.primary },
    button: {
      flexDirection: "row", alignItems: "center", gap: 8,
      borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40,
      width: "100%", justifyContent: "center",
    },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });
}
