/* Drives the REAL subscriptions.setCancelled and subscriptions.cancelled
   handlers out of backend/server.js against a stub pool.

   BEHAVIOURAL RATHER THAN SOURCE-READING, and for this feature that is not a
   style preference. Cancelling writes a date, and a figure shown to the user is
   computed from that date, so the defects that matter here are arithmetic and
   ordering ones: a second cancel resetting the timestamp, the free-tier cap
   being counted with the wrong predicate, a yearly subscription credited for a
   charge that was never due. Reading the source shows a `cancelled_at IS NULL`
   in the query and concludes the cap is right; only running it with five
   cancelled rows shows whether a sixth can be added.

   THE HONESTY RULE UNDER TEST: what a cancellation saved you is the COUNT of
   charges that would have fallen between cancelling and today, never a monthly
   rate times an elapsed duration. The second invents charges that never
   happened, which is the phantom-dot defect in a place where it reads as money.
*/

const fs = require("fs");
const path = require("path");

const SERVER = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function slice(startMarker, endMarker, from) {
  const i = SERVER.indexOf(startMarker, from || 0);
  if (i === -1) throw new Error(`missing ${startMarker}`);
  const j = SERVER.indexOf(endMarker, i);
  if (j === -1) throw new Error(`missing end of ${startMarker}`);
  return SERVER.slice(i, j + endMarker.length);
}

/* The four date helpers, lifted whole rather than reimplemented. A stub of
   advanceBillingDate that is subtly wrong produces a confident wrong number,
   which this repo has already paid for once. */
const dateHelpers = SERVER.slice(
  SERVER.indexOf("function addMonthsUTC"),
  SERVER.indexOf("function toMonthly")
);
const avoidedSrc = slice("function chargesAvoidedSince", "\n}\n");
const roundSrc = slice("function roundToCents", "\n}\n");
const bonusSrc = slice("function hasBonusPremium", "\n}\n");
/* The REAL constant, lifted rather than stubbed with a number, so these tests
   run against the same parsing and clamping the server does. Stubbing `= 5`
   here would keep passing after somebody broke the env parsing. */
const freeLimitSrc = slice("const FREE_SUBSCRIPTION_LIMIT = (() => {", "})();");
const setCancelledSrc = slice("app.post('/api/trpc/subscriptions.setCancelled'", "\n});\n");
const listCancelledSrc = slice("app.get('/api/trpc/subscriptions.cancelled'", "\n});\n");

// ── stubs the evaluated handlers close over ──────────────────────────────────
let subs = [];
let user = { is_paid: false, email: "a@b.c", bonus_premium_until: null };
let brevoCalls = [];

const NOW = new Date("2026-09-22T12:00:00Z");

const pool = {
  async query(sql, params) {
    if (/SELECT id, cancelled_at FROM subscriptions WHERE id/.test(sql)) {
      const r = subs.filter((s) => s.id === params[0] && s.user_id === params[1]);
      return { rows: r.map((s) => ({ id: s.id, cancelled_at: s.cancelled_at })), rowCount: r.length };
    }
    if (/SELECT is_paid, bonus_premium_until FROM users/.test(sql)) {
      return { rows: [user], rowCount: 1 };
    }
    if (/SELECT email FROM users/.test(sql)) {
      return { rows: [{ email: user.email }], rowCount: 1 };
    }
    if (/SELECT COUNT\(\*\) as c FROM subscriptions/.test(sql)) {
      // The predicate under test. Counted from the SQL rather than assumed, so
      // dropping `cancelled_at IS NULL` from the handler changes this answer.
      const live = /cancelled_at IS NULL/.test(sql)
        ? subs.filter((s) => s.user_id === params[0] && s.cancelled_at == null)
        : subs.filter((s) => s.user_id === params[0]);
      return { rows: [{ c: String(live.length) }], rowCount: 1 };
    }
    if (/^UPDATE subscriptions SET /.test(sql.trim())) {
      const s = subs.find((x) => x.id === params[0] && x.user_id === params[1]);
      if (!s) return { rows: [], rowCount: 0 };
      /* APPLY EVERY COLUMN THE STATEMENT SETS, parsed from the SET clause, never
         just the one this test came to look at. The first version matched
         `SET cancelled_at = NOW()` and then assigned cancelled_at alone, so a
         statement that ALSO wrote `is_active = TRUE` was silently ignored and the
         assertion that cancelling leaves a paused row paused could not fail. A
         mutation test caught it: the defect was introduced and nothing went red.
         A stub that ignores half of what it is handed proves nothing about the
         half it drops. */
      const setClause = sql.trim().replace(/^UPDATE subscriptions SET /, "").split(/\s+WHERE\s+/)[0];
      for (const part of setClause.split(",")) {
        const [colRaw, valRaw] = part.split("=");
        if (!colRaw || valRaw === undefined) continue;
        const col = colRaw.trim();
        const val = valRaw.trim();
        if (val === "NOW()") s[col] = NOW.toISOString();
        else if (val === "NULL") s[col] = null;
        else if (val === "TRUE") s[col] = true;
        else if (val === "FALSE") s[col] = false;
        else throw new Error("stub cannot apply " + col + " = " + val);
      }
      return { rows: [s], rowCount: 1 };
    }
    if (/SELECT \* FROM subscriptions\s+WHERE user_id = \$1 AND cancelled_at IS NOT NULL/.test(sql)) {
      return { rows: subs.filter((s) => s.user_id === params[0] && s.cancelled_at != null), rowCount: 0 };
    }
    if (/SELECT \* FROM subscriptions WHERE id = \$1/.test(sql)) {
      const r = subs.filter((s) => s.id === params[0]);
      return { rows: r, rowCount: r.length };
    }
    throw new Error("unexpected SQL: " + sql.replace(/\s+/g, " ").slice(0, 90));
  },
};

const trpc = (data) => ({ result: { data } });
const formatSub = (s) => ({
  id: s.id, name: s.name, price: parseFloat(s.price), billingCycle: s.billing_cycle,
  currency: s.currency || null, isActive: s.is_active ?? true,
  cancelledAt: s.cancelled_at || null,
});
const handleError = (err, res) => res.status(500).json({ error: err.message });
const syncSubCountToBrevo = (u) => brevoCalls.push(["count", u]);
const syncNextRenewalToBrevo = (u) => brevoCalls.push(["renewal", u]);

const routes = {};
const app = {
  post: (p, _mw, h) => { routes[p] = h; },
  get: (p, _mw, h) => { routes[p] = h; },
};
const authMiddleware = null;

// eslint-disable-next-line no-eval
eval(dateHelpers + roundSrc + bonusSrc + freeLimitSrc + avoidedSrc + setCancelledSrc + listCancelledSrc);

function call(route, body) {
  let status = 200;
  let payload;
  const res = {
    status(c) { status = c; return this; },
    json(p) { payload = p; return this; },
  };
  return routes[route]({ userId: 1, body: body || {} }, res).then(() => ({ status, payload }));
}

function sub(over) {
  return {
    id: 1, user_id: 1, name: "Netflix", price: "15.99", billing_cycle: "monthly",
    billing_anchor_day: 24, currency: "EUR", is_active: true,
    next_billing_date: "2026-09-24T00:00:00Z", cancelled_at: null, ...over,
  };
}

beforeEach(() => {
  subs = [];
  user = { is_paid: false, email: "a@b.c", bonus_premium_until: null };
  brevoCalls = [];
});

describe("cancelling is a third state, not pause and not delete", () => {
  it("records the cancellation date and keeps the row", async () => {
    subs = [sub()];
    const { status, payload } = await call("/api/trpc/subscriptions.setCancelled", { id: 1, cancelled: true });
    expect(status).toBe(200);
    expect(payload.result.data.cancelledAt).not.toBeNull();
    expect(subs.length).toBe(1);
  });

  it("leaves is_active alone, so restoring a paused row comes back paused", async () => {
    /* Pause and cancel answer different questions. Clearing is_active on cancel
       would silently resume something the user had deliberately paused. */
    subs = [sub({ is_active: false })];
    await call("/api/trpc/subscriptions.setCancelled", { id: 1, cancelled: true });
    expect(subs[0].is_active).toBe(false);
    await call("/api/trpc/subscriptions.setCancelled", { id: 1, cancelled: false });
    expect(subs[0].is_active).toBe(false);
  });

  it("refuses a request that is not a boolean", async () => {
    subs = [sub()];
    const { status } = await call("/api/trpc/subscriptions.setCancelled", { id: 1 });
    expect(status).toBe(400);
  });

  it("404s on a row belonging to somebody else", async () => {
    subs = [sub({ user_id: 2 })];
    const { status } = await call("/api/trpc/subscriptions.setCancelled", { id: 1, cancelled: true });
    expect(status).toBe(404);
  });

  it("tells Brevo both the count and the next renewal changed", async () => {
    subs = [sub()];
    await call("/api/trpc/subscriptions.setCancelled", { id: 1, cancelled: true });
    expect(brevoCalls.map((c) => c[0]).sort()).toEqual(["count", "renewal"]);
  });
});

describe("a second cancel must not reset the date the total is measured from", () => {
  it("is idempotent, keeping the ORIGINAL cancellation date", async () => {
    /* The failure this prevents is silent and total: re-tapping the button, or a
       retried request on a flaky connection, would move cancelled_at to now and
       reset an accumulated figure to zero. */
    const original = "2026-06-20T00:00:00Z";
    subs = [sub({ cancelled_at: original })];
    const { status, payload } = await call("/api/trpc/subscriptions.setCancelled", { id: 1, cancelled: true });
    expect(status).toBe(200);
    expect(subs[0].cancelled_at).toBe(original);
    expect(payload.result.data.cancelledAt).toBe(original);
  });

  it("uncancelling something already live is a no-op rather than an error", async () => {
    subs = [sub()];
    const { status } = await call("/api/trpc/subscriptions.setCancelled", { id: 1, cancelled: false });
    expect(status).toBe(200);
    expect(subs[0].cancelled_at).toBeNull();
  });
});

describe("the free tier cap must not punish you for cancelling", () => {
  it("lets a free user add a sixth after cancelling one of five", async () => {
    /* THE LINE THAT DECIDES WHETHER THE FEATURE IS USABLE. A bare COUNT(*) means
       cancelling five things locks a free account out of adding anything, so the
       history it keeps becomes the thing blocking the user. */
    subs = [1, 2, 3, 4, 5].map((i) => sub({ id: i, cancelled_at: i === 1 ? NOW.toISOString() : null }));
    // four live rows, so restoring the cancelled one is allowed
    const { status } = await call("/api/trpc/subscriptions.setCancelled", { id: 1, cancelled: false });
    expect(status).toBe(200);
  });

  it("refuses to restore a sixth live row on a free account", async () => {
    /* Without this, the cap has a hole: cancel five, restore five, and a free
       account holds ten live rows having never been refused. */
    subs = [1, 2, 3, 4, 5].map((i) => sub({ id: i }));
    subs.push(sub({ id: 6, cancelled_at: NOW.toISOString() }));
    const { status, payload } = await call("/api/trpc/subscriptions.setCancelled", { id: 6, cancelled: false });
    expect(status).toBe(403);
    expect(payload.error).toBe("FREE_LIMIT_REACHED");
    expect(subs[5].cancelled_at).not.toBeNull();
  });

  it("uses the code an existing client already understands", async () => {
    // Not a new error string: old builds already render the upgrade prompt for
    // FREE_LIMIT_REACHED, so they handle this without an update.
    subs = [1, 2, 3, 4, 5].map((i) => sub({ id: i }));
    subs.push(sub({ id: 6, cancelled_at: NOW.toISOString() }));
    const { payload } = await call("/api/trpc/subscriptions.setCancelled", { id: 6, cancelled: false });
    expect(payload.error).toBe("FREE_LIMIT_REACHED");
  });

  it("does not cap a paid user", async () => {
    user = { is_paid: true, email: "a@b.c", bonus_premium_until: null };
    subs = [1, 2, 3, 4, 5, 6, 7].map((i) => sub({ id: i }));
    subs.push(sub({ id: 8, cancelled_at: NOW.toISOString() }));
    const { status } = await call("/api/trpc/subscriptions.setCancelled", { id: 8, cancelled: false });
    expect(status).toBe(200);
  });

  it("cancelling is never capped, only restoring", async () => {
    user = { is_paid: false, email: "a@b.c", bonus_premium_until: null };
    subs = [1, 2, 3, 4, 5].map((i) => sub({ id: i }));
    const { status } = await call("/api/trpc/subscriptions.setCancelled", { id: 3, cancelled: true });
    expect(status).toBe(200);
  });
});

describe("what a cancellation saved is a count of real charges", () => {
  async function avoided(over) {
    subs = [sub(over)];
    const { payload } = await call("/api/trpc/subscriptions.cancelled", {});
    return payload.result.data;
  }

  it("is zero on the day you cancel, because nothing has been avoided yet", async () => {
    const d = await avoided({ cancelled_at: "2026-09-22T00:00:00Z", next_billing_date: "2026-09-24T00:00:00Z" });
    expect(d.subscriptions[0].chargesAvoided).toBe(0);
    expect(d.subscriptions[0].amountAvoided).toBe(0);
  });

  it("counts three monthly charges after three months", async () => {
    const d = await avoided({ cancelled_at: "2026-06-20T00:00:00Z", next_billing_date: "2026-06-24T00:00:00Z" });
    expect(d.subscriptions[0].chargesAvoided).toBe(3);
    expect(d.subscriptions[0].amountAvoided).toBe(47.97);
  });

  it("A YEARLY SUBSCRIPTION CANCELLED THREE MONTHS AGO HAS SAVED NOTHING YET", async () => {
    /* The assertion this whole suite exists for. The tempting implementation,
       monthly rate times months elapsed, would report a quarter of the annual
       price here: money nobody could find on a statement, invented by the same
       reasoning that drew calendar dots for charges that never happen. */
    const d = await avoided({
      cancelled_at: "2026-06-20T00:00:00Z", next_billing_date: "2027-01-15T00:00:00Z",
      billing_cycle: "yearly", billing_anchor_day: 15, price: "139.00",
    });
    expect(d.subscriptions[0].chargesAvoided).toBe(0);
    expect(d.subscriptions[0].amountAvoided).toBe(0);
  });

  it("counts the yearly charge once it has actually passed", async () => {
    const d = await avoided({
      cancelled_at: "2025-07-10T00:00:00Z", next_billing_date: "2025-08-01T00:00:00Z",
      billing_cycle: "yearly", billing_anchor_day: 1, price: "139.00",
    });
    expect(d.subscriptions[0].chargesAvoided).toBe(2);
    expect(d.subscriptions[0].amountAvoided).toBe(278);
  });

  it("never credits a charge from BEFORE the cancellation", async () => {
    /* A PAUSED row is never advanced by alerts.list, so its anchor can be months
       stale by the time it is cancelled. Without the lower bound this would
       credit the user for money they really did pay. */
    const d = await avoided({ cancelled_at: "2026-09-01T00:00:00Z", next_billing_date: "2026-03-15T00:00:00Z",
                              billing_anchor_day: 15, price: "10.00" });
    expect(d.subscriptions[0].chargesAvoided).toBe(1);
  });

  it("reaches the band even when the anchor is years stale", async () => {
    /* Walking from the anchor one week at a time could spend the whole loop
       ceiling before arriving, and report zero for a count that is not zero. */
    const d = await avoided({ cancelled_at: "2026-07-22T00:00:00Z", next_billing_date: "2011-09-21T00:00:00Z",
                              billing_cycle: "weekly", billing_anchor_day: 21, price: "4.99" });
    expect(d.subscriptions[0].chargesAvoided).toBe(9);
  });

  it("returns zero rather than throwing with no billing date at all", async () => {
    const d = await avoided({ cancelled_at: "2026-06-01T00:00:00Z", next_billing_date: null });
    expect(d.subscriptions[0].chargesAvoided).toBe(0);
  });

  it("returns zero for a cancellation date in the future", async () => {
    const d = await avoided({ cancelled_at: "2026-12-01T00:00:00Z", next_billing_date: "2026-12-05T00:00:00Z" });
    expect(d.subscriptions[0].chargesAvoided).toBe(0);
  });

  it("does NOT compute a rate times a duration, and the source says so", async () => {
    /* Named because it is the one wrong implementation a later reader is most
       likely to reach for, being shorter and producing a bigger number.

       THE COMMENTS COME OUT FIRST, and the first draft of this did not do that
       and failed against correct code. The helper explains itself by naming
       toMonthly, the very function it must not use, so a raw search finds it in
       prose. That is the sixth time in this repo an assertion has matched a
       comment; block comments only, because stripping `//` to end of line eats
       a URL. */
    const code = avoidedSrc.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code.length).toBeLessThan(avoidedSrc.length);
    expect(code).not.toMatch(/monthsSince|toMonthly/);
    expect(code).not.toMatch(/\/\s*12/);
    expect(code).toMatch(/charges\+\+/);
  });
});

describe("totals group by currency rather than summing across them", () => {
  it("keeps two currencies apart instead of picking a rate", async () => {
    /* Adding 15.99 EUR to 9.99 USD needs a rate this endpoint has no business
       choosing. The client owns conversion and knows what the user is
       displaying, so one group per currency is the honest shape. */
    subs = [
      sub({ id: 1, currency: "EUR", price: "15.99", cancelled_at: "2026-06-20T00:00:00Z", next_billing_date: "2026-06-24T00:00:00Z" }),
      sub({ id: 2, currency: "USD", price: "10.00", cancelled_at: "2026-06-20T00:00:00Z", next_billing_date: "2026-06-24T00:00:00Z" }),
    ];
    const { payload } = await call("/api/trpc/subscriptions.cancelled", {});
    const totals = payload.result.data.totals;
    expect(totals.length).toBe(2);
    const eur = totals.find((t) => t.currency === "EUR");
    const usd = totals.find((t) => t.currency === "USD");
    expect(eur.amount).toBe(47.97);
    expect(usd.amount).toBe(30);
    expect(eur.subscriptions).toBe(1);
  });

  it("groups a row with no currency separately rather than assuming a base", async () => {
    subs = [sub({ currency: null, cancelled_at: "2026-06-20T00:00:00Z", next_billing_date: "2026-06-24T00:00:00Z" })];
    const { payload } = await call("/api/trpc/subscriptions.cancelled", {});
    expect(payload.result.data.totals[0].currency).toBeNull();
  });

  it("returns empty structures rather than null when nothing is cancelled", async () => {
    subs = [sub()];
    const { payload } = await call("/api/trpc/subscriptions.cancelled", {});
    expect(payload.result.data.subscriptions).toEqual([]);
    expect(payload.result.data.totals).toEqual([]);
  });
});

describe("every live-row query learned about the new state", () => {
  /* The real risk of this change is a query that still treats a cancelled row as
     live. A source scan is the right tool here precisely because it covers the
     queries this suite does not evaluate, including the reminder cron. */
  const cases = [
    ["subscriptions.list", /WHERE s\.user_id = \$1 AND s\.cancelled_at IS NULL/],
    ["alerts.list", /WHERE user_id = \$1 AND is_active = TRUE AND cancelled_at IS NULL/],
    ["the duplicate name check", /WHERE user_id = \$1 AND cancelled_at IS NULL AND LOWER\(TRIM\(name\)\)/],
    ["the CSV export", /WHERE user_id = \$1 AND cancelled_at IS NULL ORDER BY name ASC/],
    ["analytics.summary", /SELECT \* FROM subscriptions WHERE user_id = \$1 AND cancelled_at IS NULL'/],
    ["the Brevo next renewal", /is_active = TRUE AND cancelled_at IS NULL AND next_billing_date >= NOW\(\)/],
  ];
  it.each(cases)("%s excludes cancelled rows", (_label, re) => {
    expect(SERVER).toMatch(re);
  });

  it("the free tier cap in subscriptions.create excludes them", () => {
    /* SLICED TO THE CREATE HANDLER, because the same SQL appears three times in
       this file (the Brevo count sync and the restore check in setCancelled) and
       a whole-file search is therefore satisfied by an occurrence that is not the
       one under test. A mutation proved it: the cap in create was reverted to a
       bare COUNT(*) and a file-wide assertion stayed green, matching a sibling
       query instead. An assertion that can pass for the wrong reason is not one.

       This is also the only cover the create path has here, since that handler is
       not evaluated by this suite, so the slice is doing real work. */
    const CREATE = SERVER.slice(
      SERVER.indexOf("app.post('/api/trpc/subscriptions.create'"),
      SERVER.indexOf("app.post('/api/trpc/subscriptions.update'")
    );
    expect(CREATE.length).toBeGreaterThan(200);
    expect(CREATE).toMatch(/FROM subscriptions WHERE user_id = \$1 AND cancelled_at IS NULL/);
    expect(CREATE).not.toMatch(/as c FROM subscriptions WHERE user_id = \$1',/);
  });

  it("the renewal reminder cron excludes them", () => {
    /* Reminding somebody about a renewal that will not happen is the most
       visible way this could go wrong: it is a push notification about money
       that is not moving. */
    const CRON = SERVER.slice(SERVER.indexOf("const in3Days"), SERVER.indexOf("emailsSent: sent"));
    expect(CRON).toMatch(/AND cancelled_at IS NULL/);
  });

  it("alerts.list is what freezes the anchor, so its filter is load bearing", () => {
    /* That endpoint ADVANCES next_billing_date as a side effect of being read.
       If it still saw cancelled rows it would keep rolling the anchor forward,
       and the anchor is what the saved figure is projected from, so the count
       would drift every time anybody opened the app. */
    const ALERTS = SERVER.slice(
      SERVER.indexOf("app.get('/api/trpc/alerts.list'"),
      SERVER.indexOf("UPDATE subscriptions SET next_billing_date")
    );
    expect(ALERTS).toMatch(/cancelled_at IS NULL/);
  });

  it("keeps the column nullable with no backfill", () => {
    // Absent is the correct value for every existing row, which is what makes
    // this migration free. A backfill would be inventing cancellation dates.
    expect(SERVER).toMatch(/ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ/);
    expect(SERVER).not.toMatch(/UPDATE subscriptions SET cancelled_at = .*WHERE cancelled_at IS NULL/);
  });

  it("indexes the predicate every live query now carries", () => {
    expect(SERVER).toMatch(/CREATE INDEX IF NOT EXISTS idx_subscriptions_user_cancelled/);
  });
});

describe("the cancellation date comes from the server", () => {
  it("uses NOW() and never a client supplied date", () => {
    /* A saved figure is a claim about money. Letting the client name the date
       would let a wrong clock, or a crafted request, invent months of savings. */
    expect(setCancelledSrc).toMatch(/SET cancelled_at = NOW\(\)/);
    expect(setCancelledSrc).not.toMatch(/req\.body\.cancelledAt|body\.cancelled_at/);
  });

  it("uses no interpolated SQL", () => {
    // This file has zero interpolated queries and that is what makes auditing
    // it cheap. An exception that is safe today is the one a later edit widens.
    expect(setCancelledSrc).not.toMatch(/pool\.query\(`[^`]*\$\{/);
  });
});
