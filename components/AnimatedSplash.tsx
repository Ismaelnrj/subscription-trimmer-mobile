import { useEffect, useRef } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from "react-native-reanimated";

const MIN_DISPLAY_MS = 1100;
const SPLASH_BACKGROUND_COLOR = "#FBFBFD";

type Props = {
  ready: boolean;
  onFinish: () => void;
};

// Renders the exact same image as the native splash screen (app.json's
// "splash.image") so there's no handoff moment where the design changes —
// this component only owns the fade-to-app transition once loading is done.
export function AnimatedSplash({ ready, onFinish }: Props) {
  const mountedAt = useRef(Date.now());
  const containerOpacity = useSharedValue(1);

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

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      <Image source={require("../assets/splash.png")} style={styles.image} resizeMode="contain" />
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
  image: {
    width: "100%",
    height: "100%",
  },
});
