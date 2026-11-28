import { ReactNode, useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme, useIsDark, space, STAGE, type as typeScale } from "../lib/theme";

// Cut by tools/make-app-marks.py from the generator's own mark; never drawn
// by hand. The light one is Ink Navy, which disappears on the dark ground.
const MARK_ON_LIGHT = require("../assets/brand/mark-on-light.png");
export const MARK_ON_DARK = require("../assets/brand/mark-on-dark.png");
// The flow's art, from the same generator: the navy stage atop sign in and
// sign up (and, from 2026-11-28, the main screens: components/ScreenStage.tsx),
// and the deep waves at the foot of forgot password. Brand art, like the
// launch screen; no screen here sets a mint colour of its own.
export const STAGE_ART = require("../assets/brand/stage.png");
export const STAGE_LENS = require("../assets/brand/stage-lens.png");
const WAVES_ON_LIGHT = require("../assets/brand/waves-on-light.png");
const WAVES_ON_DARK = require("../assets/brand/waves-on-dark.png");
export const STAGE_ASPECT = 1680 / 1284;
const WAVES_ASPECT = 1284 / 240;
// The stage leaves this much of the window below it for the two buttons and
// the link, and folds to COMPACT while the email form is open.
const STAGE_LEAVES = 260;
const STAGE_MIN = 340;
const STAGE_MAX = 560;
const COMPACT = 220;
// The mint lens: its share of the screen width, how much of it hangs off the
// right edge, and how far it keeps above the headline.
const LENS_SHARE = 0.4;
const LENS_OFF = 0.3;
const LENS_CLEAR = space.xl;

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const;

type StageProps = { title: string; lead?: string; compact?: boolean; onBack?: () => void };

/* THE STAGE, the owner's pick of ten (2026-11-26, "Brand panel"): a navy
   panel with the renewal rings across the top of sign in and sign up, the
   same in both themes, with the promise set in light ink at its foot. Below it
   the screen shows two buttons and nothing else, so nobody reads a form before
   they have chosen to sign in with email. Choosing it folds the stage to
   COMPACT and shows the form; `onBack` puts an arrow beside the lockup to
   unfold it again. The root layout paints the status bar STAGE.top over it,
   the colour the art starts at, so the stage runs on into the bar. */
export function AuthStage({ title, lead, compact = false, onBack }: StageProps) {
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation();
  const full = Math.min(STAGE_MAX, Math.max(STAGE_MIN, Math.round(height - STAGE_LEAVES)));
  const target = compact ? COMPACT : full;
  const h = useSharedValue(target);
  useEffect(() => {
    h.value = withTiming(target, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [target]);
  const heightStyle = useAnimatedStyle(() => ({ height: h.value }));
  // Anchored at the top and never narrower than the screen: a shorter stage
  // crops the art's foot, so the rings and the lens stay where they are drawn.
  const artWidth = Math.max(width, full / STAGE_ASPECT);
  // The lens stands on the headline, not on the picture: its foot is kept
  // LENS_CLEAR above the text block, measured, so no language or phone height
  // can push the words into it. It only shows on the full stage.
  const [textHeight, setTextHeight] = useState<number | null>(null);
  const lens = Math.round(width * LENS_SHARE);
  return (
    <Animated.View style={[styles.stage, heightStyle]}>
      <Image
        source={STAGE_ART}
        style={{ position: "absolute", top: 0, left: (width - artWidth) / 2, width: artWidth, height: artWidth * STAGE_ASPECT }}
        resizeMode="stretch"
        {...hidden}
      />
      {!compact && textHeight !== null ? (
        <Image
          source={STAGE_LENS}
          style={{ position: "absolute", width: lens, height: lens, right: -Math.round(lens * LENS_OFF), bottom: space.xxl + textHeight + LENS_CLEAR }}
          {...hidden}
        />
      ) : null}
      <View style={styles.stageTop}>
        {onBack ? (
          <TouchableOpacity style={styles.back} onPress={onBack} accessibilityRole="button" accessibilityLabel={t("common.a11yBack")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={STAGE.ink} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.lockup} accessible accessibilityLabel="Trimio">
          <Image source={MARK_ON_DARK} style={styles.mark} resizeMode="contain" />
          <Text style={[styles.wordmark, { color: STAGE.ink }]}>Trimio</Text>
        </View>
      </View>
      <View style={styles.stageText} onLayout={(e) => setTextHeight(e.nativeEvent.layout.height)}>
        <Text style={[styles.title, { color: STAGE.ink }]} accessibilityRole="header">{title}</Text>
        {lead ? <Text style={[styles.subtitle, { color: STAGE.lead }]}>{lead}</Text> : null}
      </View>
    </Animated.View>
  );
}

type Props = { title: string; subtitle?: ReactNode };

/* The top of forgot password, which has a back button above it: the lockup,
   then one headline, then a quiet line under it, on the page ground. */
export function AuthHeader({ title, subtitle }: Props) {
  const c = useTheme();
  const isDark = useIsDark();
  return (
    <View style={styles.header}>
      <View style={[styles.lockup, styles.lockupSpaced]} accessible accessibilityLabel="Trimio">
        <Image source={isDark ? MARK_ON_DARK : MARK_ON_LIGHT} style={styles.mark} resizeMode="contain" />
        <Text style={[styles.wordmark, { color: c.text }]}>Trimio</Text>
      </View>
      <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

/* The foot of forgot password: the way back (pass it as children), then the
   waves, full bleed. The link sits above the waves, never on them: the deep
   wave would swallow ink text. It takes the screen's spare height, link at
   its top and waves at its bottom. */
export function AuthFooter({ children }: { children: ReactNode }) {
  const isDark = useIsDark();
  // An explicit height, not aspectRatio: the web preview sized the band from
  // the file instead (240 dp), which is not what a phone draws.
  const { width } = useWindowDimensions();
  return (
    <View style={styles.footer}>
      <View style={styles.footerLink}>{children}</View>
      <Image source={isDark ? WAVES_ON_DARK : WAVES_ON_LIGHT} style={{ width, height: Math.round(width / WAVES_ASPECT) }} resizeMode="stretch" {...hidden} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { overflow: "hidden", backgroundColor: STAGE.bottom, borderBottomLeftRadius: space.xxl, borderBottomRightRadius: space.xxl },
  stageTop: { position: "absolute", top: space.l, left: space.xl, right: space.xl, flexDirection: "row", alignItems: "center", gap: space.s },
  back: { minWidth: 40, minHeight: 40, justifyContent: "center", marginLeft: -space.s },
  stageText: { position: "absolute", left: space.xl, right: space.xl, bottom: space.xxl },
  header: { marginBottom: space.l },
  lockup: { flexDirection: "row", alignItems: "center", gap: space.s },
  lockupSpaced: { marginBottom: space.l },
  // 143 x 152 px at 3x, so 30 x 32 dp keeps its shape.
  mark: { width: 30, height: 32 },
  wordmark: { ...typeScale.title },
  title: { ...typeScale.hero },
  subtitle: { ...typeScale.body, marginTop: space.s },
  // The screens pad 24 at the sides and 16 at the foot; the band ignores both.
  footer: { flexGrow: 1, justifyContent: "space-between", gap: space.s, marginHorizontal: -space.xl, marginBottom: -space.l },
  footerLink: { paddingHorizontal: space.xl },
});
