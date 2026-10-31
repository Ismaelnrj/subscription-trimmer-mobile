/* The offline copy: what it saves, whose it is, and that screens show it.

   The behavioural half drives the REAL lib/offline-cache.ts and the real
   @tanstack/react-query against an in-memory AsyncStorage. It needs jest's
   TypeScript transform, so it runs in CI and not in a sandbox. The same
   scenarios were measured separately on 2026-10-31 on Node type stripping
   against @tanstack/query-core 4.32.0 with only the import specifiers
   rewritten: 19 of 19, including the two that matter most, a different user
   getting nothing and a write that loses a race with sign out being undone.

   The source half pins the screens: a refetch that fails must not replace data
   with an error, or the copy is restored and then hidden. */

const fs = require("fs");
const path = require("path");

const mockStore = new Map();
const mockHooks = { afterSet: null };
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (k) => (mockStore.has(k) ? mockStore.get(k) : null),
    setItem: async (k, v) => {
      mockStore.set(k, v);
      if (mockHooks.afterSet) mockHooks.afterSet();
    },
    removeItem: async (k) => {
      mockStore.delete(k);
    },
  },
}));

const { QueryObserver } = require("@tanstack/react-query");
const { queryClient, resetQueryCache } = require("../lib/query-client");
const {
  startOfflineCache,
  restoreOfflineCache,
  forgetOfflineCache,
  snapshot,
} = require("../lib/offline-cache");

const KEY = "trimio.offlineCache";
const SUBS = [{ id: 1, name: "Netflix", price: 15.99 }];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAIT = 1300; // the write delay is one second
let mockUserId = 7;

beforeAll(() => {
  startOfflineCache(() => mockUserId);
});

beforeEach(async () => {
  mockUserId = 7;
  mockHooks.afterSet = null;
  await forgetOfflineCache();
  queryClient.clear();
  mockStore.clear();
});

afterAll(() => {
  queryClient.clear();
});

describe("what is saved", () => {
  it("writes an allowlisted query, stamped with the user it belongs to", async () => {
    await queryClient.fetchQuery({ queryKey: ["subscriptions", "list"], queryFn: async () => SUBS });
    await sleep(WAIT);
    const saved = JSON.parse(mockStore.get(KEY));
    expect(saved.userId).toBe(7);
    expect(saved.state.queries.map((q) => q.queryHash)).toContain('["subscriptions","list"]');
  });

  it("leaves out anything not on the allowlist", async () => {
    await queryClient.fetchQuery({ queryKey: ["subscriptions", "list"], queryFn: async () => SUBS });
    await queryClient.fetchQuery({ queryKey: ["notifications", "history"], queryFn: async () => [{ id: 9 }] });
    await sleep(WAIT);
    const saved = JSON.parse(mockStore.get(KEY));
    expect(saved.state.queries.map((q) => q.queryHash)).not.toContain('["notifications","history"]');
  });

  it("keeps a query whose refetch failed, and the circular error is not serialised", async () => {
    await queryClient.fetchQuery({ queryKey: ["subscriptions", "list"], queryFn: async () => SUBS });
    await queryClient
      .fetchQuery({
        queryKey: ["subscriptions", "list"],
        retry: false,
        queryFn: async () => {
          const e = new Error("Network Error");
          e.self = e;
          throw e;
        },
      })
      .catch(() => {});
    const snap = JSON.parse(JSON.stringify(snapshot()));
    expect(snap.queries[0].state.status).toBe("success");
    expect(snap.queries[0].state.error).toBeNull();
    expect(snap.queries[0].state.data).toEqual(SUBS);
  });

  it("writes nothing while signed out", async () => {
    mockUserId = null;
    await queryClient.fetchQuery({ queryKey: ["settings"], queryFn: async () => ({ currency: "EUR" }) });
    await sleep(WAIT);
    expect(mockStore.has(KEY)).toBe(false);
  });
});

describe("whose it is", () => {
  it("restores into the same user", async () => {
    await queryClient.fetchQuery({ queryKey: ["subscriptions", "list"], queryFn: async () => SUBS });
    await sleep(WAIT);
    queryClient.clear();
    expect(await restoreOfflineCache(7)).toBe(true);
    expect(queryClient.getQueryData(["subscriptions", "list"])).toEqual(SUBS);
  });

  it("gives a different user nothing, and deletes the copy", async () => {
    await queryClient.fetchQuery({ queryKey: ["subscriptions", "list"], queryFn: async () => SUBS });
    await sleep(WAIT);
    queryClient.clear();
    mockUserId = 8;
    expect(await restoreOfflineCache(8)).toBe(false);
    expect(queryClient.getQueryData(["subscriptions", "list"])).toBeUndefined();
    expect(mockStore.has(KEY)).toBe(false);
  });

  it("forget cancels a write that is still pending", async () => {
    await queryClient.fetchQuery({ queryKey: ["settings"], queryFn: async () => ({ currency: "EUR" }) });
    await forgetOfflineCache();
    await sleep(WAIT);
    expect(mockStore.has(KEY)).toBe(false);
  });

  it("a write that loses a race with sign out is taken back off disk", async () => {
    mockHooks.afterSet = () => {
      mockHooks.afterSet = null;
      forgetOfflineCache();
    };
    await queryClient.fetchQuery({ queryKey: ["settings"], queryFn: async () => ({ currency: "EUR" }) });
    await sleep(WAIT);
    expect(mockStore.has(KEY)).toBe(false);
  });

  it("refuses a copy older than thirty days, and never throws on a corrupt one", async () => {
    mockStore.set(KEY, JSON.stringify({ format: 1, userId: 7, savedAt: Date.now() - 31 * 86400000, state: { mutations: [], queries: [] } }));
    expect(await restoreOfflineCache(7)).toBe(false);
    mockStore.set(KEY, "{not json");
    expect(await restoreOfflineCache(7)).toBe(false);
  });

  it("waits for a reset in progress rather than restoring under it", async () => {
    await queryClient.fetchQuery({ queryKey: ["subscriptions", "list"], queryFn: async () => SUBS });
    await sleep(WAIT);
    const reset = resetQueryCache();
    const restoring = restoreOfflineCache(7);
    await reset;
    expect(await restoring).toBe(true);
    expect(queryClient.getQueryData(["subscriptions", "list"])).toEqual(SUBS);
  });
});

describe("a screen offline", () => {
  it("keeps the restored data: a refetch error, not a loading error", async () => {
    await queryClient.fetchQuery({ queryKey: ["subscriptions", "list"], queryFn: async () => SUBS });
    await sleep(WAIT);
    queryClient.clear();
    await restoreOfflineCache(7);
    const observer = new QueryObserver(queryClient, {
      queryKey: ["subscriptions", "list"],
      retry: false,
      queryFn: async () => {
        throw new Error("offline");
      },
    });
    const unsubscribe = observer.subscribe(() => {});
    await sleep(50);
    const result = observer.getCurrentResult();
    unsubscribe();
    expect(result.data).toEqual(SUBS);
    expect(result.isLoadingError).toBe(false);
    expect(result.isRefetchError).toBe(true);
    // isError is TRUE here, which is why the screens must not gate on it.
    expect(result.isError).toBe(true);
  });
});

describe("the screens gate on isLoadingError, not isError", () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
  const SCREENS = [
    "app/(tabs)/index.tsx",
    "app/(tabs)/calendar.tsx",
    "app/(tabs)/subscriptions.tsx",
    "app/(tabs)/analytics.tsx",
    "app/insights.tsx",
    "app/subscription-details.tsx",
    "app/alerts.tsx",
    "app/notifications.tsx",
    "app/notification-preferences.tsx",
    "app/cancelled.tsx",
  ];

  it.each(SCREENS)("%s reads isLoadingError from its queries", (p) => {
    const src = read(p);
    expect(src).toMatch(/isLoadingError/);
    /* A bare `isError,` or `isError: x` inside a useQuery destructure is the
       defect: it flips to the error state when an offline refetch fails, and
       the saved copy is restored only to be hidden. */
    const destructures = src.match(/const \{[^}]*\}\s*=\s*useQuery/g) || [];
    // As a KEY only: `isLoadingError: isError` aliases into the old name, fine.
    for (const d of destructures) expect(d).not.toMatch(/[{,]\s*isError\s*[,:}]/);
  });

  it("the four tabs say when they are showing saved data", () => {
    for (const p of SCREENS.slice(0, 4)) {
      expect(read(p)).toMatch(/<OfflineNotice \/>/);
    }
  });

  it("the copy is forgotten on sign out, on a refused session and on a change of account", () => {
    // From the implementation: the same names appear first in the interface.
    const stripped = read("lib/auth-store.ts").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    const auth = stripped.slice(stripped.indexOf("create<AuthState>"));
    const logout = auth.slice(auth.indexOf("logout: async"), auth.indexOf("restoreToken:"));
    expect(logout).toMatch(/forgetOfflineCache\(\)/);
    const setUser = auth.slice(auth.indexOf("setUser: (user)"), auth.indexOf("setLoading:"));
    expect(setUser).toMatch(/if \(previousId !== null\) forgetOfflineCache\(\)/);
    const restore = auth.slice(auth.indexOf("restoreToken: async"));
    const refused = restore.slice(restore.indexOf("} else {"));
    expect(refused).toMatch(/forgetOfflineCache\(\)/);
  });
});
