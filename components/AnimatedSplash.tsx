import { useEffect, useRef } from "react";
import { Image, StyleSheet, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

const MIN_DISPLAY_MS = 1100;
const SPLASH_BACKGROUND_COLOR = "#F9FAFB";

type Props = {
  ready: boolean;
  onFinish: () => void;
};

export function AnimatedSplash({ ready, onFinish }: Props) {
  const mountedAt = useRef(Date.now());

  const containerOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 380 });
    logoScale.value = withSpring(1, { damping: 11, stiffness: 120, mass: 0.9 });
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
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      <Animated.View style={logoStyle}>
        <Image source={require("../assets/icon.png")} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <Animated.Text style={[styles.title, logoStyle]}>Trimio</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BACKGROUND_COLOR,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  logo: {
    width: 180,
    height: 180,
    borderRadius: 40,
    overflow: "hidden",
  },
  title: {
    marginTop: 12,
    fontSize: 32,
    fontWeight: "800",
    color: "#7746DD",
    letterSpacing: 0.5,
  },
});
