/**
 * THE TWO SCHEDULED EMAILS, THE FOOTER AND THE UNSUBSCRIBE PAGE, IN BOTH LANGUAGES.
 *
 * Until 2026-10-01 the renewal reminder and the win-back were the last English
 * only mail this backend sent, and the reminder had two more defects under the
 * language. On the same data, the OLD code wrote this row to a German user:
 *     Netflix  $15.99/monthly  10/2/2026
 * English, the ACCOUNT's currency symbol instead of the row's own euros, the raw
 * API identifier for the cycle, and a US date. The new code writes:
 *     Netflix  15,99 € pro Monat  2. Oktober 2026
 *
 * BEHAVIOURAL. The real copy, formatters and both route handlers are lifted out
 * of server.js by string index and executed: against stub data here, because CI
 * has no PostgreSQL.
 *
 * MEASURED SEPARATELY on a real PostgreSQL 16 on 2026-10-01, schema built by the
 * real initDB on an empty database: both jobs run end to end, 22 of 22 checks,
 * including an unsubscribed user receiving nothing, a malformed currency falling
 * back to the account symbol, a failed send leaving reminder_sent_for and
 * win_back_sent_at unset so the next run retries, and every rendered email read
 * in full.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'server.js'), 'utf8');

const fn = (sig) => { const i = src.indexOf(sig); expect(i).toBeGreaterThan(-1); return src.slice(i, src.indexOf('\n}\n', i) + 2); };
const konst = (sig) => { const i = src.indexOf(sig); expect(i).toBeGreaterThan(-1); return src.slice(i, src.indexOf('\n};\n', i) + 3); };
const route = (p) => { const i = src.indexOf(`app.post('${p}'`); expect(i).toBeGreaterThan(-1); return src.slice(i, src.indexOf('\n});\n', i) + 4); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function lib() {
  return new Function(
    'PUBLIC_URL',
    [konst('const CYCLE_NOUN = {'), fn('function formatEmailDate('), fn('function formatEmailPrice('),
     konst('const EMAIL_FOOTER = {'), fn('function emailFooter('),
     konst('const REMINDER_EMAIL = {'), konst('const WIN_BACK_EMAIL = {'),
     konst('const UNSUBSCRIBE_PAGE = {'), fn('function unsubscribePage(')].join('\n') +
    '\n; return { formatEmailDate, formatEmailPrice, emailFooter, REMINDER_EMAIL, WIN_BACK_EMAIL, UNSUBSCRIBE_PAGE, unsubscribePage };'
  )('https://www.subtrimio.com');
}

describe('money, dates and cycles read the way each language writes them', () => {
  const { formatEmailPrice, formatEmailDate } = lib();

  test('a row is shown in ITS OWN currency, never the account symbol', () => {
    expect(formatEmailPrice('15.99', 'EUR', '$', 'monthly', 'de')).toBe('15,99 € pro Monat');
    expect(formatEmailPrice('19.99', 'USD', '€', 'yearly', 'en')).toBe('$19.99/year');
    expect(formatEmailPrice('15.99', 'EUR', '$', 'monthly', 'en')).toBe('€15.99/month');
  });

  test('the cycle is a word in the reader language, never the API identifier', () => {
    expect(formatEmailPrice('1', 'EUR', '€', 'weekly', 'de')).toMatch(/pro Woche$/);
    expect(formatEmailPrice('1', 'USD', '$', 'weekly', 'en')).toMatch(/\/week$/);
    for (const lang of ['en', 'de']) {
      expect(formatEmailPrice('1', 'EUR', '€', 'monthly', lang)).not.toMatch(/monthly/);
    }
  });

  test('a malformed currency falls back to the account symbol instead of throwing', () => {
    expect(formatEmailPrice('9.5', 'not-a-code', '£', 'weekly', 'en')).toBe('£9.50/week');
    expect(formatEmailPrice('9.5', null, '€', 'monthly', 'de')).toBe('9,50 € pro Monat');
  });

  /* Stored as midnight UTC, so formatting in any zone west of UTC would name
     the previous day. The formatter must pin UTC itself. */
  test('a billing date names the stored day in both languages', () => {
    expect(formatEmailDate('2026-10-16T00:00:00.000Z', 'de')).toBe('16. Oktober 2026');
    expect(formatEmailDate('2026-10-16T00:00:00.000Z', 'en')).toBe('16 October 2026');
    expect(fn('function formatEmailDate(')).toContain("timeZone: 'UTC'");
  });
});

describe('the copy', () => {
  const { REMINDER_EMAIL, WIN_BACK_EMAIL, emailFooter } = lib();

  /* The referral email shipped a subject-verb agreement error in both
     languages once. Singular and plural are both checked. */
  test('reminder subjects agree in number in both languages', () => {
    expect(REMINDER_EMAIL.de.subject(1)).toBe('Trimio: 1 Abo wird bald verlängert');
    expect(REMINDER_EMAIL.de.subject(3)).toBe('Trimio: 3 Abos werden bald verlängert');
    expect(REMINDER_EMAIL.en.subject(1)).toBe('Trimio: 1 subscription renewing soon');
    expect(REMINDER_EMAIL.en.subject(3)).toBe('Trimio: 3 subscriptions renewing soon');
  });

  test('the win-back adjective is declined, and lifetime takes none', () => {
    expect(WIN_BACK_EMAIL.de.heading('monthly')).toBe('Dein monatliches Trimio Premium läuft bald aus');
    expect(WIN_BACK_EMAIL.de.heading('annual')).toBe('Dein jährliches Trimio Premium läuft bald aus');
    expect(WIN_BACK_EMAIL.de.heading('lifetime')).toBe('Dein Trimio Premium läuft bald aus');
    expect(WIN_BACK_EMAIL.de.heading(null)).toBe('Dein Trimio Premium läuft bald aus');
    expect(WIN_BACK_EMAIL.en.heading('annual')).toBe('Your Trimio Annual plan is set to end');
  });

  /* The footer used to tell win-back recipients they had "turned on email
     reminders", which nothing guarantees they did. */
  test('the footer states a reason that is true for each email', () => {
    expect(emailFooter('https://u', 'de', 'premium')).toContain('weil du Trimio Premium hattest');
    expect(emailFooter('https://u', 'de', 'premium')).not.toContain('Erinnerungen');
    expect(emailFooter('https://u', 'de', 'reminders')).toContain('E-Mail-Erinnerungen');
    expect(emailFooter('https://u', 'en', 'premium')).not.toContain('email reminders');
    expect(emailFooter('https://u', 'de')).toContain('Von Trimio E-Mails abmelden');
    expect(emailFooter(null, 'de')).toBe('');
  });

  test('every German string uses umlauts and informal du, no dash as punctuation', () => {
    const { UNSUBSCRIBE_PAGE } = lib();
    const de = JSON.stringify([
      Object.values(REMINDER_EMAIL.de).map((v) => (typeof v === 'function' ? v(2) + v('Lena') : v)),
      Object.values(WIN_BACK_EMAIL.de).map((v) => (typeof v === 'function' ? v('monthly') : v)),
      UNSUBSCRIBE_PAGE.de, emailFooter('u', 'de', 'premium'), emailFooter('u', 'de', 'reminders'),
    ]);
    expect(de).toMatch(/[äöüß]/);
    expect(de).not.toMatch(/\b(verlaengert|naechsten|laeuft|behaeltst|jaehrliches|Sie|Ihnen|Ihre)\b/);
    expect(de).not.toMatch(/[–—]|\s-\s/);
  });

  test('the unsubscribe page is German for a German browser', () => {
    const { UNSUBSCRIBE_PAGE, unsubscribePage } = lib();
    const html = unsubscribePage(UNSUBSCRIBE_PAGE.de.okTitle, UNSUBSCRIBE_PAGE.de.okBody, 'de');
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('Du bist abgemeldet');
    expect(src).toMatch(/const lang = languageOf\(req\);\s*\n\s*const c = UNSUBSCRIBE_PAGE\[lang\];/);
  });
});

/* Drives the REAL route handlers against a stub database. */
function jobs({ failTo = [] } = {}) {
  const queries = [];
  const sent = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/FROM users u\s+JOIN notification_preferences/.test(sql)) {
        return { rows: [
          { id: 1, email: 'lena@x.test', name: 'Lena', language: 'de', currency_symbol: '$' },
          { id: 2, email: 'fail@x.test', name: null, language: 'de', currency_symbol: '€' },
        ] };
      }
      if (/FROM subscriptions/.test(sql)) {
        return { rows: [{ id: params[0] * 10, name: 'Netflix', price: '15.99', currency: 'EUR', billing_cycle: 'monthly', next_billing_date: '2026-10-16T00:00:00.000Z' }] };
      }
      if (/SELECT id, email, name, last_plan, language/.test(sql)) {
        return { rows: [
          { id: 3, email: 'jonas@x.test', name: 'Jonas', last_plan: 'monthly', language: 'de' },
          { id: 4, email: 'fail@x.test', name: null, last_plan: 'annual', language: 'de' },
        ] };
      }
      return { rows: [] };
    },
  };
  const sendEmail = async (to, subject, html) => {
    if (failTo.includes(to)) throw new Error('brevo down');
    sent.push({ to, subject, html });
  };
  const handlers = {};
  new Function('app', 'pool', 'crypto', 'sendEmail', 'unsubscribeUrlFor', 'handleError',
    [fn('function secretMatches('), fn('function escapeHtml('),
     konst('const EMAIL_FOOTER = {'), fn('function emailFooter('),
     konst('const REMINDER_EMAIL = {'), konst('const WIN_BACK_EMAIL = {'), konst('const CYCLE_NOUN = {'),
     fn('function formatEmailDate('), fn('function formatEmailPrice('),
     route('/api/trpc/reminders.sendEmailReminders'), route('/api/trpc/reminders.sendWinBackEmails')].join('\n')
  )({ post: (p, h) => { handlers[p] = h; } }, pool, crypto, sendEmail, (id) => `https://u/${id}`,
    (e, res) => res.status(500).json({ error: String(e) }));
  const run = async (p) => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'S';
    const out = { code: 200 };
    const quiet = console.error; console.error = () => {};
    try {
      await handlers[p]({ headers: { 'x-cron-secret': 'S' } },
        { status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } });
    } finally {
      console.error = quiet;
      if (prev === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prev;
    }
    return out;
  };
  return { run, sent, queries };
}

describe('the jobs send in the reader language and only mark what was delivered', () => {
  test('the reminder reads users.language and renders the row in its own currency', async () => {
    const j = jobs();
    await j.run('/api/trpc/reminders.sendEmailReminders');
    expect(j.queries[0].sql).toContain('u.language');
    const m = j.sent.find((x) => x.to === 'lena@x.test');
    expect(m.subject).toBe('Trimio: 1 Abo wird bald verlängert');
    expect(text(m.html)).toContain('Netflix 15,99 € pro Monat 16. Oktober 2026');
    expect(text(m.html)).not.toContain('$');
  });

  test('a failed reminder is not marked, so the next run retries it', async () => {
    const j = jobs({ failTo: ['fail@x.test'] });
    const r = await j.run('/api/trpc/reminders.sendEmailReminders');
    expect(r.body.emailsSent).toBe(1);
    const marks = j.queries.filter((q) => /SET reminder_sent_for/.test(q.sql)).map((q) => q.params[0]);
    expect(marks).toEqual([[10]]);
  });

  test('a failed win-back is not marked either, and is not counted as sent', async () => {
    const j = jobs({ failTo: ['fail@x.test'] });
    const r = await j.run('/api/trpc/reminders.sendWinBackEmails');
    expect(r.body.emailsSent).toBe(1);
    const marks = j.queries.filter((q) => /SET win_back_sent_at/.test(q.sql)).map((q) => q.params[0]);
    expect(marks).toEqual([3]);
    const wb = j.sent.find((x) => x.to === 'jonas@x.test');
    expect(wb.subject).toBe('Schade, dass du gehst, Jonas');
    // What the JOB passes to the footer, not just what the footer can say.
    expect(wb.html).toContain('weil du Trimio Premium hattest');
    expect(wb.html).not.toContain('E-Mail-Erinnerungen');
  });
});

/* The jobs run from a cron with no request, so users.language is the only
   signal, and every account older than 2026-09-30 has it NULL. /auth/me runs
   on every app launch with a session, which is what backfills them. */
test('/auth/me records the language, so existing users get German mail', () => {
  const i = src.indexOf("app.get('/api/auth/me'");
  expect(i).toBeGreaterThan(-1);
  const handler = src.slice(i, src.indexOf('\n});\n', i));
  expect(handler).toContain('recordLanguage(req.userId, req);');
});
