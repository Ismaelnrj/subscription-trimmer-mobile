/**
 * THE ALERTS SCREEN READS IN THE READER'S LANGUAGE AND EACH ROW'S OWN CURRENCY.
 *
 * app/alerts.tsx renders `title` and `message` from alerts.list verbatim. Until
 * 2026-10-04 that text was English for everybody, priced every row with the
 * ACCOUNT's symbol, and summed raw prices across currencies for the spending
 * alert. MEASURED by booting the real backend/server.js twice (HEAD and the
 * fix) against an empty PostgreSQL 16 over TLS and reading alerts.list over
 * HTTP. A German user with a euro account and one 9.99 USD row, before:
 *     Spotify billing in 1 day  |  €9.99 will be charged for Spotify.
 * after:
 *     Spotify wird morgen verlängert  |  9,99 $ wird für Spotify abgebucht.
 * And 150 EUR plus 150 USD used to read "You spend €300.00/month"; it now
 * raises no spending alert, since no rate-free total exists.
 *
 * Behavioural: the REAL handler is lifted out of server.js and driven against
 * a stub pool, so the copy, the formatter and the grouping all run.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'server.js'), 'utf8');
const fn = (sig) => { const i = src.indexOf(sig); if (i < 0) throw new Error('missing ' + sig); return src.slice(i, src.indexOf('\n}\n', i) + 2); };
const konst = (sig) => { const i = src.indexOf(sig); if (i < 0) throw new Error('missing ' + sig); return src.slice(i, src.indexOf('\n};\n', i) + 3); };
const route = (sig) => { const i = src.indexOf(sig); if (i < 0) throw new Error('missing ' + sig); return src.slice(i, src.indexOf('\n});\n', i) + 4); };

function loadHandler(rows) {
  let handler;
  const app = { get: (_p, _mw, h) => { handler = h; } };
  const pool = {
    query: async (sql) => {
      if (/FROM subscriptions/.test(sql)) return { rows: rows.subs };
      if (/FROM user_settings/.test(sql)) return { rows: [rows.settings] };
      if (/FROM notification_preferences/.test(sql)) return { rows: [{ renewal_alert_days: 3 }] };
      return { rows: [] }; // the date writes
    },
  };
  const body = [
    fn('function addMonthsUTC'), fn('function startOfUtcDay'), fn('function advanceBillingDate'),
    fn('function nextBillingDate'), fn('function toMonthly'), fn('function languageOf'),
    konst('const CYCLE_NOUN = {'), fn('function formatEmailPrice'), konst('const ALERT_TEXT = {'),
    fn('function trpc'), fn('function handleError'),
    route("app.get('/api/trpc/alerts.list'"),
  ].join('\n');
  new Function('app', 'pool', 'authMiddleware', body)(app, pool, null);
  return handler;
}

async function alerts(lang, rows) {
  const h = loadHandler(rows);
  let out;
  const res = { status: () => res, json: (b) => { out = b; return res; } };
  await h({ userId: 1, headers: lang ? { 'accept-language': lang } : {} }, res);
  return out.result.data;
}

const day = (n) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d.toISOString(); };
const row = (o) => ({ id: o.id, name: o.name, price: String(o.price), currency: o.currency, billing_cycle: 'monthly',
  next_billing_date: day(o.in), billing_anchor_day: null, trial_end_date: o.trial != null ? day(o.trial) : null });
const EUR = { currency: 'EUR', currency_symbol: '€' };
// German Intl formatting puts a NO-BREAK space (U+00A0) between amount and
// symbol, so the two never wrap onto separate lines. The emails share it.

describe('renewal and trial alerts', () => {
  const subs = [
    row({ id: 1, name: 'Spotify', price: 9.99, currency: 'USD', in: 1 }),
    row({ id: 2, name: 'Netflix', price: 15.99, currency: 'EUR', in: 0 }),
    row({ id: 3, name: 'Disney+', price: 10.99, currency: 'EUR', in: 20, trial: 2 }),
  ];

  test('a German reader gets German text, each row in its own currency', async () => {
    const a = await alerts('de', { subs, settings: EUR });
    const spotify = a.find((x) => x.id === 'renewal-1');
    expect(spotify.title).toBe('Spotify wird morgen verlängert');
    expect(spotify.message).toBe('9,99\u00a0$ wird für Spotify abgebucht.');
    expect(a.find((x) => x.id === 'renewal-2').title).toBe('Netflix wird heute verlängert');
    expect(a.find((x) => x.id === 'trial-3').title).toBe('Testphase von Disney+ endet in 2 Tagen');
  });

  test('an English reader keeps English, and the row currency still wins over the account', async () => {
    const a = await alerts('en', { subs, settings: EUR });
    expect(a.find((x) => x.id === 'renewal-1').message).toBe('$9.99 will be charged for Spotify.');
    expect(a.find((x) => x.id === 'renewal-1').title).toBe('Spotify renews tomorrow');
    expect(a.find((x) => x.id === 'trial-3').message).toMatch(/^Your free trial for Disney\+/);
  });

  test('a row with no currency falls back to the account symbol', async () => {
    const a = await alerts('en', { subs: [row({ id: 9, name: 'Old', price: 4.5, currency: null, in: 2 })], settings: EUR });
    expect(a[0].message).toBe('€4.50 will be charged for Old.');
  });

  test('the alert types the client maps are unchanged', async () => {
    const a = await alerts('de', { subs, settings: EUR });
    expect(new Set(a.map((x) => x.type))).toEqual(new Set(['renewal_alert', 'trial_alert']));
  });
});

describe('the spending alert', () => {
  test('one currency: totals and prints in that currency', async () => {
    const a = await alerts('de', { subs: [row({ id: 1, name: 'A', price: 250, currency: 'EUR', in: 20 })], settings: EUR });
    const s = a.find((x) => x.type === 'expensive_alert');
    expect(s.title).toBe('Hohe monatliche Ausgaben');
    expect(s.message).toBe('Du gibst 250,00\u00a0€ pro Monat für Abos aus.');
  });

  test('several currencies: no alert, because adding them needs a rate', async () => {
    const a = await alerts('de', { subs: [
      row({ id: 1, name: 'A', price: 150, currency: 'EUR', in: 20 }),
      row({ id: 2, name: 'B', price: 150, currency: 'USD', in: 20 }),
    ], settings: EUR });
    expect(a.find((x) => x.type === 'expensive_alert')).toBeUndefined();
  });

  test('a null currency row counts as the account currency, not as a third one', async () => {
    const a = await alerts('en', { subs: [
      row({ id: 1, name: 'A', price: 150, currency: 'EUR', in: 20 }),
      row({ id: 2, name: 'B', price: 100, currency: null, in: 20 }),
    ], settings: EUR });
    expect(a.find((x) => x.type === 'expensive_alert').message).toBe('You spend €250.00/month on subscriptions.');
  });
});

describe('the copy', () => {
  const T = new Function(konst('const ALERT_TEXT = {') + '; return ALERT_TEXT;')();

  test('both languages carry the same keys', () => {
    expect(Object.keys(T.de).sort()).toEqual(Object.keys(T.en).sort());
  });

  test('no dash as clause punctuation in the German', () => {
    const texts = [T.de.renewalTitle('X', T.de.when(3)), T.de.renewalBody('X', '1 €'), T.de.trialTitle('X', T.de.when(0)),
      T.de.trialBody('X'), T.de.spendTitle, T.de.spendBody('1 € pro Monat')];
    for (const t of texts) expect(t).not.toMatch(/ [-–—] |[–—]/);
  });

  test('the handler builds no English string of its own any more', () => {
    const h = route("app.get('/api/trpc/alerts.list'");
    expect(h).not.toMatch(/billing \$\{/);
    expect(h).not.toMatch(/\$\{sym\}\$\{/);
    expect(h).not.toMatch(/will be charged for/);
  });
});
