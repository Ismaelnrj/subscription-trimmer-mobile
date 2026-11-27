/* THE "NEW VERSION ON GOOGLE PLAY" PROMPT: whether it may ask, and how often.

   components/UpdateAvailableModal.tsx asks the server for the lowest build
   that should be running (`appVersion.check`, set by MIN_ANDROID_VERSION_CODE
   in Railway; unset means 0, never ask) and compares it with the INSTALLED
   build (lib/app-build.ts). Until 2026-11-27 "Later" only closed the window,
   so an older phone was asked again on every launch. Now "Later" holds for
   SNOOZE_DAYS for that build number, and a newer minimum asks again at once.

   Storage is loaded on first use inside a try, for the reason
   lib/offline-cache.ts gives: a top level import that throws would crash every
   launch. Without it the prompt simply cannot be snoozed. */

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

export const SNOOZE_DAYS = 3;
const KEY = "update_prompt_snooze";
const DAY_MS = 86400000;

export type Snooze = { code: number; until: number };

export function shouldPromptUpdate(installed: number | null, minimum: number, snooze: Snooze | null, now: number): boolean {
  if (!Number.isInteger(minimum) || minimum <= 0) return false;
  // An unknown build (the web preview) is never asked: there is nothing to update.
  if (installed === null || installed >= minimum) return false;
  if (snooze && snooze.code === minimum && now < snooze.until) return false;
  return true;
}

export async function readSnooze(): Promise<Snooze | null> {
  try {
    const raw = await getStorage()?.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && Number.isFinite(v.code) && Number.isFinite(v.until) ? { code: v.code, until: v.until } : null;
  } catch {
    return null;
  }
}

export async function snoozeUpdatePrompt(minimum: number, now: number = Date.now()): Promise<void> {
  try {
    await getStorage()?.setItem(KEY, JSON.stringify({ code: minimum, until: now + SNOOZE_DAYS * DAY_MS }));
  } catch {
    // A prompt that cannot be snoozed asks again next launch; nothing worse.
  }
}
