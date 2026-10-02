/**
 * SERVER ERROR TEXT REACHES A GERMAN READER IN GERMAN.
 *
 * The app shows `err.response.data.error` verbatim on login, signup, email
 * verification and password reset, so until 2026-10-02 a German user who typed
 * a wrong password read "Invalid email or password", on the first screens a new
 * user meets. MEASURED by booting the real backend/server.js twice (HEAD and
 * the fix) against an empty PostgreSQL 16 over TLS and driving it over HTTP
 * with `Accept-Language: de`. Before, every case was English; after:
 *     login, wrong password   401 "E-Mail-Adresse oder Passwort ist falsch."
 *     register, weak password 400 "Das Passwort muss mindestens 8 Zeichen lang sein."
 *     verify, wrong code      400 "Ungültiger Code."
 *     rate limited            429 "Zu viele Versuche. Bitte versuche es in 15 Minuten erneut."
 * while `en`, no header, and "Email already registered" were byte for byte
 * unchanged.
 *
 * Behavioural for the middleware (the real block is executed); a SCAN for the
 * coverage, so a new user-facing error cannot arrive without somebody deciding
 * whether it needs German.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');

const dictStart = src.indexOf('const ERROR_TEXT_DE = {');
const dictSrc = src.slice(dictStart, src.indexOf('\n};\n', dictStart) + 3);
const mwStart = src.indexOf("app.use((req, res, next) => {\n  if (languageOf(req) !== 'de') return next();");
const mwSrc = src.slice(mwStart, src.indexOf('\n});\n', mwStart) + 4);

const languageOfSrc = (() => {
  const i = src.indexOf('function languageOf(req)');
  return src.slice(i, src.indexOf('\n}\n', i) + 2);
})();

function load() {
  let mounted;
  const app = { use: (fn) => { mounted = fn; } };
  const DICT = new Function('app', `${languageOfSrc}\n${dictSrc}\n${mwSrc}\nreturn ERROR_TEXT_DE;`)(app);
  return { DICT, mw: mounted };
}

function run(mw, lang, status, body) {
  const req = { headers: lang == null ? {} : { 'accept-language': lang } };
  let sent;
  const res = { statusCode: status, json: (b) => { sent = b; return res; } };
  mw(req, res, () => {});
  res.json(body);
  return sent;
}

describe('the middleware, executed', () => {
  const { DICT, mw } = load();

  test('both blocks were found, so nothing below passes vacuously', () => {
    expect(dictStart).toBeGreaterThan(-1);
    expect(mwStart).toBeGreaterThan(-1);
    expect(typeof mw).toBe('function');
    expect(Object.keys(DICT).length).toBeGreaterThan(20);
  });

  test('German and regional German get German text', () => {
    expect(run(mw, 'de', 401, { error: 'Invalid email or password' }).error)
      .toBe('E-Mail-Adresse oder Passwort ist falsch.');
    expect(run(mw, 'de-AT', 400, { error: 'Invalid code' }).error).toBe('Ungültiger Code.');
  });

  test('English, other languages and a missing header are untouched', () => {
    for (const lang of ['en', 'fr', null]) {
      expect(run(mw, lang, 401, { error: 'Invalid email or password' }).error).toBe('Invalid email or password');
    }
  });

  test('only error statuses change, and only known strings', () => {
    expect(run(mw, 'de', 200, { error: 'Invalid code' }).error).toBe('Invalid code');
    expect(run(mw, 'de', 400, { error: 'Something nobody mapped' }).error).toBe('Something nobody mapped');
    expect(run(mw, 'de', 400, { error: 'constructor' }).error).toBe('constructor');
  });

  test('other fields on the body survive, the 403 limit among them', () => {
    const out = run(mw, 'de', 403, { error: 'FREE_LIMIT_REACHED', limit: 5 });
    expect(out).toEqual({ error: 'FREE_LIMIT_REACHED', limit: 5 });
    const mapped = run(mw, 'de', 400, { error: 'Invalid code', extra: 1 });
    expect(mapped.extra).toBe(1);
  });
});

describe('what the dictionary may and may not hold', () => {
  const { DICT } = load();

  test('no machine code is translated, since clients compare those by value', () => {
    for (const k of Object.keys(DICT)) expect(k).not.toMatch(/^[A-Z][A-Z0-9_]+$/);
  });

  test('"Email already registered" stays English, because register.tsx tests it for "already"', () => {
    expect(Object.prototype.hasOwnProperty.call(DICT, 'Email already registered')).toBe(false);
    const register = fs.readFileSync(path.join(root, 'app', 'register.tsx'), 'utf8');
    expect(register).toMatch(/includes\("already"\)/);
  });

  test('every key is a string the server really sends, so a typo cannot hide', () => {
    const rest = src.slice(0, dictStart) + src.slice(dictStart + dictSrc.length);
    const missing = Object.keys(DICT).filter((k) => !rest.includes(`'${k}'`));
    expect(missing).toEqual([]);
  });

  test('German values carry no dash as clause punctuation', () => {
    for (const v of Object.values(DICT)) expect(v).not.toMatch(/ [-–—] |[–—]/);
  });

  test('mounted before the first rate limiter, so 429s are translated too', () => {
    const firstLimiter = src.search(/app\.use\('\/api\/[^']+', \w+Limiter\)/);
    expect(firstLimiter).toBeGreaterThan(-1);
    expect(mwStart).toBeLessThan(firstLimiter);
    expect(mwStart).toBeGreaterThan(src.indexOf('app.use(express.json());'));
  });
});

describe('coverage, by scan', () => {
  const { DICT } = load();
  // Each of these was looked at and deliberately left English: machine codes
  // clients compare by value, the one string register.tsx inspects, and
  // errors only a developer or a third party can provoke.
  const DECIDED_ENGLISH = new Set([
    'FREE_LIMIT_REACHED', 'DUPLICATE_SUBSCRIPTION', 'PREMIUM_VERIFICATION_UNAVAILABLE',
    'GOOGLE_ID_TOKEN_REQUIRED',
    'Email already registered',
    'subscriptionId required', 'Subscription id required', 'id and isActive required',
    'id and cancelled required', 'idToken required', 'Refresh token required',
    'Invalid token', 'Invalid or expired refresh token',
    'budgetGoal must be a positive number or null', 'alertThreshold must be a positive number',
    'since must be an ISO date, for example 2026-10-01T08:00:00Z',
    'Webhook not configured', 'Missing event', 'Missing event.app_user_id',
  ]);

  test('every error string the server sends is either translated or decided', () => {
    const sent = new Set([...src.matchAll(/error: '([^']+)'/g)].map((m) => m[1]));
    const fn = src.indexOf('function validatePassword(');
    const body = src.slice(fn, src.indexOf('\n}\n', fn));
    for (const m of body.matchAll(/return '([^']+)'/g)) sent.add(m[1]);
    expect(sent.size).toBeGreaterThan(40);
    const undecided = [...sent].filter((s) => !(s in DICT) && !DECIDED_ENGLISH.has(s));
    expect(undecided).toEqual([]);
  });
});
