import { ReactNode } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
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
  /** Beside the figure, inside the stage: the details screen's logo. */
  aside?: ReactNode;
  /** A back arrow before the title, as on the inner screens. */
  onBack?: () => void;
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
export function ScreenStage({ title, lead, label, figure, meta, lens = false, aside, onBack, children }: Props) {
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
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
      <View style={styles.titleRow}>
        {onBack ? (
          <TouchableOpacity style={styles.back} onPress={onBack} accessibilityRole="button" accessibilityLabel={t("common.a11yBack")} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={STAGE.ink} />
          </TouchableOpacity>
        ) : null}
        {title ? (
          <Text style={[styles.title, styles.titleText]} accessibilityRole="header">{title}</Text>
        ) : (
          <View style={styles.lockup} accessible accessibilityRole="header" accessibilityLabel="Trimio">
            <Image source={MARK_ON_DARK} style={styles.mark} resizeMode="contain" />
            <Text style={styles.title}>Trimio</Text>
          </View>
        )}
      </View>
      {lead || label || figure ? (
        <View style={[styles.block, besideLens, aside ? styles.blockRow : null]}>
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
          <View style={aside ? styles.blockText : null}>
            {lead ? <Text style={styles.lead}>{lead}</Text> : null}
            {label ? <Text style={[styles.label, lead ? styles.afterLead : null]}>{label}</Text> : null}
            {figure ? (
              <Text style={styles.figure} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{figure}</Text>
            ) : null}
          </View>
          {aside}
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
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.s, minHeight: 40 },
  // 40 square with an 8 hit slop, the arrow flush with the text column.
  back: { minWidth: 40, minHeight: 40, justifyContent: "center", marginLeft: -space.s, paddingLeft: space.s },
  titleText: { flex: 1 },
  lockup: { flexDirection: "row", alignItems: "center", gap: space.s, minHeight: 32 },
  // 143 x 152 px at 3x, so 26 x 28 dp keeps its shape.
  mark: { width: 26, height: 28 },
  title: { ...typeScale.title, color: STAGE.ink, minHeight: 32, textAlignVertical: "center" },
  block: { marginTop: space.xl },
  blockRow: { flexDirection: "row", alignItems: "center", gap: space.l },
  blockText: { flex: 1 },
  lead: { ...typeScale.body, color: STAGE.lead },
  label: { ...typeScale.label, color: STAGE.lead },
  afterLead: { marginTop: space.xs },
  figure: { ...typeScale.display, ...tabular, color: STAGE.ink, marginTop: 2 },
  meta: { ...typeScale.body, ...tabular, color: STAGE.lead, marginTop: 2 },
});

/* THE INNER SCREENS' TITLE BAR, 2026-11-28, phase 2: the stack's white header
   replaced by the stage, compact, with the back arrow and the screen's name.
   One header for every inner screen, set once in app/_layout.tsx, so no screen
   can be missed and a new one gets it for free. The arrow shows only when there
   is somewhere to go back to, as the native header did. */
type HeaderProps = { navigation: { goBack: () => void }; options: { title?: string }; back?: unknown };
export function StageHeader({ navigation, options, back }: HeaderProps) {
  return <ScreenStage title={options.title} onBack={back ? () => navigation.goBack() : undefined} />;
}
