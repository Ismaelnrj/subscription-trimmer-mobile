/* WHAT'S NEW: what changed, told once, to people who had Trimio before it.
   The owner's request, 2026-11-27: people should know when an update has come.
   And 2026-11-28: EVERY update is announced, "in order to be up to date always".

   Over the air updates land without a sound, so this is the only way anybody
   hears about one. It must not become noise, hence the rules in whatsNewFor:
   each announcement once, never to somebody who installed after it (they never
   had the old version), not at all once it is SHOW_FOR_DAYS old, and ONE card
   however many were missed: somebody back after three updates sees one card
   with what is new since they last looked, newest first, at most MAX_LINES.
   components/UpdateAvailableModal.tsx shows it, and never in the same launch
   as the "new version on Google Play" prompt.

   EVERY PUBLISH ADDS AN ENTRY AT THE TOP of ANNOUNCEMENTS: a new `id`, the
   `date` it went out (the publish time off the Build Info panel, as an ISO
   time: a bare day reads as midnight UTC, so a phone installed earlier that
   day, which DID have the old version, would be skipped), its lines, and each line in BOTH locale files under
   `whatsNew`. __tests__/whats-new.test.js checks the keys exist in both and
   that the list runs newest first. Only what the app really does, in the
   app's own words. Remove entries only from the bottom (the oldest), once
   they are past SHOW_FOR_DAYS.

   Storage and expo-application are loaded inside a try, for the reason
   lib/offline-cache.ts gives. Without either, nothing is shown: a popup that
   cannot remember it was seen would come back on every launch. */

export type Announcement = { id: string; date: string; items: { icon: string; key: string }[] };

export const ANNOUNCEMENTS: Announcement[] = [
  {
    // The privacy policy's additions (section 17 promises to say so in the
    // app). Dated when written; the publish follows within the day.
    id: "2026-11-28-privacy",
    date: "2026-11-28T10:56:00Z",
    items: [{ icon: "shield-lock-outline", key: "whatsNew.privacy" }],
  },
  {
    // Phase 2 of the new look, published 2026-11-28 08:17Z without a card;
    // the owner asked that every update be announced.
    id: "2026-11-28-screens",
    date: "2026-11-28T08:17:45Z",
    items: [{ icon: "palette-outline", key: "whatsNew.screens" }],
  },
  {
    id: "2026-11-28",
    date: "2026-11-28T07:16:35Z",
    items: [
      { icon: "star-four-points-outline", key: "whatsNew.look" },
      { icon: "piggy-bank-outline", key: "whatsNew.keep" },
      { icon: "wifi-off", key: "whatsNew.offline" },
    ],
  },
];

export const SHOW_FOR_DAYS = 45;
export const MAX_LINES = 5;
const KEY = "whats_new_seen";
const DAY_MS = 86400000;

export type WhatsNew = { id: string; items: Announcement["items"] };

/* What to show, or null. `list` is newest first and `seenId` the newest id this
   phone has already shown, so everything above it is unseen. An id it does not
   know (nothing seen yet, or an entry since removed from the bottom) means all
   of it is. The card is remembered as the NEWEST id, so it never comes back. */
export function whatsNewFor(list: Announcement[], seenId: string | null, installedAt: number | null, now: number): WhatsNew | null {
  if (!list.length || installedAt === null) return null;
  const seenAt = seenId ? list.findIndex((a) => a.id === seenId) : -1;
  const unseen = seenAt === -1 ? list : list.slice(0, seenAt);
  const items: Announcement["items"] = [];
  for (const a of unseen) {
    const published = Date.parse(a.date);
    if (!Number.isFinite(published) || installedAt >= published) continue;
    if (now >= published + SHOW_FOR_DAYS * DAY_MS) continue;
    for (const item of a.items) if (!items.some((i) => i.key === item.key)) items.push(item);
  }
  return items.length ? { id: list[0].id, items: items.slice(0, MAX_LINES) } : null;
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
    // Nothing back is unknown, never 1970: new Date(null) is the epoch, which
    // would make every phone look like it had Trimio before any announcement.
    if (d == null) return null;
    const t = new Date(d).getTime();
    return Number.isFinite(t) && t > 0 ? t : null;
  } catch {
    return null;
  }
}
