import { ReactNode } from "react";
import { View, Text, Image, StyleSheet, useWindowDimensions } from "react-native";
import { space, STAGE, type as typeScale, tabular } from "../lib/theme";
import { MARK_ON_DARK, STAGE_ART, STAGE_ASPECT, STAGE_LENS } from "./AuthHeader";

// The lens beside the figure on the dashboard: its share of the screen width,
// and how much of it hangs off the right edge.
const LENS_SHARE = 0.3;
const LENS_OFF = 0.38;

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const;

type Props = {
  /** The screen's name. Without one the stage carries the Trimio lockup. */
  title?: string;
  /** A line under the title, before the figure: the dashboard's greeting. */
  lead?: string;
  /** What the figure is, said small above it. */
  label?: string;
  /** The one figure the screen is about, already formatted. */
  figure?: string;
  /** The line under the figure. */
  meta?: string;
  lens?: boolean;
  children?: ReactNode;
};

/* THE STAGE ON THE MAIN SCREENS, 2026-11-28, the owner's "yes, do it" to
   carrying the sign in flow's navy stage through the app. The white title bar
   is gone from the tabs; each screen opens on this panel instead, the same in
   both themes, with its name and its one figure set in light ink. The root
   layout paints the status bar STAGE.top, the colour the art starts at, so the
   stage runs on into the bar exactly as it does on sign in.

   It scrolls with the screen rather than staying pinned: it is a headline,
   and a pinned one would eat a quarter of every list.

   Only STAGE.ink and STAGE.lead are set on it (12.9:1 and 9.3:1 at the top,
   8.7:1 and 6.3:1 at the foot). Anything coloured, a budget over its limit, a
   warning, stays below it on the ground, where the theme's own colours were
   measured. */
export function ScreenStage({ title, lead, label, figure, meta, lens = false, children }: Props) {
  const { width } = useWindowDimensions();
  const lensSize = Math.round(width * LENS_SHARE);
  // The rows beside the lens stop short of it, so a long figure shrinks to
  // fit instead of running under it. The line below the figure is clear of it.
  const besideLens = lens ? { paddingRight: Math.round(lensSize * (1 - LENS_OFF)) + space.s } : null;
  return (
    <View style={styles.stage}>
      <Image
        source={STAGE_ART}
        style={{ position: "absolute", top: 0, left: 0, width, height: width * STAGE_ASPECT }}
        resizeMode="stretch"
        {...hidden}
      />
      {title ? (
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
      ) : (
        <View style={styles.lockup} accessible accessibilityRole="header" accessibilityLabel="Trimio">
          <Image source={MARK_ON_DARK} style={styles.mark} resizeMode="contain" />
          <Text style={styles.title}>Trimio</Text>
        </View>
      )}
      {lead || label || figure ? (
        <View style={[styles.block, besideLens]}>
          {lens ? (
            <Image
              source={STAGE_LENS}
              style={{
                position: "absolute", width: lensSize, height: lensSize, top: "50%", marginTop: -lensSize / 2,
                right: -(space.xl + Math.round(lensSize * LENS_OFF)),
              }}
              {...hidden}
            />
          ) : null}
          {lead ? <Text style={styles.lead}>{lead}</Text> : null}
          {label ? <Text style={[styles.label, lead ? styles.afterLead : null]}>{label}</Text> : null}
          {figure ? (
            <Text style={styles.figure} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{figure}</Text>
          ) : null}
        </View>
      ) : null}
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    overflow: "hidden", backgroundColor: STAGE.bottom,
    borderBottomLeftRadius: space.xxl, borderBottomRightRadius: space.xxl,
    paddingHorizontal: space.xl, paddingTop: space.m, paddingBottom: space.xl,
  },
  lockup: { flexDirection: "row", alignItems: "center", gap: space.s, minHeight: 32 },
  // 143 x 152 px at 3x, so 26 x 28 dp keeps its shape.
  mark: { width: 26, height: 28 },
  title: { ...typeScale.title, color: STAGE.ink, minHeight: 32, textAlignVertical: "center" },
  block: { marginTop: space.xl },
  lead: { ...typeScale.body, color: STAGE.lead },
  label: { ...typeScale.label, color: STAGE.lead },
  afterLead: { marginTop: space.xs },
  figure: { ...typeScale.display, ...tabular, color: STAGE.ink, marginTop: 2 },
  meta: { ...typeScale.body, ...tabular, color: STAGE.lead, marginTop: 2 },
});
