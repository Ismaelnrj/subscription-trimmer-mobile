import { getOccurrencesInMonth } from "../lib/recurrence";

function iso(y: number, m: number, d: number) {
  // m is 1-indexed for readability in tests. Returns a plain local Date
  // (not a UTC ISO string) so these tests don't depend on the runner's timezone.
  return new Date(y, m - 1, d);
}
function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

describe("getOccurrencesInMonth - monthly", () => {
  it("projects the same day-of-month forward and backward from the anchor", () => {
    const sub = { nextBillingDate: iso(2026, 5, 15), billingCycle: "monthly" };
    expect(getOccurrencesInMonth(sub, new Date(2026, 4, 1)).map(ymd)).toEqual(["2026-05-15"]);
    expect(getOccurrencesInMonth(sub, new Date(2026, 5, 1)).map(ymd)).toEqual(["2026-06-15"]);
    expect(getOccurrencesInMonth(sub, new Date(2026, 0, 1)).map(ymd)).toEqual(["2026-01-15"]);
  });

  it("clamps a month-end anchor into shorter months", () => {
    const sub = { nextBillingDate: iso(2026, 1, 31), billingCycle: "monthly" };
    expect(getOccurrencesInMonth(sub, new Date(2026, 1, 1)).map(ymd)).toEqual(["2026-02-28"]); // Feb 2026 (non-leap)
    expect(getOccurrencesInMonth(sub, new Date(2026, 3, 1)).map(ymd)).toEqual(["2026-04-30"]);
    expect(getOccurrencesInMonth(sub, new Date(2026, 2, 1)).map(ymd)).toEqual(["2026-03-31"]);
  });

  it("clamps into February 29th on a leap year", () => {
    const sub = { nextBillingDate: iso(2026, 1, 31), billingCycle: "monthly" };
    expect(getOccurrencesInMonth(sub, new Date(2024, 1, 1)).map(ymd)).toEqual(["2024-02-29"]);
  });
});

describe("getOccurrencesInMonth - yearly", () => {
  it("only occurs in the anchor's month, once a year", () => {
    const sub = { nextBillingDate: iso(2020, 5, 10), billingCycle: "yearly" };
    expect(getOccurrencesInMonth(sub, new Date(2027, 4, 1)).map(ymd)).toEqual(["2027-05-10"]);
    expect(getOccurrencesInMonth(sub, new Date(2027, 3, 1))).toEqual([]);
    expect(getOccurrencesInMonth(sub, new Date(2027, 5, 1))).toEqual([]);
  });

  it("clamps a Feb 29 anchor to Feb 28 in non-leap years", () => {
    const sub = { nextBillingDate: iso(2024, 2, 29), billingCycle: "yearly" };
    expect(getOccurrencesInMonth(sub, new Date(2025, 1, 1)).map(ymd)).toEqual(["2025-02-28"]);
    expect(getOccurrencesInMonth(sub, new Date(2028, 1, 1)).map(ymd)).toEqual(["2028-02-29"]); // next leap year
  });
});

describe("getOccurrencesInMonth - weekly", () => {
  it("projects every 7-day occurrence within the visible month", () => {
    const sub = { nextBillingDate: iso(2026, 7, 1), billingCycle: "weekly" }; // a Wednesday
    const results = getOccurrencesInMonth(sub, new Date(2026, 6, 1)).map(ymd);
    expect(results).toEqual([
      "2026-07-01",
      "2026-07-08",
      "2026-07-15",
      "2026-07-22",
      "2026-07-29",
    ]);
  });

  it("does not include occurrences that fall just outside the month boundary", () => {
    const sub = { nextBillingDate: iso(2026, 7, 29), billingCycle: "weekly" };
    const augResults = getOccurrencesInMonth(sub, new Date(2026, 7, 1)).map(ymd);
    expect(augResults).not.toContain("2026-07-29");
    expect(augResults[0]).toBe("2026-08-05");
  });

  it("projects correctly across a DST transition boundary", () => {
    // US spring-forward: Sunday March 8, 2026. Calendar-day arithmetic should
    // be unaffected since it doesn't depend on elapsed real time.
    const sub = { nextBillingDate: iso(2026, 3, 1), billingCycle: "weekly" };
    const results = getOccurrencesInMonth(sub, new Date(2026, 2, 1)).map(ymd);
    expect(results).toContain("2026-03-08");
    expect(results).toContain("2026-03-15");
  });
});

describe("getOccurrencesInMonth - invalid input", () => {
  it("returns an empty array for an unparsable date", () => {
    const sub = { nextBillingDate: "not-a-date", billingCycle: "monthly" };
    expect(getOccurrencesInMonth(sub, new Date(2026, 6, 1))).toEqual([]);
  });
});
