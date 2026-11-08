/* The review prompt, measured 2026-11-08. Its five stars were a hardcoded
   #FCD34D, a pale amber that is 1.39:1 on the light card: on the default theme
   the outlines all but vanished, and a star is a control, so WCAG 1.4.11 wants
   3:1. And "Later" was bare 13px text with only a top margin, about 18dp to
   hit against the 48dp floor. */
const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const strip = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const SRC = read("app/(tabs)/subscriptions.tsx");
const CODE = strip(SRC);
const THEME = read("lib/theme.ts");

function tokens(name) {
  const block = THEME.slice(THEME.indexOf(`export const ${name} = {`));
  const body = block.slice(0, block.indexOf("} as const;"));
  return Object.fromEntries([...body.matchAll(/(\w+): "(#[0-9A-Fa-f]{6})"/g)].map((m) => [m[1], m[2]]));
}
function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe("the review prompt", () => {
  const modal = CODE.slice(CODE.indexOf("styles.reviewOverlay"), CODE.indexOf("</Modal>", CODE.indexOf("styles.reviewOverlay")));

  it("draws its stars in a theme colour, not a fixed hex", () => {
    expect(modal).toMatch(/name="star-outline" size=\{38\} color=\{c\.warning\}/);
    expect(modal).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });

  for (const theme of ["LIGHT", "DARK"]) {
    it(`${theme}: the star outline clears 3:1 on the card it sits on`, () => {
      const c = tokens(theme);
      expect(ratio(c.warning, c.card)).toBeGreaterThanOrEqual(3);
    });
  }

  it("records what the old amber measured", () => {
    expect(ratio("#FCD34D", tokens("LIGHT").card)).toBeLessThan(1.5);
  });

  it("gives Later a 48dp target and says it is a button", () => {
    expect(modal).toMatch(/onPress=\{handleReviewLater\} style=\{styles\.reviewDismiss\} accessibilityRole="button"/);
    expect(CODE).toMatch(/reviewDismiss: \{[^}]*minHeight: 48/);
  });
});
