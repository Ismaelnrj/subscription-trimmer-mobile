import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
import { track } from "../lib/analytics";

const { width } = Dimensions.get("window");

/* One icon per slide, drawn in ink on a hairline circle. Each slide used to
   carry its own fixed hex (navy, amber, mint) for a tinted circle and the
   button under white text, so the main action changed colour on every step
   and the navy one nearly vanished on the dark ground. */
const SLIDE_ICONS = [
  { icon: "view-dashboard-outline" },
  { icon: "bell-alert-outline" },
  { icon: "lightbulb-on-outline" },
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
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const SLIDES = [
    { ...SLIDE_ICONS[0], title: t("onboarding.slide1Title"), desc: t("onboarding.slide1Desc") },
    { ...SLIDE_ICONS[1], title: t("onboarding.slide2Title"), desc: t("onboarding.slide2Desc") },
    { ...SLIDE_ICONS[2], title: t("onboarding.slide3Title"), desc: t("onboarding.slide3Desc") },
  ];

  const isEstimateStep = current === SLIDES.length;

  useEffect(() => {
    track("onboarding_started");
  }, []);

  const finish = async () => {
    track("onboarding_completed", { step_reached: current, estimate_provided: estimate !== null });
    if (estimate !== null) {
      await SecureStore.setItemAsync(USER_ESTIMATE_KEY, String(estimate));
    }
    await SecureStore.setItemAsync("onboarding_done", "true");
    /* REGISTER, NOT LOGIN. Somebody who has just finished onboarding has no
       account, by definition: `onboarding_done` was unset a moment ago, which
       is the only reason this screen ran at all. Sending them to the sign-in
       form made them read the wrong form, notice a link, and tap again before
       reaching the one they needed.
       This matters more than one tap because it is the FIRST screen after an
       install, and the app is a hard wall: `app/_layout.tsx` bounces every
       unauthenticated user here, so nothing about the product is visible until
       an account exists. Paid installs land on a form, and a form for returning
       users was the worst version of that.
       `_layout.tsx` still sends people to /login when `onboarding_done` is
       already true, which is correct: that IS a returning user. */
    router.replace("/register");
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
        <TouchableOpacity style={styles.skip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={finish} accessibilityRole="button">
          <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
        </TouchableOpacity>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="help-circle-outline" size={44} color={c.text} />
          </View>
          <Text style={styles.title}>{t("onboarding.estimateTitle")}</Text>
          <Text style={styles.desc}>{t("onboarding.estimateDesc")}</Text>
          {/* Chosen is ink, the app wide rule, never mint on a mint tint. */}
          <View style={styles.estimateRow} accessibilityRole="radiogroup">
            {ESTIMATE_OPTIONS.map((opt) => {
              const on = estimate === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.estimateChip, on && styles.estimateChipActive]}
                  onPress={() => setEstimate(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.estimateChipText, on && styles.estimateChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <TouchableOpacity style={styles.button} onPress={finish} accessibilityRole="button">
          <Text style={styles.buttonText}>{t("onboarding.getStarted")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const slide = SLIDES[current];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={finish} accessibilityRole="button">
        <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name={slide.icon as any} size={44} color={c.text} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>
      </View>

      <View style={styles.dots} accessibilityElementsHidden>
        {[...SLIDES, null].map((_, i) => (
          <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={next} accessibilityRole="button">
        <Text style={styles.buttonText}>{t("onboarding.next")}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1, backgroundColor: c.bg,
      alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl, paddingVertical: space.xxl,
    },
    skip: { position: "absolute", top: 56, right: space.xl, minHeight: 40, justifyContent: "center" },
    skipText: { ...typeScale.label, color: c.textSecondary },
    content: { alignItems: "center", width: "100%", marginBottom: 48 },
    iconCircle: {
      width: 96, height: 96, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      backgroundColor: c.card, justifyContent: "center", alignItems: "center", marginBottom: space.xxl,
    },
    title: { ...typeScale.title, fontSize: 24, lineHeight: 31, color: c.text, textAlign: "center", marginBottom: space.m },
    desc: { ...typeScale.body, fontSize: 16, lineHeight: 24, color: c.textSecondary, textAlign: "center", maxWidth: width * 0.82 },
    estimateRow: { flexDirection: "row", gap: space.s, marginTop: space.xl, flexWrap: "wrap", justifyContent: "center" },
    estimateChip: {
      minHeight: 48, minWidth: 64, paddingHorizontal: space.l, borderRadius: radius.m,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.card,
      alignItems: "center", justifyContent: "center",
    },
    estimateChipActive: { borderColor: c.text, backgroundColor: c.text },
    estimateChipText: { ...typeScale.bodyStrong, color: c.textSecondary },
    estimateChipTextActive: { color: c.bg },
    dots: { flexDirection: "row", gap: space.s, marginBottom: space.xxl },
    dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: c.border },
    dotActive: { width: 20, backgroundColor: c.text },
    button: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 52,
      width: "100%", alignItems: "center", justifyContent: "center",
    },
    buttonText: { ...typeScale.bodyStrong, color: c.bg },
  });
}
