/* A CEILING ON VERIFICATION EMAILS FOR THE WHOLE SERVICE, 2026-11-24.

   From a "10 ways your app gets you a huge bill" checklist the owner sent:
   the per address cap (takeCodeEmail) and the per IP limiters were already in
   place, but nothing capped the total, so enough IP addresses could sign up
   thousands of made up addresses and make Brevo send a bouncing code to each.
   That spends the quota and can get the Brevo account suspended, which would
   stop every Trimio email. The helper is lifted out of server.js and run. */

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function build() {
  const a = SRC.indexOf("const VERIFICATION_EMAILS_PER_DAY");
  const b = SRC.indexOf("function takeCodeEmail(");
  if (a < 0) throw new Error("no service wide verification email ceiling in server.js");
  const reports = [];
  const take = new Function(
    "reportServerError", "console",
    `${SRC.slice(a, b)}\nreturn { takeVerificationEmailBudget, VERIFICATION_EMAILS_PER_DAY };`,
  )((e) => reports.push(e.message), { error() {} });
  return { ...take, reports };
}

describe("verification emails have a ceiling for the whole service", () => {
  it("allows up to the daily number, then holds the rest, and reports it once", () => {
    const { takeVerificationEmailBudget: take, VERIFICATION_EMAILS_PER_DAY: max, reports } = build();
    const t0 = 1_800_000_000_000;
    for (let i = 0; i < max; i++) expect(take(t0 + i)).toBe(true);
    expect(take(t0 + max)).toBe(false);
    expect(take(t0 + max + 1)).toBe(false);
    expect(reports).toEqual(["Verification email ceiling reached"]);
  });

  it("opens again after 24 hours", () => {
    const { takeVerificationEmailBudget: take, VERIFICATION_EMAILS_PER_DAY: max } = build();
    const t0 = 1_800_000_000_000;
    for (let i = 0; i <= max; i++) take(t0);
    expect(take(t0 + 23 * 3600000)).toBe(false);
    expect(take(t0 + 24 * 3600000)).toBe(true);
  });

  it("sits far above real signups and far below a quota problem", () => {
    const { VERIFICATION_EMAILS_PER_DAY: max } = build();
    expect(max).toBeGreaterThanOrEqual(50);
    expect(max).toBeLessThanOrEqual(250);
  });

  it("guards both places that email an unverified address, and not the reset", () => {
    const register = SRC.slice(SRC.indexOf("app.post('/api/auth/register'"), SRC.indexOf("app.post('/api/auth/login'"));
    expect(register).toMatch(/if \(takeCodeEmail\(email\) && takeVerificationEmailBudget\(\)\) \{\s*await sendVerificationEmail/);
    const resend = SRC.slice(SRC.indexOf("app.post('/api/auth/resend-verification'"));
    const guard = resend.indexOf("takeVerificationEmailBudget()");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(resend.indexOf("sendVerificationEmail("));
    const forgot = SRC.slice(SRC.indexOf("app.post('/api/auth/forgot-password'"), SRC.indexOf("const RESET_MAX_ATTEMPTS"));
    expect(forgot).not.toMatch(/takeVerificationEmailBudget/);
  });

  it("the refusal reaches a German reader in German", () => {
    expect(SRC).toMatch(/'Too many requests\. Please try again later\.': 'Zu viele Anfragen\. Bitte versuche es später erneut\.'/);
  });
});
