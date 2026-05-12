import { useColorScheme } from "react-native";

export const LIGHT = {
  bg: "#F9FAFB",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",
  danger: "#EF4444",
  dangerLight: "#FEF2F2",
  dangerBorder: "#FECACA",
  warning: "#F59E0B",
  warningLight: "#FFFBEB",
  warningBorder: "#FCD34D",
  success: "#10B981",
  inputBg: "#FFFFFF",
  placeholder: "#9CA3AF",
  tabBar: "#FFFFFF",
  tabBarBorder: "#E5E7EB",
  tabBarActive: "#4F46E5",
  tabBarInactive: "#9CA3AF",
  overlay: "rgba(0,0,0,0.5)",
  skeleton: "#E5E7EB",
  skeletonHighlight: "#F3F4F6",
} as const;

export const DARK = {
  bg: "#0F172A",
  card: "#1E293B",
  border: "#334155",
  text: "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  primary: "#818CF8",
  primaryLight: "#1E1B4B",
  danger: "#F87171",
  dangerLight: "#2D1B1B",
  dangerBorder: "#7F1D1D",
  warning: "#FBBF24",
  warningLight: "#1C1508",
  warningBorder: "#92400E",
  success: "#34D399",
  inputBg: "#1E293B",
  placeholder: "#475569",
  tabBar: "#1E293B",
  tabBarBorder: "#334155",
  tabBarActive: "#818CF8",
  tabBarInactive: "#64748B",
  overlay: "rgba(0,0,0,0.7)",
  skeleton: "#334155",
  skeletonHighlight: "#475569",
} as const;

export type AppColors = typeof LIGHT;

export function useTheme(): AppColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? DARK : LIGHT;
}
