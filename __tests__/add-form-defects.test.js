/* Two defects in the add form, found 2026-11-07 while planning its redesign
   and fixed on their own: the custom category's confirm button was a bare
   English "Add" in every language, and the "+ custom" chip hardcoded navy
   text, which on the dark chip measured 1.08:1, invisible. */
const fs = require("fs");
const path = require("path");
const SUBS = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "subscriptions.tsx"), "utf8")
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");

describe("the add form's custom category controls", () => {
  it("the confirm button is translated", () => {
    expect(SUBS).not.toMatch(/>\s*Add\s*<\/Text>/);
  });
  it("no text colour is hardcoded navy, which vanishes in dark mode", () => {
    expect(SUBS).not.toMatch(/color: "#142B3A"/);
  });
});
