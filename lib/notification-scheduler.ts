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

/* Scheduled notifications outlive the session that created them.

   Nothing cancelled them on sign-out, and the only cancel in this file runs at
   the START of scheduling a fresh list. So signing out and leaving the app on
   the login screen left account A's subscription NAMES AND AMOUNTS queued to
   appear on the lock screen hours later, on a device that may not be theirs any
   more. That is the same class as the query cache leak: data belonging to a
   session that has ended.

   The generation counter closes the race the cancel alone cannot. Scheduling is
   async and loops with an await per notification, so a scheduler that started
   before logout can still be running after it and re-add everything it was
   supposed to lose. Each run captures the generation it began in and stops the
   moment that number moves. */
let sessionGeneration = 0;

export async function cancelAllReminders(): Promise<void> {
  sessionGeneration++;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    // Never block a sign-out on the OS notification queue.
    console.warn("[Notifications] Could not cancel reminders:", err);
  }
}

/** What the notification preferences screen actually controls.
 *
 *  This used to take only subscriptions and a symbol, and always scheduled 7,
 *  3 and 1 day reminders. It never read pushEnabled, renewalAlerts or
 *  renewalAlertDays, so the three switches on that screen changed a database
 *  row and nothing else: turning renewal alerts off left every reminder queued,
 *  and the next dashboard refetch scheduled them all again.
 *
 *  Undefined means "not loaded yet", which is deliberately treated as ON. The
 *  alternative is silently dropping somebody's reminders because a preferences
 *  query was slow, and a missing reminder is the one failure this product
 *  cannot afford. */
export type ReminderPrefs = {
  pushEnabled?: boolean;
  renewalAlerts?: boolean;
  renewalAlertDays?: number;
};

const LEAD_TIME_KEYS: Record<number, string> = {
  1: "notifications.reminders.tomorrow",
  3: "notifications.reminders.in3",
  7: "notifications.reminders.in7",
};

export async function scheduleRenewalReminders(
  subscriptions: any[],
  currencySymbol: string,
  prefs: ReminderPrefs = {}
) {
  const myGeneration = sessionGeneration;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Push off means nothing at all, not even trial reminders. The cancel above
    // has already cleared the queue, so returning here IS the disable.
    if (prefs.pushEnabled === false) return;

    const now = new Date();
    const scheduled: string[] = [];

    /* ONE reminder at the chosen lead time, not three at fixed ones. The screen
       offers 1, 3 or 7 days as a single choice, so scheduling all three ignored
       the answer and told somebody who asked for one warning that they would
       get three. Falls back to 3, which is the same default the backend uses
       for renewal_alert_days. */
    const leadDays = LEAD_TIME_KEYS[prefs.renewalAlertDays as number] ? (prefs.renewalAlertDays as number) : 3;
    const renewalRemindersOn = prefs.renewalAlerts !== false;

    for (const sub of subscriptions) {
      /* Bail the moment the session changes under us. This loop awaits once per
         notification, so a run that began before a sign-out can still be going
         after it and would re-queue everything cancelAllReminders just cleared,
         with the old account's names in it. */
      if (sessionGeneration !== myGeneration) return;
      if (!sub.nextBillingDate) continue;
      const rawBilling = String(sub.nextBillingDate).slice(0, 10);
      const billing = parseLocalDate(rawBilling);

      const amount = formatAmount(sub.price, currencySymbol);
      const reminders = renewalRemindersOn
        ? [{ daysBefore: leadDays, whenKey: LEAD_TIME_KEYS[leadDays] }]
        : [];

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
