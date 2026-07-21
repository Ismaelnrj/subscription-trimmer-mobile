import { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from "react-native-reanimated";
import { AppColors } from "../lib/theme";

interface Props {
  values: number[];
  labels: string[];
  c: AppColors;
}

function Bar({ heightPct, color, delay }: { heightPct: number; color: string; delay: number }) {
  const progress = useSharedValue(0);
  const hasAnimatedIn = useRef(false);

  useEffect(() => {
    if (hasAnimatedIn.current) {
      // Data changed after the initial entrance (e.g. a background refetch)
      // — transition smoothly to the new value instead of replaying the
      // staggered intro delay, which would read as an unwanted flicker.
      progress.value = withTiming(heightPct, { duration: 400, easing: Easing.out(Easing.cubic) });
      return;
    }
    hasAnimatedIn.current = true;
    progress.value = withDelay(delay, withTiming(heightPct, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [heightPct, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({ height: `${progress.value}%` }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, animatedStyle]} />;
}

export function WeeklyBarChart({ values, labels, c }: Props) {
  const rowStyles = makeStyles(c);
  const max = Math.max(...values, 1);

  return (
    <View style={rowStyles.row}>
      {values.map((v, i) => (
        <View key={i} style={rowStyles.column}>
          <View style={rowStyles.track}>
            <Bar heightPct={(v / max) * 100} color={c.primary} delay={i * 80} />
          </View>
          <Text style={rowStyles.label}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: "100%", borderRadius: 4 },
});

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: "row", height: 140, alignItems: "flex-end", justifyContent: "space-between" },
    column: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
    track: { width: "55%", height: "85%", justifyContent: "flex-end" },
    label: { fontSize: 11, color: c.textSecondary, marginTop: 6 },
  });
}
