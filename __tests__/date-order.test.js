/* A German date in English order, found 2026-11-07 in the German calendar:
   the timeline read "Nov. 16" and the selected day "Montag, November 16".
   A date-fns locale changes the month NAME, never the ORDER a pattern spells
   out, so every "MMM d" printed English order in German. The dashboard had its
   own switch; the calendar and the details page did not. dayMonthPattern in
   lib/date-locale.ts is now the one place that order is decided. */
const fs = require("fs");
const path = require("path");
const { format } = require("date-fns");
const { de, enUS } = require("date-fns/locale");
const { dayMonthPattern } = require("../lib/date-locale");

const ROOT = path.join(__dirname, "..");
const nov16 = new Date(2026, 10, 16);

describe("dayMonthPattern", () => {
  it("writes German day first", () => {
    expect(format(nov16, dayMonthPattern("de"), { locale: de })).toBe("16. Nov.");
    expect(format(nov16, dayMonthPattern("de-AT", { weekday: true }), { locale: de })).toBe("Montag, 16. November");
    expect(format(nov16, dayMonthPattern("de", { long: true }), { locale: de })).toBe("16. November");
  });

  it("leaves English as it was", () => {
    expect(format(nov16, dayMonthPattern("en"), { locale: enUS })).toBe("Nov 16");
    expect(format(nov16, dayMonthPattern("en", { weekday: true }), { locale: enUS })).toBe("Monday, November 16");
    expect(format(nov16, dayMonthPattern(undefined), { locale: enUS })).toBe("Nov 16");
  });
});

describe("no screen spells a day and month in a fixed order", () => {
  it("app/ and components/ carry no literal English-order pattern", () => {
    const hits = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) {
          const src = fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
          if (/["'`](?:EEEE, )?MMMM? d["'`,]/.test(src)) hits.push(p);
        }
      }
    };
    walk("app");
    walk("components");
    expect(hits).toEqual([]);
  });
});
