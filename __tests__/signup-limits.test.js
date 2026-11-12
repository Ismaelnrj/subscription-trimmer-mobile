/* SIGNUP LIMITS, 2026-11-12, from a security checklist the owner sent ("keys
   on the server, RLS on, check who owns each record, admin behind login,
   limits on signup, webhooks verified"). Five of the six were already in place
   and have their own suites (access-control-scan, revenuecat-webhook,
   login-rate-limit). This pins the sixth, where three gaps were real:

   1. register took ANY value as an email. Not a string and it threw (a 500
      and a Sentry event per request); any string at all became an account and
      was sent a verification email through Brevo.
   2. One address could be sent code emails without limit: emailLimiter is per
      IP, so forgot-password and resend-verification aimed at one inbox from
      rotated addresses were bounded by nothing.
   3. authLimiter alone allowed about 960 new accounts a day from one machine.

   Driven for real: the helpers and handlers are lifted out of server.js by
   string index and run against a stub pool, inside a `with` scope that
   supplies everything else the handlers reference. */

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function between(start, end) {
  const a = SRC.indexOf(start);
  const b = SRC.indexOf(end, a + 1);
  if (a < 0 || b < 0) throw new Error(`marker not found: ${start}`);
  return SRC.slice(a, b);
}

function handlerSource(route) {
  const a = SRC.indexOf(`app.post('${route}'`);
  if (a < 0) throw new Error(`route not found: ${route}`);
  return SRC.slice(a, SRC.indexOf("\n});\n", a) + 4);
}

const HELPERS = between("const EMAIL_MAX_LENGTH", "app.post('/api/auth/register'");
const VALIDATE_PASSWORD = between("function validatePassword(", "\n}\n") + "\n}\n";

function load(route, stubs) {
  let handler;
  const scope = Object.assign(Object.create(null), {
    app: { post: (_p, ...fns) => { handler = fns[fns.length - 1]; } },
    handleError: (err) => { throw err; },
    languageOf: () => "en",
    recordLanguage: () => {},
    generateCode: () => "123456",
    hashToken: (v) => `h:${v}`,
    ...stubs,
  });
  const exported = new Function("scope", `with (scope) {\n${HELPERS}\n${VALIDATE_PASSWORD}\n${handlerSource(route)}\nreturn { cleanEmail, isPlausibleEmail, takeCodeEmail, codeEmailsSent };\n}`)(scope);
  async function call(body, extra = {}) {
    let status = 200;
    let out;
    const res = { status(c) { status = c; return this; }, json(b) { out = b; return this; } };
    await handler({ body, headers: {}, ...extra }, res);
    return { status, body: out };
  }
  return { call, ...exported };
}

function registerHarness({ existing = false } = {}) {
  const queries = [];
  const sent = [];
  const h = load("/api/auth/register", {
    pool: {
      query: async (sql, params) => {
        queries.push(sql);
        if (/SELECT id FROM users WHERE email/.test(sql)) return { rows: existing ? [{ id: 1 }] : [] };
        if (/INSERT INTO users/.test(sql)) return { rows: [{ id: 7, email: params[1] }] };
        return { rows: [] };
      },
    },
    bcrypt: { hash: async () => "HASH" },
    generateOpenId: () => "u_1",
    trialValuesSql: () => "NULL, NULL",
    PREMIUM_TRIAL_DAYS: 14,
    assignReferralCode: async () => "ABC",
    NOTIFICATION_TEXT: { en: { welcomeTitle: "t", welcomeBody: "b" } },
    sendVerificationEmail: async (to) => { sent.push(to); },
    issueTokens: async () => ({ accessToken: "a", refreshToken: "r" }),
    formatUser: (u) => ({ id: u.id, email: u.email }),
  });
  return { ...h, queries, sent };
}

const GOOD_PASSWORD = "Abcdefg1";

describe("email addresses are checked before an account exists", () => {
  const { cleanEmail, isPlausibleEmail } = registerHarness();

  it("cleans a real address and refuses anything that is not a string", () => {
    expect(cleanEmail("  Ana@Example.COM ")).toBe("ana@example.com");
    for (const bad of [12345, { $gt: "" }, ["a@b.de"], null, undefined, true, ""]) {
      expect(cleanEmail(bad)).toBeNull();
    }
  });

  it("refuses an address longer than any real one can be", () => {
    expect(cleanEmail(`${"a".repeat(250)}@b.de`)).toBeNull();
    expect(cleanEmail(`${"a".repeat(60)}@example.com`)).not.toBeNull();
  });

  it("accepts ordinary addresses and refuses ones no mail can reach", () => {
    for (const ok of ["a@b.co", "first.last+trimio@mail.example.co.uk", "max@müller.de"]) {
      expect(isPlausibleEmail(ok)).toBe(true);
    }
    for (const bad of ["not-an-email", "a@b", "a b@c.de", "@c.de", "a@@c.de", "a@c..de", "a@c.de.", "a@.de"]) {
      expect(isPlausibleEmail(bad)).toBe(false);
    }
  });
});

describe("register", () => {
  it("answers 400, not a crash, for an email that is not a string", async () => {
    const h = registerHarness();
    const r = await h.call({ email: { $ne: null }, password: GOOD_PASSWORD });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("Please enter a valid email address");
    expect(h.queries.some((q) => /INSERT INTO users/.test(q))).toBe(false);
  });

  it("creates no account and sends no email for an address no mail can reach", async () => {
    const h = registerHarness();
    for (const email of ["nope", "x@localhost", `${"a".repeat(300)}@b.de`]) {
      const r = await h.call({ email, password: GOOD_PASSWORD });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("Please enter a valid email address");
    }
    expect(h.queries.some((q) => /INSERT INTO users/.test(q))).toBe(false);
    expect(h.sent).toEqual([]);
  });

  it("answers 400, not a crash, for a password that is not a string", async () => {
    const h = registerHarness();
    const r = await h.call({ email: "ana@example.com", password: 123456789 });
    expect(r.status).toBe(400);
    expect(h.queries.some((q) => /INSERT INTO users/.test(q))).toBe(false);
  });

  it("still creates an ordinary account and sends its code", async () => {
    const h = registerHarness();
    const r = await h.call({ email: " Ana@Example.com", password: GOOD_PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe("ana@example.com");
    expect(h.sent).toEqual(["ana@example.com"]);
  });
});

function forgotHarness() {
  const queries = [];
  const sent = [];
  const h = load("/api/auth/forgot-password", {
    pool: {
      query: async (sql, params) => {
        queries.push(sql);
        if (/SELECT \* FROM users WHERE email/.test(sql)) {
          return { rows: params[0] === "owner@example.com" || params[0] === "other@example.com" ? [{ id: 1, email: params[0] }] : [] };
        }
        return { rows: [] };
      },
    },
    resetAttempts: new Map(),
    sendPasswordResetEmail: async (to) => { sent.push(to); },
  });
  return { ...h, queries, sent };
}

describe("forgot-password", () => {
  it("answers 400, not a crash, for an email that is not a string", async () => {
    const h = forgotHarness();
    const r = await h.call({ email: ["owner@example.com"] });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("Email required");
  });

  it("sends at most five codes an hour to one address, wherever the requests come from", async () => {
    const h = forgotHarness();
    for (let i = 0; i < 8; i++) {
      const r = await h.call({ email: "owner@example.com" });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ success: true });
    }
    expect(h.sent).toHaveLength(5);
  });

  it("past the cap it does not rotate the code the real owner may be holding", async () => {
    const h = forgotHarness();
    for (let i = 0; i < 5; i++) await h.call({ email: "owner@example.com" });
    const before = h.queries.filter((q) => /UPDATE users SET reset_token/.test(q)).length;
    await h.call({ email: "owner@example.com" });
    expect(h.queries.filter((q) => /UPDATE users SET reset_token/.test(q)).length).toBe(before);
  });

  it("one address reaching the cap does not stop another", async () => {
    const h = forgotHarness();
    for (let i = 0; i < 6; i++) await h.call({ email: "owner@example.com" });
    await h.call({ email: "other@example.com" });
    expect(h.sent.filter((e) => e === "other@example.com")).toHaveLength(1);
  });

  it("the window passes and codes can be sent again", () => {
    const { takeCodeEmail } = forgotHarness();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(takeCodeEmail("a@b.de", t0)).toBe(true);
    expect(takeCodeEmail("a@b.de", t0 + 1000)).toBe(false);
    expect(takeCodeEmail("a@b.de", t0 + 60 * 60 * 1000)).toBe(true);
  });
});

describe("resend-verification", () => {
  function harness() {
    const queries = [];
    const sent = [];
    const h = load("/api/auth/resend-verification", {
      authMiddleware: () => {},
      verifyAttempts: new Map(),
      pool: {
        query: async (sql) => {
          queries.push(sql);
          if (/SELECT \* FROM users WHERE id/.test(sql)) return { rows: [{ id: 3, email: "victim@example.com", is_verified: false }] };
          return { rows: [] };
        },
      },
      sendVerificationEmail: async (to) => { sent.push(to); },
    });
    return { ...h, queries, sent };
  }

  it("refuses the sixth code in an hour with the hourly 429, and rotates nothing", async () => {
    const h = harness();
    for (let i = 0; i < 5; i++) expect((await h.call({}, { userId: 3 })).status).toBe(200);
    const updates = h.queries.filter((q) => /UPDATE users SET verification_token/.test(q)).length;
    const r = await h.call({}, { userId: 3 });
    expect(r.status).toBe(429);
    expect(r.body.error).toBe("Too many requests. Please try again in an hour.");
    expect(h.sent).toHaveLength(5);
    expect(h.queries.filter((q) => /UPDATE users SET verification_token/.test(q)).length).toBe(updates);
  });
});

describe("login and reset take the same type guard", () => {
  it("login answers 400, not a crash, for a value that is not a string", async () => {
    const helpers = between("const LOGIN_MAX_FAILURES", "app.post('/api/auth/login'");
    let handler;
    const scope = Object.assign(Object.create(null), {
      app: { post: (_p, fn) => { handler = fn; } },
      pool: { query: async () => ({ rows: [] }) },
      bcrypt: { compare: async () => false },
      handleError: (err) => { throw err; },
    });
    new Function("scope", `with (scope) {\n${HELPERS}\n${helpers}\n${handlerSource("/api/auth/login")}\n}`)(scope);
    for (const body of [{ email: 42, password: "x" }, { email: "a@b.de", password: { $gt: "" } }]) {
      let status;
      let out;
      const res = { status(c) { status = c; return this; }, json(b) { out = b; return this; } };
      await handler({ body }, res);
      expect(status).toBe(400);
      expect(out.error).toBe("Email and password required");
    }
  });

  it("reset-password reads the email through the same cleaner", () => {
    expect(handlerSource("/api/auth/reset-password")).toMatch(/const email = cleanEmail\(req\.body\.email\)/);
  });

  it("validatePassword refuses a value that is not a string", () => {
    const validatePassword = new Function(`${VALIDATE_PASSWORD}\nreturn validatePassword;`)();
    expect(validatePassword(123456789)).toBe("Password must be at least 8 characters.");
    expect(validatePassword(["Abcdefg1"])).toBe("Password must be at least 8 characters.");
  });
});

describe("new accounts per IP per day", () => {
  const block = between("const signupLimiter = rateLimit(", "});");

  it("is a daily window that counts only accounts actually created", () => {
    expect(block).toMatch(/windowMs:\s*24 \* 60 \* 60 \* 1000/);
    expect(block).toMatch(/skipFailedRequests:\s*true/);
    const max = Number(block.match(/max:\s*(\d+)/)[1]);
    expect(max).toBeGreaterThanOrEqual(10);
    expect(max).toBeLessThanOrEqual(100);
  });

  it("is mounted on register, beside authLimiter rather than instead of it", () => {
    expect(SRC).toMatch(/app\.use\('\/api\/auth\/register', signupLimiter\);/);
    expect(SRC).toMatch(/app\.use\('\/api\/auth\/register', authLimiter\);/);
  });
});

describe("the new refusals read right on both sides", () => {
  const NEW = [
    "Please enter a valid email address",
    "Too many new accounts from this network today. Please try again tomorrow.",
  ];
  const table = between("const ERROR_TEXT_DE = {", "\n};");

  it.each(NEW)("has a German version: %s", (msg) => {
    expect(table).toContain(`'${msg}':`);
  });

  /* app/register.tsx shows its own "already registered" line for any server
     error containing "already", so a new refusal must not contain it. */
  it.each(NEW)("does not trip the app's 'already' check: %s", (msg) => {
    expect(msg.toLowerCase()).not.toContain("already");
  });
});

describe("referrals.redeem", () => {
  it("answers 400, not a crash, for a code that is not a string", async () => {
    const h = load("/api/trpc/referrals.redeem", { authMiddleware: () => {}, pool: { query: async () => ({ rows: [] }) } });
    const r = await h.call({ code: 7 }, { userId: 1 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("Referral code required");
  });
});
