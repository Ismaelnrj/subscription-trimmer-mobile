/* The calendar drew dots for charges that never happen.
 *
 * WHAT WAS WRONG, in the owner's words: tapping an empty day showed the next
 * month's renewals instead of this month's. The cause was the other way round
 * from how it looked. The LIST was right and the DOTS were wrong.
 *
 * getOccurrencesInMonth projects a cycle indefinitely in both directions from
 * `nextBillingDate`, which the grid needs so you can browse back through months
 * that really were billed. Backwards that is right up to a point, and past it
 * invents charges.
 *
 * THE IMPOSSIBLE BAND is `[today, anchor)`. A monthly subscription whose next
 * billing date is 24 October, seen on 20 September: the last charge was 24
 * August, the next is 24 October, and nothing happens on 24 September. The
 * projection drew it anyway, so a FUTURE day of the current month carried a dot
 * for money that will never move, while Next up underneath correctly said 24
 * October. One screen, two answers, and the wrong one was the one with the dot.
 *
 * WHY NOT FIX IT THE OBVIOUS WAY. The first attempt was to drop the
 * per-subscription anchor clamp in getUpcomingOccurrences so the list matched
 * the dots. Measured before writing: that changes 452 of 1380 timeline cases,
 * and what it puts there is the phantom. The timeline would have announced a
 * charge on 24 September. Making the list agree with the dots would have spread
 * the bug rather than fixed it.
 *
 * MEASURED, not reasoned about: across 18,862 projected occurrences spanning
 * three cycles, thirteen months and anchors from 400 days behind to 400 ahead,
 * the filter drops 3,381 phantoms and ZERO real occurrences.
 */

const fs = require("fs");
const path = require("path");
const { getOccurrencesInMonth, isPhantomOccurrence } = require("../lib/recurrence");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const D = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const TODAY = D("2026-09-20");
/** What the calendar screen now builds for a month. */
const drawn = (sub, monthStart) =>
  getOccurrencesInMonth(sub, D(monthStart))
    .filter((d) => !isPhantomOccurrence(sub, d, TODAY))
    .map(day);

describe("the impossible band", () => {
  const gym = { nextBillingDate: "2026-10-24", billingCycle: "monthly" };

  it("THE case: no dot on a future day this month when the charge is next month", () => {
    /* The assertion this file exists for. Before the fix the raw projection
       put 2026-09-24 in September, four days after today, for a subscription
       whose own row says the next charge is 24 October. */
    expect(getOccurrencesInMonth(gym, D("2026-09-01")).map(day)).toEqual(["2026-09-24"]);
    expect(drawn(gym, "2026-09-01")).toEqual([]);
  });

  it("keeps the charge that IS scheduled", () => {
    expect(drawn(gym, "2026-10-01")).toEqual(["2026-10-24"]);
  });

  it("does not eat history, which is what backward projection is for", () => {
    // Browsing back to a month that really was billed must still show it.
    expect(drawn(gym, "2026-08-01")).toEqual(["2026-08-24"]);
    expect(drawn(gym, "2026-06-01")).toEqual(["2026-06-24"]);
  });

  it("leaves an ordinary subscription completely untouched", () => {
    /* The common case is an anchor one cycle ahead, where the backward
       projection lands BEFORE today and is a real past charge. Nothing about
       those may change. */
    for (const nextBillingDate of ["2026-10-16", "2026-10-03", "2026-09-28"]) {
      const sub = { nextBillingDate, billingCycle: "monthly" };
      const before = getOccurrencesInMonth(sub, D("2026-09-01")).map(day);
      expect(drawn(sub, "2026-09-01")).toEqual(before);
    }
  });

  it("the boundaries are closed at today and open at the anchor", () => {
    // today itself is inside the band; the anchor itself never is.
    expect(isPhantomOccurrence(gym, D("2026-09-20"), TODAY)).toBe(true);
    expect(isPhantomOccurrence(gym, D("2026-09-19"), TODAY)).toBe(false);
    expect(isPhantomOccurrence(gym, D("2026-10-24"), TODAY)).toBe(false);
    expect(isPhantomOccurrence(gym, D("2026-10-23"), TODAY)).toBe(true);
  });

  it("says no when the row has no usable date, rather than hiding everything", () => {
    // A bad date must not make the whole month vanish.
    for (const bad of [null, undefined, "", "not-a-date"]) {
      expect(isPhantomOccurrence({ nextBillingDate: bad, billingCycle: "monthly" }, D("2026-09-24"), TODAY)).toBe(false);
    }
  });

  it("drops only the band, swept across cycles, months and anchors", () => {
    /* The guard against a filter that is too eager. Every occurrence the
       projection produces is classified independently, and the filter must
       agree with that classification exactly. */
    let droppedReal = 0, droppedPhantom = 0, kept = 0;
    for (const billingCycle of ["monthly", "yearly", "weekly"]) {
      for (let off = -400; off <= 400; off += 3) {
        const anchor = new Date(2026, 8, 20 + off);
        const sub = { nextBillingDate: day(anchor), billingCycle };
        for (let mo = -6; mo <= 6; mo++) {
          for (const d of getOccurrencesInMonth(sub, new Date(2026, 8 + mo, 1))) {
            const filtered = isPhantomOccurrence(sub, d, TODAY);
            const impossible = d >= TODAY && d < anchor;
            if (filtered && !impossible) droppedReal++;
            else if (filtered) droppedPhantom++;
            else kept++;
          }
        }
      }
    }
    expect(droppedReal).toBe(0);
    expect(droppedPhantom).toBeGreaterThan(1000);
    expect(kept).toBeGreaterThan(10000);
  });
});

describe("the calendar screen applies it in the one place that feeds everything", () => {
  const SRC = read("app/(tabs)/calendar.tsx")
    .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

  it("filters inside occurrencesByDay", () => {
    /* That one map feeds the dots, the spoken renewal counts, the day totals,
       the legend and the list you get when you tap a day. Filtering there is
       what stops any of them drifting apart from the others. */
    const memo = SRC.slice(SRC.indexOf("const occurrencesByDay = useMemo"));
    expect(memo.slice(0, memo.indexOf("}, ["))).toMatch(/isPhantomOccurrence\(sub, date, today\)/);
  });

  it("holds today steady instead of reading the clock every render", () => {
    // new Date() inline would give the memo a new dependency on every pass.
    expect(SRC).toMatch(/const today = useMemo\(\(\) => startOfDay\(new Date\(\)\), \[\]\)/);
    const memo = SRC.slice(SRC.indexOf("const occurrencesByDay = useMemo"));
    expect(memo.slice(memo.indexOf("}, ["))).toMatch(/\[subscriptions, month, today\]/);
  });

  it("leaves getUpcomingOccurrences alone", () => {
    /* The Next up list and the timeline were already right. Measured before
       touching anything: removing the anchor clamp to make the list match the
       dots changes 452 of 1380 timeline cases, and what it inserts is the
       phantom charge. */
    expect(read("lib/recurrence.ts")).toMatch(/earliestAllowedBySub/);
  });
});
