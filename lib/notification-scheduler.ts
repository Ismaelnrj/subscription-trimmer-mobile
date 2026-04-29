import * as Notifications from "expo-notifications";
import { registerForPushNotificationsAsync } from "./notifications";

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
      const billing = new Date(sub.nextBillingDate);

      const reminders = [
        { daysBefore: 7, label: "in 7 days" },
        { daysBefore: 3, label: "in 3 days" },
        { daysBefore: 1, label: "tomorrow" },
      ];

      for (const { daysBefore, label } of reminders) {
        const triggerDate = new Date(billing);
        triggerDate.setDate(triggerDate.getDate() - daysBefore);
        triggerDate.setHours(9, 0, 0, 0);

        if (triggerDate > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${sub.name} renews ${label}`,
              body: `${currencySymbol}${Number(sub.price).toFixed(2)} will be charged on ${billing.toLocaleDateString()}.`,
              data: { subscriptionId: sub.id },
            },
            trigger: { date: triggerDate },
          });
          scheduled.push(`${sub.name} (${label})`);
        }
      }

      // Trial end reminder
      if (sub.trialEndDate) {
        const trialEnd = new Date(sub.trialEndDate);
        const trialReminder = new Date(trialEnd);
        trialReminder.setDate(trialReminder.getDate() - 1);
        trialReminder.setHours(9, 0, 0, 0);
        if (trialReminder > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${sub.name} trial ends tomorrow!`,
              body: `Cancel now if you don't want to be charged ${currencySymbol}${Number(sub.price).toFixed(2)}.`,
              data: { subscriptionId: sub.id },
            },
            trigger: { date: trialReminder },
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
