/* Subscriptions added with no connection: kept, sent once, never under the
   wrong account, and never wedged.

   BEHAVIOURAL, so it needs jest's TypeScript transform and runs in CI, not in a
   sandbox. The same scenarios (37 of them) were measured on 2026-11-04 on Node
   type stripping, against the real lib/pending-subscriptions.ts with only its
   two import specifiers rewritten, the real @tanstack/query-core 4.32.0 and
   zustand 4.4.1. That run is what found the wedge pinned by the first block
   below: the previous draft cleared its "sending" marker inside the pass, and a
   pass with nothing to send cleared it before it was set, so nothing was ever
   sent again until the app restarted.

   The server half (the same ref saved once, ahead of the free limit) is in
   __tests__/client-ref.test.js, and was measured by booting the real server on
   PostgreSQL 16. */

const mockStore = new Map();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (k) => (mockStore.has(k) ? mockStore.get(k) : null),
    setItem: async (k, v) => {
      mockStore.set(k, v);
    },
    removeItem: async (k) => {
      mockStore.delete(k);
    },
  },
}));

const { queryClient } = require("../lib/query-client");
const P = require("../lib/pending-subscriptions");

const KEY = "trimio.pendingSubscriptions";
const LIST = ["subscriptions", "list"];
const tick = () => new Promise((r) => setTimeout(r, 5));
const netErr = () => Object.assign(new Error("Network Error"), { request: {} });
const httpErr = (status, data) => Object.assign(new Error("HTTP " + status), { response: { status, data } });

let mockUserId = 7;
let replies = [];
const posted = [];
let savedCount = 0;
let syncedCount = 0;

const payload = (name, extra = {}) => ({
  name,
  price: 9.99,
  billingCycle: "monthly",
  category: "streaming",
  trialEndDate: null,
  force: false,
  currency: "EUR",
  clientRef: P.newClientRef(),
  ...extra,
});
const items = () => P.usePendingStore.getState().items;
const list = () => queryClient.getQueryData(LIST);
const row = (id, p) => ({ id, name: p.name, price: p.price, billingCycle: p.billingCycle, clientRef: p.clientRef });
/* Adds an entry the way a failed create does, with the send it triggers failing. */
async function addOffline(p) {
  P.addPending(mockUserId, p);
  await tick();
}

beforeAll(() => {
  P.startPendingSync({
    getUserId: () => mockUserId,
    post: async (p) => {
      posted.push(p.clientRef);
      const reply = replies.shift();
      if (!reply) throw netErr();
      return reply(p);
    },
    onSynced: () => {
      syncedCount += 1;
    },
    onSaved: () => {
      savedCount += 1;
    },
  });
});

beforeEach(async () => {
  await P.forgetPending();
  mockUserId = 7;
  replies = [];
  posted.length = 0;
  savedCount = 0;
  syncedCount = 0;
  mockStore.clear();
  queryClient.clear();
  queryClient.setQueryData(LIST, [{ id: 1, name: "Netflix", clientRef: null }]);
  await P.loadPending(7);
});

afterAll(async () => {
  // Also clears the retry timer, so nothing keeps jest alive.
  await P.forgetPending();
  queryClient.clear();
});

describe("never wedged", () => {
  it("a pass with nothing to send does not block the next one", async () => {
    expect(await P.flushPending()).toBe(0);
    const p = payload("Spotify");
    await addOffline(p);
    replies = [(x) => row(101, x)];
    expect(await P.flushPending()).toBe(1);
    expect(items()).toHaveLength(0);
  });

  it("a pass refused for the session does not block the next one either", async () => {
    await addOffline(payload("Spotify"));
    mockUserId = 9; // the store belongs to 7
    expect(await P.flushPending()).toBe(0);
    mockUserId = 7;
    replies = [(x) => row(101, x)];
    expect(await P.flushPending()).toBe(1);
  });
});

describe("waiting and sending", () => {
  it("an entry added offline shows in the list, marked, with a negative id, and is kept on disk for its user", async () => {
    await addOffline(payload("Spotify"));
    expect(list()).toHaveLength(2);
    expect(list()[1].pending).toBe(true);
    expect(list()[1].id).toBeLessThan(0);
    expect(JSON.parse(mockStore.get(KEY)).userId).toBe(7);
  });

  it("a real fetch succeeding sends it; a manual cache write does not", async () => {
    await addOffline(payload("Spotify"));
    const before = posted.length;
    queryClient.setQueryData(["settings"], { a: 1 });
    await tick();
    expect(posted.length).toBe(before);
    replies = [(x) => row(101, x)];
    await queryClient.fetchQuery({ queryKey: ["ping"], queryFn: async () => 1 });
    await tick();
    await tick();
    expect(posted.length).toBe(before + 1);
    expect(items()).toHaveLength(0);
    expect(savedCount).toBe(1);
    expect(syncedCount).toBe(1);
  });

  it("the saved row takes the waiting row's place, so it never blinks out of the list", async () => {
    await addOffline(payload("Spotify"));
    replies = [(x) => row(101, x)];
    await P.flushPending();
    expect(list().map((r) => r.id)).toEqual([1, 101]);
    expect(list().some(P.isPendingRow)).toBe(false);
    expect(mockStore.has(KEY)).toBe(false);
  });

  it("no answer, a server error, a rate limit, a 401 or a non-limit 403 stop the pass and refuse nothing", async () => {
    await addOffline(payload("Q1"));
    await addOffline(payload("Q2"));
    for (const err of [netErr(), httpErr(503, {}), httpErr(429, {}), httpErr(401, {}), httpErr(403, { error: "X" })]) {
      const n = posted.length;
      replies = [() => { throw err; }, (x) => row(999, x)];
      await P.flushPending();
      expect(posted.length).toBe(n + 1);
      expect(items()).toHaveLength(2);
      expect(items().every((i) => !i.refusal)).toBe(true);
    }
  });
});

describe("refusals stay visible and are the person's to decide", () => {
  it("the free limit and a same-name row are kept with their details, and the next entry is still sent", async () => {
    const a = payload("A");
    const b = payload("B");
    await addOffline(a);
    await addOffline(b);
    await addOffline(payload("C"));
    replies = [
      () => { throw httpErr(403, { error: "FREE_LIMIT_REACHED", limit: 5 }); },
      () => { throw httpErr(409, { error: "DUPLICATE_SUBSCRIPTION", existingName: "b" }); },
      (x) => row(102, x),
    ];
    await P.flushPending();
    const byRef = Object.fromEntries(items().map((i) => [i.ref, i]));
    expect(byRef[a.clientRef].refusal).toEqual({ code: "FREE_LIMIT_REACHED", limit: 5 });
    expect(byRef[b.clientRef].refusal).toEqual({ code: "DUPLICATE_SUBSCRIPTION", existingName: "b" });
    expect(items()).toHaveLength(2);
    expect(list().filter(P.isPendingRow).every((r) => r.refusal)).toBe(true);
    const n = posted.length;
    await P.flushPending();
    expect(posted.length).toBe(n); // not resent on its own
  });

  it("Add anyway resends the SAME ref with force set", async () => {
    const b = payload("B");
    await addOffline(b);
    replies = [() => { throw httpErr(409, { error: "DUPLICATE_SUBSCRIPTION", existingName: "B" }); }];
    await P.flushPending();
    let sent = null;
    replies = [(x) => { sent = x; return row(103, x); }];
    await P.retryPending(b.clientRef, { force: true });
    expect(sent.clientRef).toBe(b.clientRef);
    expect(sent.force).toBe(true);
    expect(items()).toHaveLength(0);
  });

  it("a validation refusal keeps the server's own text, already in the reader's language", async () => {
    await addOffline(payload("Q"));
    replies = [() => { throw httpErr(400, { error: "Ungültiges nächstes Abrechnungsdatum" }); }];
    await P.flushPending();
    expect(items()[0].refusal.code).toBe("Ungültiges nächstes Abrechnungsdatum");
  });

  it("removing one is local", async () => {
    const p = payload("Gone");
    await addOffline(p);
    const n = posted.length;
    P.removePending(p.clientRef);
    expect(items()).toHaveLength(0);
    expect(list().some(P.isPendingRow)).toBe(false);
    expect(posted.length).toBe(n);
  });
});

describe("shown once", () => {
  it("a fetched list already holding the ref drops the waiting copy (the answer was lost, then a fetch got through)", async () => {
    const p = payload("Spotify");
    await addOffline(p);
    const merged = P.mergePending([{ id: 200, name: "Spotify", clientRef: p.clientRef }]);
    expect(merged.filter((r) => r.clientRef === p.clientRef)).toHaveLength(1);
    expect(merged.some((r) => r.pending)).toBe(false);
    expect(items()).toHaveLength(0);
  });
});

describe("whose it is", () => {
  it("signing out while a send is in flight: the late answer changes nothing and the disk is cleared", async () => {
    await addOffline(payload("S1"));
    let release;
    replies = [(x) => new Promise((r) => { release = () => r(row(300, x)); })];
    const flight = P.flushPending();
    await tick();
    await P.forgetPending();
    release();
    await flight;
    expect(items()).toHaveLength(0);
    expect(P.usePendingStore.getState().userId).toBeNull();
    expect(mockStore.has(KEY)).toBe(false);
    expect(savedCount).toBe(0);
  });

  it("another account loads nothing, and the first account's copy is removed rather than kept", async () => {
    await addOffline(payload("Owned by 7"));
    expect(JSON.parse(mockStore.get(KEY)).userId).toBe(7);
    P.usePendingStore.setState({ userId: null, items: [] }); // a fresh launch
    await P.loadPending(8);
    expect(items()).toHaveLength(0);
    expect(mockStore.has(KEY)).toBe(false);
  });

  it("the same account relaunching gets its entries back in the list", async () => {
    await addOffline(payload("Owned by 7"));
    P.usePendingStore.setState({ userId: null, items: [] });
    queryClient.setQueryData(LIST, [{ id: 1, name: "Netflix" }]);
    await P.loadPending(7);
    await tick();
    expect(items()).toHaveLength(1);
    expect(list().some((r) => r.pending && r.name === "Owned by 7")).toBe(true);
  });

  it("a corrupt or unknown-format copy is dropped, never thrown", async () => {
    mockStore.set(KEY, "{not json");
    P.usePendingStore.setState({ userId: null, items: [] });
    await P.loadPending(7);
    expect(items()).toHaveLength(0);
    mockStore.set(KEY, JSON.stringify({ format: 99, userId: 7, items: [{ ref: "x", localId: -1, payload: { name: "x" } }] }));
    await P.loadPending(7);
    expect(items()).toHaveLength(0);
    expect(mockStore.has(KEY)).toBe(false);
  });
});

describe("the entry the server will make", () => {
  it("refs match the server's pattern and do not repeat", () => {
    const refs = Array.from({ length: 2000 }, () => P.newClientRef());
    expect(refs.every((r) => /^[A-Za-z0-9_-]{8,64}$/.test(r))).toBe(true);
    expect(new Set(refs).size).toBe(2000);
  });

  it("the default billing date is the server's: one cycle from today in UTC, clamped, and a trial charged when it ends", () => {
    const today = new Date(Date.UTC(2026, 0, 31, 15));
    expect(P.defaultBillingDate("monthly", null, today)).toBe("2026-02-28T00:00:00.000Z");
    expect(P.defaultBillingDate("weekly", null, today)).toBe("2026-02-07T00:00:00.000Z");
    expect(P.defaultBillingDate("yearly", null, today)).toBe("2027-01-31T00:00:00.000Z");
    expect(P.defaultBillingDate("monthly", "2026-02-10", today)).toBe("2026-02-10T00:00:00.000Z");
    expect(P.defaultBillingDate("monthly", "2026-01-31", today)).toBe("2026-01-31T00:00:00.000Z");
    expect(P.defaultBillingDate("monthly", "2025-12-31", today)).toBe("2026-01-31T00:00:00.000Z");
    // 30 Dec, then 30 Jan, which is still before today, then 28 Feb, clamped.
    expect(P.defaultBillingDate("monthly", "2025-11-30", today)).toBe("2026-02-28T00:00:00.000Z");
  });
});
