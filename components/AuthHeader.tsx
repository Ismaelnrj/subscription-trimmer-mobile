import { ReactNode } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useTheme, useIsDark, space, type as typeScale } from "../lib/theme";

// Cut by tools/make-app-marks.py from the generator's own mark; never drawn
// by hand. The light one is Ink Navy, which disappears on the dark ground.
const MARK_ON_LIGHT = require("../assets/brand/mark-on-light.png");
const MARK_ON_DARK = require("../assets/brand/mark-on-dark.png");

type Props = { title: string; subtitle?: ReactNode };

/* The top of the sign in flow (login, register, forgot password): the mark
   and the name as one lockup, then one headline that leads the screen, then a
   quiet line under it. Left aligned, so the screen reads as designed rather
   than as a centred template stack. */
export function AuthHeader({ title, subtitle }: Props) {
  const c = useTheme();
  const isDark = useIsDark();
  return (
    <View style={styles.header}>
      <View style={styles.lockup} accessible accessibilityLabel="Trimio">
        <Image source={isDark ? MARK_ON_DARK : MARK_ON_LIGHT} style={styles.mark} resizeMode="contain" />
        <Text style={[styles.wordmark, { color: c.text }]}>Trimio</Text>
      </View>
      <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: space.xxl },
  lockup: { flexDirection: "row", alignItems: "center", gap: space.s, marginBottom: space.xxl + space.l },
  // 143 x 152 px at 3x, so 30 x 32 dp keeps its shape.
  mark: { width: 30, height: 32 },
  wordmark: { ...typeScale.title },
  title: { ...typeScale.hero },
  subtitle: { ...typeScale.body, marginTop: space.s },
});
