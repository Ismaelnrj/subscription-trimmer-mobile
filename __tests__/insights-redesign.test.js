/* The Recommendations screen, redone 2026-11-07. It carried the plainest
   template tells in the app: a coloured left border on every card, tinted
   icon boxes, a badge per card and "Tap to read more →". It also had no
   Montserrat at all (fontWeight with no family falls back to the system
   font), and took each tip's colour from a hex fixed for light mode, so a
   navy icon vanished on the dark card and coral badge text measured 4.12:1.
   Pinned so none of that comes back. */
const fs = require("fs");
const path = require("path");
const RAW = fs.readFileSync(path.join(__dirname, "..", "app", "insights.tsx"), "utf8");
const SRC = RAW.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const render = SRC.slice(SRC.indexOf("export default function InsightsScreen"));

describe("the Recommendations screen", () => {
  it("draws no coloured edge, tinted box or badge", () => {
    expect(render).not.toMatch(/borderLeftWidth|borderLeftColor/);
    expect(render).not.toMatch(/\+ "18"/);
    expect(render).not.toMatch(/styles\.badge/);
  });

  it("colours a tip from the theme by priority, never from its stored hex", () => {
    expect(render).toMatch(/const toneOf = \(tip: Tip\) =>/);
    expect(render).not.toMatch(/tip\.color|selectedTip\.color/);
  });

  it("lists the tips in one grouped card", () => {
    expect(render).toMatch(/i > 0 && styles\.rowDivider/);
  });

  it("sets every text on the shared type scale", () => {
    const styles = render.slice(render.indexOf("function makeStyles"));
    expect(styles).not.toMatch(/fontSize: \d+/);
    expect(styles).not.toMatch(/fontWeight/);
  });

  it("closes the sheet with an ink button", () => {
    expect(render).toMatch(/modalClose: \{\s*backgroundColor: c\.text/);
    expect(render).toMatch(/modalCloseText: \{ \.\.\.typeScale\.bodyStrong, color: c\.bg \}/);
  });

  it("calls the low priority by a plain phrase, not an abbreviation", () => {
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "locales", "en.json"), "utf8")).insights;
    expect(en.fyi).not.toBe("FYI");
  });
});
