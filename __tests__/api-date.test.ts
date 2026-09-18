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
