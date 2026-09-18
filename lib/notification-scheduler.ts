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
   moment that number moves.

   A CHECK AT THE TOP OF THE LOOP IS NOT ENOUGH, which is the thing that is easy
   to get wrong here and was wrong until 2026-09-18. The dangerous moment is not
   between subscriptions, it is INSIDE the await: if the sign-out lands while an
   enqueue is in flight, that enqueue completes afterwards and the OS keeps the
   notification. The check had already passed, so nothing stops it, and the same
   iteration then went on to enqueue the trial reminder with no check at all.
   Every enqueue therefore re-checks AFTER it resolves and cancels the
   identifier it was just given if the session moved underneath it. A pre-call
   check governs whether to start; only a post-call check governs what exists. */
let sessionGeneration = 0;

/* Both cancelling and scheduling take the next generation, so a newer run
   invalidates an older one exactly the way a sign-out does. Two overlapping
   runs used to share a number and neither could stop the other, while the newer
   one's opening cancelAll wiped what the older one had already queued and the
   older one kept adding to the queue the newer one owned. That is how a
   preference change to "off" could be refilled by an enabled run that was
   already in flight. */
function nextGeneration(): number {
  sessionGeneration += 1;
  return sessionGeneration;
}

/* Runs are serialised against each other. The generation alone stops an older
   run from WRITING, but two runs interleaving their opening cancelAll with the
   other's enqueues is still worth ruling out rather than reasoning about. */
let runChain: Promise<void> = Promise.resolve();

export async function cancelAllReminders(): Promise<void> {
  const cancelledAt = nextGeneration();
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    // Never block a sign-out on the OS notification queue.
    console.warn("[Notifications] Could not cancel reminders:", err);
  }
  /* Deliberately NOT awaited into the caller. An in-flight run may be parked
     inside an OS call that never returns, and a sign-out cannot wait on that.
     Its enqueues clean up after themselves; this is the sweep for the case
     where one registered a notification and then threw, so there is no
     identifier to cancel individually.

     Guarded by the generation because an unguarded sweep is worse than no
     sweep: by the time the old run settles somebody may have signed in again,
     and this would wipe the new account's reminders instead. */
  runChain
    .then(() => {
      if (sessionGeneration !== cancelledAt) return;
      return Notifications.cancelAllScheduledNotificationsAsync();
    })
    .catch(() => {});
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

/** Enqueue one notification, session-aware on both sides of the await.
 *
 *  Returns false if the session moved while the OS was working, in which case
 *  the notification it just created is cancelled again by its identifier. The
 *  caller uses that answer to stop rather than carrying on to the next enqueue,
 *  which is the half the trial reminder was missing. */
async function enqueue(
  /* Derived from the function rather than naming the exported type, so it
     cannot drift if expo-notifications renames it at an SDK bump. */
  request: Parameters<typeof Notifications.scheduleNotificationAsync>[0],
  generation: number
): Promise<boolean> {
  if (sessionGeneration !== generation) return false;
  const id = await Notifications.scheduleNotificationAsync(request);
  if (sessionGeneration !== generation) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Best effort. The sweep in cancelAllReminders is the other half.
    }
    return false;
  }
  return true;
}

export function scheduleRenewalReminders(
  subscriptions: any[],
  currencySymbol: string,
  prefs: ReminderPrefs = {}
): Promise<void> {
  /* Taken SYNCHRONOUSLY, before waiting for a turn in the chain, so an older
     run is invalidated the moment a newer one is requested rather than whenever
     it happens to start. */
  const myGeneration = nextGeneration();
  const run = runChain.then(() => performSchedule(subscriptions, currencySymbol, prefs, myGeneration));
  runChain = run.catch(() => {});
  return run;
}

async function performSchedule(
  subscriptions: any[],
  currencySymbol: string,
  prefs: ReminderPrefs,
  myGeneration: number
) {
  // A cancel, or a newer run, may have arrived while this one waited its turn.
  if (sessionGeneration !== myGeneration) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (sessionGeneration !== myGeneration) return;

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
          const live = await enqueue(
            {
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
            },
            myGeneration
          );
          // The session moved while that was in flight. Stop the whole run: the
          // trial reminder below belongs to the same account.
          if (!live) return;
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
          const live = await enqueue(
            {
              content: {
                title: i18n.t("notifications.reminders.trialTitle", { name: sub.name }),
                body: amount
                  ? i18n.t("notifications.reminders.trialBody", { amount })
                  : undefined,
                data: { subscriptionId: sub.id },
              },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trialReminder },
            },
            myGeneration
          );
          if (!live) return;
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
