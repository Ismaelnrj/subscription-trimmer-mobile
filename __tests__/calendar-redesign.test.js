/* The Calendar tab, redone 2026-11-07 on the shared scale. Pinned so it
   cannot drift back:
   - the view switch and the selected day are ink, never white on primary
     (4.02:1 in dark mode, where the old switch and day circle were mint);
   - rows sit in one grouped card with hairline dividers, as on the dashboard;
   - the Month view leads with one open figure and lists its two facts as
     rows: two columns truncated the highest charge to "Urban Sports Cl…",
     and its German title read "November Zusammenfassung";
   - a day's list names the cycle as an adjective ("Monatlich") with the price
     on the right, like every other row, instead of "15,99 € / Monat". */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const strip = (s) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const SRC = strip(fs.readFileSync(path.join(ROOT, "app", "(tabs)", "calendar.tsx"), "utf8"));
const GRID = strip(fs.readFileSync(path.join(ROOT, "components", "MonthCalendarGrid.tsx"), "utf8"));
const loc = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, "locales", `${l}.json`), "utf8")).calendar;

describe("the Calendar screen", () => {
  it("marks the chosen view in ink, as a radio", () => {
    expect(SRC).toMatch(/segmentOn: \{ backgroundColor: c\.text \}/);
    expect(SRC).toMatch(/segmentTextOn: \{ color: c\.bg/);
    expect(SRC).toContain('accessibilityRole="radiogroup"');
    expect(SRC).not.toMatch(/segmentPillActive|color: "#FFFFFF"/);
  });

  it("groups rows in one card with hairline dividers", () => {
    expect(SRC).not.toContain("styles.subCard");
    expect((SRC.match(/i > 0 && styles\.rowDivider/g) || []).length).toBe(3);
  });

  it("leads the Month view with one figure and lists the rest as rows", () => {
    expect(SRC).toMatch(/styles\.monthSummaryTotal\}>\{fmtSum\(monthSummary\.total/);
    expect(SRC).toMatch(/monthSummaryTotal: \{ \.\.\.typeScale\.display/);
    expect(SRC).not.toContain("monthSummaryStatsRow");
    for (const l of ["en", "de"]) {
      expect(loc(l).monthSummary).toBeUndefined();
      expect(loc(l).monthTotal).toBeTruthy();
    }
  });

  it("names a day's cycle as an adjective, price on the right", () => {
    expect(SRC).toMatch(/\{cycleAdjective\(sub\.billingCycle\)\}/);
    expect(SRC).not.toMatch(/\} \/ \{cycleLabel/);
  });

  it("keeps every size on the scale", () => {
    expect(SRC).not.toMatch(/fontSize: \d+/);
  });
});

describe("the month grid", () => {
  it("selects a day in ink and rings today in ink", () => {
    expect(GRID).toMatch(/dayCircleSelected: \{ backgroundColor: c\.text \}/);
    expect(GRID).toMatch(/dayTextSelected: \{ color: c\.bg/);
    expect(GRID).toMatch(/dayCircleToday: \{ borderWidth: 1\.5, borderColor: c\.text \}/);
  });

  it("gives the month arrows a full touch target", () => {
    expect(GRID).toMatch(/navButton: \{ minWidth: 48, minHeight: 48/);
  });

  it("keeps labels at 12 or more; only the +N overflow mark is smaller", () => {
    const sizes = [...GRID.matchAll(/(\w+): \{[^}]*fontSize: (\d+)/g)].filter(([, , n]) => Number(n) < 12).map(([, name]) => name);
    expect(sizes).toEqual(["dotOverflow"]);
  });
});
