import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useTheme, AppColors } from "../lib/theme";

// Generic placeholder shown while the dashboard's summary data is loading.
// Approximates the general shape (a summary block, a row of stat tiles, a
// short list) rather than replicating every conditional banner exactly —
// this screen has too many optional sections to mirror precisely, but a
// plain spinner still leaves an unfinished-feeling blank gap before content.
export function DashboardSkeleton() {
  const c = useTheme();
  const styles = makeStyles(c);
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.summaryBlock, { opacity: pulse }]} />
      <View style={styles.statRow}>
        <Animated.View style={[styles.statTile, { opacity: pulse }]} />
        <Animated.View style={[styles.statTile, { opacity: pulse }]} />
        <Animated.View style={[styles.statTile, { opacity: pulse }]} />
      </View>
      <Animated.View style={[styles.listRow, { opacity: pulse }]} />
      <Animated.View style={[styles.listRow, { opacity: pulse }]} />
      <Animated.View style={[styles.listRow, { opacity: pulse }]} />
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { padding: 16 },
    summaryBlock: { height: 110, borderRadius: 16, backgroundColor: c.skeleton, marginBottom: 16 },
    statRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
    statTile: { flex: 1, height: 64, borderRadius: 12, backgroundColor: c.skeleton },
    listRow: { height: 56, borderRadius: 12, backgroundColor: c.skeletonHighlight, marginBottom: 10 },
  });
}
