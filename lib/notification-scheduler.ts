import * as Notifications from "expo-notifications";
import { registerForPushNotificationsAsync } from "./notifications";
import { parseLocalDate } from "./utils";
import i18n from "./i18n";

/* The reminder is the product. "Know before you pay" is a promise kept by this
   file and almost nowhere else, so every string in it used to being hardcoded
   English was the single largest localisation gap in the app: 589 translated
   keys, a German store listing, German legal documents, a German landing page,
   and then the one message that actually reaches a German user arrived in
   English.

   Formatting is language-aware too, not just the words. German writes a decimal
   COMMA and puts the currency symbol after the amount, and this project already
   refuses a decimal point in German copy elsewhere (tools/make-cut.py rejects
   renders containing one), so "€10.00" in a German notification would have
   broken a rule the video pipeline enforces on captions. */
function lang(): "de" | "en" {
  try {
    return i18n.language?.startsWith("de") ? "de" : "en";
  } catch {
    return "en";
  }
}

function formatAmount(price: unknown, symbol: string): string | null {
  const n = Number(price);
  // No notification is better than one that says "NaN will be charged".
  if (!Number.isFinite(n)) return null;
  if (lang() === "de") {
    return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
  }
  return `${symbol}${n.toFixed(2)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(lang() === "de" ? "de-DE" : "en-US");
}

export async function requestNotificationPermission() {
  await registerForPushNotificationsAsync();
}

export async function scheduleRenewalReminders(subscriptions: any[], currencySymbol: string) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const scheduled: string[] = [];

    for (const sub of subscriptions) {
      if (!sub.nextBillingDate) continue;
      const rawBilling = String(sub.nextBillingDate).slice(0, 10);
      const billing = parseLocalDate(rawBilling);

      const amount = formatAmount(sub.price, currencySymbol);
      const reminders = [
        { daysBefore: 7, whenKey: "notifications.reminders.in7" },
        { daysBefore: 3, whenKey: "notifications.reminders.in3" },
        { daysBefore: 1, whenKey: "notifications.reminders.tomorrow" },
      ];

      for (const { daysBefore, whenKey } of reminders) {
        const triggerDate = new Date(billing);
        triggerDate.setDate(triggerDate.getDate() - daysBefore);
        triggerDate.setHours(9, 0, 0, 0);

        if (triggerDate > now) {
          const when = i18n.t(whenKey);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: i18n.t("notifications.reminders.renewTitle", { name: sub.name, when }),
              /* The body carries the amount, so with an unparseable price there
                 is nothing useful to say and the title already says what renews
                 and when. Dropping the body beats printing NaN at somebody. */
              body: amount
                ? i18n.t("notifications.reminders.renewBody", { amount, date: formatDate(billing) })
                : undefined,
              data: { subscriptionId: sub.id },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
          });
          scheduled.push(`${sub.name} (${daysBefore}d)`);
        }
      }

      // Trial end reminder
      if (sub.trialEndDate) {
        const trialEnd = parseLocalDate(String(sub.trialEndDate).slice(0, 10));
        const trialReminder = new Date(trialEnd);
        trialReminder.setDate(trialReminder.getDate() - 1);
        trialReminder.setHours(9, 0, 0, 0);
        if (trialReminder > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: i18n.t("notifications.reminders.trialTitle", { name: sub.name }),
              body: amount
                ? i18n.t("notifications.reminders.trialBody", { amount })
                : undefined,
              data: { subscriptionId: sub.id },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trialReminder },
          });
        }
      }
    }

    if (scheduled.length > 0) {
      console.log(`[Notifications] Scheduled ${scheduled.length} renewal reminders.`);
    }
  } catch (err) {
    console.warn("[Notifications] Could not schedule reminders:", err);
  }
}
