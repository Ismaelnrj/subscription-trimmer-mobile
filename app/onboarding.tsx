import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { useTheme, useIsDark, AppColors } from "../lib/theme";

const { width } = Dimensions.get("window");

const SLIDE_ICONS = [
  { icon: "view-dashboard-outline", color: "#6C3EF4", bg: "#EDE9FE", bgDark: "#2E2350" },
  { icon: "bell-alert-outline", color: "#F5A623", bg: "#FEF3E2", bgDark: "#3A2C14" },
  { icon: "lightbulb-on-outline", color: "#2EC771", bg: "#E3F9EE", bgDark: "#0F2E1F" },
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
  const isDark = useIsDark();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const SLIDES = [
    { ...SLIDE_ICONS[0], title: t("onboarding.slide1Title"), desc: t("onboarding.slide1Desc") },
    { ...SLIDE_ICONS[1], title: t("onboarding.slide2Title"), desc: t("onboarding.slide2Desc") },
    { ...SLIDE_ICONS[2], title: t("onboarding.slide3Title"), desc: t("onboarding.slide3Desc") },
  ];

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
          <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: isDark ? "#2E2350" : "#EDE9FE" }]}>
            <MaterialCommunityIcons name="help-circle-outline" size={64} color={c.primary} />
          </View>
          <Text style={styles.title}>{t("onboarding.estimateTitle")}</Text>
          <Text style={styles.desc}>{t("onboarding.estimateDesc")}</Text>

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
          <Text style={styles.buttonText}>{t("onboarding.getStarted")}</Text>
          <MaterialCommunityIcons name="arrow-right-circle" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  const slide = SLIDES[current];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skip} onPress={finish}>
        <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
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
        <Text style={styles.buttonText}>{t("onboarding.next")}</Text>
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
