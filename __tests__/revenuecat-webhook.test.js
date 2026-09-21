/* Drives the REAL /api/webhooks/revenuecat handler out of backend/server.js
   against a stub pool and a stub RevenueCat.

   Behavioural rather than source-reading, unlike verify-premium.test.js, and
   deliberately so: the defect this exists for was a payload SHAPE mismatch. A
   TRANSFER event carries no app_user_id at all, so the handler answered 400 and
   returned before its own TRANSFER branch could run. Reading the source would
   have shown 'TRANSFER' sitting in GRANT_EVENTS and concluded it was handled.
   Only feeding it the real payload shows that it never was.

   The payload below is RevenueCat's own documented TRANSFER sample: identity in
   transferred_from / transferred_to, and no app_user_id, entitlement_ids or
   product_id anywhere in it. */

const fs = require("fs");
const path = require("path");

const SERVER = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function slice(startMarker, endMarker) {
  const i = SERVER.indexOf(startMarker);
  if (i === -1) throw new Error(`missing ${startMarker}`);
  const j = SERVER.indexOf(endMarker, i);
  if (j === -1) throw new Error(`missing end of ${startMarker}`);
  return SERVER.slice(i, j + endMarker.length);
}

const helperSrc = slice("async function reconcileEntitlementsFromRevenueCat", "\n}\n");
const handlerSrc = slice("app.post('/api/webhooks/revenuecat'", "\n});\n");

// ── stubs the evaluated handler closes over ──────────────────────────────────
let rows = [];
let rcEntitlement = {};
let brevo = [];
let dbCalls = 0;

const pool = {
  async query(sql, params) {
    dbCalls++;
    if (/SELECT open_id, email FROM users WHERE open_id = ANY/.test(sql)) {
      const found = rows
        .filter((u) => params[0].includes(u.open_id))
        .map((u) => ({ open_id: u.open_id, email: u.email }));
      return { rows: found, rowCount: found.length };
    }
    const openId = /UPDATE users SET cancelled_at = COALESCE/.test(sql) ? params[1] : params[1] ?? params[0];
    const user = rows.find((u) => u.open_id === openId);
    if (!user) return { rows: [], rowCount: 0 };
    if (/SET is_paid = \$1/.test(sql)) user.is_paid = params[0];
    else if (/SET is_paid = true/.test(sql)) user.is_paid = true;
    else if (/SET is_paid = false/.test(sql)) user.is_paid = false;
    else if (/SET cancelled_at = COALESCE/.test(sql)) user.cancelled_at = "set";
    else throw new Error(`unstubbed SQL: ${sql}`);
    return { rows: [{ email: user.email }], rowCount: 1 };
  },
};

function syncBrevoPlan(email, plan) { brevo.push([email, plan]); }
function getPlanTierFromProductId() { return "premium"; }
function handleError(err, res) { res.status(500).json({ error: "Internal server error", detail: err.message }); }

let REVENUECAT_SECRET_API_KEY = "rc-secret";

async function fetchPremiumEntitlementFromRevenueCat(openId) {
  if (rcEntitlement[openId] === "THROW") throw new Error("RevenueCat lookup failed with status 503");
  return rcEntitlement[openId] === true;
}

let handler;
const app = { post: (route, fn) => { handler = fn; } };

/* eslint-disable no-eval */
eval(helperSrc);
eval(handlerSrc);
/* eslint-enable no-eval */

const SECRET = "test-webhook-secret";

async function post(event, authorization = `Bearer ${SECRET}`) {
  brevo = [];
  dbCalls = 0;
  const logs = [];
  const real = { log: console.log, warn: console.warn, error: console.error };
  console.log = (m) => logs.push(m);
  console.warn = (m) => logs.push(m);
  console.error = (m) => logs.push(m);

  let status = 200;
  let payload = null;
  const res = {
    status(code) { status = code; return res; },
    json(body) { payload = body; return res; },
  };
  try {
    await handler({ body: { api_version: "1.0", event }, headers: { authorization } }, res);
  } finally {
    Object.assign(console, real);
  }
  return { status, payload, logs: logs.join("\n"), brevo, dbCalls };
}

beforeAll(() => { process.env.REVENUECAT_WEBHOOK_SECRET = SECRET; });
beforeEach(() => { rows = []; rcEntitlement = {}; });

/* RevenueCat's documented TRANSFER sample. Note what is NOT in it. */
const TRANSFER_EVENT = {
  app_id: "1234567890",
  event_timestamp_ms: 1758000000000,
  id: "CD489E0E-5D52-4E03-966B-A7F17788E432",
  store: "PLAY_STORE",
  transferred_from: ["user-A"],
  transferred_to: ["user-B"],
  type: "TRANSFER",
  environment: "PRODUCTION",
};

describe("TRANSFER moves premium to whoever actually owns the purchase", () => {
  it("has no app_user_id, which is the whole reason it needs its own branch", () => {
    expect(TRANSFER_EVENT.app_user_id).toBeUndefined();
    expect(TRANSFER_EVENT.entitlement_ids).toBeUndefined();
  });

  it("grants the destination and revokes the source, both from a verified read", async () => {
    rows = [
      { open_id: "user-A", email: "a@example.com", is_paid: true },
      { open_id: "user-B", email: "b@example.com", is_paid: false },
    ];
    rcEntitlement = { "user-A": false, "user-B": true };

    const r = await post(TRANSFER_EVENT);

    expect(r.status).toBe(200);
    // Against the previous code this was 400 and both rows were left as they
    // were: the person who now owns the purchase saw a free account.
    expect(rows.find((u) => u.open_id === "user-A").is_paid).toBe(false);
    expect(rows.find((u) => u.open_id === "user-B").is_paid).toBe(true);
  });

  it("does not decide from the direction of the arrays", async () => {
    /* Same payload, opposite truth on RevenueCat's side. Anything that inferred
       "transferred_to gets it" would grant B here and be wrong. */
    rows = [
      { open_id: "user-A", email: "a@example.com", is_paid: false },
      { open_id: "user-B", email: "b@example.com", is_paid: false },
    ];
    rcEntitlement = { "user-A": true, "user-B": false };

    await post(TRANSFER_EVENT);

    expect(rows.find((u) => u.open_id === "user-A").is_paid).toBe(true);
    expect(rows.find((u) => u.open_id === "user-B").is_paid).toBe(false);
  });

  it("skips RevenueCat's anonymous ids without an API call", async () => {
    rows = [{ open_id: "user-B", email: "b@example.com", is_paid: false }];
    rcEntitlement = { "user-B": true };

    const r = await post({
      ...TRANSFER_EVENT,
      transferred_from: ["$RCAnonymousID:8a9b7c6d5e4f"],
    });

    expect(r.status).toBe(200);
    expect(rows[0].is_paid).toBe(true);
    expect(r.logs).toMatch(/1 unknown id\(s\) skipped/);
  });

  it("answers 500 and writes nothing when RevenueCat cannot be reached", async () => {
    /* So the delivery is retried. Guessing instead would cancel a paying
       customer because a third party had a bad afternoon. */
    rows = [{ open_id: "user-B", email: "b@example.com", is_paid: true }];
    rcEntitlement = { "user-B": "THROW" };

    const r = await post({ ...TRANSFER_EVENT, transferred_from: [] });

    expect(r.status).toBe(500);
    expect(rows[0].is_paid).toBe(true);
  });

  it("refuses with 503 rather than reporting success when the lookup key is unset", async () => {
    const saved = REVENUECAT_SECRET_API_KEY;
    REVENUECAT_SECRET_API_KEY = undefined;
    try {
      rows = [{ open_id: "user-B", email: "b@example.com", is_paid: false }];
      const r = await post(TRANSFER_EVENT);
      expect(r.status).toBe(503);
      expect(rows[0].is_paid).toBe(false);
    } finally {
      REVENUECAT_SECRET_API_KEY = saved;
    }
  });

  it("ignores a sandbox transfer instead of rejecting it", async () => {
    const r = await post({ ...TRANSFER_EVENT, environment: "SANDBOX" });
    expect(r.status).toBe(200);
    expect(r.dbCalls).toBe(0);
  });
});

describe("every path says what it did", () => {
  it("names a grant that matched no account, loudly", async () => {
    /* The worst thing this endpoint can do: somebody paid, nothing was
       written, and a 200 told RevenueCat it went fine. It used to log nothing
       at all, which made it unfindable. */
    rows = [{ open_id: "user-A", email: "a@example.com", is_paid: false }];

    const r = await post({
      type: "INITIAL_PURCHASE",
      environment: "PRODUCTION",
      app_user_id: "not-a-real-open-id",
      entitlement_ids: ["Trimio Premium"],
      product_id: "trimio_premium_monthly",
    });

    expect(r.logs).toMatch(/matched NO user/);
    expect(r.logs).toMatch(/premium was NOT granted/);
    expect(r.brevo).toEqual([]);
  });

  it("records an ordinary grant", async () => {
    rows = [{ open_id: "user-A", email: "a@example.com", is_paid: false }];

    const r = await post({
      type: "INITIAL_PURCHASE",
      environment: "PRODUCTION",
      app_user_id: "user-A",
      entitlement_ids: ["Trimio Premium"],
      product_id: "trimio_premium_monthly",
    });

    expect(rows[0].is_paid).toBe(true);
    expect(r.logs).toMatch(/granted premium to user-A/);
  });

  it("names an event it deliberately took no action on", async () => {
    /* BILLING_ISSUE is a grace period, not a loss of access. Logging the
       no-op is how an event type that SHOULD have acted becomes visible. */
    rows = [{ open_id: "user-A", email: "a@example.com", is_paid: true }];

    const r = await post({
      type: "BILLING_ISSUE",
      environment: "PRODUCTION",
      app_user_id: "user-A",
      entitlement_ids: ["Trimio Premium"],
    });

    expect(rows[0].is_paid).toBe(true);
    expect(r.logs).toMatch(/BILLING_ISSUE ignored/);
  });
});

describe("the guards that were already right stay right", () => {
  it("rejects a wrong bearer token", async () => {
    const r = await post(TRANSFER_EVENT, "Bearer wrong-secret");
    expect(r.status).toBe(401);
    expect(r.dbCalls).toBe(0);
  });

  it("never revokes premium for a different entitlement expiring", async () => {
    rows = [{ open_id: "user-A", email: "a@example.com", is_paid: true }];

    await post({
      type: "EXPIRATION",
      environment: "PRODUCTION",
      app_user_id: "user-A",
      entitlement_ids: ["Tips"],
    });

    expect(rows[0].is_paid).toBe(true);
  });

  it("still revokes on a real premium EXPIRATION", async () => {
    rows = [{ open_id: "user-A", email: "a@example.com", is_paid: true }];

    await post({
      type: "EXPIRATION",
      environment: "PRODUCTION",
      app_user_id: "user-A",
      entitlement_ids: ["Trimio Premium"],
    });

    expect(rows[0].is_paid).toBe(false);
  });

  it("keeps access on CANCELLATION, which only turns auto-renew off", async () => {
    rows = [{ open_id: "user-A", email: "a@example.com", is_paid: true }];

    await post({
      type: "CANCELLATION",
      environment: "PRODUCTION",
      app_user_id: "user-A",
      entitlement_ids: ["Trimio Premium"],
      product_id: "trimio_premium_monthly",
    });

    expect(rows[0].is_paid).toBe(true);
    expect(rows[0].cancelled_at).toBe("set");
  });
});
