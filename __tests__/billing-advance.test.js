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

describe("the billing day survives being written to the database and read back", () => {
  /* Codex's recheck of 31a93689. The clamp above is only half the fix: the
     anchor was DERIVED from the date being advanced, so it survived within one
     call and was lost the moment the clamped value was persisted. A real
     advance is one call per request with a write in between, so 31 January
     became 28 February and then 28 March, permanently. The tests above missed
     it because they either pass an explicit anchor of 31 or advance several
     months inside a single call, and neither is what production does. */

  // What alerts.list does: read the row, advance it, write the DATE back. The
  // anchor column is deliberately not rewritten.
  const request = (row, onDate) => ({
    ...row,
    next_billing_date: advanceBillingDate(
      new Date(row.next_billing_date), row.billing_cycle, startOfUtcDay(utc(onDate)), row.billing_anchor_day
    ).date,
  });

  const overMonths = (row, dates) => dates.map((d) => day((row = request(row, d)).next_billing_date));

  it("returns to the 31st in March after clamping in February", () => {
    const row = { next_billing_date: utc("2026-01-31"), billing_cycle: "monthly", billing_anchor_day: 31 };
    expect(overMonths(row, ["2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01"]))
      .toEqual(["2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("without a stored anchor it still drifts, which is what the column is for", () => {
    /* Pins the defect rather than the fix, so this test says out loud what a
       row predating the migration does. Backfilling cannot recover the 31: a
       stored 28 February cannot prove whether 28, 29, 30 or 31 was meant, and
       guessing would move a real billing date. */
    const row = { next_billing_date: utc("2026-01-31"), billing_cycle: "monthly", billing_anchor_day: null };
    expect(overMonths(row, ["2026-02-01", "2026-03-01", "2026-04-01"]))
      .toEqual(["2026-02-28", "2026-03-28", "2026-04-28"]);
  });

  it("a legacy row is no worse off than before the column existed", () => {
    // The fallback must be the day of the date itself, so nothing moves for
    // anyone on the deploy that adds this.
    const withNull = advanceBillingDate(utc("2026-01-15"), "monthly", startOfUtcDay(utc("2026-02-01")), null);
    const withUndef = advanceBillingDate(utc("2026-01-15"), "monthly", startOfUtcDay(utc("2026-02-01")), undefined);
    expect(day(withNull.date)).toBe("2026-02-15");
    expect(day(withUndef.date)).toBe("2026-02-15");
  });

  it("rejects a nonsense anchor rather than trusting it", () => {
    // 0, 99 and "banana" must all fall back, not produce a date in the wrong month.
    for (const bad of [0, -1, 99, "banana", NaN, 1.5]) {
      const r = advanceBillingDate(utc("2026-01-15"), "monthly", startOfUtcDay(utc("2026-02-01")), bad);
      expect(day(r.date)).toBe("2026-02-15");
    }
  });

  it("keeps 29 February on an annual subscription until the next leap year", () => {
    const row = { next_billing_date: utc("2028-02-29"), billing_cycle: "yearly", billing_anchor_day: 29 };
    expect(overMonths(row, ["2028-03-01", "2029-03-01", "2030-03-01", "2031-03-01", "2032-03-01"]))
      .toEqual(["2029-02-28", "2030-02-28", "2031-02-28", "2032-02-29", "2033-02-28"]);
  });

  it("weekly cycles ignore the anchor entirely", () => {
    // There is no day-of-month to preserve, and applying one would be a bug.
    const row = { next_billing_date: utc("2026-01-31"), billing_cycle: "weekly", billing_anchor_day: 31 };
    expect(overMonths(row, ["2026-02-08", "2026-02-15"])).toEqual(["2026-02-14", "2026-02-21"]);
  });
});

describe("editing a subscription does not throw the anchor away", () => {
  /* Codex's review of 81b709ba, and the one that undid the whole feature.
     The edit form seeds its date field from the stored row and posts every
     field back, so renaming Netflix resubmitted the clamped 28 February. The
     handler read a SUPPLIED date as a CHANGED date and overwrote the anchor of
     31 with 28. One rename and a month-end subscription drifted again.

     The block is lifted out of the handler and executed with the exact payload
     the form sends, because the defect is entirely in what that payload means
     and a test built from an idealised one would never see it. */
  const BLOCK = SERVER.slice(
    SERVER.indexOf("let newBillingDate = billingCycle !== existing.billing_cycle"),
    SERVER.indexOf("const result = await pool.query(", SERVER.indexOf("subscriptions.update"))
  );
  const decide = (existing, body) =>
    new Function("existing", "billingCycle", "nextBillingDateInput", "nextBillingDate", "res",
      BLOCK + "\nreturn { newBillingDate, newAnchorDay };"
    )(existing, body.billingCycle, body.nextBillingDate, nextBillingDate, { status: () => ({ json: () => {} }) });

  // Really billed on the 31st, currently sitting at a clamped 28 February.
  const clamped = { next_billing_date: utc("2027-02-28"), billing_cycle: "monthly", billing_anchor_day: 31 };

  it("keeps the anchor through a name-only edit", () => {
    const r = decide(clamped, { billingCycle: "monthly", nextBillingDate: "2027-02-28" });
    expect(r.newAnchorDay).toBe(31);
    // What it costs if this regresses: the next renewal moves to the 28th.
    expect(day(advanceBillingDate(new Date(r.newBillingDate), "monthly", utc("2027-03-01"), r.newAnchorDay).date))
      .toBe("2027-03-31");
  });

  it("keeps it when no date is sent at all", () => {
    const r = decide(clamped, { billingCycle: "monthly", nextBillingDate: undefined });
    expect(r.newAnchorDay).toBe(31);
    expect(day(new Date(r.newBillingDate))).toBe("2027-02-28");
  });

  it("moves it when the user really picks a different day", () => {
    const r = decide(clamped, { billingCycle: "monthly", nextBillingDate: "2027-03-15" });
    expect(r.newAnchorDay).toBe(15);
    /* new Date() because the handler's newBillingDate is a Date when it comes
       off the existing row and an ISO string when it comes from the request.
       Postgres takes either, so it is not a bug, but a test that assumed one
       shape passed on the paths that happened to match and threw on this one. */
    expect(day(new Date(r.newBillingDate))).toBe("2027-03-15");
  });

  it("moves it when the user picks a month end", () => {
    const r = decide(clamped, { billingCycle: "monthly", nextBillingDate: "2027-03-31" });
    expect(r.newAnchorDay).toBe(31);
  });

  it("regenerates it when the billing cycle changes", () => {
    const r = decide(clamped, { billingCycle: "yearly", nextBillingDate: undefined });
    expect(r.newAnchorDay).toBe(new Date(r.newBillingDate).getUTCDate());
  });

  it("seeds a legacy row from its date rather than leaving it null", () => {
    // No anchor stored, so the date is the only evidence there is. Says what
    // the date already says, so nothing moves.
    const legacy = { ...clamped, billing_anchor_day: null };
    expect(decide(legacy, { billingCycle: "monthly", nextBillingDate: "2027-02-28" }).newAnchorDay).toBe(28);
  });

  it("compares the day, not the presence of the key", () => {
    /* The distinction the fix turns on, and the reason it is done server side:
       clients already installed cannot be changed and will go on resubmitting
       unchanged dates for as long as somebody skips an update. */
    const code = BLOCK.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(code).toMatch(/submittedDay !== storedDay/);
  });
});

describe("the anchor is stored where it can still be trusted", () => {
  it("has a column and a backfill that touches no billing date", () => {
    expect(SERVER).toMatch(/ADD COLUMN IF NOT EXISTS billing_anchor_day SMALLINT/);
    /* Matched, not sliced from a literal containing a newline. That anchor was
       written on a machine with LF endings and the repo is also worked in from
       Windows, where the file has CRLF, so `\n` never matched, indexOf returned
       -1 and the slice collapsed to "". An empty string then fails every
       assertion for a reason that has nothing to do with the code under test,
       and the inverse is worse: an empty slice can just as easily satisfy a
       negative assertion and pass while checking nothing. Never anchor a slice
       on whitespace that a line ending can change. */
    /* Found by the statement it IS, not by the value it happens to assign. An
       earlier version keyed on `EXTRACT`, so a migration that wrote a literal
       day and moved next_billing_date failed as "no match" rather than as
       "touches a billing date", which points the next reader at the test
       instead of at the defect. */
    const m = /`([^`]*UPDATE\s+subscriptions[^`]*billing_anchor_day[^`]*)`/.exec(SERVER);
    expect(m).not.toBe(null);
    const stmt = m[1];
    // The migration must write the new column and nothing else.
    expect(stmt).toMatch(/WHERE billing_anchor_day IS NULL/);
    expect(/SET[\s\S]*next_billing_date\s*=/.test(stmt)).toBe(false);
  });

  it("is recorded when a subscription is created", () => {
    const create = SERVER.slice(SERVER.indexOf("subscriptions.create"), SERVER.indexOf("subscriptions.update"));
    expect(create).toMatch(/billing_anchor_day/);
  });

  it("only moves when the date is deliberately set", () => {
    /* Editing a name or a price must not touch it, and it must never be
       re-derived from the stored date, which may already be a clamped 28th. */
    const update = SERVER.slice(SERVER.indexOf("subscriptions.update"), SERVER.indexOf("subscriptions.delete"));
    const code = update.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(code).toMatch(/newAnchorDay = existing\.billing_anchor_day/);
    expect(code).toMatch(/newAnchorDay = parsed\.getUTCDate\(\)/);
  });

  it("reaches the client, so the calendar draws the day the server bills", () => {
    expect(SERVER).toMatch(/billingAnchorDay:/);
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

describe("one renewal sends one reminder email", () => {
  /* There was no send record at all. Running daily, a renewal three days out
     emailed on day 3, day 2 AND day 1: three messages for one renewal, from a
     screen that previews exactly one date per subscription. */
  const CRON = SERVER.slice(SERVER.indexOf("const in3Days"), SERVER.indexOf("emailsSent: sent"));

  it("records which billing date a reminder was sent for", () => {
    expect(SERVER).toMatch(/ADD COLUMN IF NOT EXISTS reminder_sent_for TIMESTAMPTZ/);
  });

  it("skips a subscription already reminded for that exact date", () => {
    expect(CRON).toMatch(/reminder_sent_for IS NULL OR reminder_sent_for <> next_billing_date/);
  });

  it("marks only after the send succeeded", () => {
    // A Brevo outage must mean a retry next run, not a renewal that silently
    // never gets its reminder.
    expect(CRON).toMatch(/if \(delivered\)/);
    expect(CRON).toMatch(/SET reminder_sent_for = next_billing_date/);
  });

  it("counts deliveries rather than attempts", () => {
    /* `sent++` used to run after a catch-and-continue, so the number the
       endpoint reported included emails that had failed. */
    const code = CRON.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(/\)\.catch\(e => console\.error\(`Email failed[^\n]*\n\s*sent\+\+/.test(code)).toBe(false);
  });

  it("resets itself when the cycle advances, mirrored", () => {
    // reminder_sent_for is keyed to the DATE, so the next cycle differs and
    // sends normally with nothing to clean up.
    const shouldSend = (sentFor, nextBilling) => sentFor == null || sentFor !== nextBilling;
    expect(shouldSend(null, "2026-10-16")).toBe(true);
    expect(shouldSend("2026-10-16", "2026-10-16")).toBe(false);  // same cycle, already sent
    expect(shouldSend("2026-10-16", "2026-11-16")).toBe(true);   // advanced, send again
  });
});
