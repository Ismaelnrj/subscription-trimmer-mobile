/* Two whole classes of TypeScript error that a SANDBOX CAN CATCH, which matters
   because tools/typecheck.py cannot run here and CI is otherwise the first
   compiler to see anything.

   Both were real, in run 401 on app/cancelled.tsx:
     TS2339  Property 'background' does not exist on type 'AppColors'   (x2)
     TS2554  Expected 2 arguments, but got 1                            (fmtD)

   Neither needs a type system. The first is a name lookup against a table in
   lib/theme.ts, and the second is an argument count. This is NOT a replacement
   for the typecheck, which catches things no regex can; it is the cheap subset
   that gives the answer in a second instead of two minutes, on the class this
   repo has now paid for twice in one day. */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const THEME = fs.readFileSync(path.join(ROOT, "lib", "theme.ts"), "utf8");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const FILES = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "components"))];

/* `AppColors` is `Record<keyof typeof LIGHT, string>`, so LIGHT is the table the
   type is derived from and therefore the one to read. DARK is checked against it
   separately below: a token present in one palette and missing from the other
   would fail only in that mode, which is the kind of defect nobody screenshots. */
function paletteKeys(name) {
  const start = THEME.indexOf(`export const ${name} = {`);
  if (start === -1) throw new Error(`missing ${name}`);
  const body = THEME.slice(start, THEME.indexOf("\n};", start));
  return new Set([...body.matchAll(/^\s{2}(\w+)\s*:/gm)].map((m) => m[1]));
}
const TOKENS = paletteKeys("LIGHT");
const DARK_TOKENS = paletteKeys("DARK");

describe("every theme token a screen names actually exists", () => {
  it("reads a non trivial token list, so this cannot pass vacuously", () => {
    expect(TOKENS.size).toBeGreaterThan(10);
    expect(TOKENS.has("bg")).toBe(true);
    // The exact name that was got wrong. `background` is what it is NOT called.
    expect(TOKENS.has("background")).toBe(false);
  });

  it("LIGHT and DARK carry exactly the same tokens", () => {
    /* A token in one palette and not the other renders undefined in that mode
       only, so it survives every check anybody runs in the theme they use. */
    const onlyLight = [...TOKENS].filter((k) => !DARK_TOKENS.has(k));
    const onlyDark = [...DARK_TOKENS].filter((k) => !TOKENS.has(k));
    expect(onlyLight).toEqual([]);
    expect(onlyDark).toEqual([]);
  });

  it("finds no unknown c.<token> anywhere in app/ or components/", () => {
    const bad = [];
    for (const file of FILES) {
      const src = fs.readFileSync(file, "utf8");
      /* `c` is the convention every screen uses for the theme object. Matching
         `c.name` is narrow enough to avoid other identifiers, and the word
         boundary stops it matching `abc.foo`. */
      for (const m of src.matchAll(/(?<![A-Za-z0-9_$.])c\.([A-Za-z_]\w*)/g)) {
        const token = m[1];
        if (TOKENS.has(token)) continue;
        const line = src.slice(0, m.index).split("\n").length;
        bad.push(`${path.relative(ROOT, file)}:${line} c.${token}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("shared helpers whose return shape is easy to misname", () => {
  /* The third failure of this class in one day: `getCategoryIcon(...).name`,
     where the field is `icon`. CATEGORY_ICON is declared
     `Record<string, { icon: string; color: string }>`, so the valid fields are
     readable without a type system.

     DELIBERATELY NARROW, one helper. Generalising this means reimplementing
     property checking, which is the typechecker's job and would be a worse
     version of it. This helper earns a special case because it is used on five
     screens and its two fields are both plausible names for the other. */
  it("only reads fields getCategoryIcon actually returns", () => {
    const CATS = fs.readFileSync(path.join(ROOT, "lib", "categories.ts"), "utf8");
    const decl = CATS.match(/CATEGORY_ICON:\s*Record<string,\s*\{([^}]*)\}>/);
    expect(decl).not.toBeNull();
    const fields = new Set([...decl[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1]));
    expect(fields.size).toBeGreaterThan(1);

    const bad = [];
    for (const file of FILES) {
      const src = fs.readFileSync(file, "utf8");
      // Direct form: getCategoryIcon(x).field
      for (const m of src.matchAll(/getCategoryIcon\([^)]*\)\.(\w+)/g)) {
        if (!fields.has(m[1])) {
          bad.push(`${path.relative(ROOT, file)} getCategoryIcon(...).${m[1]}`);
        }
      }
      // Bound form: `const icon = getCategoryIcon(x)` then `icon.field`
      for (const m of src.matchAll(/const (\w+)\s*=\s*getCategoryIcon\(/g)) {
        const varName = m[1];
        for (const use of src.matchAll(new RegExp(`(?<![A-Za-z0-9_$.])${varName}\\.(\\w+)`, "g"))) {
          if (!fields.has(use[1])) {
            bad.push(`${path.relative(ROOT, file)} ${varName}.${use[1]}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("helpers whose argument count is easy to get wrong", () => {
  /* useDateFormat returns (date, pattern) => string. Calling it with the date
     alone typechecks nowhere and renders nothing, and the pattern is a date-fns
     FORMAT STRING rather than display text, so it is correctly not localised:
     the locale object passed alongside is what makes it render German months. */
  it("every fmtD call passes a format pattern", () => {
    const bad = [];
    for (const file of FILES) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bfmtD\(/g)) {
        // Count brackets to the matching close rather than matching a pattern:
        // an argument list nests, and `[^)]*` stops at the first inner `)`.
        let depth = 0, i = m.index + 5, end = -1;
        for (; i < src.length; i++) {
          const ch = src[i];
          if (ch === "(") depth++;
          else if (ch === ")") { if (depth === 0) { end = i; break; } depth--; }
        }
        if (end === -1) continue;
        const args = src.slice(m.index + 5, end);
        // A top level comma is what separates the two arguments.
        let d = 0, hasComma = false;
        for (const ch of args) {
          if (ch === "(" || ch === "[" || ch === "{") d++;
          else if (ch === ")" || ch === "]" || ch === "}") d--;
          else if (ch === "," && d === 0) hasComma = true;
        }
        if (!hasComma) {
          const line = src.slice(0, m.index).split("\n").length;
          bad.push(`${path.relative(ROOT, file)}:${line}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("actually found some fmtD calls, so the scan is not empty", () => {
    const total = FILES.reduce(
      (n, f) => n + [...fs.readFileSync(f, "utf8").matchAll(/\bfmtD\(/g)].length, 0
    );
    expect(total).toBeGreaterThan(4);
  });
});
