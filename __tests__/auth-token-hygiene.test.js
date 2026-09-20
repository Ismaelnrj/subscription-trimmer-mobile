/* The generators and comparisons that guard accounts, from the 2026-09-20
 * security audit. Five small things, none of which was an open hole, all of
 * which were a bad default sitting next to a comment explaining why not to.
 *
 * WHAT IT RUNS. The real functions are lifted out of backend/server.js by text
 * and executed. Nothing is reimplemented here, so the source the server ships
 * is what these assertions measure. Requiring the module is not an option: it
 * opens a database pool at import and would need a live DATABASE_URL to load.
 *
 * WHY THAT MATTERS more than usual in this file. Four of the five changes are
 * invisible from the outside: a referral code from crypto.randomInt looks
 * exactly like one from Math.random, and a constant time compare returns the
 * same booleans as `!==`. A test that only checked the visible behaviour would
 * pass just as happily against the old code. So each one is NEGATIVE TESTED
 * against the previous implementation, which is the only honest way to show
 * the change did anything at all.
 *
 * It also reports, rather than throws, when a function is renamed or moved: a
 * harness that quietly stops finding the code it tests is the exact failure
 * mode this project keeps recording, and one that dies at module load reports
 * "0 passed, 0 failed", which looks survivable and is not.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SRC = fs.readFileSync(
  path.join(__dirname, "..", "backend", "server.js"), "utf8");

/** One top level function, delimited by matching braces, or "" if it is gone.
 *
 *  Braces rather than a regex, for the reason recorded in
 *  calendar-grid-geometry.test.js: a lazy `[^}]*` stops at the first `}` it
 *  meets, which inside a function body is almost never the right one.
 *
 *  RETURNS EMPTY RATHER THAN THROWING, which is not a detail. Throwing here
 *  runs at module load, so a single missing function takes the whole file down
 *  with a stack trace and the run reports "0 passed, 0 failed". That is the
 *  silent-pass shape this project keeps rediscovering: nothing ran, nothing
 *  failed, and the summary looks survivable. A missing function is instead
 *  reported by the named assertion below. */
function lift(name) {
  const at = SRC.indexOf(`function ${name}(`);
  if (at === -1) return "";
  let depth = 0, started = false;
  for (let i = at; i < SRC.length; i++) {
    if (SRC[i] === "{") { depth++; started = true; }
    else if (SRC[i] === "}" && --depth === 0 && started) return SRC.slice(at, i + 1);
  }
  return "";
}

const NAMES = ["hashToken", "tokenMatches", "secretMatches", "generateOpenId",
               "generateReferralCode", "generateCode"];
const MISSING = NAMES.filter((n) => lift(n) === "");

/* Every name resolves to something callable, so an absent one produces a named
   failure in its own describe block rather than a TypeError in an unrelated
   one. The stub returns a value no assertion here accepts. */
const absent = () => "__NOT_IN_SERVER_JS__";
const lifted = MISSING.length
  ? Object.fromEntries(NAMES.map((n) => [n, absent]))
  : new Function("crypto", "Buffer",
      `${NAMES.map(lift).join("\n")}; return {${NAMES.join(",")}};`)(crypto, Buffer);

const { hashToken, tokenMatches, secretMatches, generateOpenId, generateReferralCode, generateCode } = lifted;

describe("the harness is actually pointed at the code", () => {
  /* FIRST, deliberately. If backend/server.js has been restructured, every
     assertion below is measuring a stub and would otherwise fail with a
     confusing message about hex digits. This one says what really happened. */
  it("finds every function it claims to test", () => {
    expect(MISSING.join(", ") || "none missing").toBe("none missing");
  });
});

const REFERRAL_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

describe("generateOpenId", () => {
  /* The public account identifier, and the app_user_id RevenueCat knows a
     subscriber by. It authorises nothing, so this is a bad default being
     hardened rather than a hole being closed, but a guessable account id is
     not something to ship on purpose. */

  it("is 128 bits of hex, not a clock and a weak PRNG", () => {
    expect(generateOpenId()).toMatch(/^u_[0-9a-f]{32}$/);
  });

  it("does not collide", () => {
    const ids = new Set(Array.from({ length: 5000 }, generateOpenId));
    expect(ids.size).toBe(5000);
  });

  it("no longer leaks when the account was created", () => {
    /* THE assertion in this block, and it only means something next to the old
       implementation. `'u_' + Date.now() + ...` put the millisecond in the id,
       so two accounts made in the same second shared a long leading run.

       An earlier attempt asserted "contains no run of 13 digits" and failed
       against correct code: random hex produces one by chance about 7% of the
       time. That was a bad test, not a bad id, and it is recorded here because
       the fix looks identical either way. */
    const oldOpenId = () =>
      "u_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const shared = (a, b) => { let n = 0; while (n < a.length && a[n] === b[n]) n++; return n; };
    const worst = (f) =>
      Math.max(...Array.from({ length: 400 }, () => shared(f(), f())));

    expect(worst(oldOpenId)).toBeGreaterThanOrEqual(13);  // the clock, in characters
    expect(worst(generateOpenId)).toBeLessThanOrEqual(8); // chance alone
  });

  it("cannot be sorted back into the order the accounts were made", () => {
    const minted = Array.from({ length: 200 }, generateOpenId);
    expect([...minted].sort()).not.toEqual(minted);
  });

  it("is what the account creation paths actually call", () => {
    /* Found by negative testing, and it is the gap that mattered most. Every
       assertion above tests the FUNCTION, so reverting only the two call sites
       back to inline `'u_' + Date.now() + ...` left the helper sitting there
       correct and unused, and the whole suite passed.

       Registration and Google sign in are the two places an account is made.
       Both must go through the helper, and no inline construction may survive
       anywhere. */
    const calls = SRC.match(/const openId = generateOpenId\(\);/g) || [];
    expect(calls.length).toBe(2);
    expect(SRC).not.toMatch(/openId\s*=\s*['"]u_['"]\s*\+/);
    expect(SRC).not.toMatch(/INSERT INTO users[\s\S]{0,400}Date\.now\(\)/);
  });
});

describe("generateReferralCode", () => {
  /* Worth a free month each, and it was using Math.random while the comment on
     generateCode two screens above said why not to. Brute force was never the
     exposure (31^6 against a 60 per minute ceiling), predictability was. */

  it("keeps the charset and length the UI and the share copy assume", () => {
    const codes = Array.from({ length: 5000 }, generateReferralCode);
    expect(codes.every((c) => new RegExp(`^[${REFERRAL_CHARS}]{6}$`).test(c))).toBe(true);
  });

  it("still avoids the characters people misread", () => {
    // 0/O and 1/I/L. Somebody reads these off a screen and types them.
    const codes = Array.from({ length: 5000 }, generateReferralCode);
    expect(codes.some((c) => /[01ILO]/.test(c))).toBe(false);
  });

  it("draws every symbol, with no modulo bias", () => {
    /* Math.floor(Math.random() * n) is biased once n does not divide the range
       evenly; randomInt is not. At 31 symbols the effect is tiny and this is
       really a check that the charset is fully reachable, which a wrong bound
       (randomInt(0, length - 1)) would silently break by never drawing the
       last character. That is the mistake worth catching here. */
    const counts = new Map();
    for (const c of Array.from({ length: 20000 }, generateReferralCode))
      for (const ch of c) counts.set(ch, (counts.get(ch) || 0) + 1);

    expect(counts.size).toBe(REFERRAL_CHARS.length);
    const expected = (20000 * 6) / REFERRAL_CHARS.length;
    const ratios = [...counts.values()].map((n) => n / expected);
    expect(Math.min(...ratios)).toBeGreaterThan(0.85);
    expect(Math.max(...ratios)).toBeLessThan(1.15);
  });
});

describe("tokenMatches", () => {
  /* Email verification and password reset. Honest about the size of it: what
     `!==` compared was two SHA-256 hashes rather than the secret, so this is
     consistency with applyUnsubscribe, which already did it properly, more
     than it is a vulnerability closed. */

  const stored = hashToken("123456");

  it("accepts the right code", () => {
    expect(tokenMatches(stored, "123456")).toBe(true);
  });

  it("rejects a wrong code", () => {
    expect(tokenMatches(stored, "123457")).toBe(false);
    expect(tokenMatches(stored, "000000")).toBe(false);
  });

  it("accepts a code that arrived as a number", () => {
    // req.body is JSON; a client sending 123456 unquoted is not an attack.
    expect(tokenMatches(stored, 123456)).toBe(true);
  });

  it("refuses when there is no stored token at all", () => {
    /* The old call sites guarded this with `!user.verification_token ||`
       before comparing. That guard now lives inside, so removing it from a
       caller cannot turn a null column into a match. */
    for (const empty of [null, undefined, "", 0, false])
      expect(tokenMatches(empty, "123456")).toBe(false);
  });

  it("refuses an absent code", () => {
    expect(tokenMatches(stored, null)).toBe(false);
    expect(tokenMatches(stored, undefined)).toBe(false);
  });

  it("returns false rather than throwing on a code that is not a string", () => {
    /* The reason this is a real improvement and not only tidying. `code` comes
       straight off req.body, so {"code": {}} used to reach crypto.update(),
       throw a TypeError, and answer 500 where the honest reply is "invalid".
       Asserted against the old expression so the difference is legible. */
    expect(() => hashToken({})).toThrow();               // pre-fix
    expect(tokenMatches(stored, {})).toBe(false);        // post-fix
    expect(tokenMatches(stored, [])).toBe(false);
    expect(tokenMatches(stored, { toString: () => "123456" })).toBe(true);
  });

  it("survives a stored hash of the wrong length", () => {
    // timingSafeEqual THROWS on a length mismatch rather than returning false,
    // so a truncated column must be handled before it is reached.
    expect(tokenMatches("deadbeef", "123456")).toBe(false);
    expect(tokenMatches(stored + "ff", "123456")).toBe(false);
  });
});

describe("secretMatches, the cron shared secret", () => {
  /* The two reminder cron routes compared the RAW secret with `!==`. That is
     the same class as tokenMatches and MORE deserving of it: tokenMatches
     compares two hashes, so an early exit leaks a hash prefix and there is no
     path back to the code, while these leak the secret's own prefix. Network
     jitter swamps it in practice and it was never the weak point, but the
     cheaper of the two comparisons should not be the careful one. */

  it("accepts the right secret and rejects a wrong one", () => {
    expect(secretMatches("s3cret", "s3cret")).toBe(true);
    expect(secretMatches("s3cres", "s3cret")).toBe(false);
    expect(secretMatches("s3cret-longer", "s3cret")).toBe(false);
  });

  it("REFUSES EVERYTHING when the secret is not configured", () => {
    /* The behaviour that must not change, and the reason the old guard read
       `!process.env.CRON_SECRET || ...`. With nothing configured the route has
       to reject every caller. Treating absent as a match would turn an unset
       Railway variable into an open endpoint that sends email to every user. */
    for (const unset of [undefined, null, ""])
      for (const attempt of ["", "anything", undefined, null])
        expect(secretMatches(attempt, unset)).toBe(false);
  });

  it("refuses a missing header even when the secret IS configured", () => {
    for (const absent of [undefined, null, ""])
      expect(secretMatches(absent, "s3cret")).toBe(false);
  });

  it("does not throw on a non-string header", () => {
    // req.headers can hand back an array when a header is sent twice.
    expect(secretMatches(["a", "b"], "s3cret")).toBe(false);
    expect(secretMatches({}, "s3cret")).toBe(false);
  });

  it("is what both cron routes actually call", () => {
    /* Same gap the openId assertion covers: testing the helper proves nothing
       if the routes still compare inline. Both must go through it, and no
       `!== process.env.CRON_SECRET` may survive. */
    const calls = SRC.match(/secretMatches\(secret, process\.env\.CRON_SECRET\)/g) || [];
    expect(calls.length).toBe(2);
    expect(SRC).not.toMatch(/secret\s*!==\s*process\.env\.CRON_SECRET/);
  });

  it("leaves the RevenueCat webhook's own compare alone", () => {
    /* Deliberately NOT refactored to use this helper. It is already correct,
       it is the path that grants premium, and a diff on the revenue path buys
       nothing here. Pinned so a later tidy is a conscious decision. */
    expect(SRC).toMatch(/timingSafeEqual\(provided, expected\)/);
  });
});

describe("generateCode, unchanged, confirmed still unchanged", () => {
  // It was already correct. Pinned so a later tidy of its neighbours cannot
  // quietly drag it back to Math.random.
  it("is six digits", () => {
    expect(Array.from({ length: 2000 }, generateCode)
      .every((c) => /^\d{6}$/.test(c))).toBe(true);
  });

  it("uses crypto, not Math.random", () => {
    expect(lift("generateCode")).toMatch(/crypto\.randomInt/);
    expect(lift("generateCode")).not.toMatch(/Math\.random/);
    expect(lift("generateReferralCode")).not.toMatch(/Math\.random/);
    expect(lift("generateOpenId")).not.toMatch(/Math\.random|Date\.now/);
  });
});

describe("the unauthenticated token endpoints carry a ceiling", () => {
  /* Source reading, because the mounts are express wiring rather than a
     function that can be lifted and run. These two were the only routes with
     no limit at all, which is easy to miss: neither is a password endpoint, so
     the mount list reads complete without them. */

  it("google and refresh are both mounted on a limiter", () => {
    expect(SRC).toMatch(/app\.use\('\/api\/auth\/google',\s*(\w+)\)/);
    expect(SRC).toMatch(/app\.use\('\/api\/auth\/refresh',\s*(\w+)\)/);
  });

  it("the limiter they use is defined before they mount it", () => {
    const name = /app\.use\('\/api\/auth\/refresh',\s*(\w+)\)/.exec(SRC)[1];
    const defined = SRC.indexOf(`const ${name} = rateLimit(`);
    expect(defined).toBeGreaterThan(-1);
    expect(defined).toBeLessThan(SRC.indexOf(`app.use('/api/auth/refresh'`));
  });

  it("is loose enough that ordinary traffic never reaches it", () => {
    /* THE THING THAT WOULD BREAK THE APP if it were got wrong, and the reason
       these two do not simply reuse authLimiter.

       An access token lives an hour, so EVERY active user refreshes roughly
       hourly, and mobile carriers put large numbers of subscribers behind one
       CGNAT address. express-rate-limit keys on IP. authLimiter's 10 per 15
       minutes would be spent by real traffic from a single carrier and would
       sign people out, which is worse than the abuse it prevents.

       So the assertion is a FLOOR, not a ceiling: whatever limiter these two
       end up on must be generous. Raise it if real traffic approaches it. */
    const name = /app\.use\('\/api\/auth\/refresh',\s*(\w+)\)/.exec(SRC)[1];
    const at = SRC.indexOf(`const ${name} = rateLimit(`);
    const body = SRC.slice(at, SRC.indexOf("});", at));

    /* windowMs is written `15 * 60 * 1000`, an EXPRESSION. A first version of
       this read it with /windowMs:\s*(\d+)/, which captured 15 and computed a
       budget 40000 times too generous, so mounting refresh on the tight
       authLimiter sailed through. The negative test caught it; the assertion
       did not. Evaluate the arithmetic instead of grabbing the first integer,
       and refuse anything that is not plain arithmetic. */
    const value = (prop) => {
      const m = new RegExp(`${prop}:\\s*([0-9*+\\s]+?),`).exec(body);
      expect(m).not.toBe(null);
      return Function(`"use strict"; return (${m[1]});`)();
    };
    const perMinute = value("max") / (value("windowMs") / 60000);

    expect(perMinute).toBeGreaterThanOrEqual(8);  // per IP, and a CGNAT is one IP
    expect(perMinute).toBeLessThan(1000);         // but still a ceiling
  });

  it("every other auth route still has the limiter it had", () => {
    // Adding two mounts must not have disturbed the existing list.
    for (const [route, limiter] of [
      ["/api/auth/register", "authLimiter"],
      ["/api/auth/login", "authLimiter"],
      ["/api/auth/forgot-password", "emailLimiter"],
      ["/api/auth/resend-verification", "emailLimiter"],
      ["/api/auth/verify-email", "codeLimiter"],
      ["/api/auth/reset-password", "codeLimiter"],
      ["/api/auth/account", "authLimiter"],
      ["/api/trpc", "apiLimiter"],
    ]) {
      expect(SRC).toContain(`app.use('${route}', ${limiter});`);
    }
  });
});
