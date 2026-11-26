/**
 * THE PASSWORD EYE SHOWS WHAT IS ON SCREEN, THE WAY ANDROID DOES.
 *
 * 2026-11-26, the owner on a phone: "the eye works in reverse". The icon
 * showed the action (an open eye while the password was hidden, meaning "tap
 * to show"); Android's own password fields, Google's included, show the state:
 * a crossed eye while the password is hidden, an open one while it is visible.
 * The accessibility label keeps describing the action ("Show password"), which
 * is what a screen reader user needs to hear on a button.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const files = ["app/login.tsx", "app/register.tsx", "app/forgot-password.tsx"];

describe.each(files)("%s", (file) => {
  const src = fs.readFileSync(path.join(root, file), "utf8");

  test("shows an open eye while the password is visible, a crossed one while hidden", () => {
    const icons = [...src.matchAll(/name=\{showPassword \? "([\w-]+)" : "([\w-]+)"\}/g)];
    expect(icons.length).toBeGreaterThan(0);
    for (const [, shown, hidden] of icons) {
      expect(shown).toMatch(/^eye(-outline)?$/);
      expect(hidden).toMatch(/^eye-off(-outline)?$/);
    }
  });

  test("the label still names the action", () => {
    expect(src).toMatch(/showPassword \? "common\.a11yHidePassword" : "common\.a11yShowPassword"/);
  });
});
