/* WHAT'S NEW: one short announcement, shown once, to people who had Trimio
   before it. The owner's request, 2026-11-27: people should know when an
   update has come.

   Over the air updates land without a sound, so this is the only way anybody
   hears about one. It must not become noise, hence the rules in
   shouldShowWhatsNew: once per announcement, never to somebody who installed
   after it (they never had the old version), and not at all once it is
   SHOW_FOR_DAYS old. components/UpdateAvailableModal.tsx shows it, and never in
   the same launch as the "new version on Google Play" prompt.

   TO ANNOUNCE SOMETHING NEW: give ANNOUNCEMENT a new `id` and `date` (the day
   it is published), list its lines, and write each line in BOTH locale files
   under `whatsNew`. __tests__/whats-new.test.js checks the keys exist in both.
   Only what the app really does, in the app's own words. `null` announces
   nothing.

   Storage and expo-application are loaded inside a try, for the reason
   lib/offline-cache.ts gives. Without either, nothing is shown: a popup that
   cannot remember it was seen would come back on every launch. */

export type Announcement = { id: string; date: string; items: { icon: string; key: string }[] };

export const ANNOUNCEMENT: Announcement | null = {
  id: "2026-11-27",
  date: "2026-11-27",
  items: [
    { icon: "star-four-points-outline", key: "whatsNew.look" },
    { icon: "piggy-bank-outline", key: "whatsNew.keep" },
    { icon: "wifi-off", key: "whatsNew.offline" },
  ],
};

export const SHOW_FOR_DAYS = 45;
const KEY = "whats_new_seen";
const DAY_MS = 86400000;

export function shouldShowWhatsNew(a: Announcement | null, seenId: string | null, installedAt: number | null, now: number): boolean {
  if (!a || !a.items.length) return false;
  if (seenId === a.id) return false;
  const published = Date.parse(a.date);
  if (!Number.isFinite(published) || installedAt === null) return false;
  if (installedAt >= published) return false;
  return now < published + SHOW_FOR_DAYS * DAY_MS;
}

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

let storage: Storage | null | undefined;
function getStorage(): Storage | null {
  if (storage === undefined) {
    try {
      const mod = require("@react-native-async-storage/async-storage");
      storage = (mod?.default ?? mod) || null;
    } catch {
      storage = null;
    }
  }
  return storage ?? null;
}

/* What was seen, or "unknown" when storage is missing, which reads as seen. */
export async function readSeen(): Promise<string | null | "unknown"> {
  const s = getStorage();
  if (!s) return "unknown";
  try {
    return await s.getItem(KEY);
  } catch {
    return "unknown";
  }
}

export async function markSeen(id: string): Promise<void> {
  try {
    await getStorage()?.setItem(KEY, id);
  } catch {
    // Seen or not, the announcement expires after SHOW_FOR_DAYS.
  }
}

/* When Trimio was first installed on this phone, from Android itself. */
export async function installedAt(): Promise<number | null> {
  try {
    const Application = require("expo-application");
    const d = await Application.getInstallationTimeAsync();
    const t = new Date(d).getTime();
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}
