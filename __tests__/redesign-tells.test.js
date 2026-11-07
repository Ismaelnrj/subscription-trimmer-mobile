/* The redesign exists because the owner said the app "looks AI generated".
   Anthropic's frontend-design skill (anthropics/skills, read at 2c5958e,
   2026-11-07) lists what generated interfaces cluster on. Two of its tells
   are plain text and so can be checked: meta strings joined with middle dots
   ("A · B · C") and an arrow appended to link or button text. The first
   redesigned dashboard shipped three of them before anybody checked.

   Scoped to the screens already redone. Add each screen here when its
   redesign lands, so a redone screen cannot drift back. The paywall's
   "Cancel anytime · Instant access · Instant results" and
   "Unlock Premium · {{price}}" went with its redesign on 2026-11-07. */

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const REDONE = [
  { file: "app/(tabs)/index.tsx", keys: "dashboard" },
  { file: "app/(tabs)/subscriptions.tsx", keys: "subscriptions" },
  { file: "app/upgrade.tsx", keys: "upgrade" },
  { file: "app/(tabs)/analytics.tsx", keys: "analytics" },
];

// Block and JSX comments may quote the tells they explain.
const code = (s) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");

for (const { file, keys } of REDONE) {
  describe(`${file} carries no generated-template tells`, () => {
    const src = code(read(file));

    it("no middle dot joins two pieces of text", () => {
      expect(src.match(/.{0,30}·.{0,30}/g) ?? []).toEqual([]);
    });

    it("no arrow appended to link or button text", () => {
      expect(src.match(/.{0,30}[→➔➜].{0,10}/g) ?? []).toEqual([]);
    });

    for (const lang of ["en", "de"]) {
      it(`no ${lang} ${keys}.* string joins with a middle dot or ends in an arrow`, () => {
        const section = JSON.parse(read(`locales/${lang}.json`))[keys];
        const hits = Object.entries(section).filter(([, v]) => typeof v === "string" && /·|[→➔➜]/.test(v));
        expect(hits).toEqual([]);
      });
    }
  });
}
