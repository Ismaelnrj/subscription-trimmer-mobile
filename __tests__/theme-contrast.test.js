/* Every theme token that carries text must clear its WCAG floor, in BOTH
 * themes, against the ground it actually renders on.
 *
 * This exists because the quiet grey failed everywhere for months and nobody
 * saw it. `textMuted`, `placeholder` and `tabBarInactive` shared one hex per
 * theme, and all six pairings were under 4.5:1: the light one, #8B949C, was
 * under even the 3:1 large-text floor at 2.85:1 on the ground. It was used in
 * 27 text styles and 12 icons across 19 files. Contrast is not intuitable, so
 * looking at the app could never have found it and looking at the app is all
 * that was ever done.
 *
 * The light `danger` was worse in kind: 3.93:1 on `dangerLight`, which is
 * exactly where an error message sits, and 4.45:1 under white at the 11 call
 * sites that use it as a fill. Error text is the text a user most needs to
 * read.
 *
 * THE RATIOS ARE COMPUTED FROM lib/theme.ts, not restated here, so this fails
 * on a future edit rather than agreeing with a stale copy of the numbers.
 */

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "lib", "theme.ts"), "utf8");

/** The hex tokens of one exported theme object. */
function theme(name) {
  const at = SRC.indexOf(`export const ${name} = {`);
  // Empty rather than a throw: a renamed export IS a regression, and throwing
  // at module load replaces the failing assertion's name with a stack trace.
  if (at === -1) return {};
  const end = SRC.indexOf("} as const;", at);
  const out = {};
  for (const m of SRC.slice(at, end).matchAll(/(\w+):\s*"(#[0-9A-Fa-f]{6})"/g)) out[m[1]] = m[2];
  return out;
}

/** WCAG 2.x relative luminance, then the contrast ratio. Twelve lines of
 *  arithmetic beats a dependency, and the design skill's check_contrast.py
 *  agrees with it to two decimals on every pairing below. */
function luminance(hex) {
  const ch = [1, 3, 5]
    .map(i => parseInt(hex.substr(i, 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT = theme("LIGHT");
const DARK = theme("DARK");

const NORMAL_TEXT = 4.5;
const LARGE_TEXT = 3.0;

/* Every pairing that puts text on a surface. The ground matters: `placeholder`
   renders on `inputBg` and not on `card`, and the tab bar has its own. */
const PAIRS = [
  ["text", "bg"], ["text", "card"],
  ["textSecondary", "bg"], ["textSecondary", "card"],
  ["textMuted", "bg"], ["textMuted", "card"],
  ["placeholder", "inputBg"],
  ["tabBarInactive", "tabBar"], ["tabBarActive", "tabBar"],
  ["success", "bg"], ["success", "card"],
  ["warning", "bg"], ["warning", "card"], ["warning", "warningLight"],
  ["danger", "bg"], ["danger", "card"], ["danger", "dangerLight"],
];

for (const [name, palette] of [["LIGHT", LIGHT], ["DARK", DARK]]) {
  describe(`${name} theme clears the text contrast floor`, () => {
    it.each(PAIRS)(`%s on %s`, (fg, bg) => {
      expect(ratio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(NORMAL_TEXT);
    });
  });
}

describe("white on a primary fill, which 36 call sites rely on", () => {
  it("passes normal text in the light theme", () => {
    expect(ratio("#FFFFFF", LIGHT.primary)).toBeGreaterThanOrEqual(NORMAL_TEXT);
  });

  it("clears only the LARGE text floor in the dark theme, a known gap", () => {
    // 4.02:1. Deliberate, not an oversight: dark primary #2F8E71 was chosen to
    // balance BOTH directions the way the old violet did, and 36 call sites put
    // white on it, so raising it is the highest blast radius colour change in
    // this codebase and a product decision rather than a correction.
    // Asserted at 3:1 so the gap is VISIBLE here instead of absent. If somebody
    // decides to close it, tighten this to NORMAL_TEXT in the same commit.
    expect(ratio("#FFFFFF", DARK.primary)).toBeGreaterThanOrEqual(LARGE_TEXT);
    expect(ratio("#FFFFFF", DARK.primary)).toBeLessThan(NORMAL_TEXT);
  });

  it("does not let dark primary become the bright mint", () => {
    // #55C6A3 under white is 2.1:1, and all 36 call sites would drop to it at
    // once. This is the specific mistake CLAUDE.md names as highest risk.
    expect(DARK.primary).not.toBe("#55C6A3");
  });
});

describe("the category palette is left alone on purpose", () => {
  it("keeps #8B949C as the other category, which is a dot and not text", () => {
    // The old failing grey still lives here legitimately. It belongs to a
    // categorical palette validated on its own adjacency pairlist, the calendar
    // legend answers its 2.98:1 by naming the category beside the swatch, and
    // changing it needs that adjacency check re-run rather than a contrast one.
    const cats = fs.readFileSync(
      path.join(__dirname, "..", "lib", "categories.ts"), "utf8");
    expect(cats).toMatch(/other:\s*\{[^}]*#8B949C/);
  });
});

describe("the greys that failed cannot come back", () => {
  it.each([["#8B949C"], ["#6E7E88"], ["#C4544A"]])("%s is gone from theme.ts values", hex => {
    // Scoped to VALUES, since the header comment names all three while
    // explaining why they went. A bare indexOf over the file would match the
    // documentation and report the fix as the defect.
    const values = [...SRC.matchAll(/\w+:\s*"(#[0-9A-Fa-f]{6})"/g)].map(m => m[1]);
    expect(values).not.toContain(hex);
  });
});
