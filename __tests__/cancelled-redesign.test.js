/* Cancelled subscriptions, redone 2026-11-07: the savings figure leads open
   on the page, rows sit in one grouped card with the same brand marks as
   every other list (tinted category circles before), the meta line drops its
   middle dot join, and restore gets a 48dp target. */
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "cancelled.tsx"), "utf8").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");

describe("the Cancelled screen", () => {
  it("leads with the saving as the display figure", () => {
    expect(SRC).toMatch(/totalAmount: \{ \.\.\.typeScale\.display/);
  });

  it("uses brand marks in one grouped card", () => {
    expect(SRC).toContain("<LogoImage name={sub.name} category={sub.category} />");
    expect(SRC).not.toContain("getCategoryIcon");
    expect(SRC).toMatch(/i > 0 && styles\.rowDivider/);
  });

  it("joins nothing with a middle dot and gives restore a full target", () => {
    expect(SRC).not.toContain("·");
    expect(SRC).toMatch(/iconButton: \{ width: 48, height: 48/);
  });

  it("sets every text on the type scale", () => {
    const styles = SRC.slice(SRC.indexOf("function makeStyles"));
    expect(styles).not.toMatch(/fontSize: \d+|fontWeight|fontFamily/);
  });
});
