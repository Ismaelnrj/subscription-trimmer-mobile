/* The subscription details screen, redone 2026-11-07, and a defect found
   with it: the Monthly and Yearly figures are derived from ONE row and were
   formatted without its currency, so a 24.99 USD row printed "€24.99" and
   "€299.88" under a header reading "$24.99 / month". Also gone: the dark
   mode gradient (off palette), the system font (no Montserrat anywhere),
   and a "Danger Zone" heading over a single delete button. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RAW = fs.readFileSync(path.join(ROOT, "app", "subscription-details.tsx"), "utf8");
const SRC = RAW.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const loc = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, "locales", `${l}.json`), "utf8")).subscriptionDetails;

describe("the subscription details screen", () => {
  it("formats a figure derived from the row in the row's currency", () => {
    expect(SRC).toMatch(/fmtC\(monthly, sub\.currency\)/);
    expect(SRC).toMatch(/fmtC\(monthly \* 12, sub\.currency\)/);
    expect(SRC).not.toMatch(/fmtC\(monthly(?: \* 12)?\)/);
  });

  it("has no gradient and no danger zone heading", () => {
    expect(SRC).not.toContain("LinearGradient");
    expect(SRC).not.toContain("dangerZone");
    for (const l of ["en", "de"]) expect(loc(l).dangerZone).toBeUndefined();
  });

  it("sets every text on the shared type scale", () => {
    const styles = SRC.slice(SRC.indexOf("function makeStyles"));
    expect(styles).not.toMatch(/fontSize: \d+|fontWeight/);
  });

  it("groups renewals and actions in cards with hairline dividers", () => {
    expect(SRC).toMatch(/i > 0 && styles\.rowDivider/);
    expect(SRC).not.toContain("styles.renewalRow");
  });
});
