import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { REMINDER_CHANNEL_ID } from "./reminder-channel";
import i18n from "./i18n";

// Set up notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Android 8+ won't show a heads-up banner (and on some OEM skins, won't
// show anything at all) for notifications posted without an explicit
// channel. It silently falls back to a low-importance default channel.
/* The channel's name is what Android shows under Settings > Apps > Trimio >
   Notifications, which is exactly where somebody goes to switch reminders
   back on, so it is written in the app's language. Android lets an app
   rename its own channel, so each launch (after the language has loaded, see
   app/_layout.tsx) brings it up to date. A failure here must not stop the
   channel being created, hence the English fallback. */
function reminderChannelName(): string {
  try {
    const name = i18n.t("notifPrefs.channelName");
    if (typeof name === "string" && name && name !== "notifPrefs.channelName") return name;
  } catch {}
  return "Renewal reminders";
}

async function ensureReminderChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: reminderChannelName(),
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

/* WHAT LAUNCH DOES NOW: set up the channel and, ONLY if permission was already
   granted, register the token. It never asks.

   Launch used to call registerForPushNotificationsAsync, which ASKS. So on
   Android 13+ the very first thing a new install showed, before onboarding had
   said a word about what Trimio is, was the system "Allow notifications?"
   dialog. A refusal there is close to permanent (Android stops offering the
   dialog after it is declined), and refused means renewal reminders, the
   product, silently never arrive. The question now waits until somebody has
   added a subscription and been told what the reminder is for, see
   lib/reminder-primer.ts.

   With targetSdk 33 or higher, creating a channel does not trigger the
   permission dialog by itself, so ensureReminderChannel is safe here. */
export async function prepareNotifications() {
  await ensureReminderChannel();
  if (!Device.isDevice) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") await registerForPushNotificationsAsync();
}

export type ReminderPermission = "granted" | "undetermined" | "denied";

/** Where the permission stands, without asking. "denied" includes the case
    where Android will not show the dialog again, so nobody gets asked twice. */
export async function getReminderPermission(): Promise<ReminderPermission> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied" || canAskAgain === false) return "denied";
  return "undetermined";
}

/** ASKS. Call only after explaining why, never at launch. */
export async function registerForPushNotificationsAsync() {
  let token;

  await ensureReminderChannel();

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!");
      return;
    }

    try {
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        })
      ).data;
      console.log("Push token obtained");
    } catch (err) {
      // Getting a push token can fail for reasons outside our control (FCM
      // registration, network, etc). All actual notifications in this app
      // (renewal reminders, price alerts) are scheduled locally on-device
      // and don't depend on this token, so it's safe to just log and move on.
      console.warn("[Notifications] Could not get push token:", err);
    }
  } else {
    console.log("Must use physical device for Push Notifications");
  }

  return token;
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
      badge: 1,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, channelId: REMINDER_CHANNEL_ID },
  });
}

export async function sendScheduledNotification(
  title: string,
  body: string,
  seconds: number,
  data?: Record<string, any>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
      badge: 1,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: REMINDER_CHANNEL_ID },
  });
}

/* WHAT THE PHONE ITSELF SAYS ABOUT REMINDERS, for the Build Info panel.

   Added 2026-11-14, when the owner reported that reminder emails arrive and
   phone reminders do not. Every link this app controls was read and holds:
   the scheduler queues, expo-notifications sets a real alarm and posts it.
   What nothing could see is the phone's side: whether Android lets Trimio
   post at all, whether the channel was switched off, and whether anything is
   actually waiting in the queue. Each of those fails silently, so the panel
   reads them out rather than leaving them to be guessed. */
export type ReminderDiagnostics = {
  permission: ReminderPermission;
  /** Android's own importance for the reminder channel; null when the
      channel does not exist (or the platform has no channels). 2 is NONE,
      which is what switching the channel off in Android's settings sets. */
  channelImportance: number | null;
  queued: number;
  /** The earliest date-triggered notification waiting, if any. */
  next: { at: number; title: string } | null;
};

export async function readReminderDiagnostics(): Promise<ReminderDiagnostics> {
  const permission = await getReminderPermission().catch(() => "denied" as ReminderPermission);
  let channelImportance: number | null = null;
  if (Platform.OS === "android") {
    const channel = await Notifications.getNotificationChannelAsync(REMINDER_CHANNEL_ID).catch(() => null);
    channelImportance = channel ? channel.importance : null;
  }
  const requests = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  let next: ReminderDiagnostics["next"] = null;
  for (const r of requests) {
    /* Android hands a date trigger back as { type: "date", value: <ms> }
       (DateTrigger.toBundle in expo-notifications 0.31), not as the
       { date } it was given, so read value and accept date as a fallback. */
    const t: any = r.trigger;
    const at = typeof t?.value === "number" ? t.value : t?.date != null ? new Date(t.date).getTime() : NaN;
    if (!Number.isFinite(at)) continue;
    if (!next || at < next.at) next = { at, title: String(r.content?.title ?? "") };
  }
  return { permission, channelImportance, queued: requests.length, next };
}

/** One notification in a few seconds, through the same alarm and channel as
    a real reminder, so a person can see whether this phone shows them. */
export async function sendTestReminder(title: string, body: string, seconds = 10): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: REMINDER_CHANNEL_ID },
  });
}
