import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import i18n from "./i18n";

const LANGUAGE_KEY = "app_language";

interface LanguageState {
  language: "en" | "de";
  setLanguage: (lang: "en" | "de") => Promise<void>;
  loadLanguage: () => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: (i18n.language as "en" | "de") ?? "en",

  setLanguage: async (lang) => {
    await i18n.changeLanguage(lang);
    await SecureStore.setItemAsync(LANGUAGE_KEY, lang).catch(() => {});
    set({ language: lang });
  },

  loadLanguage: async () => {
    const saved = await SecureStore.getItemAsync(LANGUAGE_KEY).catch(() => null);
    if (saved === "en" || saved === "de") {
      await i18n.changeLanguage(saved);
      set({ language: saved });
    }
  },
}));
