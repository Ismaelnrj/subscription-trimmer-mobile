import { useEffect, useRef } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from "react-native-reanimated";

const MIN_DISPLAY_MS = 1100;
const FADE_OUT_MS = 320;
const SPLASH_BACKGROUND_COLOR = "#FEFEFE";

type Props = {
  ready: boolean;
  onFinish: () => void;
};

// Android 12+'s native Splash Screen API can only show a small centered
// icon on a solid color — it can't render a full illustrated scene, so the
// rich design lives here instead, in a normal full-screen Image unconstrained
// by that OS rule. This briefly follows the native icon-only splash rather
// than replacing it. This component only owns the fade-to-app transition.
//
// This view mounts (and starts running) while still hidden behind the
// native icon splash, since `ready` only flips true once auth/network
// init resolves — often well past MIN_DISPLAY_MS on its own. The parent
// calls SplashScreen.hideAsync() at that same `ready` transition, which is
// the moment this illustration actually becomes visible, so MIN_DISPLAY_MS
// must count from there, not from mount — otherwise a slow init makes this
// screen flash by for a few milliseconds instead of holding as intended.
export function AnimatedSplash({ ready, onFinish }: Props) {
  const containerOpacity = useSharedValue(1);
  const finished = useRef(false);

  const finishOnce = () => {
    if (finished.current) return;
    finished.current = true;
    onFinish();
  };

  useEffect(() => {
    if (!ready) return;
    let safety: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      containerOpacity.value = withTiming(0, { duration: FADE_OUT_MS }, (didFinish) => {
        if (didFinish) runOnJS(finishOnce)();
      });
      // Reanimated's completion callback can fail to fire in edge cases
      // (e.g. the JS thread being busy at startup), which would otherwise
      // leave this overlay stuck on screen indefinitely at partial opacity.
      // This guarantees it always gets dismissed regardless.
      safety = setTimeout(finishOnce, FADE_OUT_MS + 250);
    }, MIN_DISPLAY_MS);
    return () => {
      clearTimeout(timer);
      if (safety) clearTimeout(safety);
    };
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
