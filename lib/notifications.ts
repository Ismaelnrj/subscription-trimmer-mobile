import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

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
async function ensureReminderChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Renewal reminders",
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
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
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
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}
