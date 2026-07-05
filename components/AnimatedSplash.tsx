import { useEffect, useRef } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useTheme } from "../lib/theme";

const MIN_DISPLAY_MS = 1100;

type Props = {
  ready: boolean;
  onFinish: () => void;
};

export function AnimatedSplash({ ready, onFinish }: Props) {
  const c = useTheme();
  const mountedAt = useRef(Date.now());

  const containerOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.5);
  const logoRotate = useSharedValue(-8);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(12);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 9, stiffness: 120, mass: 0.9 });
    logoRotate.value = withSpring(0, { damping: 10, stiffness: 100 });
    textOpacity.value = withDelay(280, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    textTranslateY.value = withDelay(280, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const elapsed = Date.now() - mountedAt.current;
    const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);
    const timer = setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: 320 }, (finished) => {
        if (finished) runOnJS(onFinish)();
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [ready]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }, { rotate: `${logoRotate.value}deg` }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: c.bg }, containerStyle]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.iconBg, logoStyle]}>
        <Image source={require("../assets/adaptive-icon.png")} style={styles.icon} resizeMode="contain" />
      </Animated.View>
      <Animated.Text style={[styles.title, { color: c.primary }, textStyle]}>Trimio</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  iconBg: {
    width: 128,
    height: 128,
    borderRadius: 30,
    backgroundColor: "#7746DD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#7746DD",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  icon: {
    width: 84,
    height: 84,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
  },
});
