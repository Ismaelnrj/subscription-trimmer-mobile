import { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from "react-native-reanimated";
import { AppColors, space, type as typeScale, tabular } from "../lib/theme";

interface Props {
  values: number[];
  labels: string[];
  /** Writes the amount printed on each column's cap. */
  formatValue?: (n: number) => string;
  c: AppColors;
}

/* Column height in px, for the tallest week. The others scale from it. */
const PLOT = 112;

function Bar({ heightPct, color, delay }: { heightPct: number; color: string; delay: number }) {
  const progress = useSharedValue(0);
  const hasAnimatedIn = useRef(false);

  useEffect(() => {
    if (hasAnimatedIn.current) {
      // Data changed after the initial entrance (a background refetch):
      // transition to the new value instead of replaying the staggered intro,
      // which would read as an unwanted flicker.
      progress.value = withTiming(heightPct, { duration: 400, easing: Easing.out(Easing.cubic) });
      return;
    }
    hasAnimatedIn.current = true;
    progress.value = withDelay(delay, withTiming(heightPct, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [heightPct, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({ height: `${progress.value}%` }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, animatedStyle]} />;
}

/* Four weeks of one month, answering the panel's own promise: which week hits
   hardest. That week is the one in the accent; the rest sit in a quiet grey,
   which is the dataviz skill's "emphasis" form. Each column carries its
   amount on the cap, since four numbers is a table a reader wants whole.
   Columns are capped at 24px wide and grow from one baseline, square at the
   bottom and rounded 4px at the top. A quiet week draws no column over the
   baseline, which is what it is. */
export function WeeklyBarChart({ values, labels, formatValue, c }: Props) {
  const s = makeStyles(c);
  const max = Math.max(...values, 0);

  return (
    <View>
      <View style={s.plot}>
        {values.map((v, i) => {
          const top = max > 0 && v === max;
          return (
            <View
              key={i}
              style={s.column}
              accessible
              accessibilityLabel={`${labels[i]}: ${formatValue ? formatValue(v) : String(v)}`}
            >
              {/* A quiet week carries no figure: "~0,00 €" says nothing a missing
                  column does not, and a tilde on nothing is noise. */}
              {formatValue && v > 0 && <Text style={[s.value, top && s.valueTop]} numberOfLines={1}>{formatValue(v)}</Text>}
              {/* The slot is the column's final height, so the amount above it
                  sits on the cap while the column grows into it. */}
              <View style={[s.slot, { height: max > 0 ? Math.round((v / max) * PLOT) : 0 }]}>
                <Bar heightPct={100} color={top ? c.primary : c.textMuted} delay={i * 80} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={s.baseline} />
      <View style={s.labels}>
        {labels.map((l, i) => (
          <Text key={i} style={s.label} numberOfLines={1}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: "100%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
});

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    plot: { flexDirection: "row", alignItems: "flex-end", minHeight: PLOT + 24 },
    column: { flex: 1, alignItems: "center" },
    slot: { width: 24, justifyContent: "flex-end" },
    value: { ...typeScale.caption, ...tabular, color: c.textSecondary, marginBottom: space.xs },
    valueTop: { color: c.text },
    baseline: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    labels: { flexDirection: "row", marginTop: space.s },
    label: { ...typeScale.caption, color: c.textSecondary, flex: 1, textAlign: "center" },
  });
}
