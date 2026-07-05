import { useEffect, useRef } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
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
    zIndex: 999,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
});
