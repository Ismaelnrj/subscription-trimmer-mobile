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
 * SOURCE READING. Since 2026-10-24 no contact data goes to Brevo at all, so
 * the guard refuses any contact endpoint or sync helper coming back.
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

test('nothing is written to a Brevo contact at all', () => {
  /* Since 2026-10-24 Brevo receives the emails and nothing else. The PLAN and
     SUB_COUNT contact sync fed campaigns that were never sent. */
  expect(code).not.toMatch(/api\.brevo\.com\/v3\/contacts/);
  for (const name of ['updateBrevoContact', 'syncBrevoPlan', 'syncBrevoSubCount', 'syncSubCountToBrevo']) {
    expect(code).not.toContain(name);
  }
});

test('the only Brevo endpoint left is the transactional send', () => {
  const hosts = [...code.matchAll(/https:\/\/api\.brevo\.com\/[^'"`\s]*/g)].map((m) => m[0]);
  expect(hosts.length).toBeGreaterThanOrEqual(1);
  expect([...new Set(hosts)]).toEqual(['https://api.brevo.com/v3/smtp/email']);
});

test('the renewal digest and everything that built it are gone', () => {
  for (const name of ['UPCOMING_RENEWALS', 'TOTAL_AMOUNT', 'NEXT_RENEWAL_DATE', 'syncNextRenewalToBrevo', 'RENEWAL_DIGEST_WINDOW_DAYS']) {
    expect(code).not.toContain(name);
  }
});
