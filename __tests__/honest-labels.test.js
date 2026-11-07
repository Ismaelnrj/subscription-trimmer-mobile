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
