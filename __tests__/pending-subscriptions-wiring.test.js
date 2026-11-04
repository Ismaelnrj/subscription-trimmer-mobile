/* The wiring that makes offline adding hold together, read from source so it
   runs anywhere. The module's behaviour is pinned separately, in
   pending-subscriptions.test.js (CI) and client-ref.test.js.

   Each assertion here is a way the feature fails without anything crashing:
   a screen that fetches the list its own way makes waiting entries vanish
   from whichever screen fetched last; a sign out that keeps them sends one
   person's entries under the next person's account; a create failure that is
   not checked for "no connection" throws the entry away. */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
/* Comments explain the old behaviour by quoting it, so code assertions read
   code only. Block comments and JSX comments; never `//`, which eats URLs. */
const codeOf = (src) => {
  const out = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
  if (src.includes("/*") && out.length === src.length) throw new Error("comment strip removed nothing");
  return out;
};
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(e.name) ? [rel] : [];
  });
}
const sources = ["app", "components", "lib"].flatMap(walk);

describe("one way to fetch the list", () => {
  it("only lib/subscription-list.ts requests /trpc/subscriptions.list", () => {
    const offenders = sources.filter(
      (f) => f !== path.join("lib", "subscription-list.ts") && codeOf(read(f)).includes('"/trpc/subscriptions.list"'),
    );
    expect(offenders).toEqual([]);
  });

  it("and it merges the waiting entries into what the server returned", () => {
    const src = codeOf(read("lib/subscription-list.ts"));
    expect(src).toMatch(/return mergePending\(rows\)/);
  });

  it("every screen querying the list uses that fetch", () => {
    const users = sources.filter((f) => /queryKey: \["subscriptions", "list"\],\s*\n\s*queryFn/.test(read(f)));
    expect(users.length).toBeGreaterThanOrEqual(7);
    for (const f of users) {
      const src = read(f);
      const blocks = src.split('queryKey: ["subscriptions", "list"],').slice(1);
      for (const b of blocks) {
        const next = b.slice(0, 200);
        if (!/^\s*queryFn/.test(next)) continue; // an invalidate, not a query
        expect([f, /queryFn: fetchSubscriptionList|fetchSubscriptionList\(\)/.test(next)]).toEqual([f, true]);
      }
    }
  });
});

describe("a create with no connection is kept, not thrown away", () => {
  const src = codeOf(read("app/(tabs)/subscriptions.tsx"));

  it("every new entry carries its own ref", () => {
    expect(src).toMatch(/createMutation\.mutate\(\{ \.\.\.data, clientRef: newClientRef\(\) \}\)/);
  });

  it("a transient failure on create queues it, with the ref it was sent with", () => {
    const onError = src.slice(src.indexOf("const createMutation"), src.indexOf("const updateMutation"));
    expect(onError).toMatch(/isTransientFailure\(err\)/);
    expect(onError).toMatch(/addPending\(/);
    expect(onError).toMatch(/rescheduleRemindersFromCache\(\)/);
  });

  it("edits, deletes, pauses and cancels say the connection is the problem", () => {
    expect((src.match(/isTransientFailure\(err\) \? t\("subscriptions\.noConnection"\)/g) || []).length).toBe(4);
  });

  it("a waiting row never reaches a server call that needs an id", () => {
    expect(src).toMatch(/const confirmDelete = \(sub: any\) => \{\s*if \(isPendingRow\(sub\)\) \{ showPending\(sub\); return; \}/);
    const details = codeOf(read("app/subscription-details.tsx"));
    expect(details).toMatch(/if \(isPendingRow\(sub\)\) \{[\s\S]{0,400}removePending\(sub\.clientRef\)/);
    expect(details).toMatch(/isPendingRow\(sub\) \? \(/); // no edit button for it
  });

  it("both places where totals show say what is not in them yet", () => {
    for (const f of ["app/(tabs)/index.tsx", "app/(tabs)/subscriptions.tsx"]) {
      expect([f, codeOf(read(f)).includes("<PendingNotice />")]).toEqual([f, true]);
    }
  });
});

describe("whose they are", () => {
  const auth = codeOf(read("lib/auth-store.ts"));

  it("an identity change forgets them with the offline copy", () => {
    expect(auth).toMatch(/if \(previousId !== null\) \{\s*forgetOfflineCache\(\);[\s\S]{0,200}forgetPending\(\);/);
  });

  it("sign out and a refused session forget them", () => {
    const forgets = (auth.match(/await forgetOfflineCache\(\);\s*await forgetPending\(\);/g) || []).length;
    expect(forgets).toBe(2);
  });

  it("both launch paths load them after the offline copy, for the same user", () => {
    expect(auth).toMatch(/await restoreOfflineCache\(res\.data\.id\);[\s\S]{0,120}await loadPending\(res\.data\.id\);/);
    expect(auth).toMatch(/await restoreOfflineCache\(user\.id\);\s*await loadPending\(user\.id\);/);
  });

  it("the offline copy never stores a waiting row as if it were saved", () => {
    const cache = read("lib/offline-cache.ts");
    expect(cache).toMatch(/\.filter\(\(r\) => !\(r && typeof r === "object" && \(r as \{ pending\?: unknown \}\)\.pending === true\)\)/);
  });
});

describe("the sender", () => {
  const mod = codeOf(read("lib/pending-subscriptions.ts"));

  it("is started once at launch, with the app state, posting to create", () => {
    const layout = codeOf(read("app/_layout.tsx"));
    expect(layout).toMatch(/startPendingSync\(\{/);
    expect(layout).toMatch(/apiClient\.post\("\/trpc\/subscriptions\.create", payload\)/);
    expect(layout).toMatch(/appState: AppState/);
  });

  it("clears its in-progress marker from outside the pass, never inside it", () => {
    /* Inside, a pass that returns before its first await clears the marker
       before it is set, and every later send returns that settled promise. */
    const pass = mod.slice(mod.indexOf("async function sendAll"), mod.indexOf("function scheduleRetry"));
    expect(pass.length).toBeGreaterThan(200);
    expect(pass).not.toMatch(/flushing\s*=/);
    expect(mod).toMatch(/if \(flushing === run\) flushing = null;/);
  });

  it("ignores manual cache writes, or every local edit would fire a send", () => {
    expect(mod).toMatch(/event\.action\?\.type !== "success" \|\| event\.action\?\.manual\) return;/);
  });

  it("makes refs the server accepts", () => {
    const server = read("backend/server.js");
    const pattern = "/^[A-Za-z0-9_-]{8,64}$/";
    expect(server.includes(pattern)).toBe(true);
    expect(read("lib/pending-subscriptions.ts").includes(pattern)).toBe(true);
  });
});

describe("copy", () => {
  const keys = [
    "subscriptions.savedOfflineTitle",
    "subscriptions.savedOfflineBody",
    "subscriptions.noConnection",
    "subscriptions.pendingTitle",
    "subscriptions.pendingBody",
    "subscriptions.pendingRemove",
    "subscriptions.pendingBadge",
    "subscriptions.refusedBadge",
    "subscriptions.refusedTitle",
    "subscriptions.refusedLimit",
    "subscriptions.refusedOther",
    "subscriptions.a11yPending",
    "common.pendingNotice_one",
    "common.pendingNotice_other",
  ];
  for (const lang of ["en", "de"]) {
    it(`every new string exists in ${lang}`, () => {
      const d = JSON.parse(read(`locales/${lang}.json`));
      const missing = keys.filter((k) => {
        const [s, n] = k.split(".");
        return typeof d[s]?.[n] !== "string" || !d[s][n].trim();
      });
      expect(missing).toEqual([]);
    });
  }
});
