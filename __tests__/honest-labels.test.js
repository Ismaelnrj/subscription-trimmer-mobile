/* Two ways a screen can mislead without anything breaking, both found on
   2026-11-07 by rendering the real app in a browser and reading it.

   1. THE PURCHASE SCREEN SOLD "AI Recommendations" ("KI-Empfehlungen"). The
      recommendations are rules in app/insights.tsx (buildTips): duplicates,
      expensive rows, price rises. No model is called anywhere, so the label
      described a feature the product does not have, on the one screen where
      somebody decides to pay, in an app whose promise is that it does not send
      your data anywhere. A claim about what a paid feature is must be true.

   2. ENGLISH DATES WERE NUMERIC US DATES. date-fns "P" with enUS renders
      3 February 2027 as "02/03/2027", which a European reading the English app
      takes for 2 March: a billing date read a month late, in an app about
      knowing before you pay. "PP" names the month in both languages ("Feb 3,
      2027", "3. Feb. 2027"), so it cannot be misread. */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(e.name) ? [rel] : [];
  });
}
function strings(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [[prefix + k, v]] : v && typeof v === "object" ? strings(v, prefix + k + ".") : [],
  );
}

describe("no claim of AI the app does not have", () => {
  const claims = /\bAI\b|\bKI\b|KI-|artificial intelligence|künstliche intelligenz|machine learning|maschinelles lernen/i;
  for (const lang of ["en", "de"]) {
    it(`no ${lang} string says AI`, () => {
      const hits = strings(JSON.parse(read(`locales/${lang}.json`))).filter(([, v]) => claims.test(v));
      expect(hits).toEqual([]);
    });
  }

  it("the recommendations row on the purchase screen names what they are", () => {
    expect(JSON.parse(read("locales/en.json")).upgrade.feat_ai).toBe("Savings recommendations");
    expect(JSON.parse(read("locales/de.json")).upgrade.feat_ai).toBe("Sparempfehlungen");
  });
});

describe("the yearly saving is worked out from Play's prices, never written in", () => {
  /* "Save 44%" was a string. True of 2.99 and 19.99, false the day the Play
     price changed (3.99 and 24.99 save 47%), and Play rounds each country's
     price on its own, so no fixed figure is right everywhere. */
  const src = read("app/upgrade.tsx");
  const head = "const yearlySaving = (): number | null => {";
  const start = src.indexOf(head);
  const body = src.slice(start + head.length, src.indexOf("\n  };", start));
  // Missing function: every assertion below fails by name rather than the suite failing to load.
  const yearlySaving = start > 0 ? new Function("packages", "PRODUCT_IDS", body) : () => undefined;
  const IDS = { monthly: "m", yearly: "y" };
  const pkgs = (m, y) => [
    ...(m == null ? [] : [{ product: { identifier: "m", price: m } }]),
    ...(y == null ? [] : [{ product: { identifier: "y", price: y } }]),
  ];

  it("the function exists and is what the yearly badge reads", () => {
    expect(start).toBeGreaterThan(0);
    expect(src).toMatch(/badge: saving !== null \? t\("upgrade\.savePercent", \{ percent: saving \}\) : undefined/);
  });

  it("gives the real saving, rounded down", () => {
    expect(yearlySaving(pkgs(2.99, 19.99), IDS)).toBe(44);
    expect(yearlySaving(pkgs(3.99, 24.99), IDS)).toBe(47);
  });

  it("claims nothing without both real prices, or without a saving", () => {
    expect(yearlySaving(pkgs(3.99, null), IDS)).toBeNull();
    expect(yearlySaving(pkgs(null, 24.99), IDS)).toBeNull();
    expect(yearlySaving([], IDS)).toBeNull();
    expect(yearlySaving(pkgs(3.99, 47.88), IDS)).toBeNull();
    expect(yearlySaving(pkgs(0, 24.99), IDS)).toBeNull();
  });

  it("no purchase screen string carries a fixed percentage", () => {
    for (const lang of ["en", "de"]) {
      const hits = strings(JSON.parse(read(`locales/${lang}.json`)).upgrade).filter(([, v]) => /\d\s?%/.test(v));
      expect([lang, hits]).toEqual([lang, []]);
    }
  });
});

describe("no date a reader can take for another day", () => {
  it("no screen formats a date with the numeric short pattern", () => {
    const offenders = ["app", "components"]
      .flatMap(walk)
      .filter((f) => /fmtD\([^;]*?,\s*"P"\s*\)/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("the three that used it name the month now", () => {
    expect(read("app/(tabs)/subscriptions.tsx")).toMatch(/fmtD\(nextDate, "PP"\)/);
    expect(read("app/refer-a-friend.tsx")).toMatch(/fmtD\(new Date\(bonusPremiumUntil!\), "PP"\)/);
    expect(read("app/notifications.tsx")).toMatch(/fmtD\(new Date\(n\.createdAt\), "PP"\)/);
  });
});
