/* The Stats tab, redone 2026-11-07 on the shared scale and the dataviz
   skill's rules. What these pin, so the screen cannot drift back:
   - one figure leads, open on the page, with no gradient card in dark mode
     (the old one was off palette, #245F52 to #2F8E71);
   - the split is a thin bar with 2px gaps above rows that name every part,
     the skill's form for a split read beside its figures. The category
     colours pass the validator in declared order and FAIL it all-pairs
     (insurance and software 5.1, under the 15 floor), and sorting by amount
     makes any pair neighbours, so the gaps and the named rows are what keep
     identity from resting on colour alone;
   - the folded tail is a neutral that shows: c.border was 1.3:1 on the card
     and the old dark legend dot for it was invisible;
   - "per month" is said once in the section header. On every row it pushed
     "Mitgliedschaften" into an ellipsis;
   - the weekly chart puts the amount on each cap, highlights the week that
     costs most, and labels no empty week ("~0,00 €" said nothing). */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const strip = (s) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const RAW = fs.readFileSync(path.join(ROOT, "app", "(tabs)", "analytics.tsx"), "utf8");
const SRC = strip(RAW);
const CHART = strip(fs.readFileSync(path.join(ROOT, "components", "WeeklyBarChart.tsx"), "utf8"));
const GATE = strip(fs.readFileSync(path.join(ROOT, "components", "PremiumGate.tsx"), "utf8"));

function styleBody(src, name) {
  const at = src.indexOf(`    ${name}: {`, src.indexOf("function makeStyles"));
  if (at < 0) throw new Error(`no style ${name}`);
  let depth = 0;
  for (let j = src.indexOf("{", at); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(at, j + 1);
  }
  throw new Error(`unclosed ${name}`);
}

describe("the Stats screen", () => {
  it("strips comments before reading", () => {
    expect(SRC.length).toBeLessThan(RAW.length);
  });

  it("leads with one open figure and no gradient card", () => {
    expect(SRC).not.toContain("LinearGradient");
    expect(SRC).not.toMatch(/#245F52/i);
    expect(styleBody(SRC, "summaryValue")).toContain("typeScale.display");
  });

  it("draws the split as a thin gapped bar, not a donut", () => {
    expect(SRC).not.toContain("DonutChart");
    const bar = styleBody(SRC, "splitBar");
    expect(bar).toMatch(/height: 8\b/);
    expect(bar).toMatch(/gap: 2\b/);
    expect(bar).toContain("radius.pill");
  });

  it("names every part in a row, the folded tail included, in a colour that shows", () => {
    expect(SRC).toMatch(/\{categoryLabel\(cat\.category\)\}/);
    expect(SRC).toMatch(/t\("analytics\.otherCategories"/);
    expect(SRC).toMatch(/const restColor = c\.textMuted;/);
  });

  it("says per month once, in the header, not on every category row", () => {
    expect(SRC).toMatch(/sectionHeaderNote\}>\{t\("analytics\.perMonth"\)\}/);
    expect(SRC).not.toMatch(/fmtTotal\(cat\.amount\)\}\{t\("common\.perMonthShort"\)/);
    expect(SRC).not.toMatch(/fmtTotal\(hiddenTotal\)\}\{t\("common\.perMonthShort"\)/);
  });

  it("keeps every size on the scale, nothing under 13", () => {
    const styles = SRC.slice(SRC.indexOf("function makeStyles"));
    expect(styles).not.toMatch(/fontSize: (\d|1[012])\b/);
    expect(styles).not.toMatch(/textTransform: "uppercase"/);
  });

  it("has the new strings in both languages", () => {
    for (const lang of ["en", "de"]) {
      const a = JSON.parse(fs.readFileSync(path.join(ROOT, "locales", `${lang}.json`), "utf8")).analytics;
      expect(a.perMonth).toBeTruthy();
      expect(a.perYearMeta).toContain("{{amount}}");
      expect(a.share).toContain("{{percent}}");
      expect(a.yearlyProjection).toBeUndefined();
      expect(a.avgPerYear).toBeUndefined();
    }
  });
});

describe("the weekly chart", () => {
  it("prints the amount on the cap and none for an empty week", () => {
    expect(CHART).toMatch(/formatValue && v > 0 &&/);
  });

  it("highlights the week that costs most and keeps the rest quiet", () => {
    expect(CHART).toMatch(/top \? c\.primary : c\.textMuted/);
  });

  it("caps a column at 24px and grows it from one baseline", () => {
    expect(styleBody(CHART, "slot")).toMatch(/width: 24\b/);
    expect(CHART).toContain("baseline");
    expect(CHART).toMatch(/borderTopLeftRadius: 4, borderTopRightRadius: 4/);
  });

  it("reads each week aloud with its amount", () => {
    expect(CHART).toMatch(/accessibilityLabel=\{`\$\{labels\[i\]\}: /);
  });
});

describe("the Premium card", () => {
  it("is a quiet card with an ink button, not amber with white on primary", () => {
    expect(styleBody(GATE, "container")).toContain("c.card");
    expect(styleBody(GATE, "button")).toContain("c.text");
    expect(styleBody(GATE, "buttonText")).toContain("c.bg");
    expect(GATE).not.toMatch(/textTransform: "uppercase"/);
    expect(styleBody(GATE, "button")).toMatch(/minHeight: 48/);
  });

  it("is a button a screen reader can name", () => {
    expect(GATE).toContain('accessibilityRole="button"');
  });
});
