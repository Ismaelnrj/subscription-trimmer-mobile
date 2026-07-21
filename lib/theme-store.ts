import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  loadMode: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "system",

  setMode: (mode) => {
    SecureStore.setItemAsync("theme_mode", mode).catch(() => {});
    set({ mode });
  },

  loadMode: async () => {
    try {
      const stored = await SecureStore.getItemAsync("theme_mode");
      if (stored === "light" || stored === "dark" || stored === "system") {
        set({ mode: stored });
      }
    } catch {}
  },
}));
