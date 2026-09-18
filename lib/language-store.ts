import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import i18n from "./i18n";

const LANGUAGE_KEY = "app_language";

/* Renewal reminders are scheduled with the OS ahead of time, with their text
   baked in at scheduling time, so switching language does not change the ones
   already queued. Without this, somebody who switches to German keeps getting
   English reminders until the dashboard happens to refetch and reschedule them,
   which is the one message this app exists to send.

   Deliberately not awaited and fully swallowed: changing language must succeed
   even if notification permission was refused, the cache is empty, or the OS
   refuses the schedule. The imports are dynamic so this module stays cheap for
   callers that never switch language, and so a missing dependency can never
   take the language store down with it. */
function rescheduleReminders() {
  (async () => {
    try {
      const [{ queryClient }, { useCurrencyStore }, { scheduleRenewalReminders }] = await Promise.all([
        import("./query-client"),
        import("./currency-store"),
        import("./notification-scheduler"),
      ]);
      const subs = queryClient.getQueryData<any[]>(["subscriptions", "list"]);
      if (!Array.isArray(subs) || subs.length === 0) return;
      /* Preferences must come along. Calling without them falls back to the
         scheduler's `{}` default, which means push on, renewal alerts on and a
         three day lead, so switching language RE-ENABLED reminders somebody had
         turned off and silently replaced a seven day choice with three.

         Reading the same cache key the dashboard and the preferences screen
         use, so this reflects whatever was last loaded rather than refetching
         during a language switch. */
      const prefs = queryClient.getQueryData<any>(["notifications", "preferences"]);
      await scheduleRenewalReminders(subs, useCurrencyStore.getState().currency.symbol, prefs ?? {});
    } catch (e) {
      console.warn("[Language] Could not reschedule reminders:", e);
    }
  })();
}

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
    rescheduleReminders();
  },

  loadLanguage: async () => {
    const saved = await SecureStore.getItemAsync(LANGUAGE_KEY).catch(() => null);
    if (saved === "en" || saved === "de") {
      await i18n.changeLanguage(saved);
      set({ language: saved });
    }
  },
}));
