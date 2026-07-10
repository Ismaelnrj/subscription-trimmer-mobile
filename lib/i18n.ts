import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import en from "../locales/en.json";
import de from "../locales/de.json";

const deviceLang = Localization.getLocales()[0]?.languageCode ?? "en";
const defaultLng = deviceLang.startsWith("de") ? "de" : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: defaultLng,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
