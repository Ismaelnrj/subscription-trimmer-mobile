/* Dark mode fills, measured 2026-11-08. Light mode hid all of this: there
   `primary` and `text` are both Ink Navy, so a button filled with either looks
   the same, and a white label on it is 13.5:1. Dark mode is where they differ:

   - white on dark `primary` #2F8E71 is 4.02:1, under the 4.5:1 text floor. The
     dashboard action, the paywall buy button (and its 13px sub-line), the add
     form's submit, the list's add button, empty state button and active sort
     chip, and the floating add button all did it. Every screen redone after
     them already filled with `text` and labelled with `bg`.
   - the savings toast filled with `success`, which in dark is Soft Mint, under
     white text and a white invite link: 2.10:1, failing even the large text
     floor, on the toast that announces a saving.
   - swipe to delete was white on dark `danger`: 2.52:1, the same pairing fixed
     on the cancel guide button and never swept for here.
   - the "Go unlimited" link set text in `primary`: 3.94:1 on the dark card.

   The guard is a SCAN of every screen, not a list of the ones found, so it also
   covers a screen nobody has written yet. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function tsxFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return tsxFiles(rel);
    return e.name.endsWith(".tsx") ? [rel] : [];
  });
}
/* Comments explain what used to be wrong and quote it, so they are stripped.
   `//` only when not part of a URL. */
const code = (src) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const FILES = [...tsxFiles("app"), ...tsxFiles("components")];

function findAll(re) {
  const hits = [];
  for (const f of FILES) {
    const src = code(read(f));
    for (const m of src.matchAll(re)) hits.push(`${f}: ${m[0]}`);
  }
  return hits;
}

describe("no text on a primary fill, and no text set in primary", () => {
  it("scans a real number of screens", () => {
    expect(FILES.length).toBeGreaterThan(40);
  });

  it("no screen fills anything with c.primary", () => {
    expect(findAll(/backgroundColor:\s*c\.primary\b(?!Light)/g)).toEqual([]);
  });

  it("no screen sets text in c.primary", () => {
    expect(findAll(/(?<![A-Za-z])color:\s*c\.primary\b(?!Light)/g)).toEqual([]);
  });

  /* The error boundary is the one exception: it renders when something has
     failed, possibly before the theme, so it carries fixed light colours on
     purpose and white on Ink Navy there is 14.6:1. */
  it("no screen labels anything with a literal white, outside the error boundary", () => {
    const WHITE = /(?<![A-Za-z])color(?::\s*|=\{?\s*)["'](?:#fff|#ffffff|white)["']/gi;
    const hits = findAll(WHITE).filter((h) => !h.startsWith(path.join("app", "_layout.tsx")));
    expect(hits).toEqual([]);
    const layout = code(read("app/_layout.tsx"));
    expect([...layout.matchAll(WHITE)].length).toBe(1);
    expect(layout).toMatch(/errStyles = StyleSheet\.create\([\s\S]*?buttonText: \{ color: "#FFFFFF"/);
  });

  it("the savings toast and swipe delete keep their status fill and label with c.bg", () => {
    const s = code(read("app/(tabs)/subscriptions.tsx"));
    expect(s).toMatch(/removedCard: \{[\s\S]*?backgroundColor: c\.success/);
    expect(s).toMatch(/removedCardText: \{ color: c\.bg,/);
    expect(s).toMatch(/removedCardInvite: \{ color: c\.bg,/);
    expect(s).toMatch(/swipeDelete: \{[\s\S]*?backgroundColor: c\.danger/);
    expect(s).toMatch(/swipeDeleteText: \{ color: c\.bg,/);
  });
});

/* The ratios the fixes rely on, computed from lib/theme.ts so a token change
   that breaks them fails here rather than on a phone. */
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

describe("bg on every fill a label sits on clears 4.5:1 in both themes", () => {
  for (const theme of ["LIGHT", "DARK"]) {
    const c = tokens(theme);
    for (const fill of ["text", "success", "danger"]) {
      it(`${theme}: bg on ${fill}`, () => {
        expect(c.bg).toMatch(/^#/);
        expect(c[fill]).toMatch(/^#/);
        expect(ratio(c.bg, c[fill])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it("documents what white on dark success was", () => {
    expect(ratio("#FFFFFF", tokens("DARK").success)).toBeLessThan(3);
  });
});
