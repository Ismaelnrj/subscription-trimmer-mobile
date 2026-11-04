import { queryClient } from "./query-client";
import { useCurrencyStore } from "./currency-store";
import { scheduleRenewalReminders } from "./notification-scheduler";

/* Reschedules renewal reminders from the cached list, for a change made
   without a fetch: a subscription saved on the phone while offline gets its
   reminder now, not whenever the next successful fetch happens, which offline
   may be days away. A reminder is the product, and it is the one part that
   works with no connection at all, since the phone fires it.

   Same rule as lib/language-store.ts: preferences not loaded means do
   nothing. The scheduler reads an absent preference as ON, which would
   re-enable reminders somebody had switched off. Never throws. */
export async function rescheduleRemindersFromCache(): Promise<void> {
  try {
    const subs = queryClient.getQueryData<any[]>(["subscriptions", "list"]);
    if (!Array.isArray(subs)) return;
    const prefs = queryClient.getQueryData<any>(["notifications", "preferences"]);
    if (!prefs) return;
    await scheduleRenewalReminders(subs, useCurrencyStore.getState().currency.symbol, prefs);
  } catch (e) {
    console.warn("[Reminders] Could not reschedule from the cached list:", e);
  }
}
