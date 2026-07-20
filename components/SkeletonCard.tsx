import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useTheme, AppColors } from "../lib/theme";

// Placeholder shown while the subscriptions list is loading, shaped to match
// the real card layout so the loading state doesn't flash the "no
// subscriptions yet" empty state before data arrives.
export function SkeletonCard() {
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
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[styles.bar, { width: "50%", opacity: pulse }]} />
        <Animated.View style={[styles.bar, { width: "35%", opacity: pulse }]} />
        <Animated.View style={[styles.bar, { width: "40%", opacity: pulse }]} />
        <Animated.View style={[styles.badge, { opacity: pulse }]} />
      </View>
      <Animated.View style={[styles.iconCircle, { opacity: pulse }]} />
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: c.border, flexDirection: "row",
      justifyContent: "space-between", alignItems: "flex-start",
    },
    bar: { height: 10, borderRadius: 4, backgroundColor: c.skeleton, marginBottom: 8 },
    badge: { height: 16, width: 60, borderRadius: 4, backgroundColor: c.skeletonHighlight, marginTop: 4 },
    iconCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: c.skeleton },
  });
}
