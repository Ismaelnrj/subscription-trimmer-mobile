/**
 * THE SIGN IN FLOW'S ART IS DRAWN AT THE SHAPE THE CODE ASSUMES.
 *
 * tools/make-app-marks.py draws the corner art and the waves; AuthHeader.tsx
 * sizes them from two aspect constants with resizeMode "stretch". Redraw a
 * file at a new shape without the constant and every phone stretches it: the
 * rings turn to ovals. The canvas changed twice on 2026-11-26 alone.
 *
 * Also pinned: the feature row promises nothing about privacy. "Your data
 * stays private" was in the owner's mock and is not something a server that
 * holds the list can say; "no bank login" is simply true.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const pngSize = (p) => {
  const b = fs.readFileSync(path.join(root, p));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const header = read("components/AuthHeader.tsx");
const ratio = (name) => {
  const m = header.match(new RegExp(`const ${name} = (\\d+) / (\\d+);`));
  if (!m) throw new Error(`no ${name}`);
  return [Number(m[1]), Number(m[2])];
};

describe("sign in art", () => {
  test.each(["light", "dark"])("the %s corner art matches CORNER_ASPECT (height / width)", (theme) => {
    const [w, h] = pngSize(`assets/brand/corner-on-${theme}.png`);
    const [num, den] = ratio("CORNER_ASPECT");
    expect(h / w).toBeCloseTo(num / den, 3);
  });

  test.each(["light", "dark"])("the %s waves match WAVES_ASPECT (width / height)", (theme) => {
    const [w, h] = pngSize(`assets/brand/waves-on-${theme}.png`);
    const [num, den] = ratio("WAVES_ASPECT");
    expect(w / h).toBeCloseTo(num / den, 3);
  });

  test("the feature row makes no privacy promise, in either language", () => {
    for (const lang of ["en", "de"]) {
      const auth = JSON.parse(read(`locales/${lang}.json`)).auth;
      const features = [auth.featureReminders, auth.featureGuides, auth.featureNoBank].join(" ");
      expect(features).not.toMatch(/privat|private|never leaves|verlässt nie|sicher|secure/i);
    }
  });
});
