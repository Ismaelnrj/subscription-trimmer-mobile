import * as SecureStore from "expo-secure-store";
import { getReminderPermission, registerForPushNotificationsAsync } from "./notifications";

/* WHEN TO ASK FOR NOTIFICATIONS: right after somebody adds a subscription,
   with a sentence saying what the reminder is for, and only while Android
   would still show its dialog.

   Asked cold at launch, the question arrived before the person knew what
   Trimio does. Asked here, it arrives the moment a reminder has an obvious
   meaning ("before Netflix renews"), which is the whole value of the app.

   "Not now" is remembered for a week, so adding three subscriptions in a row
   does not ask three times. */
const DECLINED_AT_KEY = "reminder_primer_declined_at";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export async function shouldOfferReminderPrimer(now: number = Date.now()): Promise<boolean> {
  try {
    if ((await getReminderPermission()) !== "undetermined") return false;
    const declinedAt = Number(await SecureStore.getItemAsync(DECLINED_AT_KEY));
    if (Number.isFinite(declinedAt) && declinedAt > 0 && now - declinedAt < COOLDOWN_MS) return false;
    return true;
  } catch {
    return false;
  }
}

export async function rememberPrimerDeclined(now: number = Date.now()): Promise<void> {
  await SecureStore.setItemAsync(DECLINED_AT_KEY, String(now)).catch(() => {});
}

/** Shows Android's own dialog and reports the answer. */
export async function acceptReminderPrimer(): Promise<boolean> {
  try {
    await registerForPushNotificationsAsync();
    return (await getReminderPermission()) === "granted";
  } catch {
    return false;
  }
}
