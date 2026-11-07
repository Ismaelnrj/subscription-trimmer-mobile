/* Two text colours that failed the 4.5:1 floor in dark mode, measured
   2026-11-07: the Premium tag (primary on primaryLight, 3.35:1) and the
   locked Add button (white on textMuted, 3.08:1). Both now use the theme's
   own text colour; this computes the ratios from lib/theme.ts so a token
   change that breaks them fails here. */
const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
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

describe("the Premium tag and the locked Add button read in both themes", () => {
  for (const theme of ["LIGHT", "DARK"]) {
    const c = tokens(theme);
    it(`${theme}: tag text on its ground clears 4.5:1`, () => expect(ratio(c.text, c.primaryLight)).toBeGreaterThanOrEqual(4.5));
    it(`${theme}: locked Add text on the card clears 4.5:1`, () => expect(ratio(c.text, c.card)).toBeGreaterThanOrEqual(4.5));
  }
  it("the dashboard's tag uses the text colour", () => {
    expect(read("app/(tabs)/index.tsx")).toMatch(/tagText: \{[^}]*color: c\.text \}/);
  });
  it("the locked Add button is outlined with text-coloured content", () => {
    const s = read("app/(tabs)/subscriptions.tsx");
    expect(s).toMatch(/addButtonLocked: \{ backgroundColor: c\.card, borderWidth: 1, borderColor: c\.border \}/);
    expect(s).toMatch(/atLimit && styles\.addButtonTextLocked/);
  });
});
