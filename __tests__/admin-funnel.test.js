/**
 * THE OWNER'S FUNNEL ENDPOINT, GET /api/admin/funnel.
 *
 * HALF BEHAVIOURAL, HALF SOURCE READING, and the split is the honest part.
 * The handler's auth, validation, windows and response shape are driven for
 * real here: the actual functions are lifted out of server.js by string index
 * and run against a stub pool. What a stub CANNOT say is whether the SQL counts
 * correctly, because that is a fact about PostgreSQL, and CI has none.
 *
 * THE SQL WAS MEASURED SEPARATELY, on 2026-10-01, against a real PostgreSQL
 * 16.13 cluster whose schema was built by running the REAL initDB rather than
 * retyped CREATE statements. Seven users designed so each count has a case that
 * would catch it going wrong: 13 of 13 checks passed across the three windows,
 * the since window, the 401s and the 400. Six mutations were then applied to
 * the SQL one at a time and ALL SIX were caught:
 *   the gate ignoring cancelled_at, `NOT is_paid` dropping NULL rows, the limit
 *   hardcoded, an INNER JOIN losing users with no subscriptions, the 24h window
 *   off by a day, and verified counting Google users who never saw an email.
 * Do not read a green run of THIS file as proof of any of that.
 *
 * THAT MEASUREMENT FOUND initDB COULD NOT BUILD AN EMPTY DATABASE: it ran
 * ALTER TABLE subscriptions 43 lines before CREATE TABLE subscriptions. Fixed
 * in its own change the same day, and guarded by __tests__/initdb-order.test.js.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVER = path.join(__dirname, '..', 'backend', 'server.js');
const src = fs.readFileSync(SERVER, 'utf8');

function lift(signature) {
  const i = src.indexOf(signature);
  expect(i).toBeGreaterThan(-1);
  const j = src.indexOf('\n}\n', i);
  expect(j).toBeGreaterThan(i);
  return src.slice(i, j + 2);
}

const LIMIT = 5;

function build() {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{
        signups: 9, via_google: 4, via_email: 5, email_verified: 3,
        added_subscription: 6, at_free_limit: 2, paid: 1, bonus_premium: 1,
        referred: 2, referral_rewarded: 1, lang_de: 5, lang_en: 3, lang_unknown: 1,
      }] };
    },
  };
  const make = new Function(
    'pool', 'crypto', 'FREE_SUBSCRIPTION_LIMIT', 'handleError',
    lift('function secretMatches(') + '\n' +
    lift('async function funnelCounts(') + '\n' +
    lift('async function adminFunnel(') + '\n; return adminFunnel;'
  );
  const handler = make(pool, crypto, LIMIT, (e, res) => res.status(500).json({ error: String(e) }));
  return { handler, calls };
}

async function call(handler, { secret, since, env } = {}) {
  const prev = process.env.CRON_SECRET;
  if (env === null) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = env === undefined ? 'S3CRET' : env;
  const out = { code: 200, body: null, headers: {} };
  const res = {
    status(c) { out.code = c; return this; },
    json(b) { out.body = b; return this; },
    set(k, v) { out.headers[k] = v; return this; },
  };
  try {
    await handler(
      { headers: secret == null ? {} : { 'x-cron-secret': secret }, query: since == null ? {} : { since } },
      res
    );
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prev;
  }
  return out;
}

describe('who can read it', () => {
  test('no header is refused, and the database is never touched', async () => {
    const { handler, calls } = build();
    expect((await call(handler, {})).code).toBe(401);
    expect(calls).toHaveLength(0);
  });

  test('a wrong secret is refused', async () => {
    const { handler, calls } = build();
    expect((await call(handler, { secret: 'guess' })).code).toBe(401);
    expect(calls).toHaveLength(0);
  });

  /* The single most dangerous inversion: with no secret configured the route
     must reject everybody, never admit everybody. */
  test('an unset CRON_SECRET refuses even a caller who sends a header', async () => {
    const { handler, calls } = build();
    expect((await call(handler, { secret: 'S3CRET', env: null })).code).toBe(401);
    expect((await call(handler, { secret: '', env: '' })).code).toBe(401);
    expect(calls).toHaveLength(0);
  });

  test('an unreadable since is a 400 before any query runs', async () => {
    const { handler, calls } = build();
    expect((await call(handler, { secret: 'S3CRET', since: 'yesterday-ish' })).code).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe('what it answers', () => {
  test('three rolling windows, each a cohort from the right moment', async () => {
    const { handler, calls } = build();
    const before = Date.now();
    const r = await call(handler, { secret: 'S3CRET' });
    expect(r.code).toBe(200);
    expect(Object.keys(r.body.windows)).toEqual(['last24h', 'last7d', 'allTime']);
    expect(calls).toHaveLength(3);
    const day = 24 * 60 * 60 * 1000;
    expect(Math.abs(calls[0].params[0].getTime() - (before - day))).toBeLessThan(5000);
    expect(Math.abs(calls[1].params[0].getTime() - (before - 7 * day))).toBeLessThan(5000);
    expect(calls[2].params[0]).toBe('-infinity');
  });

  test('passes the live free limit, never a copy of the number', async () => {
    const { handler, calls } = build();
    await call(handler, { secret: 'S3CRET' });
    for (const c of calls) expect(c.params[1]).toBe(LIMIT);
    expect(src).toContain('[sinceValue, FREE_SUBSCRIPTION_LIMIT]');
  });

  test('since adds a fourth window from that exact moment', async () => {
    const { handler, calls } = build();
    const r = await call(handler, { secret: 'S3CRET', since: '2026-10-01T08:00:00Z' });
    expect(r.code).toBe(200);
    expect(r.body.windows.since.from).toBe('2026-10-01T08:00:00.000Z');
    expect(calls[3].params[0].toISOString()).toBe('2026-10-01T08:00:00.000Z');
  });

  test('maps every column and is never cached', async () => {
    const { handler } = build();
    const r = await call(handler, { secret: 'S3CRET' });
    expect(r.body.freeLimit).toBe(LIMIT);
    expect(r.headers['Cache-Control']).toBe('no-store');
    expect(r.body.windows.last24h).toEqual({
      signups: 9, viaGoogle: 4, viaEmail: 5, emailVerified: 3,
      addedSubscription: 6, atFreeLimit: 2, paid: 1, bonusPremium: 1,
      referred: 2, referralRewarded: 1, language: { de: 5, en: 3, unknown: 1 },
    });
  });
});

describe('the SQL keeps the properties the PostgreSQL run measured', () => {
  const sql = lift('async function funnelCounts(');

  /* atFreeLimit is the only population that has ever been shown the price, so
     it must count exactly what the gate in subscriptions.create counts. */
  test('atFreeLimit mirrors the create gate: active rows only', () => {
    expect(src).toContain("'SELECT COUNT(*) as c FROM subscriptions WHERE user_id = $1 AND cancelled_at IS NULL'");
    expect(sql).toContain('COUNT(*) FILTER (WHERE cancelled_at IS NULL) AS active');
    expect(sql).toContain('subs_active >= $2');
  });

  test('a user with no subscriptions still counts as a signup', () => {
    expect(sql).toContain('LEFT JOIN (');
    expect(sql).not.toMatch(/\bINNER JOIN\b/);
  });

  test('NULL booleans are read with IS TRUE, never bare NOT', () => {
    expect(sql).toContain('is_paid IS NOT TRUE');
    expect(sql).not.toMatch(/WHERE NOT is_paid/);
  });

  test('email verification is counted for email signups only', () => {
    expect(sql).toContain('google_id IS NULL AND is_verified IS TRUE');
  });

  test('selects no personal column at all', () => {
    expect(sql).not.toMatch(/\bu\.(email|name|open_id|id)\b\s*,/);
    expect(sql).not.toMatch(/\bemail\b/);
  });
});

describe('how it is mounted', () => {
  test('a GET, behind its own limiter instance', () => {
    expect(src).toContain("app.get('/api/admin/funnel', adminFunnel);");
    expect(src).toContain("app.use('/api/admin', adminLimiter);");
    expect(src).toMatch(/const adminLimiter = rateLimit\(\{/);
    expect(src).not.toContain("app.use('/api/admin', authLimiter)");
  });
});
