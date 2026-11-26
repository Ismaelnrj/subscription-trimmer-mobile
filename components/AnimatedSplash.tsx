import { useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import layout from "../assets/splash-layers/layout.json";

const MIN_DISPLAY_MS = 1100;
const FADE_OUT_MS = 320;
// Warm White, the brand ground. Matches splash.backgroundColor in app.json
// so the OS splash and this screen are the same colour and the handover
// between them is invisible.
const SPLASH_BACKGROUND_COLOR = "#F7F6F1";

// Android draws the OS splash logo (assets/splash-icon.png) 200 dp wide:
// app.json uses the top level `splash` key, for which @expo/prebuild-config
// sets imageWidth 200 (getAndroidSplashConfig). The mark fills 31% of that
// image (make-splash.py draws it at 0.62 of a canvas twice the size). The
// mark starts at exactly that size and place, so the moment this screen
// takes over cannot be seen. Configuring expo-splash-screen's plugin with an
// imageWidth would change the first number.
const OS_MARK_DP = 200 * 0.31;

type LayerName = keyof typeof layout.layers;

// The pieces of assets/splash.png, cut by tools/make-splash.py.
const SOURCES: Record<LayerName, number> = {
  wave_back: require("../assets/splash-layers/wave_back.png"),
  wave_front: require("../assets/splash-layers/wave_front.png"),
  ring_outer: require("../assets/splash-layers/ring_outer.png"),
  ring_mid: require("../assets/splash-layers/ring_mid.png"),
  ring_inner: require("../assets/splash-layers/ring_inner.png"),
  arcs: require("../assets/splash-layers/arcs.png"),
  mark: require("../assets/splash-layers/mark.png"),
  bell: require("../assets/splash-layers/bell.png"),
  calendar: require("../assets/splash-layers/calendar.png"),
  dots: require("../assets/splash-layers/dots.png"),
  word: require("../assets/splash-layers/word.png"),
  tag: require("../assets/splash-layers/tag.png"),
};

// When each piece moves, in ms from the first visible frame. o is opacity,
// s scale, y a rise in canvas pixels, r a turn in degrees; "os" means the
// mark's start on the OS splash and "below" a wave's own height. The
// prototype the owner approved ran this same table.
type Step = {
  start: number;
  dur: number;
  o?: [number, number];
  s?: [number | "os", number];
  y?: [number | "os", number] | "below";
  r?: [number, number];
  back?: boolean;
};
// Declaration order is paint order, back to front: Layer renders in it.
const TIMELINE: Record<LayerName, Step> = {
  wave_back: { start: 120, dur: 560, y: "below" },
  wave_front: { start: 200, dur: 560, y: "below" },
  ring_outer: { start: 300, dur: 420, o: [0, 1], s: [0.7, 1] },
  ring_mid: { start: 240, dur: 420, o: [0, 1], s: [0.7, 1] },
  ring_inner: { start: 180, dur: 420, o: [0, 1], s: [0.7, 1] },
  arcs: { start: 300, dur: 480, o: [0, 1], r: [-30, 0] },
  mark: { start: 0, dur: 520, s: ["os", 1], y: ["os", 0] },
  bell: { start: 380, dur: 340, o: [0, 1], s: [0.4, 1], back: true },
  calendar: { start: 440, dur: 340, o: [0, 1], s: [0.4, 1], back: true },
  dots: { start: 460, dur: 260, o: [0, 1] },
  word: { start: 420, dur: 360, o: [0, 1], y: [40, 0] },
  tag: { start: 520, dur: 360, o: [0, 1], y: [40, 0] },
};
const MOTION_MS = 880;

function outCubic(p: number) {
  "worklet";
  return 1 - Math.pow(1 - p, 3);
}
function outBack(p: number) {
  "worklet";
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
}

type Geometry = { k: number; ox: number; oy: number; markScale0: number; markDy0: number };

// The same cover scaling the flat image used: the 1284 x 2778 canvas
// scaled to fill the screen, centred, the overflow cropped.
function geometryFor(width: number, height: number): Geometry {
  const [cw, ch] = layout.canvas;
  const k = Math.max(width / cw, height / ch);
  const ox = (width - cw * k) / 2;
  const oy = (height - ch * k) / 2;
  return {
    k,
    ox,
    oy,
    markScale0: OS_MARK_DP / (layout.markHeight * k),
    markDy0: (height / 2 - (oy + layout.centre[1] * k)) / k,
  };
}

function Layer({ name, t, geo }: { name: LayerName; t: SharedValue<number>; geo: Geometry }) {
  const [x0, y0, x1, y1] = layout.layers[name];
  const step = TIMELINE[name];
  const { k, markScale0, markDy0 } = geo;
  const style = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, (t.value - step.start) / step.dur));
    const e = step.back ? outBack(raw) : outCubic(raw);
    let opacity = 1;
    let scale = 1;
    let rise = 0;
    let turn = 0;
    if (step.o) opacity = step.o[0] + (step.o[1] - step.o[0]) * e;
    if (step.s) {
      const from = step.s[0] === "os" ? markScale0 : step.s[0];
      scale = from + (step.s[1] - from) * e;
    }
    if (step.y === "below") rise = (y1 - y0) * (1 - e);
    else if (step.y) {
      const from = step.y[0] === "os" ? markDy0 : step.y[0];
      rise = from + (step.y[1] - from) * e;
    }
    if (step.r) turn = step.r[0] + (step.r[1] - step.r[0]) * e;
    return {
      opacity,
      transform: [{ translateY: rise * k }, { scale }, { rotate: `${turn}deg` }],
    };
  });
  return (
    <Animated.Image
      source={SOURCES[name]}
      style={[
        {
          position: "absolute",
          left: geo.ox + x0 * k,
          top: geo.oy + y0 * k,
          width: (x1 - x0) * k,
          height: (y1 - y0) * k,
        },
        style,
      ]}
    />
  );
}

type Props = {
  ready: boolean;
  onFinish: () => void;
};

// Android 12+'s native Splash Screen API can only show a small centered
// icon on a solid color, so the illustrated scene lives here, in pieces.
// The root layout hides the OS splash as soon as this tree mounts, so this
// screen is visible from mount: the motion starts then, growing the OS
// splash's small mark into place while the rest of the picture draws in
// around it. It is still by MOTION_MS, well inside the MIN_DISPLAY_MS hold,
// so the launch takes no longer than the still picture did.
//
// The hold counts from `ready` (auth and onboarding state restored), not
// from mount, so a fast init still shows the finished picture for a moment
// and a slow one holds it, finished, for as long as init takes.
export function AnimatedSplash({ ready, onFinish }: Props) {
  const containerOpacity = useSharedValue(1);
  const finished = useRef(false);
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? MOTION_MS : 0);
  const window = useWindowDimensions();
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const geo = geometryFor(size.width, size.height);

  const finishOnce = () => {
    if (finished.current) return;
    finished.current = true;
    onFinish();
  };

  useEffect(() => {
    if (reduceMotion) return;
    t.value = withTiming(MOTION_MS, { duration: MOTION_MS, easing: Easing.linear });
  }, []);

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

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== size.width || height !== size.height)) {
      setSize({ width, height });
    }
  };

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none" onLayout={onLayout}>
      {(Object.keys(TIMELINE) as LayerName[]).map((name) => (
        <Layer key={name} name={name} t={t} geo={geo} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BACKGROUND_COLOR,
    zIndex: 999,
    overflow: "hidden",
  },
});
