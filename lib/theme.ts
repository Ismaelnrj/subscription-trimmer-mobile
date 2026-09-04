import { useColorScheme } from "react-native";
import { useThemeStore } from "./theme-store";

/* Trimio brand palette: Ink Navy, Warm White, Soft Mint, with Slate, Warm
   Amber and Muted Coral in supporting roles. The light theme's ground,
   card, rule, ink, slate and mint are the same values the landing page
   uses, so the app and the site read as one product. The intended weighting is
   roughly 60% warm white, 25% ink navy, 10% mint, 5% everything else, so
   mint is an accent and never a workhorse.
 *
 * Two contrast rules keep that palette honest, both measured, not guessed:
 *   - Soft Mint #55C6A3 carries white text at only 2.1:1 and reads as body
 *     text on warm white at 1.9:1. It is never a fill behind white and
 *     never running text on a light ground. It marks things: active tabs,
 *     status pills (navy on mint is 7.0:1), chart series, small signals.
 *   - `primary` is used both as a fill behind white text and as text on a
 *     surface, so it has to work in both directions. Ink Navy does that on
 *     light (14.6:1 under white). On dark, #2F8E71 is the mint that
 *     balances the same way the old violet did, better in fact: 4.0:1
 *     under white and 3.9:1 on the card, against the violet's 4.0 and 3.8.
 *     The bright mint lives in `accent`, where nothing sits on top of it. */
export const LIGHT = {
  bg: "#F7F6F1",
  card: "#FCFBF8",
  border: "#DCDEDB",
  text: "#142B3A",
  textSecondary: "#52616B",
  textMuted: "#8B949C",
  primary: "#142B3A",
  primaryLight: "#E7EBEE",
  accent: "#55C6A3",
  accentLight: "#DDF4EC",
  danger: "#C4544A",
  dangerLight: "#FBEEEC",
  dangerBorder: "#F0CFCA",
  warning: "#96631B",
  warningLight: "#FDF3E4",
  warningBorder: "#F0DDBA",
  success: "#1F7A62",
  inputBg: "#FFFFFF",
  placeholder: "#8B949C",
  tabBar: "#FCFBF8",
  tabBarBorder: "#DCDEDB",
  tabBarActive: "#142B3A",
  tabBarInactive: "#8B949C",
  overlay: "rgba(20,43,58,0.55)",
  skeleton: "#E9E6DE",
  skeletonHighlight: "#F3F1EA",
} as const;

export const DARK = {
  bg: "#0E1A22",
  card: "#16242E",
  border: "#24343E",
  text: "#F2F1EC",
  textSecondary: "#93A3AD",
  textMuted: "#6E7E88",
  primary: "#2F8E71",
  primaryLight: "#16342C",
  accent: "#55C6A3",
  accentLight: "#16342C",
  danger: "#F0857A",
  dangerLight: "#3A201D",
  dangerBorder: "#5C302B",
  warning: "#EFB264",
  warningLight: "#3A2C14",
  warningBorder: "#5C4520",
  success: "#55C6A3",
  inputBg: "#16242E",
  placeholder: "#6E7E88",
  tabBar: "#101E28",
  tabBarBorder: "#24343E",
  tabBarActive: "#55C6A3",
  tabBarInactive: "#6E7E88",
  overlay: "rgba(0,0,0,0.7)",
  skeleton: "#24343E",
  skeletonHighlight: "#2E3F4A",
} as const;

export type AppColors = Record<keyof typeof LIGHT, string>;

function useResolvedScheme(): "light" | "dark" {
  const scheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const resolved = mode === "system" ? scheme : mode;
  return resolved === "dark" ? "dark" : "light";
}

export function useTheme(): AppColors {
  return useResolvedScheme() === "dark" ? DARK : LIGHT;
}

export function useIsDark(): boolean {
  return useResolvedScheme() === "dark";
}
