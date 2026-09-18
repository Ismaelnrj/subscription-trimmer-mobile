/* The CSV export, which had two defects of opposite kinds.

   One was a wrong number that looked right: the total summed every row while
   the dashboard reads analytics.summary, whose query filters is_active = TRUE.
   Pausing a subscription left the app stating two different monthly totals for
   the same data, with nothing to explain the gap.

   The other was a crash that looked impossible: toISOString() throws a
   RangeError on an invalid date, and the call was guarded for truthiness only,
   so one malformed date anywhere in the list took the whole export down.

   The source-reading half pins the code. The behavioural half below mirrors the
   logic, because the real function needs expo-file-system and a share sheet. */

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(
  path.join(__dirname, "..", "app", "(tabs)", "subscriptions.tsx"), "utf8");
const EXPORT = SRC.slice(SRC.indexOf("const exportReport"), SRC.indexOf("const handleShare") + 1 || undefined);

describe("the export total agrees with the rest of the app", () => {
  it("sums active subscriptions only", () => {
    expect(EXPORT).toMatch(/activeSubs\s*=\s*subscriptions\.filter/);
    expect(EXPORT).toMatch(/monthlyTotal\s*=\s*activeSubs\.reduce/);
  });

  it("does not reduce over every row any more", () => {
    const code = EXPORT.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(/monthlyTotal\s*=\s*subscriptions\.reduce/.test(code)).toBe(false);
  });

  it("still exports the paused rows, and labels them", () => {
    // Excluding them from the SUM was the bug. Dropping them from the file
    // would be a different bug: a record of what you have is the point.
    expect(EXPORT).toMatch(/subscriptions\.map/);
    expect(EXPORT).toMatch(/"Status"/);
    expect(EXPORT).toMatch(/isActive === false \? "paused" : "active"/);
  });

  it("says which counts are which in the summary", () => {
    expect(EXPORT).toMatch(/# Active,/);
    expect(EXPORT).toMatch(/# Paused,/);
  });
});

describe("one bad date does not take the export down", () => {
  it("routes every date through a guard", () => {
    const code = EXPORT.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(code).toMatch(/const isoDay =/);
    // the unguarded form must be gone from the row builder
    expect(/new Date\(s\.\w+\)\.toISOString\(\)/.test(code)).toBe(false);
  });

  it("the guard behaves, mirrored", () => {
    const isoDay = (v) => {
      if (!v) return "";
      const ms = new Date(v).getTime();
      return Number.isFinite(ms) ? new Date(ms).toISOString().split("T")[0] : "";
    };
    expect(isoDay("2026-10-16")).toBe("2026-10-16");
    expect(isoDay("not-a-date")).toBe("");
    expect(isoDay(null)).toBe("");
    expect(isoDay(undefined)).toBe("");
    expect(isoDay("")).toBe("");
  });

  it("the old form really did throw, which is why the guard exists", () => {
    let threw = false;
    try { new Date("not-a-date").toISOString(); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

describe("the active-only total, mirrored", () => {
  const toMonthly = (p, c) => (c === "weekly" ? (p * 52) / 12 : c === "yearly" ? p / 12 : p);
  const total = (subs) =>
    subs.filter((s) => s.isActive !== false)
        .reduce((sum, s) => sum + toMonthly(s.price, s.billingCycle), 0);

  it("excludes a paused subscription", () => {
    const subs = [
      { price: 15.99, billingCycle: "monthly", isActive: true },
      { price: 12.99, billingCycle: "monthly", isActive: false },
    ];
    expect(total(subs)).toBeCloseTo(15.99);
  });

  it("treats a missing isActive as active, matching formatSub's `?? true`", () => {
    expect(total([{ price: 10, billingCycle: "monthly" }])).toBe(10);
  });

  it("still converts cycles", () => {
    expect(total([{ price: 120, billingCycle: "yearly", isActive: true }])).toBe(10);
  });
});
