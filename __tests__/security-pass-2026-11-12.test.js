/* Three findings from a pass with Cloudflare's security-audit skill, 2026-11-12.

   1. OPENING THE UNSUBSCRIBE LINK UNSUBSCRIBED YOU. GET /unsubscribe wrote
      email_opt_out on arrival, and mail security scanners open the links in an
      email to check them before the person ever sees it. So a reminder could
      switch its own reader's reminders off. Opening the link now only shows a
      button; pressing it posts the form, and the RFC 8058 one-click POST from
      a mail provider still acts with no page, as that standard requires.

   2. NOTHING BOUNDED HOW MANY ROWS ONE ACCOUNT COULD STORE. The free limit
      only counts active rows and only applies to free accounts, so a Premium
      account (and since the reverse trial every new account, free of charge)
      or a free one cycling create and cancel could grow the database without
      end at the API rate limit. A ceiling over ALL of an account's rows,
      cancelled included, inside the same lock as the free limit.

   3. THE CI TOKEN HAD WHATEVER THE REPOSITORY DEFAULT GRANTS. checks.yml ran
      third party actions pinned by tag with no permissions block, and master
      deploys to production on push. contents: read caps it whatever the
      setting says.

   Source reading plus a behavioural check of the two unsubscribe functions
   on a stub pool. Measured separately by booting this server and the one
   before it on PostgreSQL 16 (see the commit message). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');

function slice(from, to) {
  const a = SRC.indexOf(from);
  const b = SRC.indexOf(to, a + from.length);
  if (a < 0 || b < 0) throw new Error(`markers not found: ${from} .. ${to}`);
  return SRC.slice(a, b);
}

function route(method, p) {
  const start = SRC.indexOf(`app.${method}('${p}'`);
  if (start < 0) throw new Error(`no ${method} ${p}`);
  const next = SRC.slice(start + 10).search(/\napp\.(get|post|patch|put|delete|use)\(/);
  return SRC.slice(start, next < 0 ? undefined : start + 10 + next);
}

describe('opening the unsubscribe link changes nothing', () => {
  test('GET only verifies the link and never writes', () => {
    const get = route('get', '/unsubscribe');
    expect(get).toMatch(/verifyUnsubscribe\(req\)/);
    expect(get).not.toMatch(/applyUnsubscribe\(/);
    expect(get).not.toMatch(/pool\.query\(/);
  });

  test('the page it shows posts the link back with a button', () => {
    const get = route('get', '/unsubscribe');
    expect(get).toMatch(/method="post"/);
    expect(get).toMatch(/name="confirm" value="1"/);
  });

  test('POST still acts, and answers a pressed button with a page', () => {
    const post = route('post', '/unsubscribe');
    expect(post).toMatch(/applyUnsubscribe\(req\)/);
    expect(post).toMatch(/confirm === '1'/);
    // The one-click path keeps its bare status, which providers require.
    expect(post).toMatch(/sendStatus\(/);
  });

  function lib(pool) {
    const verify = SRC.slice(SRC.indexOf('function verifyUnsubscribe('), SRC.indexOf('\n}\n', SRC.indexOf('function verifyUnsubscribe(')) + 2);
    const apply = SRC.slice(SRC.indexOf('async function applyUnsubscribe('), SRC.indexOf('\n}\n', SRC.indexOf('async function applyUnsubscribe(')) + 2);
    const crypto = require('crypto');
    const unsubscribeToken = (id) => crypto.createHmac('sha256', 'k').update(`unsub:${id}`).digest('hex');
    // eslint-disable-next-line no-new-func
    return new Function('pool', 'crypto', 'unsubscribeToken', `${verify}\n${apply}\nreturn { verifyUnsubscribe, applyUnsubscribe };`)(pool, crypto, unsubscribeToken);
  }

  test('a good link verifies without touching the database, and applying it writes', async () => {
    const writes = [];
    const pool = { query: async (sql, args) => { writes.push([sql, args]); return { rows: [] }; } };
    const crypto = require('crypto');
    const t = crypto.createHmac('sha256', 'k').update('unsub:7').digest('hex');
    const { verifyUnsubscribe, applyUnsubscribe } = lib(pool);
    expect(verifyUnsubscribe({ query: { u: '7', t }, body: {} })).toBe(7);
    expect(writes).toEqual([]);
    expect(await applyUnsubscribe({ query: {}, body: { u: '7', t } })).toBe(true);
    expect(writes.length).toBe(2);
    expect(writes[0][1]).toEqual([7]);
  });

  test('a bad link verifies to nothing and applies nothing', async () => {
    const writes = [];
    const pool = { query: async (sql) => { writes.push(sql); return { rows: [] }; } };
    const { verifyUnsubscribe, applyUnsubscribe } = lib(pool);
    expect(verifyUnsubscribe({ query: { u: '7', t: 'x'.repeat(64) }, body: {} })).toBe(null);
    expect(verifyUnsubscribe({ query: {}, body: {} })).toBe(null);
    expect(await applyUnsubscribe({ query: { u: '7', t: 'nope' }, body: {} })).toBe(false);
    expect(writes).toEqual([]);
  });

  test('the confirm page is written in both languages', () => {
    const page = slice('const UNSUBSCRIBE_PAGE = {', '\n};\n');
    const en = page.slice(page.indexOf('en:'), page.indexOf('de:'));
    const de = page.slice(page.indexOf('de:'));
    for (const block of [en, de]) {
      for (const k of ['confirmTitle', 'confirmBody', 'confirmButton']) expect(block).toMatch(new RegExp(`${k}: '`));
      // The copy rule: no dash as clause punctuation in anything a user reads.
      expect(block).not.toMatch(/ [-–—] /);
    }
  });
});

describe('one account cannot grow the database without end', () => {
  const create = route('post', '/api/trpc/subscriptions.create');

  test('a ceiling exists, and it is far above any real user', () => {
    const m = SRC.match(/const MAX_SUBSCRIPTIONS_PER_ACCOUNT = (\d+);/);
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBeGreaterThanOrEqual(200);
    expect(Number(m[1])).toBeLessThanOrEqual(5000);
  });

  test('it counts every row, cancelled included, for every account, before the insert', () => {
    const lock = create.slice(create.indexOf('withSubscriptionLimitLock('));
    const cap = lock.indexOf('MAX_SUBSCRIPTIONS_PER_ACCOUNT');
    const paidGate = lock.indexOf('if (!isPaid)');
    const insert = lock.indexOf('INSERT INTO subscriptions');
    expect(cap).toBeGreaterThan(-1);
    // Outside the free-only branch, so Premium and trial accounts are bounded too.
    expect(cap).toBeLessThan(paidGate);
    expect(cap).toBeLessThan(insert);
    const count = lock.slice(0, cap);
    expect(count).toMatch(/SELECT COUNT\(\*\)[^']*FROM subscriptions WHERE user_id = \$1'/);
  });

  test('a replayed create is still answered before the ceiling', () => {
    // A retry of a row that IS saved must get its row back even at the ceiling.
    const lock = create.slice(create.indexOf('withSubscriptionLimitLock('));
    expect(lock.indexOf('client_ref = $2')).toBeLessThan(lock.indexOf('MAX_SUBSCRIPTIONS_PER_ACCOUNT'));
  });
});

describe('the CI token can only read', () => {
  test('checks.yml declares contents: read and asks for no write', () => {
    const wf = fs.readFileSync(path.join(root, '.github/workflows/checks.yml'), 'utf8');
    expect(wf).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(wf).not.toMatch(/: write/);
  });
});
