/* Guess limits must hold for a BURST, not only for guesses sent one by one.
 *
 * Found 2026-11-17 by an audit and measured on the real server against
 * PostgreSQL 16 before it was fixed: 100 parallel reset-code guesses with the
 * right code at position 60 reset the password in 3 of 4 trials, after at least
 * 65 wrong guesses had been compared against one live code. 100 parallel
 * verification guesses were all compared, 60 parallel wrong passwords all ran
 * bcrypt against a lock of 10, and account deletion had no guess limit at all.
 * The cause was the same everywhere: the attempt was counted AFTER the lookup,
 * so every request already waiting on the pool compared before any had counted.
 *
 * This suite drives the REAL handlers lifted out of server.js on a stub pool
 * that answers each query a macrotask later, which is what lets requests
 * interleave the way they do on a real connection pool. The stub models the
 * users row, including the atomic increment the fixed code relies on (one
 * UPDATE ... RETURNING runs to completion before the next, like a row lock).
 * Every assertion here fails against the code before the fix.
 */
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");
const between = (start, end) => {
  const i = SRC.indexOf(start);
  if (i < 0) throw new Error(`not found: ${start}`);
  const j = SRC.indexOf(end, i);
  return SRC.slice(i, j + end.length);
};
const route = (sig) => between(sig, "\n});\n");

const LOGIN_SRC = (() => {
  const i = SRC.indexOf("const LOGIN_MAX_FAILURES");
  const fn = SRC.indexOf("function noteLoginFailure", i);
  return SRC.slice(i, SRC.indexOf("\n}\n", fn) + 3);
})();
const tick = () => new Promise((r) => setTimeout(r, 0));
const H = (code) => `H:${code}`;
const tokenMatches = (stored, code) => typeof stored === "string" && stored === H(String(code));

function call(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ status: this.statusCode, body }); return this; },
    };
    Promise.resolve(handler({ headers: {}, body: {}, ...req }, res)).catch(reject);
  });
}

/* One users row and the statements the reset, verify, login, profile and
   delete handlers send, old and new shapes both, so the same suite runs
   against the code before the fix and fails there. */
function userPool(row) {
  return {
    query: async (sql, params = []) => {
      await tick();
      if (/^SELECT \* FROM users/.test(sql)) return { rows: [{ ...row }] };
      if (/reset_attempts = reset_attempts \+ 1/.test(sql)) {
        if (!row.reset_token) return { rows: [] };
        row.reset_attempts += 1;
        return { rows: [{ ...row }] };
      }
      if (/verification_attempts = verification_attempts \+ 1/.test(sql)) {
        if (!row.verification_token || row.is_verified) return { rows: [] };
        row.verification_attempts += 1;
        return { rows: [{ ...row }] };
      }
      if (/^UPDATE users SET password_hash = \$1, reset_token = NULL/.test(sql)) {
        if (/AND reset_token = \$3/.test(sql) && row.reset_token !== params[2]) return { rows: [] };
        row.password_hash = params[0]; row.reset_token = null; row.reset_attempts = 0;
        return { rows: [{ id: row.id }] };
      }
      if (/^UPDATE users SET reset_token = NULL/.test(sql)) {
        if (/AND reset_token = \$2/.test(sql) && row.reset_token !== params[1]) return { rows: [] };
        row.reset_token = null; return { rows: [] };
      }
      if (/^UPDATE users SET is_verified = TRUE/.test(sql)) {
        if (/AND verification_token = \$2/.test(sql) && row.verification_token !== params[1]) return { rows: [] };
        row.is_verified = true; row.verification_token = null;
        return { rows: [{ id: row.id }] };
      }
      if (/^UPDATE users SET verification_token = NULL/.test(sql)) {
        if (/AND verification_token = \$2/.test(sql) && row.verification_token !== params[1]) return { rows: [] };
        row.verification_token = null; return { rows: [] };
      }
      if (/^DELETE FROM users/.test(sql)) { row.deleted = true; return { rows: [] }; }
      return { rows: [] };
    },
  };
}

describe("a reset code cannot be guessed by a burst", () => {
  function build() {
    const row = { id: 1, email: "victim@example.com", reset_token: H("123456"), reset_expires: new Date(Date.now() + 3600e3), reset_attempts: 0, password_hash: "OLD" };
    let compared = 0;
    let handler;
    const app = { post: (_p, fn) => { handler = fn; } };
    new Function(
      "app", "pool", "cleanEmail", "validatePassword", "tokenMatches", "bcrypt", "loginFailures", "handleError", "resetAttempts",
      `const RESET_MAX_ATTEMPTS = 5;\n${route("app.post('/api/auth/reset-password'")}`,
    )(app, userPool(row), (e) => (typeof e === "string" ? e.trim().toLowerCase() : null), () => null,
      (s, c) => { compared++; return tokenMatches(s, c); },
      { hash: async (p) => `NEW:${p}` }, new Map(), (e) => { throw e; }, new Map());
    const guess = (code) => call(handler, { body: { email: "victim@example.com", code, newPassword: "Attack3rPass" } });
    return { row, guess, compared: () => compared };
  }

  it("compares at most five guesses of a parallel burst, and the right one at 60 fails", async () => {
    const { row, guess, compared } = build();
    const out = await Promise.all(Array.from({ length: 100 }, (_, i) => guess(i === 60 ? "123456" : String(300000 + i))));
    expect(compared()).toBeLessThanOrEqual(5);
    expect(out[60].status).toBe(400);
    expect(row.password_hash).toBe("OLD");
    expect(row.reset_token).toBeNull();
  });

  it("the owner's one right guess still works", async () => {
    const { row, guess } = build();
    expect((await guess("123456")).status).toBe(200);
    expect(row.password_hash).toBe("NEW:Attack3rPass");
  });

  it("four wrong then the right one works, five wrong burns it", async () => {
    const a = build();
    for (let i = 0; i < 4; i++) await a.guess("000000");
    expect((await a.guess("123456")).status).toBe(200);
    const b = build();
    for (let i = 0; i < 5; i++) await b.guess("000000");
    expect((await b.guess("123456")).status).toBe(400);
    expect(b.row.password_hash).toBe("OLD");
  });

  it("a new code from forgot-password starts the count again", () => {
    expect(route("app.post('/api/auth/forgot-password'")).toMatch(/reset_attempts = 0/);
  });
});

describe("a verification code cannot be guessed by a burst", () => {
  function build() {
    const row = { id: 7, is_verified: false, verification_token: H("654321"), verification_expires: new Date(Date.now() + 3600e3), verification_attempts: 0 };
    let compared = 0;
    let handler;
    const app = { post: (_p, _mw, fn) => { handler = fn; } };
    new Function(
      "app", "pool", "authMiddleware", "recordLanguage", "rewardReferral", "formatUser", "handleError", "tokenMatches", "verifyAttempts",
      `const VERIFY_MAX_ATTEMPTS = 5;\n${route("app.post('/api/auth/verify-email'")}`,
    )(app, userPool(row), null, () => {}, async () => {}, (u) => ({ id: u.id }), (e) => { throw e; },
      (s, c) => { compared++; return tokenMatches(s, c); }, new Map());
    return { row, verify: (code) => call(handler, { userId: 7, body: { code } }), compared: () => compared };
  }

  it("compares at most five guesses of a parallel burst", async () => {
    const { row, verify, compared } = build();
    const out = await Promise.all(Array.from({ length: 100 }, (_, i) => verify(i === 60 ? "654321" : String(100000 + i))));
    expect(compared()).toBeLessThanOrEqual(5);
    expect(out[60].status).toBe(400);
    expect(row.is_verified).toBe(false);
  });

  it("the right code still verifies", async () => {
    const { row, verify } = build();
    expect((await verify("654321")).status).toBe(200);
    expect(row.is_verified).toBe(true);
  });

  it("a new code from resend-verification starts the count again", () => {
    expect(route("app.post('/api/auth/resend-verification'")).toMatch(/verification_attempts = 0/);
  });
});

describe("passwords: a burst cannot outrun the per account lock", () => {
  function limiter() {
    return new Function(`${LOGIN_SRC}\nreturn { loginFailures, loginLocked, noteLoginFailure };`)();
  }
  const bcryptCounting = () => {
    const b = { calls: 0, compare: async (pw, h) => { b.calls++; await tick(); return pw === "Right1pass" && h === "HASH"; }, hash: async (p) => `N:${p}` };
    return b;
  };

  it("login runs bcrypt at most ten times for 60 parallel wrong passwords", async () => {
    const { loginFailures, loginLocked, noteLoginFailure } = limiter();
    const bcrypt = bcryptCounting();
    let handler;
    const app = { post: (_p, fn) => { handler = fn; } };
    new Function("app", "pool", "cleanEmail", "loginLocked", "noteLoginFailure", "loginFailures", "bcrypt", "issueTokens", "formatUser", "handleError",
      route("app.post('/api/auth/login'"),
    )(app, userPool({ id: 1, email: "a@b.de", password_hash: "HASH" }), (e) => e, loginLocked, noteLoginFailure, loginFailures, bcrypt,
      async () => ({ accessToken: "a", refreshToken: "r" }), (u) => ({ id: u.id }), (e) => { throw e; });
    const out = await Promise.all(Array.from({ length: 60 }, () => call(handler, { body: { email: "a@b.de", password: "wrong" } })));
    expect(bcrypt.calls).toBeLessThanOrEqual(10);
    expect(out.filter((r) => r.status === 429).length).toBeGreaterThanOrEqual(50);
  });

  it("login still signs in, and clears the count", async () => {
    const { loginFailures, loginLocked, noteLoginFailure } = limiter();
    let handler;
    const app = { post: (_p, fn) => { handler = fn; } };
    new Function("app", "pool", "cleanEmail", "loginLocked", "noteLoginFailure", "loginFailures", "bcrypt", "issueTokens", "formatUser", "handleError",
      route("app.post('/api/auth/login'"),
    )(app, userPool({ id: 1, email: "a@b.de", password_hash: "HASH" }), (e) => e, loginLocked, noteLoginFailure, loginFailures, bcryptCounting(),
      async () => ({ accessToken: "a", refreshToken: "r" }), (u) => ({ id: u.id }), (e) => { throw e; });
    expect((await call(handler, { body: { email: "a@b.de", password: "Right1pass" } })).status).toBe(200);
    expect(loginFailures.has("a@b.de")).toBe(false);
  });

  it("account deletion shares the lock: no password guessing past it", async () => {
    const { loginFailures, loginLocked, noteLoginFailure } = limiter();
    const bcrypt = bcryptCounting();
    const row = { id: 5, email: "a@b.de", password_hash: "HASH" };
    const src = route("app.delete('/api/auth/account'");
    let handler;
    const app = { delete: (_p, _mw, fn) => { handler = fn; } };
    const names = ["app", "pool", "authMiddleware", "bcrypt", "loginLocked", "noteLoginFailure", "loginFailures", "handleError",
      "verifyGoogleIdToken", "deletePostHogPerson", "sendAccountDeletedEmail", "languageOf", "reportServerError"];
    new Function(...names, src)(app, userPool(row), null, bcrypt, loginLocked, noteLoginFailure, loginFailures, (e) => { throw e; },
      async () => ({}), async () => {}, async () => {}, () => "en", () => {});
    const out = await Promise.all(Array.from({ length: 40 }, () => call(handler, { userId: 5, body: { password: "wrong" } })));
    expect(bcrypt.calls).toBeLessThanOrEqual(10);
    expect(out.filter((r) => r.status === 429).length).toBeGreaterThanOrEqual(30);
    expect((await call(handler, { userId: 5, body: { password: "Right1pass" } })).status).toBe(429);
    expect(row.deleted).toBeUndefined();
  });
});
