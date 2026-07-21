import { useColorScheme } from "react-native";
import { useThemeStore } from "./theme-store";

export const LIGHT = {
  bg: "#F7F6FB",
  card: "#FFFFFF",
  border: "#E7E3F5",
  text: "#1B1B1F",
  textSecondary: "#6B6B75",
  textMuted: "#9B99A8",
  primary: "#6C3EF4",
  primaryLight: "#EDE9FE",
  danger: "#E74C3C",
  dangerLight: "#FDECEA",
  dangerBorder: "#F5C6C0",
  warning: "#F5A623",
  warningLight: "#FEF3E2",
  warningBorder: "#FBD999",
  success: "#2EC771",
  inputBg: "#FFFFFF",
  placeholder: "#9B99A8",
  tabBar: "#FFFFFF",
  tabBarBorder: "#E7E3F5",
  tabBarActive: "#6C3EF4",
  tabBarInactive: "#9B99A8",
  overlay: "rgba(0,0,0,0.5)",
  skeleton: "#E7E3F5",
  skeletonHighlight: "#F1EFFA",
} as const;

export const DARK = {
  bg: "#121522",
  card: "#23253A",
  border: "#33344A",
  text: "#F1F0F7",
  textSecondary: "#A8A6B8",
  textMuted: "#6B6B75",
  primary: "#8A63FF",
  primaryLight: "#2E2350",
  danger: "#F0685A",
  dangerLight: "#3A1F1D",
  dangerBorder: "#5C2B26",
  warning: "#F7B84C",
  warningLight: "#3A2C14",
  warningBorder: "#5C4520",
  success: "#4ADB8B",
  inputBg: "#23253A",
  placeholder: "#6B6B75",
  tabBar: "#181A2A",
  tabBarBorder: "#33344A",
  tabBarActive: "#8A63FF",
  tabBarInactive: "#6B6B75",
  overlay: "rgba(0,0,0,0.7)",
  skeleton: "#33344A",
  skeletonHighlight: "#3E4058",
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
