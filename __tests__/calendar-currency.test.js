/* The calendar added raw prices across currencies, found 2026-11-07 on the
   Month view: a 49 EUR row, five other euro rows and Adobe at 24.99 USD read
   "129,94 €", the dollars counted as euros. The grid's day amounts, the
   selected day's total and the month's "highest" charge did the same, so a
   dollar price could outrank a larger euro one. The dashboard was fixed for
   this on 2026-09-29 and Stats after it; the calendar was not swept.

   Source reading, because the screen is TypeScript inside a component tree;
   sumMixedInBase itself is pinned behaviourally in currency-convert.test.ts. */
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "calendar.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("the calendar converts each row before adding", () => {
  it("adds no raw price anywhere", () => {
    expect(SRC).not.toMatch(/sum \+ \(?sub\.price/);
    expect(SRC).not.toMatch(/sub\.price > \(max/);
  });

  it("converts one row through sumMixedInBase", () => {
    expect(SRC).toMatch(/sumMixedInBase\(\{ \[sub\.currency \|\| ""\]: price \}, rates, baseCurrencyCode, price\)/);
  });

  it("uses the converted price for every sum and for the highest charge", () => {
    expect(SRC).toMatch(/map\.set\(key, subs\.reduce\(\(sum: number, sub: any\) => sum \+ inBase\(sub\), 0\)\)/);
    expect(SRC).toMatch(/const selectedDayTotal = selectedDaySubs\.reduce\(\(sum: number, sub: any\) => sum \+ inBase\(sub\), 0\)/);
    expect(SRC).toMatch(/const total = all\.reduce\(\(sum, sub\) => sum \+ inBase\(sub\), 0\)/);
    expect(SRC).toMatch(/inBase\(sub\) > inBase\(max\)/);
  });

  it("marks a total that moved through a rate as an estimate", () => {
    expect(SRC).toMatch(/isMixedCurrency\(byCurrency, currency\.code\)/);
    expect(SRC).toMatch(/fmtSum\(selectedDayTotal, selectedDaySubs\)/);
    expect(SRC).toMatch(/fmtSum\(monthSummary\.total, monthSummary\.all\)/);
  });
});
