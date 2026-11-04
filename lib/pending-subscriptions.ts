import { create } from "zustand";
import { queryClient } from "./query-client";
import { isTransientFailure } from "./session-errors";

/* SUBSCRIPTIONS ADDED WITH NO CONNECTION, kept on the phone until the server
   has them. Added 2026-11-04 at the owner's request: offline mode let people
   open the app and see their list, and then refused the one thing they came to
   do, with an alert that did not even say the connection was the problem.

   CREATES ONLY, ON PURPOSE. A new subscription conflicts with nothing on the
   server except the free limit and a same-name row, and both are answered by
   the server when the entry is sent. Editing, pausing, cancelling and deleting
   an existing row offline would need conflict rules for a row somebody may
   also have changed elsewhere, which is a different and larger feature. Those
   still need a connection and now say so in plain words.

   NEVER TWICE. Every create carries a `clientRef` the server stores in a
   unique column, and a create whose ref already exists returns that row
   instead of inserting another. That is what makes retrying safe: the
   dangerous case is a request the server COMMITTED whose answer never reached
   the phone, and without the ref the retry would add a second Netflix.

   WHOSE IT IS, the same rules as lib/offline-cache.ts: stamped with the user
   id, restored only into that id, and forgotten on sign out, on a refused
   session and on any change of account, so one person's waiting entries can
   never be sent under another person's account.

   No react-native import: AppState and the request are passed in by
   startPendingSync, so this module runs outside the app for measurement. */

const STORAGE_KEY = "trimio.pendingSubscriptions";
/* Bump when the stored shape changes in a way an old copy would break. */
const FORMAT = 1;
/* While something is waiting and the app is open, try again this often. A
   failed attempt with no connection costs one request that fails at once. */
const RETRY_MS = 30_000;

export const LIST_KEY = ["subscriptions", "list"];

export type CreatePayload = {
  name: string;
  price: number;
  nextBillingDate?: string;
  billingCycle: string;
  category: string;
  trialEndDate: string | null;
  force: boolean;
  currency: string;
  clientRef: string;
};

/* Why the server said no. Kept on the entry so the person can see it and
   decide, rather than the entry vanishing. */
export type Refusal = { code: string; limit?: number; existingName?: string };

export type PendingItem = {
  ref: string;
  localId: number;
  savedAt: number;
  payload: CreatePayload;
  refusal?: Refusal;
};

type State = { userId: number | null; items: PendingItem[] };

export const usePendingStore = create<State>(() => ({ userId: null, items: [] }));

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/* Loaded on first use inside a try, for the reason lib/offline-cache.ts gives:
   a top level import that throws would crash every launch. */
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

/* Every forget() moves this on, so work that began for a session that has
   since ended is dropped, or undone if it already reached the disk. */
let generation = 0;

/* Matches the server's check, /^[A-Za-z0-9_-]{8,64}$/. Uniqueness only has to
   hold within one person's own subscriptions, so this is not a secret and
   Math.random is enough. */
export function newClientRef(): string {
  const r = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  return `${Date.now().toString(36)}-${r()}-${r()}`;
}

export function isPendingRow(row: unknown): boolean {
  return !!row && typeof row === "object" && (row as { pending?: unknown }).pending === true;
}

/* THE SERVER'S DEFAULT BILLING DATE, mirrored, so a waiting entry shows (and
   gets reminders for) the same day the server will give it. One cycle from
   today in UTC, the month clamped to its last day; a trial is first charged
   when it ends. Replaced by the server's own row the moment it syncs. */
function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addMonthsUTC(date: Date, months: number, anchorDay: number): Date {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(anchorDay, last)));
}
function step(date: Date, cycle: string, anchorDay: number): Date {
  if (cycle === "weekly") return new Date(date.getTime() + 7 * 86400000);
  return addMonthsUTC(date, cycle === "yearly" ? 12 : 1, anchorDay);
}
function dayToIso(day: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString() : null;
}
export function defaultBillingDate(cycle: string, trialEndDate: string | null, today = new Date()): string {
  const start = startOfUtcDay(today);
  const trial = trialEndDate ? dayToIso(trialEndDate) : null;
  if (trial) {
    let d = new Date(trial);
    const anchor = d.getUTCDate();
    for (let i = 0; i < 1000 && d < start; i++) d = step(d, cycle, anchor);
    return d.toISOString();
  }
  return step(start, cycle, start.getUTCDate()).toISOString();
}

/* A waiting entry in the shape subscriptions.list returns (formatSub), so
   every screen that reads the list shows it without knowing it is waiting,
   apart from the two flags it can read when it does need to know. */
export function toRow(item: PendingItem) {
  const p = item.payload;
  const next = (p.nextBillingDate && dayToIso(p.nextBillingDate)) || defaultBillingDate(p.billingCycle, p.trialEndDate);
  return {
    id: item.localId,
    name: p.name,
    price: p.price,
    billingCycle: p.billingCycle,
    category: p.category,
    nextBillingDate: next,
    trialEndDate: p.trialEndDate ? dayToIso(p.trialEndDate) : null,
    billingAnchorDay: new Date(next).getUTCDate(),
    currency: p.currency || null,
    created_at: new Date(item.savedAt).toISOString(),
    isActive: true,
    cancelledAt: null,
    clientRef: item.ref,
    pending: true,
    refusal: item.refusal ?? null,
  };
}

async function persist(gen: number): Promise<void> {
  const store = getStorage();
  if (!store) return;
  const { userId, items } = usePendingStore.getState();
  if (userId == null) return;
  if (items.length === 0) await store.removeItem(STORAGE_KEY);
  else await store.setItem(STORAGE_KEY, JSON.stringify({ format: FORMAT, userId, items }));
  // The session ended while that write was in flight: take it back off disk.
  if (gen !== generation) await store.removeItem(STORAGE_KEY);
}

function setItems(items: PendingItem[]): void {
  usePendingStore.setState({ items });
  persist(generation).catch(() => {});
}

/* Puts the waiting entries into the cached list, replacing any copies already
   there, so the list, the calendar, the free limit count and the reminders all
   see them at once without a fetch. `saved` is rows the server has just
   returned for entries that were waiting: they take the entry's place, so the
   row does not blink out of the list until the next fetch brings it back. */
export function reapplyToCache(saved: unknown[] = []): void {
  const { items } = usePendingStore.getState();
  const current = queryClient.getQueryData<any[]>(LIST_KEY);
  if (!Array.isArray(current)) {
    // Nothing fetched yet: never invent a list out of saved rows alone.
    if (items.length === 0) return;
    queryClient.setQueryData(LIST_KEY, items.map(toRow));
    return;
  }
  const base = current.filter((r) => !isPendingRow(r));
  const ids = new Set(base.map((r) => r?.id));
  const fresh = saved.filter((r: any) => r && typeof r === "object" && typeof r.id === "number" && !ids.has(r.id));
  queryClient.setQueryData(LIST_KEY, [...base, ...fresh, ...items.map(toRow)]);
}

/* What every list fetch returns: the server's rows, then whatever is still
   waiting. A server row carrying a waiting entry's ref means the entry was
   saved (an answer lost on the way back, then a fetch that got through), so
   that entry is dropped here rather than shown twice. */
export function mergePending(serverRows: unknown): any[] {
  const rows = Array.isArray(serverRows) ? serverRows.filter((r) => !isPendingRow(r)) : [];
  const saved = new Set(rows.map((r: any) => r?.clientRef).filter(Boolean));
  const { items } = usePendingStore.getState();
  const still = items.filter((i) => !saved.has(i.ref));
  if (still.length !== items.length) setItems(still);
  return [...rows, ...still.map(toRow)];
}

export function addPending(userId: number, payload: CreatePayload): PendingItem {
  const state = usePendingStore.getState();
  // Another account's entries are never mixed in; setUser forgets them first,
  // so this only guards against a call made out of order.
  const items = state.userId === userId ? state.items : [];
  const lowest = items.reduce((min, i) => Math.min(min, i.localId), 0);
  const item: PendingItem = {
    ref: payload.clientRef,
    // Negative, so it can never collide with a server id, and unique.
    localId: Math.min(-1, lowest - 1, -Date.now()),
    savedAt: Date.now(),
    payload,
  };
  usePendingStore.setState({ userId, items: [...items.filter((i) => i.ref !== item.ref), item] });
  persist(generation).catch(() => {});
  reapplyToCache();
  scheduleRetry();
  return item;
}

export function removePending(ref: string): void {
  setItems(usePendingStore.getState().items.filter((i) => i.ref !== ref));
  reapplyToCache();
}

/* "Add anyway" after a duplicate refusal, or "Try again" after any other:
   clears the refusal (and sets force when asked) and sends it again. */
export function retryPending(ref: string, opts: { force?: boolean } = {}): Promise<number> {
  setItems(
    usePendingStore.getState().items.map((i) =>
      i.ref === ref
        ? { ...i, refusal: undefined, payload: { ...i.payload, force: opts.force ? true : i.payload.force } }
        : i,
    ),
  );
  reapplyToCache();
  return flushPending();
}

export async function forgetPending(): Promise<void> {
  generation += 1;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  usePendingStore.setState({ userId: null, items: [] });
  try {
    await getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // The copy names its user, so it is refused on read by anybody else anyway.
  }
}

/* Called once the user is known at launch, after the offline copy is
   restored, so the waiting entries land on top of the saved list. */
export async function loadPending(userId: number): Promise<void> {
  const gen = generation;
  let items: PendingItem[] = [];
  try {
    const store = getStorage();
    const raw = store ? await store.getItem(STORAGE_KEY) : null;
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.format === FORMAT && saved.userId === userId && Array.isArray(saved.items)) {
        items = saved.items.filter(
          (i: any) => i && typeof i.ref === "string" && typeof i.localId === "number" && i.payload && typeof i.payload.name === "string",
        );
      } else {
        await store!.removeItem(STORAGE_KEY).catch(() => {});
      }
    }
  } catch {
    items = [];
  }
  if (gen !== generation) return;
  usePendingStore.setState({ userId, items });
  if (items.length) {
    reapplyToCache();
    kick();
  }
}

/* SENDING. One pass at a time, oldest first, stopping at the first failure
   that means "not now" (no answer, a server error, a rate limit), since the
   rest would fail the same way. A refusal (the free limit, a same-name row,
   a validation error) marks that entry and moves on to the next. */
type Poster = (payload: CreatePayload) => Promise<unknown>;
let poster: Poster | null = null;
let getUserId: () => number | null = () => null;
let onSynced: (() => void) | null = null;
let onSaved: ((saved: unknown, item: PendingItem) => void) | null = null;
let flushing: Promise<number> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let appActive: () => boolean = () => true;

function waiting(): PendingItem[] {
  return usePendingStore.getState().items.filter((i) => !i.refusal);
}

/* ONE PASS AT A TIME, and the marker is cleared from OUTSIDE the pass, which
   is not a style choice. This used to be `flushing = (async () => { try {...}
   finally { flushing = null } })()`. An async function runs synchronously up
   to its first await, so a pass with nothing to send (or no session) reached
   its finally BEFORE the assignment, and the assignment then stored a promise
   that was already settled and that nothing would ever clear: every later
   send returned it, and nothing was saved again until the app restarted.
   Found by running this module against the real query cache, 2026-11-04. */
export function flushPending(): Promise<number> {
  if (flushing) return flushing;
  const run = sendAll();
  flushing = run;
  const clear = () => {
    if (flushing === run) flushing = null;
  };
  run.then(clear, clear);
  return run;
}

async function sendAll(): Promise<number> {
  const gen = generation;
  let synced = 0;
  let refused = 0;
  const savedRows: unknown[] = [];
  const uid = getUserId();
  if (!poster || uid == null || usePendingStore.getState().userId !== uid) return 0;
  for (const item of waiting()) {
    if (gen !== generation) break;
    let saved: unknown;
    try {
      saved = await poster(item.payload);
    } catch (e: any) {
      if (gen !== generation) break;
      if (isTransientFailure(e)) break;
      const status = e?.response?.status;
      const body = e?.response?.data ?? {};
      /* 401 and a non-limit 403 are about the session, which the API
         client and the auth store decide; the entry waits for that. */
      if (status === 401 || (status === 403 && body.error !== "FREE_LIMIT_REACHED")) break;
      const refusal: Refusal = { code: typeof body.error === "string" ? body.error : `HTTP_${status}` };
      if (typeof body.limit === "number") refusal.limit = body.limit;
      if (typeof body.existingName === "string") refusal.existingName = body.existingName;
      setItems(usePendingStore.getState().items.map((i) => (i.ref === item.ref ? { ...i, refusal } : i)));
      refused += 1;
      continue;
    }
    if (gen !== generation) break;
    setItems(usePendingStore.getState().items.filter((i) => i.ref !== item.ref));
    synced += 1;
    savedRows.push(saved);
    try {
      onSaved?.(saved, item);
    } catch {
      // Analytics must never undo a save.
    }
  }
  if (gen === generation && (synced || refused)) {
    reapplyToCache(savedRows);
    if (synced) onSynced?.();
  }
  return synced;
}

function scheduleRetry(): void {
  if (timer || waiting().length === 0) return;
  timer = setTimeout(() => {
    timer = null;
    if (appActive()) kick();
    else scheduleRetry();
  }, RETRY_MS);
}

function kick(): void {
  if (waiting().length === 0) return;
  flushPending()
    .catch(() => 0)
    .finally(() => scheduleRetry());
}

/* Called once at launch from app/_layout.tsx. A successful fetch of anything
   means the connection is back, so it is the cue to send; so is the app
   coming to the foreground. setQueryData also reports "success", flagged
   manual, and is ignored, or every local edit of the cache would fire a send. */
export function startPendingSync(opts: {
  getUserId: () => number | null;
  post: Poster;
  onSynced?: () => void;
  onSaved?: (saved: unknown, item: PendingItem) => void;
  appState?: { currentState?: string; addEventListener: (type: "change", fn: (s: string) => void) => unknown };
}): void {
  getUserId = opts.getUserId;
  poster = opts.post;
  onSynced = opts.onSynced ?? null;
  onSaved = opts.onSaved ?? null;
  if (opts.appState) {
    const app = opts.appState;
    appActive = () => app.currentState === undefined || app.currentState === "active";
    app.addEventListener("change", (s) => {
      if (s === "active") kick();
    });
  }
  queryClient.getQueryCache().subscribe((event: any) => {
    if (!event || event.type !== "updated" || event.action?.type !== "success" || event.action?.manual) return;
    kick();
  });
}
