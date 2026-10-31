/* Security audit, 2026-10-24, after Railway's 21 October disclosure.

   Three things, each driven against the real handler lifted out of server.js:
     1. The email verification code had no per ACCOUNT guess limit, only the per
        IP codeLimiter, so a guesser on many addresses had 24 hours at a six
        digit code. Verifying an address you do not own is what lets a squatted
        password survive the owner's later Google sign in. Five wrong guesses
        now burn it, as reset-password already did.
     2. Changing the password left the old refresh token valid for its 90 days.
        It now rotates the session and hands this device the new pair.
     3. The CSV export's formula guard missed a leading tab or carriage return. */

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function handlerFrom(start) {
  const a = SRC.indexOf(start);
  if (a < 0) throw new Error(`not found: ${start}`);
  return SRC.slice(a, SRC.indexOf("\n});\n", a) + 4);
}

function call(handler, req) {
  return new Promise((resolve, reject) => {
    let status = 200;
    const res = {
      status(c) { status = c; return this; },
      json(body) { resolve({ status, body }); return this; },
    };
    Promise.resolve(handler({ headers: {}, ...req }, res)).catch(reject);
  });
}

describe("verification code guesses count against the account", () => {
  function build() {
    const user = { id: 7, is_verified: false, verification_token: "H:123456", verification_expires: new Date(Date.now() + 3600e3) };
    const writes = [];
    const pool = {
      query: async (sql, params) => {
        if (/^SELECT \* FROM users/.test(sql)) return { rows: [{ ...user }] };
        writes.push(sql);
        if (/verification_token = NULL/.test(sql)) user.verification_token = null;
        if (/is_verified = TRUE/.test(sql)) user.is_verified = true;
        return { rows: [] };
      },
    };
    let handler;
    const app = { post: (_p, _mw, fn) => { handler = fn; } };
    const src = `const VERIFY_MAX_ATTEMPTS = 5;\nconst verifyAttempts = new Map();\n${handlerFrom("app.post('/api/auth/verify-email'")}`;
    new Function(
      "app", "pool", "authMiddleware", "recordLanguage", "rewardReferral", "formatUser", "handleError", "tokenMatches",
      src,
    )(app, pool, null, () => {}, async () => {}, (u) => ({ id: u.id }), (e) => { throw e; },
      (stored, code) => stored === `H:${code}`);
    return { verify: (code) => call(handler, { userId: 7, body: { code } }), user, writes };
  }

  it("the right code still verifies", async () => {
    const { verify, user } = build();
    expect((await verify("123456")).status).toBe(200);
    expect(user.is_verified).toBe(true);
  });

  it("five wrong guesses burn the code, so the right one no longer works", async () => {
    const { verify, user } = build();
    for (let i = 0; i < 5; i++) expect((await verify("000000")).status).toBe(400);
    expect(user.verification_token).toBeNull();
    const after = await verify("123456");
    expect(after.status).toBe(400);
    expect(after.body.error).toBe("Code expired. Request a new one.");
    expect(user.is_verified).toBe(false);
  });

  it("four wrong guesses do not", async () => {
    const { verify, user } = build();
    for (let i = 0; i < 4; i++) await verify("000000");
    expect((await verify("123456")).status).toBe(200);
    expect(user.is_verified).toBe(true);
  });

  it("asking for a new code clears the count", () => {
    const resend = handlerFrom("app.post('/api/auth/resend-verification'");
    expect(resend).toMatch(/verifyAttempts\.delete\(user\.id\)/);
  });
});

describe("a password change rotates the session", () => {
  function build() {
    const user = { id: 3, email: "a@example.com", password_hash: "OLD" };
    let rotated = 0;
    const pool = { query: async (sql, params) => {
      if (/^UPDATE users SET password_hash/.test(sql)) user.password_hash = params[0];
      return { rows: [{ ...user }] };
    } };
    let handler;
    const app = { patch: (_p, _mw, fn) => { handler = fn; } };
    new Function(
      "app", "pool", "authMiddleware", "bcrypt", "validatePassword", "issueTokens", "loginFailures", "formatUser", "handleError",
      "loginLocked", "noteLoginFailure",
      handlerFrom("app.patch('/api/auth/profile'"),
    )(app, pool, null,
      { compare: async (pw, h) => h === "OLD" && pw === "Current1", hash: async (pw) => `NEW:${pw}` },
      () => null,
      async () => { rotated++; return { accessToken: "acc2", refreshToken: "ref2" }; },
      new Map(), (u) => ({ id: u.id }), (e) => { throw e; },
      () => false, () => {});
    return { patch: (body) => call(handler, { userId: 3, body }), rotated: () => rotated };
  }

  it("issues a new pair and returns it", async () => {
    const { patch, rotated } = build();
    const r = await patch({ currentPassword: "Current1", newPassword: "Newpass12" });
    expect(r.status).toBe(200);
    expect(rotated()).toBe(1);
    expect(r.body.session).toEqual({ token: "acc2", refreshToken: "ref2" });
  });

  it("a name change does not touch the session and answers a plain user", async () => {
    const { patch, rotated } = build();
    const r = await patch({ name: "Ana" });
    expect(rotated()).toBe(0);
    expect(r.body.session).toBeUndefined();
  });

  it("a wrong current password rotates nothing", async () => {
    const { patch, rotated } = build();
    expect((await patch({ currentPassword: "nope", newPassword: "Newpass12" })).status).toBe(400);
    expect(rotated()).toBe(0);
  });

  it("refuses a name over 80 characters, as registration does", async () => {
    const { patch } = build();
    expect((await patch({ name: "x".repeat(81) })).status).toBe(400);
  });

  it("the app stores the new pair, or this device would be signed out too", () => {
    const screen = fs.readFileSync(path.join(__dirname, "..", "app", "account-settings.tsx"), "utf8");
    expect(screen).toMatch(/setItemAsync\("auth_token", data\.session\.token\)/);
    expect(screen).toMatch(/setItemAsync\("refresh_token", data\.session\.refreshToken\)/);
  });
});

describe("CSV formula guard", () => {
  const exportSrc = handlerFrom("app.get('/api/trpc/subscriptions.exportCsv'");
  const guard = exportSrc.match(/if \((\/\^\[[^\]]+\]\/)\.test\(str\)\)/);
  it("covers tab and carriage return as well as = + - @", () => {
    expect(guard).not.toBeNull();
    // eslint-disable-next-line no-eval
    const re = eval(guard[1]);
    for (const lead of ["=", "+", "-", "@", "\t", "\r"]) expect(re.test(`${lead}cmd`)).toBe(true);
    expect(re.test("Netflix")).toBe(false);
  });
});
