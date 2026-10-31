import AsyncStorage from "@react-native-async-storage/async-storage";
import { dehydrate, hydrate } from "@tanstack/react-query";
import type { DehydratedState, QueryKey } from "@tanstack/react-query";
import { queryClient, cacheResetSettled } from "./query-client";

/* A read-only copy of the last data the server sent, so opening the app with no
   connection shows your subscriptions instead of an error on every screen.

   READ ONLY ON PURPOSE. Nothing here queues a write for later: adding, editing,
   pausing and cancelling still need the server, and fail with their own error
   exactly as before. Replaying writes made offline means conflict handling and
   duplicate saves, which is a different and much larger feature.

   WHAT IS KEPT is an allowlist of the screens worth opening offline, never the
   whole cache. Each entry is data the app already shows on screen.

   WHERE: AsyncStorage, which is app private storage. It is already in build 40
   (PostHog stores its queue there), so this ships over the air. Not SecureStore:
   its values are capped near 2KB on Android, and a subscription list passes that.

   WHOSE: the copy is stamped with the user id it was written for, and restored
   only into the same id. It is deleted whenever the session ends or changes
   hands, because every query key in this app is global and a copy restored into
   the wrong account would show one person another person's subscriptions. */

const STORAGE_KEY = "trimio.offlineCache";
/* Bump when the shape of a persisted query's data changes in a way an old copy
   would break, so a stale copy is dropped rather than rendered. */
const FORMAT = 1;
/* Past this, the copy is more likely to mislead than help: prices and dates
   will have moved. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/* Writes are coalesced: a launch settles several queries within a second. */
const WRITE_DELAY_MS = 1000;

const PERSISTED_KEYS: QueryKey[] = [
  ["subscriptions", "list"],
  ["analytics", "summary"],
  ["settings"],
  ["notifications", "preferences"],
  ["alerts", "list"],
  ["cancelledSubscriptions"],
];
const PERSISTED = new Set(PERSISTED_KEYS.map((k) => JSON.stringify(k)));

export function isPersistedKey(queryKey: unknown): boolean {
  return Array.isArray(queryKey) && PERSISTED.has(JSON.stringify(queryKey));
}

let started = false;
let getUserId: () => number | null = () => null;
let timer: ReturnType<typeof setTimeout> | null = null;
/* Every forget() moves this on. A write that began under an older generation
   belongs to a session that has ended, so it is dropped, or undone if it had
   already reached the disk. */
let generation = 0;

/* Starts writing successful fetches of the allowlisted queries to disk. Called
   once at launch. `userIdGetter` is passed in rather than imported, because the
   auth store imports this module. */
export function startOfflineCache(userIdGetter: () => number | null): void {
  getUserId = userIdGetter;
  if (started) return;
  started = true;
  queryClient.getQueryCache().subscribe((event: any) => {
    if (!event || event.type !== "updated" || event.action?.type !== "success") return;
    if (!isPersistedKey(event.query?.queryKey)) return;
    scheduleWrite();
  });
}

function scheduleWrite(): void {
  if (timer) return;
  const gen = generation;
  timer = setTimeout(() => {
    timer = null;
    if (gen !== generation) return;
    writeNow(gen).catch(() => {});
  }, WRITE_DELAY_MS);
}

/* Only what the screens read, and a state that is always `success`. A query
   whose latest refetch FAILED still holds good data, and keeping it is the whole
   point; its error, an axios error with circular references, is not
   serialisable and is not wanted. */
export function snapshot(): DehydratedState {
  const dehydrated = dehydrate(queryClient, {
    dehydrateMutations: false,
    shouldDehydrateQuery: (q) => isPersistedKey(q.queryKey) && q.state.data !== undefined,
  });
  return {
    mutations: [],
    queries: dehydrated.queries.map((q) => ({
      queryKey: q.queryKey,
      queryHash: q.queryHash,
      state: {
        data: q.state.data,
        dataUpdateCount: 1,
        dataUpdatedAt: q.state.dataUpdatedAt,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        fetchFailureCount: 0,
        fetchFailureReason: null,
        fetchMeta: null,
        isInvalidated: false,
        status: "success",
        fetchStatus: "idle",
      },
    })),
  };
}

async function writeNow(gen: number): Promise<void> {
  // A sign out or account switch still clearing the cache: let it finish, so
  // nothing of the previous account is read from memory below.
  await cacheResetSettled();
  if (gen !== generation) return;
  const userId = getUserId();
  if (userId == null) return;
  const state = snapshot();
  if (state.queries.length === 0) return;
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ format: FORMAT, userId, savedAt: Date.now(), state }),
  );
  // The session ended while that write was in flight: take it back off disk.
  if (gen !== generation) await AsyncStorage.removeItem(STORAGE_KEY);
}

/* Deletes the copy and cancels any pending write. Called whenever the session
   ends or changes hands. */
export async function forgetOfflineCache(): Promise<void> {
  generation += 1;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the next write for a different user is refused on read
    // anyway, because the copy names the user it belongs to.
  }
}

/* Puts the saved copy into the query cache, if it belongs to `userId`. Screens
   then render it straight away and refetch in the background; a refetch that
   fails offline leaves it on screen. Never throws: a broken copy must not stop
   the app opening. Returns whether anything was restored. */
export async function restoreOfflineCache(userId: number): Promise<boolean> {
  try {
    await cacheResetSettled();
    const gen = generation;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const usable =
      saved &&
      saved.format === FORMAT &&
      saved.userId === userId &&
      typeof saved.savedAt === "number" &&
      Date.now() - saved.savedAt <= MAX_AGE_MS &&
      saved.state &&
      Array.isArray(saved.state.queries);
    if (!usable) {
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      return false;
    }
    // The session moved while the copy was being read.
    if (gen !== generation || getUserId() !== userId) return false;
    const queries = saved.state.queries.filter(
      (q: any) => q && isPersistedKey(q.queryKey) && typeof q.queryHash === "string" && q.state,
    );
    if (queries.length === 0) return false;
    hydrate(queryClient, { mutations: [], queries });
    return true;
  } catch {
    return false;
  }
}
