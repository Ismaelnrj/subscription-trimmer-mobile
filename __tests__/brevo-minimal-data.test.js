/**
 * BREVO RECEIVES THE LEAST IT NEEDS, AND NEVER WHAT SOMEBODY SUBSCRIBES TO.
 *
 * Until 2026-10-01 every add, edit, pause, cancel and delete pushed the user's
 * upcoming subscription NAMES, prices and renewal dates into their Brevo
 * contact, for every user, free or paid, opted out or not:
 *     UPCOMING_RENEWALS  "Netflix ($15.99/monthly) · 2026-10-16; ..."
 *     TOTAL_AMOUNT, NEXT_RENEWAL_DATE, CURRENCY_SYMBOL
 * It existed to feed a Brevo renewal automation. Four days after it was added
 * the win-back moved OUT of Brevo Automation because workflows are "gated
 * behind a plan we don't have", so the automation it fed almost certainly never
 * ran, while the real reminder is sent from code. What a person pays for is
 * personal data, and some of it is sensitive.
 *
 * SOURCE READING, and the reason is the shape of the risk: the way this comes
 * back is somebody adding a new attribute to a contact sync, so the guard reads
 * every updateBrevoContact call and allows only the two attributes that remain.
 * Comments are stripped first, because the explanation of the removal names
 * the attributes it removed.
 */
const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, '..', 'backend', 'server.js'), 'utf8');
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the comment strip removed something, so nothing below passes vacuously', () => {
  expect(code.length).toBeLessThan(raw.length);
});

test('only PLAN and SUB_COUNT are ever written to a Brevo contact', () => {
  const calls = [...code.matchAll(/updateBrevoContact\(\s*\w+\s*,\s*\{([^}]*)\}/g)];
  expect(calls.length).toBeGreaterThanOrEqual(2);
  const keys = new Set();
  for (const [, body] of calls) {
    for (const [, k] of body.matchAll(/(\w+)\s*:/g)) keys.add(k);
  }
  expect([...keys].sort()).toEqual(['PLAN', 'SUB_COUNT']);
});

test('the renewal digest and everything that built it are gone', () => {
  for (const name of ['UPCOMING_RENEWALS', 'TOTAL_AMOUNT', 'NEXT_RENEWAL_DATE', 'syncNextRenewalToBrevo', 'RENEWAL_DIGEST_WINDOW_DAYS']) {
    expect(code).not.toContain(name);
  }
});

/* The other way it comes back: a contact sync that passes a whole object built
   elsewhere, which the key scan above could not read. */
test('every contact update passes a literal object the scan can read', () => {
  const all = [...code.matchAll(/updateBrevoContact\(([^)]*)\)/g)].map((m) => m[1]);
  const literal = [...code.matchAll(/updateBrevoContact\(\s*\w+\s*,\s*\{/g)];
  // The function's own declaration is the only call-shaped match without an object.
  expect(all.filter((a) => !/\{/.test(a))).toEqual(['email, attributes']);
  expect(literal.length).toBe(all.length - 1);
});
