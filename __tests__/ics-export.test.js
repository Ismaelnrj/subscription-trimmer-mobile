/* Pins the ICS calendar export's day arithmetic.

   Behavioural, and it extracts the REAL nextDay/fmtIcsDate out of
   app/(tabs)/subscriptions.tsx rather than restating them, because the defect
   this exists for was a correct-looking helper sitting next to a wrong one:
   fmtIcsDate sliced the YYYY-MM-DD digits (offset-proof) while nextDay did
   local `new Date()` arithmetic on the same value.

   DTEND for a VALUE=DATE event is EXCLUSIVE, so DTEND == DTSTART is a
   zero-length all-day event, invalid per RFC 5545. */

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "subscriptions.tsx"), "utf8");

/* Takes the whole statement by COUNTING brackets to its terminating
   semicolon, rather than matching a pattern. This file's own subject is a
   one-liner sitting beside a multi-line arrow, and a lazy regex reads one of
   them wrong, which is the trap CLAUDE.md records four times over. */
function extract(name) {
  const marker = `const ${name} = (iso: string)`;
  const start = SRC.indexOf(marker);
  if (start === -1) throw new Error(`${name} not found in subscriptions.tsx`);
  let depth = 0;
  let i = start + marker.length;
  for (; i < SRC.length; i++) {
    const ch = SRC[i];
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === ";" && depth === 0) break;
  }
  const body = SRC.slice(start + `const ${name} = `.length, i).replace(/: string/g, "");
  return eval(`(${body})`); // eslint-disable-line no-eval
}

const fmtIcsDate = extract("fmtIcsDate");
const nextDay = extract("nextDay");

/* Every zone below observes DST, and the dates are the spring-forward day in
   each hemisphere: that is the 23 hour local day that broke the old version. */
const CASES = [
  ["Europe/Vienna", "2026-03-29"],
  ["America/New_York", "2026-03-08"],
  ["America/Los_Angeles", "2026-03-08"],
  ["Australia/Sydney", "2026-10-04"],
  ["Europe/Vienna", "2026-10-25"],
  ["America/New_York", "2026-11-01"],
  ["Pacific/Auckland", "2026-09-27"],
  ["UTC", "2026-10-16"],
  ["America/Sao_Paulo", "2026-10-16"],
];

describe("ICS export names the right two days in every timezone", () => {
  const saved = process.env.TZ;
  afterAll(() => { process.env.TZ = saved; });

  it.each(CASES)("%s, billing on %s", (tz, day) => {
    process.env.TZ = tz;
    const iso = `${day}T00:00:00.000Z`;

    const start = fmtIcsDate(iso);
    const end = nextDay(iso);

    // DTSTART is the stored day, unchanged by the reader's offset.
    expect(start).toBe(day.replace(/-/g, ""));
    // DTEND must be STRICTLY after it, or calendars drop the event.
    expect(Number(end)).toBeGreaterThan(Number(start));
    // and it must be the very next calendar day, not two days on.
    const expected = new Date(Date.UTC(
      Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) + 1
    )).toISOString().slice(0, 10).replace(/-/g, "");
    expect(end).toBe(expected);
  });

  it("does not reach for local date arithmetic", () => {
    /* `new Date(iso)` then `setDate(getDate() + 1)` is the exact call that
       failed, and it fails on one day a year, so a manual check will not find
       it coming back. */
    const src = SRC.slice(SRC.indexOf("const nextDay"), SRC.indexOf("const icsEscape"));
    expect(src).not.toMatch(/setDate\(/);
    expect(src).not.toMatch(/getDate\(\)/);
    expect(src).toMatch(/Date\.UTC/);
  });
});
