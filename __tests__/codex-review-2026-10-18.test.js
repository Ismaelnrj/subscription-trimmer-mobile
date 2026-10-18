/*
 * Three findings from the Codex review of master at a578150b, 2026-10-18,
 * each driven against the REAL code lifted out of backend/server.js by string
 * index, on stub databases. Nothing is retyped.
 *
 *   1. Google claiming an unverified address dropped the stranger's password
 *      and refresh token, but the access token they already held kept reading
 *      the owner's data for up to an hour. Tokens minted for an unverified
 *      password now carry `unv`, and authMiddleware refuses one whose password
 *      is gone.
 *   2. The reminder email job never advanced a passed billing date, so a
 *      Premium user who stopped opening the app got one email and then none.
 *   3. A trial created without a billing date was billed one cycle from
 *      today, not when the trial ends.
 */
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");
const fn = (sig) => {
  const i = SRC.indexOf(sig);
  expect(i).toBeGreaterThan(-1);
  return SRC.slice(i, SRC.indexOf("\n}\n", i) + 2);
};
const between = (a, b) => {
  const i = SRC.indexOf(a);
  const j = SRC.indexOf(b, i);
  expect(i).toBeGreaterThan(-1);
  expect(j).toBeGreaterThan(i);
  return SRC.slice(i, j);
};

const SECRET = "test-secret-at-least-32-characters-long";
const jwt = {
  // A stand-in that keeps the claims readable, which is all these cases need.
  sign: (claims) => "T." + Buffer.from(JSON.stringify(claims)).toString("base64"),
  verify: (tok) => {
    if (!tok.startsWith("T.")) throw new Error("bad");
    return JSON.parse(Buffer.from(tok.slice(2), "base64").toString());
  },
};

describe("a session opened by an unverified registrant dies when Google claims the address", () => {
  function middleware(pool) {
    // eslint-disable-next-line no-new-func
    return new Function("jwt", "JWT_SECRET", "pool", fn("function authMiddleware(") + "; return authMiddleware;")(jwt, SECRET, pool);
  }
  function call(mw, token) {
    return new Promise((resolve) => {
      const res = { status(c) { this.code = c; return this; }, json() { resolve({ code: this.code }); return this; } };
      mw({ headers: { authorization: `Bearer ${token}` } }, res, () => resolve({ code: "next" }));
    });
  }

  it("refuses an unverified token whose password Google dropped", async () => {
    const mw = middleware({ query: async () => ({ rows: [{ has_password: false }] }) });
    expect(await call(mw, jwt.sign({ userId: 7, unv: true }))).toEqual({ code: 401 });
  });

  it("lets an unverified token through while its password still exists", async () => {
    const mw = middleware({ query: async () => ({ rows: [{ has_password: true }] }) });
    expect(await call(mw, jwt.sign({ userId: 7, unv: true }))).toEqual({ code: "next" });
  });

  it("refuses rather than guesses when the lookup fails", async () => {
    const mw = middleware({ query: async () => { throw new Error("db down"); } });
    expect(await call(mw, jwt.sign({ userId: 7, unv: true }))).toEqual({ code: 401 });
  });

  it("an ordinary verified token costs no database read", async () => {
    let reads = 0;
    const mw = middleware({ query: async () => { reads++; return { rows: [] }; } });
    expect(await call(mw, jwt.sign({ userId: 7 }))).toEqual({ code: "next" });
    expect(reads).toBe(0);
  });

  async function minted(row) {
    const pool = { query: async (sql) => (/SELECT is_verified/.test(sql) ? { rows: [row] } : { rows: [] }) };
    const crypto = require("crypto");
    // eslint-disable-next-line no-new-func
    const issueTokens = new Function(
      "jwt", "JWT_SECRET", "pool", "crypto", "hashToken", "ACCESS_TOKEN_EXPIRY", "REFRESH_TOKEN_EXPIRY_MS",
      fn("async function issueTokens(") + "; return issueTokens;"
    )(jwt, SECRET, pool, crypto, (x) => x, "1h", 1000);
    return jwt.verify((await issueTokens(7)).accessToken);
  }

  it("marks tokens for an unverified password account, and only those", async () => {
    expect((await minted({ is_verified: false, has_password: true })).unv).toBe(true);
    expect((await minted({ is_verified: true, has_password: true })).unv).toBeUndefined();
    expect((await minted({ is_verified: true, has_password: false })).unv).toBeUndefined();
  });

  it("the Google link still drops the unverified password the check relies on", () => {
    expect(SRC).toMatch(/is_verified = TRUE, password_hash = NULL, refresh_token_hash = NULL/);
  });
});

describe("the reminder email walks a passed billing date forward", () => {
  const RealDate = Date;
  const FROZEN = RealDate.parse("2026-10-14T12:00:00.000Z");
  class FrozenDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(FROZEN); else super(...a); }
    static now() { return FROZEN; }
  }
  async function run(row) {
    const writes = [];
    const sent = [];
    const pool = {
      async query(sql, params) {
        if (/FROM users u\s+JOIN notification_preferences/.test(sql)) {
          return { rows: [{ id: 1, email: "a@x.test", name: "A", language: "en", currency_symbol: "€" }] };
        }
        if (/FROM subscriptions/.test(sql)) return { rows: [{ ...row }] };
        if (/UPDATE subscriptions SET next_billing_date/.test(sql)) writes.push(params[0]);
        return { rows: [] };
      },
    };
    const handlers = {};
    const route = between("app.post('/api/trpc/reminders.sendEmailReminders'", "\n});\n") + "\n});\n";
    const consts = (sig) => { const i = SRC.indexOf(sig); return SRC.slice(i, SRC.indexOf("\n};\n", i) + 3); };
    // eslint-disable-next-line no-new-func
    new Function("app", "pool", "crypto", "sendEmail", "unsubscribeUrlFor", "handleError", "Date",
      [fn("function secretMatches("), fn("function escapeHtml("), fn("function addMonthsUTC("),
       fn("function advanceBillingDate("), fn("function startOfUtcDay("),
       consts("const EMAIL_FOOTER = {"), fn("function emailFooter("), consts("const REMINDER_EMAIL = {"),
       consts("const CYCLE_NOUN = {"), fn("function formatEmailDate("), fn("function formatEmailPrice("),
       route].join("\n")
    )({ post: (p, h) => { handlers[p] = h; } }, pool, require("crypto"),
      async (to, subject) => { sent.push(subject); return true; }, () => "u", (e) => { throw e; }, FrozenDate);
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "S";
    try {
      await handlers["/api/trpc/reminders.sendEmailReminders"](
        { headers: { "x-cron-secret": "S" } }, { status() { return this; }, json() { return this; } });
    } finally {
      process.env.CRON_SECRET = prev;
    }
    return { writes, sent };
  }
  const base = { id: 5, name: "Netflix", price: "15.99", currency: "EUR", billing_cycle: "monthly", billing_anchor_day: 16 };

  it("a date a month stale is advanced, written back and reminded", async () => {
    const { writes, sent } = await run({ ...base, next_billing_date: "2026-09-16T00:00:00.000Z" });
    expect(writes).toEqual(["2026-10-16T00:00:00.000Z"]);
    expect(sent.length).toBe(1);
  });

  it("a stale date that lands outside the window is advanced but not emailed", async () => {
    const { writes, sent } = await run({ ...base, billing_anchor_day: 30, next_billing_date: "2026-09-30T00:00:00.000Z" });
    expect(writes).toEqual(["2026-10-30T00:00:00.000Z"]);
    expect(sent.length).toBe(0);
  });

  it("a current date is neither rewritten nor sent twice for the same cycle", async () => {
    const { writes, sent } = await run({ ...base, next_billing_date: "2026-10-16T00:00:00.000Z", reminder_sent_for: "2026-10-16T00:00:00.000Z" });
    expect(writes).toEqual([]);
    expect(sent.length).toBe(0);
  });
});

describe("a trial without a billing date is first charged when it ends", () => {
  function firstBillingDate(body, todayIso = "2026-10-18T09:00:00.000Z") {
    const RealDate = Date;
    const FROZEN = RealDate.parse(todayIso);
    class FrozenDate extends RealDate {
      constructor(...a) { if (a.length === 0) super(FROZEN); else super(...a); }
      static now() { return FROZEN; }
    }
    const block = between("    let billingDate = nextBillingDate(billingCycle);", "    const userResult = await pool.query");
    // eslint-disable-next-line no-new-func
    return new Function("Date", "req", "res",
      [fn("function addMonthsUTC("), fn("function advanceBillingDate("), fn("function startOfUtcDay("),
       fn("function nextBillingDate("), fn("function parseCalendarDateStrict("),
       "const { billingCycle = 'monthly', trialEndDate, nextBillingDate: nextBillingDateInput } = req.body;",
       block, "return billingDate;"].join("\n")
    )(FrozenDate, { body }, { status() { return { json: () => "REFUSED" }; } });
  }

  it("uses the trial end date when no billing date is given", () => {
    expect(firstBillingDate({ trialEndDate: "2026-10-25" })).toBe("2026-10-25T00:00:00.000Z");
  });

  it("walks a trial that already ended to its next charge", () => {
    expect(firstBillingDate({ trialEndDate: "2026-09-25" })).toBe("2026-10-25T00:00:00.000Z");
  });

  it("a date the user typed always wins", () => {
    expect(firstBillingDate({ trialEndDate: "2026-10-25", nextBillingDate: "2026-11-01" })).toBe("2026-11-01T00:00:00.000Z");
  });

  it("without a trial the default is still one cycle from today", () => {
    expect(firstBillingDate({})).toBe("2026-11-18T00:00:00.000Z");
  });
});

/* Finding 5: Stats added raw prices across currencies while the dashboard
   converted them, so the same data read two ways on two screens. Source
   reading, because the screen is TypeScript; sumMixedInBase itself is pinned
   behaviourally in currency-convert.test.ts. */
describe("Stats converts each currency before adding, like the dashboard", () => {
  const A = fs.readFileSync(path.join(__dirname, "..", "app", "(tabs)", "analytics.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("the monthly total comes from the per currency parts", () => {
    expect(A).toMatch(/inBase\(summary\?\.monthlyByCurrency, summary\?\.monthlyTotal \?\? 0\)/);
  });

  it("each category is converted from its own parts", () => {
    expect(A).toMatch(/inBase\(summary\?\.categoryByCurrency\?\.\[cat\.category\], cat\.amount\)/);
  });

  it("each weekly bar adds converted prices, not raw ones", () => {
    expect(A).not.toMatch(/buckets\[weekIndex\] \+= sub\.price/);
    expect(A).toMatch(/buckets\[weekIndex\] \+= sumMixedInBase\(/);
  });

  it("a converted total is marked as an estimate", () => {
    expect(A).toMatch(/isMixedCurrency\(summary\?\.monthlyByCurrency, currency\.code\)/);
    expect(A).not.toMatch(/fmtC\(monthly\)|fmtC\(summary\?\.yearlyTotal/);
  });
});
