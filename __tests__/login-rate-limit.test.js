/* Login rate limiting, added 2026-10-15.

   Two layers, and this pins both:
     1. loginLimiter, per IP, counts only FAILED attempts (skipSuccessfulRequests),
        so people sharing a mobile carrier address cannot lock each other out by
        signing in normally. It is its own instance, not the authLimiter that
        register and account deletion spend.
     2. A per-ACCOUNT counter: after 10 wrong passwords for one email inside 15
        minutes that email is refused with 429, whichever addresses the guesses
        came from. A success or a password reset clears it.

   The second layer is driven for real: the helpers and the login handler are
   lifted out of server.js by string index and run against a stub pool and a
   stub bcrypt. */

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function slice(startMarker, endMarker) {
  const a = SRC.indexOf(startMarker);
  const b = SRC.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error(`marker not found: ${startMarker}`);
  return SRC.slice(a, b);
}

const helpers = slice("const LOGIN_MAX_FAILURES", "app.post('/api/auth/login'");
const handlerStart = SRC.indexOf("app.post('/api/auth/login'");
const handlerSrc = SRC.slice(handlerStart, SRC.indexOf("\n});\n", handlerStart) + 4);

function build({ password = "right" } = {}) {
  let handler;
  const app = { post: (_p, fn) => { handler = fn; } };
  const pool = {
    query: async (_sql, [email]) => ({
      rows: email === "owner@example.com" ? [{ id: 1, email, password_hash: "HASH" }] : [],
    }),
  };
  const bcrypt = { compare: async (pw) => pw === password };
  const issueTokens = async () => ({ accessToken: "a", refreshToken: "r" });
  const formatUser = (u) => ({ id: u.id });
  const handleError = (err) => { throw err; };
  const exports = new Function(
    "app", "pool", "bcrypt", "issueTokens", "formatUser", "handleError",
    `${helpers}\n${handlerSrc}\nreturn { loginFailures, loginLocked, noteLoginFailure, LOGIN_MAP_LIMIT };`,
  )(app, pool, bcrypt, issueTokens, formatUser, handleError);
  async function login(email, pw) {
    let status = 200;
    let body;
    const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
    await handler({ body: { email, password: pw } }, res);
    return { status, body };
  }
  return { login, ...exports };
}

describe("per account login lockout", () => {
  it("refuses the 11th attempt after 10 wrong passwords, even with the right one", async () => {
    const { login } = build();
    for (let i = 0; i < 10; i++) expect((await login("owner@example.com", "wrong")).status).toBe(401);
    const locked = await login("owner@example.com", "right");
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe("Too many attempts. Please try again in 15 minutes.");
  });

  it("a success before the limit clears the count", async () => {
    const { login } = build();
    for (let i = 0; i < 9; i++) await login("owner@example.com", "wrong");
    expect((await login("owner@example.com", "right")).status).toBe(200);
    for (let i = 0; i < 9; i++) await login("owner@example.com", "wrong");
    expect((await login("owner@example.com", "right")).status).toBe(200);
  });

  it("counts unknown addresses the same way, so a 429 reveals nothing", async () => {
    const { login } = build();
    for (let i = 0; i < 10; i++) expect((await login("nobody@example.com", "x")).status).toBe(401);
    expect((await login("nobody@example.com", "x")).status).toBe(429);
  });

  it("one locked email does not affect another", async () => {
    const { login } = build();
    for (let i = 0; i < 10; i++) await login("nobody@example.com", "x");
    expect((await login("owner@example.com", "right")).status).toBe(200);
  });

  it("the lock expires after the window", () => {
    const { loginLocked, noteLoginFailure } = build();
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) noteLoginFailure("a@b.c", t0);
    expect(loginLocked("a@b.c", t0 + 60_000)).toBe(true);
    expect(loginLocked("a@b.c", t0 + 15 * 60 * 1000)).toBe(false);
  });

  it("the map cannot grow past its limit", () => {
    const { noteLoginFailure, loginFailures, LOGIN_MAP_LIMIT } = build();
    for (let i = 0; i < LOGIN_MAP_LIMIT + 50; i++) noteLoginFailure(`u${i}@x.y`, 1);
    expect(loginFailures.size).toBeLessThanOrEqual(LOGIN_MAP_LIMIT);
  });
});

describe("how it is wired", () => {
  it("login has its own per IP limiter that skips successful requests", () => {
    const def = slice("const loginLimiter = rateLimit({", "});");
    expect(def).toMatch(/skipSuccessfulRequests: true/);
    expect(SRC).toMatch(/app\.use\('\/api\/auth\/login', loginLimiter\)/);
    expect(SRC).not.toMatch(/app\.use\('\/api\/auth\/login', authLimiter\)/);
  });

  it("registration keeps a limiter that counts every attempt", () => {
    expect(SRC).toMatch(/app\.use\('\/api\/auth\/register', authLimiter\)/);
    expect(slice("const authLimiter = rateLimit({", "});")).not.toMatch(/skipSuccessfulRequests/);
  });

  it("a successful password reset clears the login lock", () => {
    const reset = slice("app.post('/api/auth/reset-password'", "app.post('/api/auth/resend-verification'");
    expect(reset).toMatch(/loginFailures\.delete\(email\)/);
  });

  it("the lock text is one the German middleware already translates", () => {
    expect(SRC).toMatch(/'Too many attempts\. Please try again in 15 minutes\.': 'Zu viele Versuche/);
  });
});
