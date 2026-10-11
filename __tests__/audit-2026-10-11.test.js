/* Four backend findings from the 2026-10-11 audit. Mostly source reading. The
   behaviour was measured separately by lifting the real handlers out of
   server.js and driving them on a stub pool: 5 of 5 scenarios pass, and the
   previous server.js fails the three that matter (reset code burn, Google
   link dropping a squatter's password, re-enabling email lifting the opt out). */
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");
const handler = (route) => {
  const i = SRC.indexOf(route);
  return SRC.slice(i, SRC.indexOf("\napp.", i + 10));
};

describe("Google sign in cannot inherit a stranger's password", () => {
  const google = handler("app.post('/api/auth/google'");
  it("drops an UNVERIFIED password and its session when linking", () => {
    const branch = google.slice(google.indexOf("!user.is_verified && user.password_hash"));
    expect(branch).toMatch(/password_hash = NULL/);
    expect(branch).toMatch(/refresh_token_hash = NULL/);
  });
  it("keeps a VERIFIED password, which proved ownership through the code email", () => {
    expect(google).toMatch(/} else \{\s*await pool\.query\('UPDATE users SET google_id = \$1, is_verified = TRUE WHERE id = \$2'/);
  });
});

describe("a reset code burns after a handful of wrong guesses", () => {
  const reset = handler("app.post('/api/auth/reset-password'");
  it("counts wrong guesses per account and clears the code at the cap", () => {
    expect(SRC).toMatch(/const RESET_MAX_ATTEMPTS = 5;/);
    expect(reset).toMatch(/resetAttempts\.get\(user\.id\)/);
    expect(reset).toMatch(/tries >= RESET_MAX_ATTEMPTS[\s\S]*reset_token = NULL/);
  });
  it("a fresh code from forgot-password starts the count again", () => {
    expect(handler("app.post('/api/auth/forgot-password'")).toMatch(/resetAttempts\.delete\(user\.id\)/);
  });
});

describe("switching email reminders back on undoes an unsubscribe", () => {
  it("clears email_opt_out on an explicit true", () => {
    const prefs = handler("app.post('/api/trpc/notifications.updatePreferences'");
    expect(prefs).toMatch(/if \(emailReminders === true\)[\s\S]*email_opt_out = FALSE/);
  });
});

describe("create and update validate the same fields", () => {
  it("both run validateSubscriptionFields, and update caps the name too", () => {
    const create = handler("app.post('/api/trpc/subscriptions.create'");
    const update = handler("app.post('/api/trpc/subscriptions.update'");
    expect(create).toMatch(/validateSubscriptionFields\(category, trialEndDate\)/);
    expect(update).toMatch(/validateSubscriptionFields\(category, trialEndDate\)/);
    expect(update).toMatch(/name\.trim\(\)\.length > 120/);
  });
  it("the validator refuses a long category and an impossible trial date", () => {
    const start = SRC.indexOf("function validateSubscriptionFields");
    const end = SRC.indexOf("/* WHAT A CANCELLATION", start);
    // eslint-disable-next-line no-new-func
    const v = new Function(SRC.slice(start, end) + "; return validateSubscriptionFields;")();
    expect(v("streaming", null)).toBe(null);
    expect(v("x".repeat(100), null)).toBe(null);
    expect(v("x".repeat(101), null)).toMatch(/Category/);
    expect(v(null, "2026-02-31")).toMatch(/trial/);
    expect(v(null, "2026-03-31")).toBe(null);
  });
});
