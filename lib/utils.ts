/** Accepts YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY and normalises to YYYY-MM-DD.
 *  Returns null if the string cannot be understood as a valid date.
 */
export function normaliseDateInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + "T00:00:00");
    return isNaN(d.getTime()) ? null : trimmed;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, a, b, y] = slashMatch;
    for (const [month, day] of [[b, a], [a, b]]) {
      const iso = `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      const d = new Date(iso + "T00:00:00");
      if (!isNaN(d.getTime()) && d.getMonth() + 1 === Number(month)) return iso;
    }
  }

  return null;
}

/** Keeps a money field to something that is actually an amount of money.
 *
 *  Two things go wrong without it, both silently, which is what makes them
 *  worth guarding:
 *
 *  1. A German or Austrian keyboard offers a comma as the decimal separator,
 *     and parseFloat stops dead at one. "6,99" reads back as 6, so the person
 *     sees a price they never typed and no error anywhere. The comma is
 *     normalised to a period here instead.
 *  2. Nothing stopped a third decimal. "6.944" was accepted as a price, stored
 *     at full precision in a NUMERIC column, and then displayed as 6.94
 *     everywhere, so the stored figure and the shown figure disagreed forever
 *     and every total carried the difference.
 *
 *  A single separator is always read as the decimal point, never as grouping:
 *  "6.944" is 6944 to an Austrian and 6.944 to an American, and there is no
 *  way to tell which was meant. Capping the decimals means the third digit is
 *  simply refused as it is typed, which the person sees immediately, rather
 *  than a wrong number being stored with no error either way.
 *
 *  Returns the text the field should now show, so it is safe to call on every
 *  keystroke: a lone trailing separator survives, otherwise "1." could not be
 *  typed on the way to "1.50".
 */
export function sanitiseAmountInput(raw: string): string {
  let s = raw.replace(/[^0-9.,]/g, "");
  // A fully grouped amount is the one unambiguous case: every separator but
  // the last is followed by exactly three digits, so "1.234,56" and
  // "1,234.56" are both 1234.56. The shape has to be checked rather than just
  // counting separators, or typing a stray comma after "1.23" would read the
  // decimal point as grouping and silently give 123.
  if (/^\d{1,3}(?:[.,]\d{3})+[.,]\d{0,2}$/.test(s)) {
    const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    s = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
  }
  const cleaned = s.replace(/,/g, ".");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  const whole = cleaned.slice(0, firstDot);
  const decimals = cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  return whole + "." + decimals;
}

/** Parse a YYYY-MM-DD string as a local date (avoids UTC off-by-one). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Turns what the API sends for a billing or trial date into the CALENDAR DAY
 *  the user meant, at local midnight.
 *
 *  `next_billing_date` and `trial_end_date` are TIMESTAMPTZ, and the create
 *  handler stores `new Date("2026-10-16").toISOString()`, which is midnight
 *  UTC. `new Date(...)` on that gives the instant, so its LOCAL day is the day
 *  BEFORE anywhere west of UTC. Measured: for a 16 October renewal, a phone in
 *  New York or Los Angeles read day 15 while the notification scheduler, which
 *  already sliced the string before parsing, read 16. The calendar marked a
 *  renewal a day early and the reminder arrived on the right day, in the same
 *  app, from the same row.
 *
 *  Reading the leading YYYY-MM-DD is what makes it timezone-proof: those digits
 *  are the day, and nothing about the reader's offset can change them. */
export function parseApiDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
}
