/* The Settings tab, redone 2026-11-07. Pinned here so it cannot drift back:
   - a German reader met "SOON" on a badge, and "User" and "No email" were the
     English fallbacks for an account without a name;
   - the language switch read "EN" and "DE". Each language is named in its
     own words, the convention somebody lost in the other language relies on;
   - the iOS row promised "Coming soon to the App Store" for an app nobody is
     building (iOS is deferred until Android has traction), and it was a row
     that looked tappable and did nothing;
   - theme and language are segmented controls in ink, never white on primary
     (4.02:1 in dark mode);
   - the floating add button covers this screen too, so it reserves the same
     clearance as every other screen that draws it. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RAW = fs.readFileSync(path.join(ROOT, "app", "(tabs)", "profile.tsx"), "utf8");
const SRC = RAW.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const loc = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, "locales", `${l}.json`), "utf8")).profile;

describe("the Settings screen", () => {
  it("strips comments before reading", () => {
    expect(SRC.length).toBeLessThan(RAW.length);
  });

  it("carries no English fallback or badge", () => {
    expect(SRC).not.toMatch(/>SOON</);
    expect(SRC).not.toMatch(/"User"|"No email"/);
  });

  it("names each language in its own words", () => {
    expect(SRC).toMatch(/\{ code: "en", name: "English" \}/);
    expect(SRC).toMatch(/\{ code: "de", name: "Deutsch" \}/);
    expect(SRC).not.toMatch(/>EN<|>DE</);
  });

  it("promises no iOS app", () => {
    expect(SRC).not.toContain("iOSComingSoon");
    for (const l of ["en", "de"]) {
      expect(loc(l).iOSComingSoon).toBeUndefined();
      expect(loc(l).comingSoon).toBeUndefined();
    }
  });

  it("marks the chosen theme and language in ink, as radios", () => {
    expect(SRC).toMatch(/segmentOn: \{ backgroundColor: c\.text \}/);
    expect(SRC).toMatch(/segmentTextOn: \{ color: c\.bg/);
    expect((SRC.match(/accessibilityRole="radiogroup"/g) || []).length).toBe(2);
  });

  it("reserves room for the floating add button", () => {
    expect(SRC).toContain("paddingBottom: FAB_SCROLL_CLEARANCE");
  });

  it("keeps every size on the scale, nothing under 13, no uppercase labels", () => {
    expect(SRC).not.toMatch(/fontSize: (\d|1[012])\b/);
    expect(SRC).not.toMatch(/textTransform: "uppercase"/);
  });

  it("has every string it renders, in both languages", () => {
    const used = [...SRC.matchAll(/t\("profile\.([a-zA-Z0-9_]+)"/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(10);
    for (const l of ["en", "de"]) for (const k of used) expect([l, k, typeof loc(l)[k]]).toEqual([l, k, "string"]);
  });
});
