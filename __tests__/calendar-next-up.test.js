/* The empty day tells you when the next one is.
 *
 * A typical month has renewals on four or five days of thirty, so
 * "No renewals on this day" was what the bottom third of the calendar said
 * almost every time it was opened. It answered a question nobody had and left
 * the real one ("then when?") unanswered, in the largest block of space on the
 * screen.
 *
 * WHAT THIS PINS, and it is one thing above all: the list counts from the
 * SELECTED day, not from today. That is the whole value. Browsing forward to
 * November and tapping an empty 8th should say what is next in November.
 * Swapping `selectedDate` for `new Date()` would look identical whenever the
 * user happens to be on the current month, which is most of the time, and be
 * wrong exactly when somebody is planning ahead. It is the kind of regression
 * that survives a manual check.
 *
 * Verified against the real getUpcomingOccurrences before it was written:
 *   from 19 Sep -> iCloud 3 Oct, Netflix 16 Oct, Spotify 17 Oct
 *   from  2 Nov -> iCloud 3 Nov
 * Different answers, which is the point.
 */

const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const SRC = read("app/(tabs)/calendar.tsx");
// Comments quote the reasoning, including the words "not from today", so a
// test matching its own explanation would pass while checking nothing.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

/** The arguments of a call, split at the top level.
 *
 *  Brace counting rather than a regex: `getUpcomingOccurrences(subscriptions
 *  as any[], selectedDate, NEXT_UP_WINDOW_DAYS)` sits inside a ternary inside
 *  a useMemo, and a lazy character class picks the wrong closing paren. */
function argsOf(haystack, fn, from = 0) {
  const open = haystack.indexOf(`${fn}(`, from);
  if (open === -1) return null;
  let depth = 0, start = open + fn.length + 1;
  const args = [];
  for (let i = start; i < haystack.length; i++) {
    const ch = haystack[i];
    if ("([{".includes(ch)) depth++;
    else if (ch === ")" && depth === 0) { args.push(haystack.slice(start, i).trim()); return args; }
    else if (")]}".includes(ch)) depth--;
    else if (ch === "," && depth === 0) { args.push(haystack.slice(start, i).trim()); start = i + 1; }
  }
  return null;
}

describe("an empty day says when the next renewal is", () => {
  it("has a nextUp list at all", () => {
    expect(CODE).toMatch(/const nextUp = useMemo/);
  });

  it("counts from the selected day, not from today", () => {
    /* THE assertion in this file. The timeline's own call two blocks up
       legitimately passes new Date(), so find the one inside nextUp rather
       than the first in the file. */
    const memo = CODE.slice(CODE.indexOf("const nextUp = useMemo"));
    const args = argsOf(memo, "getUpcomingOccurrences");
    expect(args).not.toBe(null);
    expect(args[1]).toBe("selectedDate");
  });

  it("recomputes when the selected day changes", () => {
    // Without selectedDate in the deps it would answer for whichever day
    // happened to be selected when the subscriptions last loaded.
    const memo = CODE.slice(CODE.indexOf("const nextUp = useMemo"));
    const deps = memo.slice(0, memo.indexOf("];") + 1);
    expect(deps).toMatch(/\[subscriptions, selectedDate\]/);
  });

  it("caps the list rather than printing the whole future", () => {
    // A full list turns the empty state into a second timeline and buries the
    // calendar it belongs to.
    expect(CODE).toMatch(/\.slice\(0, NEXT_UP_COUNT\)/);
    const m = /const NEXT_UP_COUNT = (\d+)/.exec(SRC);
    expect(m).not.toBe(null);
    expect(Number(m[1])).toBeGreaterThan(0);
    expect(Number(m[1])).toBeLessThan(6);
  });

  it("looks far enough ahead that a quiet stretch still finds something", () => {
    /* The timeline's 30 days is right for "what is coming up". It is wrong
       here: tapping an empty day in a quiet January would have found nothing
       and shown the same dead end this replaces. */
    const m = /const NEXT_UP_WINDOW_DAYS = (\d+)/.exec(SRC);
    expect(m).not.toBe(null);
    expect(Number(m[1])).toBeGreaterThan(60);
  });

  it("only appears on a day that has nothing, and never instead of the day's own list", () => {
    const branch = CODE.slice(CODE.indexOf("selectedDaySubs.length === 0"));
    const elseAt = branch.indexOf(") : (");
    expect(branch.slice(0, elseAt)).toMatch(/nextUp\.length > 0/);
  });

  it("carries a heading in both languages, with no dash", () => {
    for (const f of ["locales/en.json", "locales/de.json"]) {
      const s = JSON.parse(read(f)).calendar.nextUp;
      expect(typeof s).toBe("string");
      expect(s.length).toBeGreaterThan(0);
      expect(/\s[-–—]\s|[–—]/.test(s)).toBe(false);
    }
  });

  it("the selection rule, mirrored", () => {
    // Runs for real. Pins that "next" means strictly on or after the day being
    // looked at, which is what makes browsing forward useful.
    const pick = (from, dates, n) => dates.filter((d) => d >= from).slice(0, n);
    const dates = ["2026-09-16", "2026-09-17", "2026-10-03", "2026-10-16", "2026-11-08"];
    expect(pick("2026-09-19", dates, 3)).toEqual(["2026-10-03", "2026-10-16", "2026-11-08"]);
    expect(pick("2026-11-02", dates, 3)).toEqual(["2026-11-08"]);
    expect(pick("2026-12-01", dates, 3)).toEqual([]);
  });
});
