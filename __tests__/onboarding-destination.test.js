/* A new install must land on the CREATE ACCOUNT form, not the sign in form.
 *
 * Onboarding only runs when `onboarding_done` is unset, so anyone finishing it
 * has no account by definition. It used to `router.replace("/login")`, which
 * made a brand new user read the returning-user form, notice a link, and tap
 * again to reach the one they needed. That is the first screen after an install,
 * and the app is a hard wall: nothing about the product is visible until an
 * account exists, so paid installs land on a form and it was the wrong form.
 *
 * Three assertions, and the third is the one that is not obvious.
 */

const fs = require("fs");
const path = require("path");

const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
const ONBOARDING = read("app", "onboarding.tsx");
const LAYOUT = read("app", "_layout.tsx");

describe("where a finished onboarding sends people", () => {
  it("replaces to /register", () => {
    expect(ONBOARDING).toMatch(/router\.replace\("\/register"\)/);
  });

  it("no longer replaces to /login", () => {
    // Scoped to the call, not the file: the comment above it explains the old
    // behaviour and names /login, so a bare search would match the explanation
    // and report the fix as the defect. That trap is on record here repeatedly.
    expect(ONBOARDING).not.toMatch(/router\.replace\("\/login"\)/);
  });

  it("still sends a RETURNING signed-out user to /login", () => {
    // Someone with onboarding_done already true is a returning user, so the
    // sign in form is right for them. Changing both would be the overcorrection.
    expect(LAYOUT).toMatch(/onboardingDone \? "\/login" : "\/onboarding"/);
  });

  it("keeps register inside the auth group, or the redirect fights it", () => {
    // THE NON-OBVIOUS ONE. The effect in _layout.tsx bounces any unauthenticated
    // user who is NOT in this list back to login or onboarding. Drop "register"
    // from it and the replace above is undone on the very next render, which
    // would look like the button doing nothing rather than like a routing bug.
    const group = LAYOUT.match(/const inAuthGroup = \[([^\]]*)\]/);
    expect(group).not.toBeNull();
    expect(group[1]).toMatch(/"register"/);
  });
});
