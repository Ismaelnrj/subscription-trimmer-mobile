/* The sign-in flow, restyled 2026-11-07: login, register, forgot password,
   verify email and onboarding. None of them set a Montserrat family, so all
   five rendered in the system font, the first screens anybody meets. Also:
   - the primary button is ink on every screen; onboarding painted each slide's
     button its own fixed hex (navy, amber, mint) and appended an arrow;
   - the verify code box was a fixed 200px that clipped the sixth digit;
   - fields and buttons reach 52dp, links 48dp. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const code = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const FILES = ["app/login.tsx", "app/register.tsx", "app/forgot-password.tsx", "app/verify-email.tsx", "app/onboarding.tsx"];
const stylesOf = (src) => src.slice(src.indexOf("function makeStyles"));

describe.each(FILES)("%s", (file) => {
  const src = code(file);
  const styles = stylesOf(src);

  it("sets text on the type scale (one large code field excepted)", () => {
    const withoutCode = styles.replace(/codeInput: \{[^}]*\}/, "");
    expect(withoutCode).not.toMatch(/fontSize: \d+\b(?!, lineHeight)|fontWeight/);
    expect(styles).toContain("typeScale.");
  });

  it("draws its primary button in ink with no white literal", () => {
    expect(styles).toMatch(/button: \{\s*backgroundColor: c\.text/);
    expect(src).not.toMatch(/color="#fff"|color="#FFFFFF"|"#fff"/);
    expect(src).not.toMatch(/c\.primary/);
  });

  it("gives the primary button at least 52dp", () => {
    expect(styles).toMatch(/button: \{[^}]*minHeight: 52/);
  });
});

describe("onboarding", () => {
  it("carries no per-slide hex and no arrow on its buttons", () => {
    const src = code("app/onboarding.tsx");
    expect(src).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(src).not.toMatch(/arrow-right/);
  });
});

describe("verify email", () => {
  it("gives the six digit code room to show all six", () => {
    expect(stylesOf(code("app/verify-email.tsx"))).toMatch(/codeInput: \{[^}]*width: 220/);
  });
});
