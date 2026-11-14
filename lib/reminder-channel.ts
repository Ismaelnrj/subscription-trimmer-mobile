/* The Android notification channel every reminder is posted to, in a module
   with no imports so the scheduler, the setup code and the tests all read the
   same string.

   WHY IT MUST BE NAMED ON THE TRIGGER. lib/notifications.ts creates this
   channel ("Renewal reminders", high importance), but until 2026-11-14 no
   reminder named it, and expo-notifications 0.31 then posts to its own
   fallback channel, "Miscellaneous". So the channel a person finds under
   Android's settings for Trimio carried nothing, and the one carrying the
   reminders had a name that said nothing about them. */
export const REMINDER_CHANNEL_ID = "default";
