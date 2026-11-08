/* The strength label on the sign up screen, measured 2026-11-08 in Chromium
   with the real Montserrat: German "Schwach" is 55.8 wide in SemiBold 12, the
   widest of the six labels (English "Strong" 41.9). The box was a fixed 44, so
   the German label broke mid word into "Schwa" / "ch", seen rendered, on the
   first screen a German user meets about their new password. */
const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const CODE = read("components/PasswordStrength.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
const label = /\n\s*label: \{([^}]*)\}/.exec(CODE)[1];
const reqText = /reqText: \{([^}]*)\}/.exec(CODE)[1];
const WIDEST_LABEL = 55.8;

describe("the password strength label", () => {
  it("has no fixed width to break a word inside", () => {
    expect(label).not.toMatch(/(^|[^A-Za-z])width:/);
  });
  it("reserves at least the widest label, so the bars do not jump", () => {
    const min = Number(/minWidth: (\d+)/.exec(label)[1]);
    expect(min).toBeGreaterThanOrEqual(WIDEST_LABEL);
  });
  it("never shrinks, so a larger font shortens the bars instead", () => {
    expect(label).toMatch(/flexShrink: 0/);
  });
  it("is set in Montserrat, as are the requirements", () => {
    expect(label).toMatch(/fontFamily: "Montserrat-SemiBold"/);
    expect(reqText).toMatch(/fontFamily: "Montserrat-Regular"/);
  });
  it("the measured label is still the German weak one", () => {
    expect(JSON.parse(read("locales/de.json")).passwordStrength.weak).toBe("Schwach");
  });
});
