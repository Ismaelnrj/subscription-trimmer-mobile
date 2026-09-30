/* The six findings from the 2026-09-29 external code review that were verified
   against this repository before anything was changed.

   MIXED ON PURPOSE. The currency arithmetic, the date validation and the
   planned-activity selector are BEHAVIOURAL: the real functions are required
   and executed, because a money calculation or a calendar rule that can only
   be reasoned about is one this codebase has already paid for more than once.
   The rest are SOURCE-READING, because they live inside React component trees
   that cannot mount here, and each says so where it sits.

   Every assertion below was checked against the code as it stood at 9931511b
   before the fix, so the suite fails there and passes here. */

const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

/* An assertion that a string must NOT appear necessarily lives beside a comment
   explaining the string, so the comment satisfies the search and the test
   passes vacuously. This has now cost this repo six recorded failures, so the
   comments come out first and the strip is asserted to have removed something. */
const codeOf = (p) => {
  const raw = read(p);
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
  expect(stripped.length).toBeLessThan(raw.length);
  return stripped;
};

// ── F09  the alert screen mapped types the server has never sent ─────────────

describe("alert types match what the server actually sends", () => {
  const SERVER = read("backend/server.js");
  const SENT = ["renewal_alert", "trial_alert", "expensive_alert"];

  it("the server emits exactly these three types", () => {
    for (const t of SENT) expect(SERVER).toContain(`type: '${t}'`);
  });

  it("the screen maps every one of them to its own icon", () => {
    const code = codeOf("app/alerts.tsx");
    const icons = new Set();
    for (const t of SENT) {
      expect(code).toContain(`case "${t}":`);
      /* The switch falls through from the suffixed name to the bare alias, so
         the icon is on the LAST case of each group. Reading the icon that
         follows proves the type reaches a real one rather than `information`. */
      const after = code.slice(code.indexOf(`case "${t}":`));
      const m = after.match(/return "([a-z-]+)"/);
      expect(m).not.toBeNull();
      expect(m[1]).not.toBe("information");
      icons.add(m[1]);
    }
    // three distinct icons, or two types are still indistinguishable
    expect(icons.size).toBe(3);
  });

  it("the severity badge is localised rather than a bare English JSX node", () => {
    const code = codeOf("app/alerts.tsx");
    expect(code).not.toContain("severity.charAt(0).toUpperCase()");
    expect(code).toContain("alerts.severity_");
  });

  it("both locales carry the three severity labels and they differ", () => {
    const en = JSON.parse(read("locales/en.json")).alerts;
    const de = JSON.parse(read("locales/de.json")).alerts;
    for (const k of ["severity_high", "severity_medium", "severity_low"]) {
      expect(typeof en[k]).toBe("string");
      expect(typeof de[k]).toBe("string");
      expect(en[k].length).toBeGreaterThan(0);
      expect(de[k].length).toBeGreaterThan(0);
      /* Copying the English into the German file is the failure this catches,
         and it is one this repo has recorded happening. */
      expect(de[k]).not.toBe(en[k]);
    }
  });
});

// ── F07  the dashboard invented enabled preferences while they loaded ────────

describe("reminders are never scheduled from invented preferences", () => {
  it("no caller passes an empty-object fallback to the scheduler", () => {
    /* `prefs ?? {}` reads to the scheduler as push ON, renewal alerts ON and a
       three day lead, so on any cold start where the preferences query lost
       the race this re-enabled reminders somebody had explicitly turned off.
       lib/language-store.ts already carried the fix; the dashboard did not. */
    for (const f of ["app/(tabs)/index.tsx", "lib/language-store.ts"]) {
      const code = codeOf(f);
      expect(code).not.toMatch(/scheduleRenewalReminders\([^;]*\?\?\s*\{\s*\}/);
    }
  });

  it("the dashboard returns rather than scheduling when preferences are absent", () => {
    const code = codeOf("app/(tabs)/index.tsx");
    const at = code.indexOf("onSuccess");
    expect(at).toBeGreaterThan(-1);
    expect(code.slice(at, at + 200)).toContain("if (!notifPrefs) return;");
  });
});

// ── F04  paused rows generated planned activity on the phone ─────────────────

describe("paused subscriptions carry no planned activity", () => {
  it("absent reads as active, matching the server's own `is_active ?? true`", () => {
    const { hasPlannedCharges } = require("../lib/recurrence");
    expect(hasPlannedCharges({ isActive: true })).toBe(true);
    expect(hasPlannedCharges({})).toBe(true);
    expect(hasPlannedCharges({ isActive: null })).toBe(true);
    expect(hasPlannedCharges({ isActive: false })).toBe(false);
  });

  it("livePlanned drops only the paused rows", () => {
    const { livePlanned } = require("../lib/recurrence");
    const rows = [{ id: 1 }, { id: 2, isActive: false }, { id: 3, isActive: true }];
    expect(livePlanned(rows).map((r) => r.id)).toEqual([1, 3]);
  });

  it("every consumer of planned activity filters, not just the one reported", () => {
    /* The server already filters `is_active = TRUE` for the reminder cron,
       analytics.summary and alerts.list. subscriptions.list deliberately does
       NOT, because the management screen needs paused rows, so each client
       consumer has to. Before this they all read the raw list, so a paused row
       was paused on the server and live on the phone. */
    for (const f of [
      "lib/notification-scheduler.ts",
      "app/(tabs)/calendar.tsx",
      "app/(tabs)/analytics.tsx",
      "app/(tabs)/index.tsx",
    ]) {
      expect(codeOf(f)).toContain("livePlanned");
    }
    /* buildTips filters INSIDE itself rather than at its two call sites, so a
       third caller cannot forget. Its signature must stay unchanged: adding a
       parameter there is what shipped `TypeError: 50 is not a function`. */
    const insights = codeOf("app/insights.tsx");
    expect(insights).toContain("s.isActive !== false");
    expect(insights).toMatch(/export function buildTips\(\s*subs: Sub\[\],\s*fmtC:/);
  });
});

// ── F08  a billing date the calendar does not have was accepted ──────────────

describe("impossible calendar dates are refused", () => {
  it("rejects rollover dates the ISO branch used to hand straight back", () => {
    /* isNaN is not a validity check: `new Date("2026-02-31")` is a perfectly
       valid Date holding 3 March. Measured against the real helper. */
    const { normaliseDateInput } = require("../lib/utils");
    for (const bad of ["2026-02-31", "2026-04-31", "2025-02-29", "2026-02-29", "2026-06-31"]) {
      expect(normaliseDateInput(bad)).toBeNull();
    }
  });

  it("still accepts a real leap day and ordinary dates, in both input formats", () => {
    const { normaliseDateInput } = require("../lib/utils");
    expect(normaliseDateInput("2024-02-29")).toBe("2024-02-29");
    expect(normaliseDateInput("2026-01-31")).toBe("2026-01-31");
    expect(normaliseDateInput("2026-10-16")).toBe("2026-10-16");
    expect(normaliseDateInput("31/01/2026")).toBe("2026-01-31");
  });

  it("the ISO and slash branches now agree, which they did not", () => {
    /* The slash branch always compared the month back, so `29/02/2025` was
       refused while `2025-02-29` was accepted: one helper right, its
       neighbour wrong, the same shape as fmtIcsDate beside nextDay. */
    const { normaliseDateInput } = require("../lib/utils");
    expect(normaliseDateInput("29/02/2025")).toBeNull();
    expect(normaliseDateInput("2025-02-29")).toBeNull();
  });

  it("the server refuses them too, on both write routes", () => {
    const SERVER = read("backend/server.js");
    expect(SERVER).toContain("function parseCalendarDateStrict");
    const uses = SERVER.match(/parseCalendarDateStrict\(nextBillingDateInput\)/g) || [];
    expect(uses.length).toBe(2);
    /* The old guard must be gone from both, or one route still accepts them. */
    expect(SERVER).not.toMatch(/const parsed = new Date\(nextBillingDateInput\)/);
  });

  it("the server helper is timezone independent and rejects rollover", () => {
    const SERVER = read("backend/server.js");
    const i = SERVER.indexOf("function parseCalendarDateStrict");
    const body = SERVER.slice(i, SERVER.indexOf("\n}\n", i) + 3);
    // eslint-disable-next-line no-eval
    const parseCalendarDateStrict = eval(`(${body.replace(/^function /, "function ")})`);
    for (const bad of ["2026-02-31", "2025-02-29", "2026-02-31T00:00:00.000Z"]) {
      expect(parseCalendarDateStrict(bad)).toBeNull();
    }
    for (const good of ["2026-10-16", "2024-02-29", "2026-10-16T00:00:00.000Z"]) {
      expect(parseCalendarDateStrict(good)).not.toBeNull();
    }
  });
});

// ── F05  totals added raw numbers across currencies ──────────────────────────

describe("a total is summed in one named currency", () => {
  /* The brief's own fixture: with USD 1 and EUR 0.8, ten of each is 22.50 USD
     or 18 EUR. Executed against the real function, not restated. */
  const RATES = { USD: 1, EUR: 0.8, JPY: 150 };
  const MIXED = { EUR: 10, USD: 10 };

  it("matches the fixture in both directions", () => {
    const { sumMixedInBase } = require("../lib/currency-store");
    expect(sumMixedInBase(MIXED, RATES, "USD")).toBeCloseTo(22.5, 9);
    expect(sumMixedInBase(MIXED, RATES, "EUR")).toBeCloseTo(18, 9);
  });

  it("a single currency stays exact", () => {
    const { sumMixedInBase } = require("../lib/currency-store");
    expect(sumMixedInBase({ USD: 10 }, RATES, "USD")).toBe(10);
  });

  it("a legacy row with no currency reads as the base", () => {
    const { sumMixedInBase } = require("../lib/currency-store");
    expect(sumMixedInBase({ "": 10 }, RATES, "EUR")).toBe(10);
  });

  it("an unusable rate never produces NaN, Infinity or a false currency", () => {
    /* `?? 1` catches null and undefined only, so a rate of 0 divided through
       to Infinity and a NaN propagated, and both render as somebody's monthly
       cost. Anything not finite and positive leaves the part unconverted. */
    const { sumMixedInBase } = require("../lib/currency-store");
    for (const rates of [{ USD: 1, EUR: 0 }, { USD: 1, EUR: NaN }, { USD: 1 }]) {
      const got = sumMixedInBase({ EUR: 10 }, rates, "USD");
      expect(Number.isFinite(got)).toBe(true);
      expect(got).toBe(10);
    }
    expect(Number.isFinite(sumMixedInBase({ EUR: NaN, USD: 10 }, RATES, "USD"))).toBe(true);
  });

  it("an absent breakdown falls back, so an older server behaves as before", () => {
    const { sumMixedInBase } = require("../lib/currency-store");
    expect(sumMixedInBase(null, RATES, "USD", 7)).toBe(7);
    expect(sumMixedInBase({}, RATES, "USD", 7)).toBe(7);
  });

  it("only a total priced entirely in the shown currency is exact", () => {
    const { isMixedCurrency } = require("../lib/currency-store");
    expect(isMixedCurrency({ USD: 10 }, "USD")).toBe(false);
    expect(isMixedCurrency(MIXED, "USD")).toBe(true);
    expect(isMixedCurrency({ EUR: 10 }, "USD")).toBe(true);
  });

  it("the server reports the parts and introduces no exchange rate", () => {
    const SERVER = read("backend/server.js");
    expect(SERVER).toContain("monthlyByCurrency");
    expect(SERVER).toContain("categoryByCurrency");
    /* Rates belong to the client, which already fetches and validates them.
       A backend rate dependency would make every summary depend on a third
       party being reachable. */
    expect(SERVER).not.toContain("frankfurter");
    /* The existing fields must survive for builds already installed. */
    expect(SERVER).toMatch(/monthlyTotal,\s*\n\s*yearlyTotal: monthlyTotal \* 12,/);
  });

  it("the dashboard uses the corrected total everywhere, including yearly", () => {
    const code = codeOf("app/(tabs)/index.tsx");
    expect(code).toContain("mixedTotalInBase(summary?.monthlyByCurrency");
    /* The server's own yearlyTotal is the mixed monthlyTotal * 12, so reading
       it back would be wrong in the same way, twelve times over. */
    expect(code).toContain("const yearlyTotal = monthlyTotal * 12;");
    expect(code).not.toContain("summary?.yearlyTotal");
    expect(code).not.toContain("(summary?.monthlyTotal ?? 0)");
  });

  it("marks a cross-currency total as an estimate", () => {
    /* fmtC's own tilde rule compares the BASE against the display currency,
       which misses the case that matters here: a US reader with one euro row
       has base and display both USD, so an exact-looking figure is printed for
       a number that moved through an exchange rate. */
    const code = codeOf("app/(tabs)/index.tsx");
    expect(code).toContain("isMixedCurrency(summary?.monthlyByCurrency");
    expect(code).toMatch(/const fmtTotal = [\s\S]{0,200}?\?\s*`~\$\{text\}`\s*:\s*text;/);
    /* and every TOTAL must go through it, or one of them still reads exact */
    /* Anything DERIVED from the total is an estimate too, so the over-budget
       and remaining amounts go through it as well. */
    expect(code).not.toMatch(/fmtC\((viewMode|monthlyTotal|budgetGoal - monthlyTotal)/);
  });
});

// ── The empty state seeded a mixed-currency first run ────────────────────────

describe("Load examples seeds one currency, at catalogue prices", () => {
  const SEEDS = ["Netflix Standard", "Spotify Premium", "iCloud+ 200GB"];

  it("every seed resolves to a real template in the user's own currency", () => {
    const { findTemplateByExactName } = require("../lib/service-templates");
    for (const base of ["USD", "EUR"]) {
      const rows = SEEDS.map((n) => findTemplateByExactName(n, base));
      for (const t of rows) expect(t).toBeDefined();
      /* The whole point: one currency, and it is the user's. This is the
         EMPTY STATE, so for a non-USD user the old hardcoded USD rows made
         the very first screen of the app a mix of two currencies. */
      expect([...new Set(rows.map((t) => t.currency))]).toEqual([base]);
    }
  });

  it("the screen reads the catalogue rather than hardcoding prices", () => {
    const code = codeOf("app/(tabs)/subscriptions.tsx");
    expect(code).toContain("findTemplateByExactName");
    /* 15.99 tagged USD was the DACH Netflix price, not the US one, and 9.99
       for Spotify was two price rises out of date. Neither may come back. */
    expect(code).not.toMatch(/name: "Netflix", price: 15\.99/);
    expect(code).not.toMatch(/name: "Spotify", price: 9\.99/);
  });
});
