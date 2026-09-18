/* Server-side billing date advancement, from Codex's review of 2026-09-18.

   Two defects in one loop, both of which WROTE to the database:

   Reading alerts compared a midnight-UTC billing date against the current
   instant, so a payment due today counted as past from one minute after
   midnight. Fetching alerts rolled it into next month and persisted that, and
   the alert for the day it was warning about vanished on that very day.

   And `setMonth(getMonth() + 1)` overflows. There is no 31 February, so
   31 January plus one month is 3 March: February skipped, day of month
   permanently changed, every later advance compounding from the wrong day.

   Behavioural, not source-reading. The helpers are lifted out of server.js and
   executed, because the property worth pinning is what the dates DO. */

const fs = require("fs");
const path = require("path");

const SERVER = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");
const helpers = SERVER.slice(SERVER.indexOf("function addMonthsUTC"), SERVER.indexOf("function toMonthly"));
// eslint-disable-next-line no-eval
eval(helpers);

const day = (d) => d.toISOString().slice(0, 10);
const utc = (s) => new Date(s + "T00:00:00.000Z");

describe("a month is a calendar month, not 30-ish days", () => {
  it("clamps 31 January to the end of February", () => {
    // setMonth gave 3 March here, skipping February altogether.
    expect(day(addMonthsUTC(utc("2026-01-31"), 1, 31))).toBe("2026-02-28");
  });

  it("clamps to 29 February in a leap year", () => {
    expect(day(addMonthsUTC(utc("2028-01-31"), 1, 31))).toBe("2028-02-29");
  });

  it("returns to the 31st after clamping, rather than sticking at the 28th", () => {
    /* This is why the anchor day is carried rather than re-read. Advancing from
       the clamped value would leave a 31st subscription billing on the 28th
       forever after its first February. */
    let d = utc("2026-01-31");
    const got = [day(d)];
    for (let i = 0; i < 4; i++) { d = addMonthsUTC(d, 1, 31); got.push(day(d)); }
    expect(got).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("handles a 30 day month", () => {
    expect(day(addMonthsUTC(utc("2026-03-31"), 1, 31))).toBe("2026-04-30");
  });

  it("advances a year without losing 29 February", () => {
    expect(day(addMonthsUTC(utc("2028-02-29"), 12, 29))).toBe("2029-02-28");
  });
});

describe("reading alerts cannot move a payment due today", () => {
  const today = startOfUtcDay(new Date("2026-09-18T12:00:00.000Z"));

  it("leaves today's billing date alone", () => {
    const r = advanceBillingDate(utc("2026-09-18"), "monthly", today);
    expect(day(r.date)).toBe("2026-09-18");
    expect(r.advanced).toBe(false);
  });

  it("leaves it alone at every hour of the billing day", () => {
    for (let h = 0; h < 24; h++) {
      const t = startOfUtcDay(new Date(Date.UTC(2026, 8, 18, h)));
      expect(advanceBillingDate(utc("2026-09-18"), "monthly", t).advanced).toBe(false);
    }
  });

  it("still advances a genuinely stale date", () => {
    // The loop exists for a reason: a date months in the past should roll up.
    const r = advanceBillingDate(utc("2026-07-18"), "monthly", today);
    expect(day(r.date)).toBe("2026-09-18");
    expect(r.advanced).toBe(true);
  });

  it("advances a stale month-end date without skipping a month", () => {
    const r = advanceBillingDate(utc("2026-01-31"), "monthly", startOfUtcDay(new Date("2026-03-01T12:00:00Z")));
    expect(day(r.date)).toBe("2026-03-31");
  });

  it("advances weekly and yearly cycles too", () => {
    expect(day(advanceBillingDate(utc("2026-09-01"), "weekly", today).date)).toBe("2026-09-22");
    expect(day(advanceBillingDate(utc("2025-09-18"), "yearly", today).date)).toBe("2026-09-18");
  });

  it("terminates rather than looping forever", () => {
    // The 1000 iteration cap is the backstop against a pathological input.
    const r = advanceBillingDate(utc("1990-01-01"), "monthly", today);
    expect(r.date >= today).toBe(true);
  });
});

describe("a new subscription's first billing date is calendar safe", () => {
  it("does not overflow from a 31st", () => {
    /* nextBillingDate() had the same setMonth defect, so adding a subscription
       on 31 January with no date given produced 3 March. */
    const src = SERVER.slice(SERVER.indexOf("function nextBillingDate"), SERVER.indexOf("function toMonthly"));
    expect(src).toMatch(/addMonthsUTC/);
    expect(/setMonth\(/.test(src)).toBe(false);
  });
});
