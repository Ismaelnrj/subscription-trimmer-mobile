/* Four defects on the subscriptions screen, found 2026-11-07 while planning
   its redesign, and fixed on their own so they are not held behind a taste
   call. Each one is about what a reader is told, two of them about money. */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const SUBS = read("app/(tabs)/subscriptions.tsx").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const en = JSON.parse(read("locales/en.json"));
const de = JSON.parse(read("locales/de.json"));

describe("the subscriptions screen says what it means", () => {
  it("the German title is my subscriptions, not my expenses", () => {
    expect(de.tabs.headerSubscriptions).toBe("Meine Abos");
  });

  it("the German cancel guide button does not read as a command to cancel", () => {
    // "Kündigen" says Cancel: somebody could fear the tap cancels the subscription.
    expect(de.subscriptions.howToCancel).not.toBe("Kündigen");
    expect(de.subscriptions.howToCancel).toBe("So kündigst du");
  });

  it("no monthly equivalent is printed in English or out of the row's own currency", () => {
    expect(SUBS).not.toMatch(/\/mo`/);
    expect(SUBS).not.toMatch(/fmtC\(price \/ 12\)/);
    expect(SUBS).not.toMatch(/fmtC\(\(price \* 52\) \/ 12\)/);
    for (const l of [en, de]) {
      if (l.subscriptions.perMonthEquiv) expect(l.subscriptions.perMonthEquiv).toContain("{{amount}}");
    }
  });

  it("the paste preview names the cycle in words, never the raw API value", () => {
    expect(SUBS).not.toMatch(/\$\{formData\.billingCycle\}/);
    expect(SUBS).not.toMatch(/` · \$\{/);
  });
});
