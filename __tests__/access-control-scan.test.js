/* ACCESS CONTROL, AS A SCAN RATHER THAN AN AUDIT. Added 2026-10-12, after a
   manual audit of every route found nothing failing but two places that were
   safe only because of the line above them. An audit is a moment; this runs on
   every push and covers routes nobody has written yet.

   It reads backend/server.js and holds four rules:
     1. Every /api route requires authMiddleware, unless it is on PUBLIC below
        with the reason it may be open. A new route that forgets the middleware
        fails here, not in production.
     2. On a signed in route, every query touching a table that holds user data
        passes req.userId as a parameter, so the row is chosen by the verified
        token. The few that legitimately use another id (one already proven to
        belong to the caller) are on DERIVED below, each with its reason.
     3. Nothing anywhere reads a user id out of the request body, query string
        or URL.
     4. The public routes that act on user data check their secret in constant
        time.
   Both allowlists must stay true: an entry that no longer matches anything
   fails too, so they cannot quietly grow stale.

   Negative tested on 2026-10-12 against the code it exists to catch: restoring
   the old setCancelled re-read (id only), removing authMiddleware from
   subscriptions.list, and adding `req.body.userId` to a handler each produced
   a failure naming the route.

   Helper functions called with req.userId (recordLanguage, resolveCurrency,
   ...) are outside the route blocks and not scanned; they
   take the id as an argument and were read by hand in the same audit. */

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

const USER_TABLES = ["users", "subscriptions", "notifications", "price_history", "user_settings", "notification_preferences"];

// Open on purpose. Each needs its own guard, and rule 4 checks the ones that use a secret.
const PUBLIC = {
  "POST /api/auth/register": "creating an account, nobody is signed in yet (rate limited)",
  "POST /api/auth/login": "signing in, checked by password hash (rate limited)",
  "POST /api/auth/google": "Google ID token verified server side with the audience pinned",
  "POST /api/auth/refresh": "looked up by the hash of a random refresh token",
  "POST /api/auth/forgot-password": "sends a code to the address, reveals nothing (rate limited)",
  "POST /api/auth/reset-password": "emailed code, five attempts per account",
  "POST /api/webhooks/revenuecat": "RevenueCat, shared secret compared in constant time",
  "POST /api/trpc/reminders.sendEmailReminders": "cron-job.org, CRON_SECRET compared in constant time",
  "POST /api/trpc/reminders.sendWinBackEmails": "cron-job.org, CRON_SECRET compared in constant time",
  "GET /api/admin/funnel": "owner only, CRON_SECRET compared in constant time",
  "GET /api/trpc/appVersion.check": "returns the minimum app version, no user data",
  "GET /unsubscribe": "the HMAC in the link is the authorisation (RFC 8058)",
  "POST /unsubscribe": "the HMAC in the link is the authorisation (RFC 8058)",
};

// Signed in routes whose query is keyed by an id other than req.userId, where
// that id was loaded from a row the caller was already proven to own.
const DERIVED = {
  "POST /api/trpc/referrals.redeem :: SELECT id FROM users WHERE referral_code": "finds the inviter by code and reads only their id",
  "POST /api/trpc/referrals.redeem :: UPDATE users SET referred_by": "writes to `me`, loaded by req.userId above",
  "POST /api/auth/resend-verification :: UPDATE users SET verification_token": "writes to `user`, loaded by req.userId above",
  "GET /api/trpc/alerts.list :: UPDATE subscriptions SET next_billing_date = $1 WHERE id = $2": "ids come from this route's own query, filtered by req.userId",
  "GET /api/trpc/alerts.list :: UPDATE subscriptions SET next_billing_date = $1, billing_anchor_day": "ids come from this route's own query, filtered by req.userId",
};

// Read one string literal starting at i, honouring escapes. Returns [text, end].
function readString(s, i) {
  const q = s[i];
  let j = i + 1;
  while (j < s.length && s[j] !== q) j += s[j] === "\\" ? 2 : 1;
  return [s.slice(i + 1, j), j + 1];
}

// From an opening bracket, return the index after its partner, skipping strings.
// Counting brackets rather than matching them: this file has paid for [^)]
// regexes several times.
function balanced(s, i) {
  const open = s[i];
  const close = { "(": ")", "[": "]", "{": "}" }[open];
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    // Comments first: an apostrophe in "RevenueCat's" inside a comment would
    // otherwise open a string and swallow the next route into this one, which
    // is exactly what the first run of this scan did.
    if (c === "/" && s[j + 1] === "/") { const nl = s.indexOf("\n", j); j = nl < 0 ? s.length : nl; continue; }
    if (c === "/" && s[j + 1] === "*") { const e = s.indexOf("*/", j + 2); j = e < 0 ? s.length : e + 1; continue; }
    if (c === "'" || c === '"' || c === "`") { j = readString(s, j)[1] - 1; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j + 1;
  }
  return s.length;
}

function routes() {
  const out = [];
  const re = /^app\.(get|post|patch|put|delete)\('([^']+)'(.*)$/gm;
  let m;
  while ((m = re.exec(SRC))) {
    const start = m.index;
    const open = SRC.indexOf("(", start);
    const end = balanced(SRC, open);
    out.push({ key: `${m[1].toUpperCase()} ${m[2]}`, path: m[2], line: SRC.slice(0, start).split("\n").length, head: m[3], body: SRC.slice(start, end) });
  }
  return out;
}

function queries(body) {
  const out = [];
  const re = /\b(?:pool|client)\.query\(\s*/g;
  let m;
  while ((m = re.exec(body))) {
    let i = m.index + m[0].length;
    if (!"'\"`".includes(body[i])) continue;
    const [sql, after] = readString(body, i);
    let j = after;
    while (/\s|,/.test(body[j])) j++;
    const params = body[j] === "[" ? body.slice(j, balanced(body, j)) : "";
    out.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
  }
  return out;
}

const touchesUserTable = (sql) =>
  USER_TABLES.some((t) => new RegExp(`\\b(FROM|INTO|UPDATE|JOIN)\\s+${t}\\b`, "i").test(sql));

const ALL = routes();

describe("access control scan of backend/server.js", () => {
  it("cuts each route at its own end, never into the next one", () => {
    const leaks = ALL.filter((r) => /\napp\.(get|post|patch|put|delete|use)\(/.test(r.body)).map((r) => r.key);
    expect(leaks).toEqual([]);
  });

  it("finds the routes it is meant to scan", () => {
    // Guards the scan itself: a parser that finds nothing passes every rule.
    expect(ALL.filter((r) => r.path.startsWith("/api/")).length).toBeGreaterThan(30);
    const listed = ALL.find((r) => r.key === "GET /api/trpc/subscriptions.list");
    expect(listed && queries(listed.body).length).toBeGreaterThan(0);
  });

  it("every /api route requires authMiddleware unless it is listed as public", () => {
    const open = ALL.filter((r) => r.path.startsWith("/api/") && !/authMiddleware/.test(r.head) && !PUBLIC[r.key]);
    expect(open.map((r) => `${r.key} (server.js:${r.line}) has no authMiddleware`)).toEqual([]);
  });

  it("every signed in query on user data is chosen by req.userId", () => {
    const used = new Set();
    const bad = [];
    for (const r of ALL.filter((x) => /authMiddleware/.test(x.head))) {
      for (const q of queries(r.body)) {
        if (!touchesUserTable(q.sql)) continue;
        if (/req\.userId/.test(q.params)) continue;
        const hit = Object.keys(DERIVED).find((k) => {
          const [route, prefix] = k.split(" :: ");
          return route === r.key && q.sql.startsWith(prefix);
        });
        if (hit) { used.add(hit); continue; }
        bad.push(`${r.key} (server.js:${r.line}): "${q.sql.slice(0, 90)}" does not pass req.userId`);
      }
    }
    expect(bad).toEqual([]);
    // An allowlist entry that matches nothing is a lie waiting to be believed.
    expect(Object.keys(DERIVED).filter((k) => !used.has(k))).toEqual([]);
  });

  it("nothing reads a user id from the request", () => {
    const hits = SRC.split("\n")
      .map((l, i) => [l, i + 1])
      .filter(([l]) => /req\.(body|query|params)\??\.(userId|user_id|uid|ownerId)\b/.test(l) || /\{[^}]*\b(userId|user_id)\b[^}]*\}\s*=\s*req\.(body|query|params)/.test(l))
      .map(([l, n]) => `server.js:${n}: ${l.trim()}`);
    expect(hits).toEqual([]);
  });

  it("every public route listed still exists", () => {
    const keys = new Set(ALL.map((r) => r.key));
    // adminFunnel is mounted by reference rather than an inline handler.
    expect(Object.keys(PUBLIC).filter((k) => !keys.has(k))).toEqual([]);
  });

  it("the secret guarded public routes compare in constant time", () => {
    for (const key of ["POST /api/trpc/reminders.sendEmailReminders", "POST /api/trpc/reminders.sendWinBackEmails"]) {
      expect(ALL.find((r) => r.key === key).body).toMatch(/secretMatches\(/);
    }
    expect(ALL.find((r) => r.key === "POST /api/webhooks/revenuecat").body).toMatch(/timingSafeEqual\(/);
    const funnel = SRC.slice(SRC.indexOf("async function adminFunnel"), SRC.indexOf("app.get('/api/admin/funnel'"));
    expect(funnel).toMatch(/secretMatches\(req\.headers\['x-cron-secret'\]/);
    // Both unsubscribe routes go through applyUnsubscribe, which reads the user
    // id from the link (?u=) and acts only after the HMAC check passes.
    const apply = SRC.slice(SRC.indexOf("async function applyUnsubscribe"), SRC.indexOf("app.get('/unsubscribe'"));
    expect(apply.indexOf("timingSafeEqual(")).toBeGreaterThan(-1);
    expect(apply.indexOf("timingSafeEqual(")).toBeLessThan(apply.indexOf("pool.query("));
    for (const key of ["GET /unsubscribe", "POST /unsubscribe"]) {
      expect(ALL.find((r) => r.key === key).body).toMatch(/applyUnsubscribe\(req\)/);
    }
  });
});
