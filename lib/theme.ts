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
 *     The bright mint lives in `accent`, where nothing sits on top of it. *
 *   THE QUIET GREY FAILED CONTRAST IN BOTH THEMES, fixed 2026-09-21 by
 *   measuring rather than by looking. `textMuted`, `placeholder` and
 *   `tabBarInactive` all shared one hex per theme, and every one of the six
 *   pairings was under the 4.5:1 floor for text:
 *
 *     light #8B949C  2.85:1 on bg, 2.98:1 on card, 3.08:1 on inputBg
 *     dark  #6E7E88  4.21:1 on bg, 3.77:1 on card, 4.04:1 on the tab bar
 *
 *   The light one was under even the 3:1 large-text and UI floor, so there was
 *   no size at which it became acceptable. It was used in 27 text styles and
 *   12 icons across 19 files, so this was never one screen's bug: it was a
 *   token that cannot carry text being asked to carry text.
 *
 *   NOW light #67717A and dark #8695A0, which clear 4.5:1 against every ground
 *   they actually render on: 4.60 / 4.81 / 4.98 light, 5.73 / 5.14 / 5.51
 *   dark. Chosen as the lightest value that clears the floor on the TIGHTEST
 *   ground in each theme, so muted text stays as quiet as the 60/25/10 palette
 *   weighting wants while still being readable.
 *
 *   `lib/categories.ts` ALSO HOLDS #8B949C, as the `other` category colour,
 *   and it is deliberately NOT changed. That is a dot rather than text, it
 *   belongs to a categorical palette validated on its own adjacency pairlist,
 *   and the calendar legend already answers its 2.98:1 by naming the category
 *   beside the swatch. Changing it would need the adjacency check re-run.
 *
 *   __tests__/theme-contrast.test.js computes these ratios from this file, so
 *   a future edit that reintroduces a failing grey fails in CI rather than
 *   shipping. That is the half that matters: this defect survived months of
 *   looking at the app.
 *
 *   THE LIGHT DANGER COLOUR ALSO FAILED, and it is the worst of the set,
 *   because error text is the text a user most needs to read. `#C4544A` was
 *   recorded in two places as "the text version of coral", and measured it is
 *   4.12:1 on the ground, 4.30:1 on the card and 3.93:1 on `dangerLight`,
 *   which is where an error message actually sits. It was also a FILL behind
 *   white at 11 call sites, and white on it is 4.45:1, so it failed in both
 *   directions at once.
 *   Now `#B8473D`: 4.84 on bg, 5.06 on card, 4.63 on dangerLight, and 5.24
 *   under white. The lightest value that clears 4.5:1 on all four, so the red
 *   stays the same red rather than becoming a different one.
 *   `dangerLight` and `dangerBorder` are untouched, they are grounds not text.
 *
 *   White on DARK `primary` #2F8E71 is 4.02:1, under the 4.5:1 text floor, and
 *   as text on the dark card it is 3.94:1. Neither reaches anybody any more:
 *   since 2026-11-08 NO screen puts text on a primary fill or sets text in
 *   primary. Buttons, chosen states and the add button fill with `text` and
 *   label with `bg`, which in light is the same Ink Navy and in dark is light
 *   ink on near black. What still uses primary is non-text (spinners, refresh
 *   tint, the limit meter, a border, the top weekly bar), where 3:1 is the
 *   floor and 3.94:1 clears it. __tests__/dark-mode-fills.test.js keeps it so. */
export const LIGHT = {
  bg: "#F7F6F1",
  card: "#FCFBF8",
  border: "#DCDEDB",
  text: "#142B3A",
  textSecondary: "#52616B",
  textMuted: "#67717A",
  primary: "#142B3A",
  primaryLight: "#E7EBEE",
  accent: "#55C6A3",
  accentLight: "#DDF4EC",
  danger: "#B8473D",
  dangerLight: "#FBEEEC",
  dangerBorder: "#F0CFCA",
  warning: "#96631B",
  warningLight: "#FDF3E4",
  warningBorder: "#F0DDBA",
  success: "#1F7A62",
  inputBg: "#FFFFFF",
  placeholder: "#67717A",
  tabBar: "#FCFBF8",
  tabBarBorder: "#DCDEDB",
  tabBarActive: "#142B3A",
  tabBarInactive: "#67717A",
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
  textMuted: "#8695A0",
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
  placeholder: "#8695A0",
  tabBar: "#101E28",
  tabBarBorder: "#24343E",
  tabBarActive: "#55C6A3",
  tabBarInactive: "#8695A0",
  overlay: "rgba(0,0,0,0.7)",
  skeleton: "#24343E",
  skeletonHighlight: "#2E3F4A",
} as const;

export type AppColors = Record<keyof typeof LIGHT, string>;

/* THE TYPE, SPACING AND RADIUS SCALE, 2026-11-07. Until then every screen
   picked its own numbers: 24 font sizes from 8 to 48, 18 corner radii, and 199
   of 212 text styles semibold or heavier, so nothing led because everything
   shouted. That, more than any colour, is what read as assembled rather than
   designed. Screens being redone take their numbers from here; a number off
   the scale is a decision, never a default.

   fontFamily ONLY, no fontWeight: on Android a weight beside a custom family
   can make the system pick a different file, which is how a SemiBold heading
   turns into a faux bold. The weight is in the family name. */
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 12, l: 16, pill: 999 } as const;
export const type = {
  /** The one money figure a screen is about. */
  display: { fontFamily: "Montserrat-SemiBold", fontSize: 40, lineHeight: 48, letterSpacing: -1 },
  title: { fontFamily: "Montserrat-SemiBold", fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  heading: { fontFamily: "Montserrat-SemiBold", fontSize: 16, lineHeight: 22 },
  body: { fontFamily: "Montserrat-Regular", fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: "Montserrat-Medium", fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: "Montserrat-Regular", fontSize: 13, lineHeight: 18 },
  label: { fontFamily: "Montserrat-Medium", fontSize: 13, lineHeight: 18 },
} as const;
/** Figures in a column line up digit under digit. Montserrat carries tnum. */
export const tabular = { fontVariant: ["tabular-nums"] } as { fontVariant: "tabular-nums"[] };

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
