/* Bare English words glued to a JSX expression, found 2026-11-07 on the
   German Stats screen: every category amount read "~49,00 €/mo" and the
   averages "€/yr", and Insights opened with "7 subscriptions" and
   "3 recommendations" pluralised by hand with `"s"`. Not t() calls, not
   locale keys and not standalone JSX text, so the locale checks and the text
   node sweeps all missed them: the same class this repo has recorded on the
   meter and the paywall table, in a shape those scans could not see.

   Two shapes are scanned, so a new one fails here before a German reader
   meets it: a unit suffix written straight after an expression ("}/mo"), and
   an English word pluralised by hand beside a count ("} word{n !== 1 ? "s""). */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const code = (s) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");

function sources() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx$/.test(e.name)) out.push(p);
    }
  };
  walk("app");
  walk("components");
  return out;
}

describe("no English unit or plural is written beside a number by hand", () => {
  const files = sources();

  it("scans the screens", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("no unit suffix follows an expression in JSX", () => {
    const hits = files.filter((f) => /\}\/(mo|yr|wk|month|year)\b/.test(code(fs.readFileSync(path.join(ROOT, f), "utf8"))));
    expect(hits).toEqual([]);
  });

  it("no word is pluralised with a bare \"s\"", () => {
    const hits = files.filter((f) => /\}\s*[a-z]+\{[^}]*!== 1 \? "s"/.test(code(fs.readFileSync(path.join(ROOT, f), "utf8"))));
    expect(hits).toEqual([]);
  });

  it("the short units and the counts exist in both languages", () => {
    for (const lang of ["en", "de"]) {
      const l = JSON.parse(fs.readFileSync(path.join(ROOT, "locales", `${lang}.json`), "utf8"));
      expect(l.common.perMonthShort).toMatch(/^\//);
      expect(l.common.perYearShort).toMatch(/^\//);
      for (const k of ["snapshot", "recommendationCount", "needAttention"]) {
        expect(l.insights[`${k}_one`]).toContain("{{count}}");
        expect(l.insights[`${k}_other`]).toContain("{{count}}");
      }
    }
    const de = JSON.parse(fs.readFileSync(path.join(ROOT, "locales", "de.json"), "utf8"));
    expect(de.common.perMonthShort).toBe("/Monat");
  });
});
