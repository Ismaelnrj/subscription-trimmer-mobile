/* Every piece of text is set in Montserrat. On Android a Text with a size or a
   weight but no fontFamily falls back to Roboto, and nothing anywhere sets a
   default family, so each such style is a word in a different face.

   Found 2026-11-08, after the redesign had been called complete: the tab bar
   labels (on every main screen), the calendar's day amounts and legend, the
   subscriptions list's empty, error and limit states and its review prompt, the
   password strength meter on sign up, and both offline notices. The before
   shots showed them in a visibly different face beside Montserrat; the redesign
   had checked each screen it touched and never scanned for the class.

   A SCAN, not a list, so it covers a screen nobody has written yet. */
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
const code = (src) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/* name: { ... } with at most one level of nested braces inside. */
const STYLE = /(\w+):\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
const HAS_TYPE = /fontSize|fontWeight/;
const HAS_FAMILY = /fontFamily|\.\.\.(?:typeScale|type)\.\w+/;

/* Deliberate: the error boundary renders when something has failed, possibly
   before the fonts have loaded, and an emoji draws from the emoji font. */
const ALLOWED = new Set([
  "app/_layout.tsx:title",
  "app/_layout.tsx:message",
  "app/_layout.tsx:buttonText",
  "app/(tabs)/subscriptions.tsx:reviewEmoji",
]);

function missing() {
  const out = [];
  for (const f of [...tsxFiles("app"), ...tsxFiles("components")]) {
    const src = code(read(f));
    for (const m of src.matchAll(STYLE)) {
      const [, name, body] = m;
      if (!HAS_TYPE.test(body) || HAS_FAMILY.test(body)) continue;
      const key = `${f.split(path.sep).join("/")}:${name}`;
      if (!ALLOWED.has(key)) out.push(`${key}  { ${body.replace(/\s+/g, " ").trim().slice(0, 80)} }`);
    }
  }
  return out;
}

describe("every text style names a Montserrat face", () => {
  it("no style sets a size or weight without a family", () => {
    expect(missing()).toEqual([]);
  });

  it("the scan reads real styles, so a pass is not vacuous", () => {
    let typed = 0, bare = 0;
    for (const f of [...tsxFiles("app"), ...tsxFiles("components")]) {
      for (const m of code(read(f)).matchAll(STYLE)) {
        if (HAS_TYPE.test(m[2]) || HAS_FAMILY.test(m[2])) typed++;
        if (HAS_TYPE.test(m[2])) bare++;
      }
    }
    expect(typed).toBeGreaterThan(250);
    expect(bare).toBeGreaterThan(20);
  });

  it("every allowed exception still exists, so the list cannot go stale", () => {
    for (const key of ALLOWED) {
      const [file, name] = [key.slice(0, key.lastIndexOf(":")), key.slice(key.lastIndexOf(":") + 1)];
      expect(read(file)).toMatch(new RegExp(`\\b${name}: \\{`));
    }
  });

  it("every family named is one the app loads", () => {
    const loaded = new Set([...read("app/_layout.tsx").matchAll(/"(Montserrat-\w+)": require/g)].map((m) => m[1]));
    expect(loaded.size).toBe(5);
    const used = new Set();
    for (const f of [...tsxFiles("app"), ...tsxFiles("components"), "lib/theme.ts"]) {
      for (const m of read(f).matchAll(/fontFamily: "(Montserrat-\w+)"/g)) used.add(m[1]);
    }
    expect([...used].filter((u) => !loaded.has(u))).toEqual([]);
  });
});
