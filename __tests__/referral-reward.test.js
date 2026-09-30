/**
 * THE REFERRAL REWARD: atomicity, the cap, and the email that tells somebody.
 *
 * SOURCE READING, ON PURPOSE, AND THIS HEADER IS THE HONEST PART. The real
 * behaviour here lives in PostgreSQL: whether GREATEST/LEAST shortens an
 * expiry, and whether a failure between the claim and the grant rolls back,
 * are facts about a database and cannot be settled by reading JavaScript.
 * CI has no PostgreSQL, so these assertions pin the SHAPE of the fix and
 * nothing more.
 *
 * THE BEHAVIOUR WAS MEASURED SEPARATELY, against a real PostgreSQL 16 cluster
 * driving this exact function with a real pg Pool, on 2026-09-30:
 *   21 assertions passed against this code.
 *   Against ca029a18 the same scenarios reported, in as many words:
 *     lowered cap  -> inviter had 200 days, now has 30, SHORTENED by 170
 *     injected failure -> referral_rewarded=true, CLAIM CONSUMED, reward lost
 *     retry        -> returned false, REFUSED, nobody is ever paid
 * Do not read a green run of THIS file as proof of any of that.
 */
const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'backend', 'server.js');
const src = fs.readFileSync(SERVER, 'utf8');

/* Block comments are stripped before any "must not contain" assertion, because
   the code explains itself by QUOTING the behaviour it removed. Only block
   comments: stripping // to end of line eats the https:// in a URL. The strip
   is asserted to have removed something, so it cannot pass vacuously. */
function codeOf(text) {
  const out = text.replace(/\/\*[\s\S]*?\*\//g, '');
  if (out.length >= text.length) throw new Error('comment strip removed nothing');
  return out;
}

function rewardReferralSource() {
  const i = src.indexOf('async function rewardReferral(referrerId, referredId) {');
  expect(i).toBeGreaterThan(-1);
  const j = src.indexOf('\n}\n', src.indexOf('client.release();', i));
  expect(j).toBeGreaterThan(i);
  return src.slice(i, j);
}

describe('rewardReferral is one transaction', () => {
  const fn = () => codeOf(rewardReferralSource());

  it('checks out a client and brackets the work in BEGIN and COMMIT', () => {
    const body = fn();
    expect(body).toContain('await pool.connect()');
    expect(body).toContain("client.query('BEGIN')");
    expect(body).toContain("client.query('COMMIT')");
    expect(body).toContain("client.query('ROLLBACK')");
  });

  it('never uses pool.query inside the transaction', () => {
    /* A POOL IS NOT A CONNECTION. pool.query inside a BEGIN can land on a
       different connection than the BEGIN did, which is a transaction that
       silently covers nothing at all. */
    expect(fn()).not.toContain('pool.query');
  });

  it('releases the client in finally', () => {
    expect(fn()).toMatch(/finally\s*\{[^}]*client\.release\(\)/);
  });

  it('locks both participants in a consistent order', () => {
    expect(fn()).toMatch(/ORDER BY id FOR UPDATE/);
  });

  it('claims the flag conditionally, so a retry cannot pay twice', () => {
    expect(fn()).toContain('referral_rewarded = FALSE RETURNING id');
  });
});

describe('the cap can never shorten access already earned', () => {
  it('wraps the LEAST ceiling in a GREATEST against the existing expiry', () => {
    const body = codeOf(rewardReferralSource());
    const set = body.slice(body.indexOf('SET bonus_premium_until ='));
    /* LEAST alone is a cap that points BACKWARDS when the existing expiry is
       already past the ceiling, which is what lowering the Railway variable
       would do to every balance above the new value. */
    expect(set).toMatch(/GREATEST\(\s*COALESCE\(bonus_premium_until, NOW\(\)\),\s*LEAST\(/);
  });

  it('still stacks rather than restarting, via the inner GREATEST', () => {
    expect(codeOf(rewardReferralSource()))
      .toMatch(/GREATEST\(COALESCE\(bonus_premium_until, NOW\(\)\), NOW\(\)\) \+ INTERVAL '30 days'/);
  });
});

describe('the cap variable is validated before it reaches SQL', () => {
  const block = src.slice(src.indexOf('const REFERRAL_MAX_BONUS_MONTHS = (() => {'),
                          src.indexOf('})();', src.indexOf('const REFERRAL_MAX_BONUS_MONTHS = (() => {')));

  it('rejects anything that is not all digits', () => {
    expect(block).toMatch(/\/\^\\d\+\$\/\.test/);
  });

  it('requires a SAFE integer with an upper bound', () => {
    /* All digits is not enough on its own: a long enough run of them parses to
       1e21, and a merely large one makes make_interval answer
       "timestamp out of range", so every reward fails rather than one. */
    expect(block).toContain('Number.isSafeInteger');
    expect(block).toMatch(/n > 1200/);
  });

  it('warns and falls back rather than refusing to boot', () => {
    expect(block).toContain('console.warn');
    expect(block).toContain('return 12;');
  });

  it('no longer uses the lenient parseInt-or-default form', () => {
    expect(codeOf(src)).not.toContain('parseInt(process.env.REFERRAL_MAX_BONUS_MONTHS, 10) || 12');
  });
});

describe('the reward tells the people who earned it', () => {
  const body = () => codeOf(rewardReferralSource());

  it('sends from inside rewardReferral, so a caller cannot forget', () => {
    expect(body()).toContain('sendReferralRewardEmail');
  });

  it('sends only when days were actually granted', () => {
    /* At the balance cap the grant really is nothing, and "you earned 0 days
       of Premium" is a worse message than silence. */
    expect(body()).toMatch(/if \(r\.grantedDays > 0 && r\.email\)/);
  });

  it('sends after COMMIT and never awaits it into the caller', () => {
    const b = body();
    expect(b.indexOf("client.query('COMMIT')")).toBeLessThan(b.indexOf('sendReferralRewardEmail(r)'));
    expect(b).toMatch(/sendReferralRewardEmail\(r\)\.catch\(/);
    expect(b).not.toMatch(/await sendReferralRewardEmail/);
  });

  it('reports the real granted days rather than a flat 30', () => {
    expect(body()).toMatch(/grantedDays: Math\.max\(0, Math\.round\(\(until - base\) \/ 86400000\)\)/);
  });

  it('uses the transaction clock rather than the JS clock', () => {
    expect(body()).toContain('NOW() AS server_now');
  });

  it('carries both languages and a billing note in each', () => {
    const block = src.slice(src.indexOf('const REFERRAL_EMAIL = {'), src.indexOf('function formatBonusDate'));
    expect(block).toMatch(/en:\s*\{/);
    expect(block).toMatch(/de:\s*\{/);
    expect(block).toContain('does not change an existing paid subscription');
    expect(block).toContain('kostenpflichtiges Abo');
  });

  it('formats the date in UTC, not the server timezone', () => {
    /* bonus_premium_until is an instant at midnight UTC, so formatting it in
       the server's zone names the previous day west of UTC. That is the
       parseApiDate bug wearing a different hat. */
    const f = src.slice(src.indexOf('function formatBonusDate'), src.indexOf('async function sendReferralRewardEmail'));
    expect(f).toContain("timeZone: 'UTC'");
  });
});

describe('a failed reward stays retryable', () => {
  it('swallows its own failure rather than 500ing the verification', () => {
    expect(codeOf(rewardReferralSource())).toMatch(/console\.error\([^)]*rolled back/);
  });

  it('verify-email reconciles before its already-verified early return', () => {
    const h = src.slice(src.indexOf("app.post('/api/auth/verify-email'"), src.indexOf("app.get('/api/trpc/referrals.me'"));
    const i = codeOf(h).indexOf('if (user.is_verified)');
    const j = codeOf(h).indexOf('rewardReferral');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(codeOf(h)).toMatch(/user\.referred_by && !user\.referral_rewarded/);
  });

  it('referrals.me reconciles a pending claim, which needs no scheduled job', () => {
    const h = src.slice(src.indexOf("app.get('/api/trpc/referrals.me'"), src.indexOf("app.post('/api/trpc/referrals.redeem'"));
    expect(codeOf(h)).toMatch(/user\.referred_by && user\.is_verified && !user\.referral_rewarded/);
    expect(codeOf(h)).toContain('rewardReferral');
  });
});

describe('the language a person is written to in', () => {
  it('has a column, added additively', () => {
    expect(src).toContain('ADD COLUMN IF NOT EXISTS language TEXT');
  });

  it('is recorded where the header is actually available', () => {
    expect(src).toContain('function recordLanguage(');
    expect(codeOf(src).match(/recordLanguage\(/g).length).toBeGreaterThanOrEqual(4);
  });

  it('never fails the request that carried it', () => {
    const f = src.slice(src.indexOf('function recordLanguage('), src.indexOf('function recordLanguage(') + 400);
    expect(f).toMatch(/\.catch\(\(\) => \{\}\)/);
    expect(f).not.toContain('await');
  });

  it('defaults to English when unknown', () => {
    expect(codeOf(rewardReferralSource())).toMatch(/row\.language === 'de' \? 'de' : 'en'/);
  });
});

describe('the copy matches what the code actually grants', () => {
  const en = require('../locales/en.json');
  const de = require('../locales/de.json');

  it('no longer promises a flat month on either side', () => {
    /* Near the balance cap the real grant is smaller than 30 days, so "you
       both get 1 month" was a promise the calculation could not keep. */
    for (const [name, l] of [['en', en], ['de', de]]) {
      expect(l.referFriend.desc).not.toMatch(/\b1 month\b|\b1 Monat\b/);
      expect(l.referFriend.shareMessage).not.toMatch(/\b1 month\b|\b1 Monat\b/);
      expect(l.profile.referAFriend).not.toMatch(/\b1 month\b|\b1 Monat\b/);
    }
  });

  it('says up to, in both languages', () => {
    expect(en.referFriend.desc).toContain('up to 30 days');
    expect(de.referFriend.desc).toContain('bis zu 30 Tage');
  });

  it('keeps the {{months}} cap token wired', () => {
    expect(en.referFriend.desc).toContain('{{months}}');
    expect(de.referFriend.desc).toContain('{{months}}');
  });
});
