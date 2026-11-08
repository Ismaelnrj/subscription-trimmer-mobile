/* Shared pieces redone 2026-11-07, after every screen around them was:
   - the first-run card, the dashboard every new account sees, was a navy
     gradient with a mint trim tab, an eyebrow pill and an ExtraBold title,
     a different app from the dashboard that replaces it;
   - the reminder primer and the update modal put white on c.primary,
     4.02:1 in dark mode, under the text floor;
   - the legal screens set an italic intro and sub-floor sizes. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const code = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const stylesOf = (src) => src.slice(src.indexOf("function makeStyles"));

describe("the first-run card", () => {
  const src = code("components/FirstRunCard.tsx");
  it("has no gradient, fixed hex, trim tab or eyebrow pill", () => {
    expect(src).not.toContain("LinearGradient");
    expect(src).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(src).not.toMatch(/\btrim\b|styles\.eyebrowText/);
  });
  it("sets text on the type scale", () => {
    expect(stylesOf(src).replace(/title: \{[^}]*\}/, "")).not.toMatch(/fontSize|fontWeight/);
  });
});

describe.each(["components/ReminderPrimer.tsx", "components/UpdateAvailableModal.tsx"])("%s", (f) => {
  const src = code(f);
  it("uses an ink button, never white on primary", () => {
    expect(src).not.toMatch(/c\.primary|"#fff"|"#FFFFFF"/);
    expect(stylesOf(src)).toMatch(/backgroundColor: c\.text/);
  });
  it("sets text on the type scale", () => {
    expect(stylesOf(src)).not.toMatch(/fontSize|fontWeight/);
  });
});

describe.each(["app/terms-of-service.tsx", "app/privacy-policy.tsx"])("%s", (f) => {
  it("reads at body size with no italic intro", () => {
    const styles = stylesOf(code(f));
    expect(styles).not.toMatch(/fontStyle: "italic"|fontSize: 1[23]\b/);
    expect(styles).toMatch(/sectionBody: \{ \.\.\.typeScale\.body/);
  });
});
