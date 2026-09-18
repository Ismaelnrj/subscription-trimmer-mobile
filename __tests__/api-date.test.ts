/* The calendar and the reminder disagreed about which day a renewal fell on,
   for anyone west of UTC.

   next_billing_date and trial_end_date are TIMESTAMPTZ, and the create handler
   stores new Date("2026-10-16").toISOString(), which is midnight UTC. So the
   API sends an INSTANT, and new Date() on it lands on the previous LOCAL day
   anywhere with a negative offset.

   lib/notification-scheduler.ts already sliced the string before parsing, so
   reminders were right. lib/recurrence.ts did not, so the calendar grid, the
   timeline and the analytics month all marked the renewal a day early.
   Measured before the fix: a 16 October renewal read day 15 in New York and
   Los Angeles, and day 16 in Vienna, Tokyo and Auckland.

   These assertions do not need to change the timezone, which is the whole
   point: parseApiDate reads the YYYY-MM-DD digits, and no reader's offset can
   change what those digits say. */

function parseApiDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
}

const parts = (d: Date | null) =>
  d ? [d.getFullYear(), d.getMonth() + 1, d.getDate()] : null;

describe("an API timestamp resolves to the day the user meant", () => {
  it("reads the calendar day out of a UTC-midnight instant", () => {
    expect(parts(parseApiDate("2026-10-16T00:00:00.000Z"))).toEqual([2026, 10, 16]);
  });

  it("gives the same day whatever the offset in the string", () => {
    /* The digits are the day. Whether the tail says Z, +02:00 or -08:00 cannot
       move it, which is exactly the property new Date() lacks. */
    for (const tail of ["T00:00:00.000Z", "T00:00:00+02:00", "T00:00:00-08:00", "T23:59:59Z", ""]) {
      expect(parts(parseApiDate("2026-10-16" + tail))).toEqual([2026, 10, 16]);
    }
  });

  it("returns local midnight, so date arithmetic starts from the day", () => {
    const d = parseApiDate("2026-10-16T00:00:00.000Z")!;
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });

  it("agrees with what the notification scheduler already computed", () => {
    // The scheduler slices then calls parseLocalDate. Reminders were never
    // wrong; the calendar was. These must now land on the same day.
    const stored = "2026-10-16T00:00:00.000Z";
    const [y, m, d] = stored.slice(0, 10).split("-").map(Number);
    expect(parts(parseApiDate(stored))).toEqual(parts(new Date(y, m - 1, d)));
  });

  it("handles month and year boundaries, where an off-by-one is worst", () => {
    expect(parts(parseApiDate("2027-01-01T00:00:00.000Z"))).toEqual([2027, 1, 1]);
    expect(parts(parseApiDate("2026-03-01T00:00:00.000Z"))).toEqual([2026, 3, 1]);
    expect(parts(parseApiDate("2028-02-29T00:00:00.000Z"))).toEqual([2028, 2, 29]);
  });

  it("returns null rather than an invalid Date", () => {
    for (const bad of [null, undefined, "", "not-a-date"]) {
      expect(parseApiDate(bad as any)).toBe(null);
    }
  });

  it("passes a real Date through untouched", () => {
    const d = new Date(2026, 9, 16);
    expect(parseApiDate(d)).toBe(d);
  });

  it("rejects an invalid Date object", () => {
    expect(parseApiDate(new Date("nope"))).toBe(null);
  });
});

/* "In 3 days" means the charge lands three calendar days from today. The app
   never knows or shows a time of day, so counting 24 hour blocks answers a
   question nobody asked, and the answer moved with the clock.

   Measured against a 16 October charge, asked on 14 October: the old
   Math.ceil((target - now) / 86400000) said 3 at 01:00 in Vienna and 1 at
   20:00 in New York. Both should be 2, at every hour, everywhere. */
function daysUntil(value: string | Date | null | undefined, from: Date = new Date()): number | null {
  const target = parseApiDate(value);
  if (!target) return null;
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const b = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

describe("days until a charge counts calendar days", () => {
  const CHARGE = "2026-10-16T00:00:00.000Z";

  it("gives the same answer at every hour of the day", () => {
    const answers = new Set<number | null>();
    for (let h = 0; h < 24; h++) answers.add(daysUntil(CHARGE, new Date(2026, 9, 14, h)));
    expect([...answers]).toEqual([2]);
  });

  it("is 0 today, 1 tomorrow, -1 yesterday", () => {
    expect(daysUntil("2026-10-14T00:00:00.000Z", new Date(2026, 9, 14, 23, 59))).toBe(0);
    expect(daysUntil("2026-10-15T00:00:00.000Z", new Date(2026, 9, 14, 0, 1))).toBe(1);
    expect(daysUntil("2026-10-13T00:00:00.000Z", new Date(2026, 9, 14, 12))).toBe(-1);
  });

  it("survives a DST transition, which is why it rounds", () => {
    // One of the days in the span is 23 or 25 hours long, so flooring a raw
    // division would drop or add a day across the changeover weekend.
    expect(daysUntil("2026-10-26T00:00:00.000Z", new Date(2026, 9, 24, 12))).toBe(2);
    expect(daysUntil("2026-11-02T00:00:00.000Z", new Date(2026, 10, 1, 12))).toBe(1);
  });

  it("returns null for an unreadable date, which callers MUST check", () => {
    /* `null >= 0` is TRUE in JavaScript, so `days >= 0 && days <= 7` passes
       for null and a broken row would show up as due today. Every call site
       tests `days != null` first. */
    expect(daysUntil("nope")).toBe(null);
    expect(daysUntil(null)).toBe(null);
    expect((null as any) >= 0).toBe(true);   // the trap, pinned so it stays visible
  });
});
