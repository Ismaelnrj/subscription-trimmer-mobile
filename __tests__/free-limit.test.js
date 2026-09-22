/* The free tier cap, which is now a deployment setting rather than a constant.

   WHY THIS SUITE EXISTS AT ALL. CLAUDE.md recorded that the cap "of 5 read from
   the server's own FREE_LIMIT_REACHED code rather than duplicated client side,
   so the two cannot drift". That was FALSE: app/(tabs)/subscriptions.tsx held
   `const FREE_LIMIT = 5` and used it in six places, including the meter and the
   add button's locked state. Making the server's number configurable while that
   copy stayed hardcoded would have been strictly worse than leaving it alone,
   because the gate and the thing drawing the gate would disagree and only one of
   them is visible to the user. */

const fs = require("fs");
const path = require("path");
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

/* CODE WITH THE COMMENTS TAKEN OUT, and it exists because writing these
   assertions hit the same trap twice in one sitting: a comment explaining why a
   string must not appear necessarily CONTAINS that string, so a whole file
   search finds it in prose and the assertion passes, or fails, for the wrong
   reason. Block comments and JSX comment blocks only, never `//` to end of
   line, because that eats the `//` in a URL. */
const codeOf = (src) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const SERVER = read("backend", "server.js");
const SUBS = read("app", "(tabs)", "subscriptions.tsx");
const UPGRADE = read("app", "upgrade.tsx");
const CANCELLED = read("app", "cancelled.tsx");
const EN = JSON.parse(read("locales", "en.json"));
const DE = JSON.parse(read("locales", "de.json"));

// The real constant, evaluated rather than described, so the parsing is tested.
const limitSrc = SERVER.slice(
  SERVER.indexOf("const FREE_SUBSCRIPTION_LIMIT = (() => {"),
  SERVER.indexOf("})();", SERVER.indexOf("const FREE_SUBSCRIPTION_LIMIT")) + 5
);
function limitFor(value) {
  const prev = process.env.FREE_SUBSCRIPTION_LIMIT;
  if (value === undefined) delete process.env.FREE_SUBSCRIPTION_LIMIT;
  else process.env.FREE_SUBSCRIPTION_LIMIT = value;
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (m) => warnings.push(String(m));
  try {
    // eslint-disable-next-line no-eval
    const n = eval(limitSrc + "\nFREE_SUBSCRIPTION_LIMIT");
    return { n, warnings };
  } finally {
    console.warn = realWarn;
    if (prev === undefined) delete process.env.FREE_SUBSCRIPTION_LIMIT;
    else process.env.FREE_SUBSCRIPTION_LIMIT = prev;
  }
}

describe("the limit reads its environment safely", () => {
  it("defaults to 5 when unset", () => {
    expect(limitFor(undefined).n).toBe(5);
    expect(limitFor("").n).toBe(5);
  });

  it("takes a whole number", () => {
    expect(limitFor("10").n).toBe(10);
    expect(limitFor("1").n).toBe(1);
  });

  it("refuses 0 rather than locking every add", () => {
    /* Zero is a coherent business model and also indistinguishable from an
       outage from inside the app: every add refused with no message that fits.
       If it is ever wanted it belongs in an explicit paywall. */
    const r = limitFor("0");
    expect(r.n).toBe(5);
    expect(r.warnings.length).toBe(1);
  });

  it("falls back on a typo instead of refusing to boot", () => {
    /* Deliberately the OPPOSITE of the JWT_SECRET decision, and the distinction
       is what it guards: that one is access control, this is a product tier. A
       typo in a growth knob must not take the service down. */
    for (const bad of ["abc", "-3", "3.5.1"]) {
      const r = limitFor(bad);
      expect(r.n).toBe(5);
      expect(r.warnings.length).toBe(1);
    }
  });

  it("warns naming the value it rejected", () => {
    expect(limitFor("abc").warnings[0]).toMatch(/abc/);
  });
});

describe("one number, enforced in every place it is enforced", () => {
  it("no hardcoded 5 survives in either gate", () => {
    /* Both sites: subscriptions.create and the restore path in setCancelled.
       A configurable limit that one of them ignores is the same defect as a
       hardcoded one, in a place that is harder to find. */
    expect(SERVER).not.toMatch(/parseInt\(countResult\.rows\[0\]\.c\) >= 5/);
    const gates = [...SERVER.matchAll(/parseInt\(countResult\.rows\[0\]\.c\) >= (\w+)/g)];
    expect(gates.length).toBe(2);
    for (const g of gates) expect(g[1]).toBe("FREE_SUBSCRIPTION_LIMIT");
  });

  it("tells the client the number on a request it already makes", () => {
    // settings.get, which the subscriptions screen already queries, so the
    // client learns the limit without an extra round trip.
    expect(SERVER).toMatch(/freeSubscriptionLimit: FREE_SUBSCRIPTION_LIMIT/);
  });

  it("carries the limit on the refusal itself", () => {
    /* The 403 is the only place the number is guaranteed current, since the
       server decided that exact refusal with it. */
    const refusals = [...SERVER.matchAll(/error: 'FREE_LIMIT_REACHED'([^}]*)\}/g)];
    expect(refusals.length).toBe(2);
    for (const r of refusals) expect(r[1]).toMatch(/limit: FREE_SUBSCRIPTION_LIMIT/);
  });

  it("settings.update never writes it", () => {
    // It is deployment config riding a user-settings response, so a client that
    // tried to send it must be ignored rather than able to raise its own cap.
    /* Anchored on the ROUTE rather than on the bare name. The first draft
       sliced from indexOf("settings.update"), which matched the comment above
       the field in settings.get, so the slice was that comment and nothing
       else. The length guard below is what caught it. */
    const start = SERVER.indexOf("app.post('/api/trpc/settings.update'");
    const update = SERVER.slice(start, SERVER.indexOf("\napp.", start + 40));
    expect(update.length).toBeGreaterThan(100);
    expect(update).not.toMatch(/freeSubscriptionLimit/);
  });
});

describe("the client reads the server's number rather than its own", () => {
  it("keeps only a documented fallback, not a second source", () => {
    expect(SUBS).not.toMatch(/const FREE_LIMIT = 5;/);
    expect(SUBS).toMatch(/const FREE_LIMIT_FALLBACK = 5;/);
  });

  it("every derived value uses the resolved limit", () => {
    /* The meter, the percentage, the locked add button and the slots-left line
       all have to move together, or the screen contradicts itself. */
    expect(SUBS).toMatch(/const atLimit = !isPremium && total >= freeLimit;/);
    expect(SUBS).toMatch(/Math\.min\(\(total \/ freeLimit\) \* 100, 100\)/);
    expect(SUBS).toMatch(/count: freeLimit - total/);
    expect(SUBS).toMatch(/limit: freeLimit/);
  });

  it("guards a present but unusable value, not only an absent one", () => {
    /* `?? fallback` passes 0 and NaN through. A limit of 0 locks the add button
       for everybody and a NaN makes every comparison false and removes the gate
       entirely, so one direction hides the button and the other hides the
       paywall. That is the `?? 1` exchange rate lesson in a new place. */
    for (const src of [SUBS, UPGRADE]) {
      expect(src).toMatch(/Number\(settings\?\.freeSubscriptionLimit\)/);
      expect(src).toMatch(/Number\.isFinite\(serverLimit\) && serverLimit >= 1/);
    }
  });

  it("the fallback equals the server's own default", () => {
    /* A fallback that differs from the default silently changes behaviour for
       exactly the users whose settings query failed, which is the hardest group
       to observe. Read from both sides rather than restated. */
    const serverDefault = limitFor(undefined).n;
    for (const src of [SUBS, UPGRADE, CANCELLED]) {
      const m = src.match(/const FREE_LIMIT_FALLBACK = (\d+);/);
      expect(m).not.toBeNull();
      expect(Number(m[1])).toBe(serverDefault);
    }
  });

  it("the restore refusal quotes the limit the server just used", () => {
    expect(CANCELLED).toMatch(/err\?\.response\?\.data\?\.limit/);
    expect(CANCELLED).toMatch(/restoreBlockedBody", \{/);
  });
});

describe("no user-facing copy states the number", () => {
  it("every string that mentions the cap interpolates it", () => {
    /* A configurable limit with the old number written into the copy is a
       screen that contradicts its own gate. Both of these said 5, and one of
       them was written earlier the same day. */
    expect(EN.upgrade.free_subscriptions).toMatch(/\{\{count\}\}/);
    expect(DE.upgrade.free_subscriptions).toMatch(/\{\{count\}\}/);
    expect(EN.cancelled.restoreBlockedBody_other).toMatch(/\{\{count\}\}/);
    expect(DE.cancelled.restoreBlockedBody_other).toMatch(/\{\{count\}\}/);
  });

  it("no bare 5 is left in either locale's cap copy", () => {
    const keys = ["upgrade.free_subscriptions", "cancelled.restoreBlockedBody_one",
                  "cancelled.restoreBlockedBody_other", "subscriptions.limitCount"];
    const get = (o, k) => k.split(".").reduce((a, b) => a?.[b], o);
    for (const src of [EN, DE]) {
      for (const k of keys) {
        const v = get(src, k);
        expect(typeof v).toBe("string");
        expect(v).not.toMatch(/(?<![0-9])5(?![0-9])/);
      }
    }
  });

  it("the meter is localised at all, which it was not", () => {
    /* `{total} / {FREE_LIMIT} subscriptions` was a bare English JSX text node on
       the busiest screen in the app, so a German reader got "3 / 5
       subscriptions". Not a t() call, not a locale key and not a template
       literal, which is why every localisation sweep missed it. */
    expect(codeOf(SUBS)).not.toMatch(/\{FREE_LIMIT\} subscriptions/);
    expect(SUBS).toMatch(/t\("subscriptions\.limitCount"/);
    expect(EN.subscriptions.limitCount).toBeDefined();
    expect(DE.subscriptions.limitCount).toBeDefined();
    expect(DE.subscriptions.limitCount).not.toBe(EN.subscriptions.limitCount);
    expect(DE.subscriptions.limitCount).toMatch(/Abos/);
  });

  it("the plural pair differs in both languages", () => {
    expect(EN.cancelled.restoreBlockedBody_one).not.toBe(EN.cancelled.restoreBlockedBody_other);
    expect(DE.cancelled.restoreBlockedBody_one).not.toBe(DE.cancelled.restoreBlockedBody_other);
  });
});
