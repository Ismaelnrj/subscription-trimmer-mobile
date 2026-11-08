/* Account settings, restyled 2026-11-07: sentence case headings instead of
   uppercase labels, ink buttons instead of white on primary (4.02:1 in dark
   mode), 48dp inputs and buttons, and no "Danger Zone" heading over the
   delete card. The German placeholder for a new password was shortened when
   the inputs moved to body size, because it clipped to "1 Zah". */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "app", "account-settings.tsx"), "utf8").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const styles = SRC.slice(SRC.indexOf("function makeStyles"));
const loc = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, "locales", `${l}.json`), "utf8")).accountSettings;

describe("the Account settings screen", () => {
  it("uses ink buttons and spinners, never white on primary", () => {
    expect(styles).toMatch(/saveButton: \{\s*backgroundColor: c\.text/);
    expect(SRC).not.toContain('color="#FFFFFF"');
    expect(styles).not.toContain("c.primary");
  });

  it("gives every input and button a 48dp target", () => {
    for (const name of ["input", "saveButton", "clearButton", "deleteButton"]) {
      const at = styles.indexOf(`    ${name}: {`);
      expect([name, styles.slice(at, styles.indexOf("},", at)).includes("minHeight: 48")]).toEqual([name, true]);
    }
  });

  it("has no uppercase labels, no fixed sizes and no danger zone heading", () => {
    expect(styles).not.toMatch(/textTransform|fontSize: \d+|fontWeight/);
    expect(SRC).not.toContain("dangerZone");
    for (const l of ["en", "de"]) expect(loc(l).dangerZone).toBeUndefined();
  });

  it("keeps the German new password hint short enough to show whole", () => {
    expect(loc("de").newPasswordPlaceholder.length).toBeLessThanOrEqual(32);
  });
});
