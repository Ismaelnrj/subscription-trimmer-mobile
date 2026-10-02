/**
 * IN-APP NOTIFICATION ROWS ARE WRITTEN IN THE READER'S LANGUAGE AND CURRENCY.
 *
 * The notifications screen renders `title` and `message` exactly as stored, so
 * the server's text IS what people read. Until 2026-10-02 every writer stored
 * English, and two stored a hardcoded dollar sign. MEASURED END TO END on
 * 2026-10-02 by booting the real backend/server.js twice (HEAD and the fix),
 * each against an empty PostgreSQL 16 over TLS, and driving it over HTTP the
 * way the app does: register, add, raise the price, raise it again in another
 * currency, read notifications.getHistory. A German user got, before:
 *     Netflix increased by $2.00 | ... went from $15.99 to $17.99 per monthly.
 *     Netflix increased by $2.00 | ... went from $17.99 to $19.99 per monthly.
 * and after:
 *     Netflix ist um 2,00 € teurer geworden | Dein Abo Netflix kostet jetzt
 *     17,99 € pro Monat statt 15,99 €.
 * The second "increase" was a EUR to USD edit, a difference between two units,
 * and is no longer announced as a rise.
 *
 * Behavioural for the copy (the real const and formatter are executed); a scan
 * for the writers, so a fifth one cannot arrive in English unnoticed.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'server.js'), 'utf8');
const fn = (sig) => { const i = src.indexOf(sig); expect(i).toBeGreaterThan(-1); return src.slice(i, src.indexOf('\n}\n', i) + 2); };
const konst = (sig) => { const i = src.indexOf(sig); expect(i).toBeGreaterThan(-1); return src.slice(i, src.indexOf('\n};\n', i) + 3); };

function lib() {
  return new Function(
    konst('const CYCLE_NOUN = {') + '\n' + fn('function formatEmailPrice(') + '\n' +
    konst('const NOTIFICATION_TEXT = {') + '\n; return { NOTIFICATION_TEXT, formatEmailPrice };'
  )();
}

describe('the copy, rendered', () => {
  const { NOTIFICATION_TEXT: T, formatEmailPrice: money } = lib();

  test('German rows read in German with the row currency in German format', () => {
    expect(T.de.welcomeTitle).toBe('Willkommen bei Trimio!');
    expect(T.de.addedBody('Netflix', money(15.99, 'EUR', 'EUR', 'monthly', 'de')))
      .toBe('Netflix (15,99 € pro Monat) wurde hinzugefügt.');
    expect(T.de.increaseTitle('Netflix', money(2, 'EUR', 'EUR', null, 'de')))
      .toBe('Netflix ist um 2,00 € teurer geworden');
    expect(T.de.increaseBody('Netflix', money(15.99, 'EUR', 'EUR', null, 'de'), money(17.99, 'EUR', 'EUR', 'monthly', 'de')))
      .toBe('Dein Abo Netflix kostet jetzt 17,99 € pro Monat statt 15,99 €.');
  });

  test('English keeps its wording, with a real symbol and a real cycle word', () => {
    expect(T.en.welcomeTitle).toBe('Welcome to Trimio!');
    expect(T.en.addedTitle).toBe('Subscription Added');
    expect(T.en.addedBody('Disney+', money(19.99, 'USD', 'USD', 'yearly', 'en'))).toBe('Disney+ ($19.99/year) was added.');
    expect(T.en.increaseBody('Disney+', money(19.99, 'USD', 'USD', null, 'en'), money(21.99, 'USD', 'USD', 'yearly', 'en')))
      .toBe('Your Disney+ subscription went from $19.99 to $21.99/year.');
  });

  test('a euro row is never written with a dollar sign, in either language', () => {
    for (const lang of ['en', 'de']) {
      const body = T[lang].increaseBody('N', money(15.99, 'EUR', 'EUR', null, lang), money(17.99, 'EUR', 'EUR', 'monthly', lang));
      expect(body).toContain('€');
      expect(body).not.toContain('$');
      expect(body).not.toMatch(/monthly|yearly|weekly/);
    }
  });

  test('German uses umlauts and du, and no dash as punctuation', () => {
    const de = JSON.stringify(Object.values(T.de).map((v) => (typeof v === 'function' ? v('N', '1 €', '2 €') : v)));
    expect(de).toMatch(/[äöü]/);
    expect(de).toMatch(/\b(deine|Dein)\b/);
    expect(de).not.toMatch(/\b(Sie|Ihre|Ihr)\b/);
    expect(de).not.toMatch(/[–—]|\s-\s/);
  });
});

describe('every writer', () => {
  /* Each INSERT plus the lines that build its values: the window is the 700
     characters before the statement through the end of its pool.query call. */
  const writers = [];
  let i = -1;
  while ((i = src.indexOf('INSERT INTO notifications', i + 1)) !== -1) {
    writers.push(src.slice(Math.max(0, i - 700), src.indexOf(');', i) + 2));
  }

  test('there are four, so the scan below is not checking nothing', () => {
    expect(writers.length).toBe(4);
  });

  test('every one takes its text from NOTIFICATION_TEXT in the request language', () => {
    for (const w of writers) {
      expect(w).toContain('NOTIFICATION_TEXT');
      expect(w).toContain('languageOf(req)');
    }
  });

  test('none carries English literals or a hardcoded dollar sign any more', () => {
    for (const w of writers) {
      const call = w.slice(w.indexOf('INSERT INTO notifications'));
      expect(call).not.toMatch(/'Welcome to Trimio!'|'Subscription Added'|increased by|\$\$\{/);
    }
  });

  test('a price change across two currencies is not announced as a rise', () => {
    expect(src).toContain('const oldCurrency = existing.currency || currency;');
    expect(src).toContain('if (price > oldPrice && oldCurrency === currency) {');
  });
});
