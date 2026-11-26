import { ReactNode } from "react";
import { View, Text, Image, StyleSheet, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme, useIsDark, space, type as typeScale } from "../lib/theme";

// Cut by tools/make-app-marks.py from the generator's own mark; never drawn
// by hand. The light one is Ink Navy, which disappears on the dark ground.
const MARK_ON_LIGHT = require("../assets/brand/mark-on-light.png");
const MARK_ON_DARK = require("../assets/brand/mark-on-dark.png");
// The flow's art, from the same generator: a deep ringed disc with a mint
// lens off the top right corner, and deep waves at the foot. Brand art, like
// the launch screen; no screen here sets a mint colour of its own.
const CORNER_ON_LIGHT = require("../assets/brand/corner-on-light.png");
const CORNER_ON_DARK = require("../assets/brand/corner-on-dark.png");
const WAVES_ON_LIGHT = require("../assets/brand/waves-on-light.png");
const WAVES_ON_DARK = require("../assets/brand/waves-on-dark.png");
const CORNER_ASPECT = 528 / 660;
const WAVES_ASPECT = 1284 / 240;
// The corner art's share of the screen width. It ends above the headline,
// clear of the lockup and the label, at 360 and 393 dp wide in both
// languages, measured in Chromium.
const CORNER_SHARE = 0.56;

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const;

type Props = { title: string; subtitle?: ReactNode; brand?: boolean };

/* The top of the sign in flow. With `brand` (sign in, sign up): the corner
   art, the lockup, a small label saying what Trimio is, then the headline and
   a lead. Without it (forgot password, which has a back button above): the
   lockup, headline and lead only.

   ASSUMES the screen pads space.l at the top and space.xl at the sides,
   which the corner art reaches past to sit in the screen's own corner. */
export function AuthHeader({ title, subtitle, brand = false }: Props) {
  const c = useTheme();
  const isDark = useIsDark();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const artWidth = Math.round(width * CORNER_SHARE);
  return (
    <View style={styles.header}>
      {brand ? (
        <Image
          source={isDark ? CORNER_ON_DARK : CORNER_ON_LIGHT}
          style={[styles.corner, { width: artWidth, height: Math.round(artWidth * CORNER_ASPECT) }]}
          resizeMode="stretch"
          {...hidden}
        />
      ) : null}
      <View style={styles.lockup} accessible accessibilityLabel="Trimio">
        <Image source={isDark ? MARK_ON_DARK : MARK_ON_LIGHT} style={styles.mark} resizeMode="contain" />
        <Text style={[styles.wordmark, { color: c.text }]}>Trimio</Text>
      </View>
      {brand ? (
        <View style={styles.eyebrowBlock}>
          <Text style={[styles.eyebrow, { color: c.textSecondary }]}>{t("auth.eyebrow")}</Text>
          <View style={[styles.rule, { backgroundColor: c.text }]} />
        </View>
      ) : null}
      <Text style={[styles.title, brand && styles.titleBeside, { color: c.text }]} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

/* What Trimio does, in three true words each, under the sign in button. No
   privacy promise: "your data stays private" is not something a list on a
   server can say, but "no bank login" is simply true. */
export function AuthFeatures() {
  const c = useTheme();
  const { t } = useTranslation();
  const items = [
    ["bell-outline", t("auth.featureReminders")],
    ["book-open-variant", t("auth.featureGuides")],
    ["shield-check-outline", t("auth.featureNoBank")],
  ] as const;
  return (
    <View style={styles.features}>
      {items.map(([icon, label], i) => (
        <View key={icon} style={[styles.feature, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.border }]}>
          <MaterialCommunityIcons name={icon} size={22} color={c.text} />
          <Text style={[styles.featureText, { color: c.textSecondary }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/* The foot of the sign in flow: the switch between signing in and signing
   up (pass it as children), then the waves, full bleed. The link sits above
   the waves, never on them: the deep wave would swallow ink text. It takes
   the screen's spare height, link at its top and waves at its bottom, so the
   link stays by the button and the waves stay on the floor. */
export function AuthFooter({ children, features = false }: { children: ReactNode; features?: boolean }) {
  const isDark = useIsDark();
  // An explicit height, not aspectRatio: the web preview sized the band from
  // the file instead (240 dp), which is not what a phone draws.
  const { width } = useWindowDimensions();
  return (
    <View style={styles.footer}>
      <View style={styles.footerLink}>
        {children}
        {features ? <AuthFeatures /> : null}
      </View>
      <Image source={isDark ? WAVES_ON_DARK : WAVES_ON_LIGHT} style={{ width, height: Math.round(width / WAVES_ASPECT) }} resizeMode="stretch" {...hidden} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: space.l },
  corner: { position: "absolute", top: -space.l, right: -space.xl },
  lockup: { flexDirection: "row", alignItems: "center", gap: space.s, marginBottom: space.l },
  // 143 x 152 px at 3x, so 36 x 38 dp keeps its shape.
  mark: { width: 36, height: 38 },
  wordmark: { ...typeScale.brand },
  eyebrowBlock: { marginBottom: space.s },
  eyebrow: { ...typeScale.label, letterSpacing: 2.4, textTransform: "uppercase" },
  rule: { width: 28, height: 3, borderRadius: 2, marginTop: space.s },
  title: { ...typeScale.hero },
  subtitle: { ...typeScale.body, marginTop: space.s },
  // Not tighter: German keeps "abgebucht wird." together (a no break space),
  // and at 360 dp anything under about 88% splits the word itself.
  titleBeside: { maxWidth: "92%" },
  features: { flexDirection: "row", marginTop: space.xs, marginBottom: space.xs },
  feature: { flex: 1, alignItems: "center", gap: space.xs, paddingHorizontal: space.xs },
  featureText: { ...typeScale.caption, textAlign: "center" },
  // The screens pad 24 at the sides and 16 at the foot; the band ignores both.
  footer: { flexGrow: 1, justifyContent: "space-between", gap: space.s, marginHorizontal: -space.xl, marginBottom: -space.l },
  footerLink: { paddingHorizontal: space.xl },
});
