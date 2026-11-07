/* THE REVERSE TRIAL, 2026-11-07: every new account gets 14 days of Premium
   with no card and drops back to the free tier unless it subscribes.

   MEASURED SEPARATELY, by booting the REAL server (and the previous one from
   origin/master) on PostgreSQL 16 and driving it over HTTP, 21 checks:
     - a new email account is Premium with hasPaidPlan false, free Premium
       ending 14 days out and trial_started_at set; /auth/me agrees;
     - it can add six subscriptions (free limit 5); once the trial ends it is
       free, keeps all six, and a seventh is refused with FREE_LIMIT_REACHED;
     - the funnel counts started / active / paid, and a paying account reports
       hasPaidPlan true;
     - PREMIUM_TRIAL_DAYS=0 gives a free account with no marker, and a typo
       ("1e3") warns once and falls back to 14;
     - the previous server gives a free account (the baseline);
     - the new server booted twice on the database the previous one built
       grants nothing to the account made before the deploy and the trial to
       one made after it;
     - the Google signup INSERT, lifted out of this file and executed on the
       same database, grants 14 days, and nothing at 0 (that route answers 503
       without GOOGLE_CLIENT_IDS, so it cannot be driven over HTTP here).
   CI has no PostgreSQL, so this file is the guard on the source and on the
   parts that run without a database. Do not read a green run of it as proof
   of the SQL. */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const server = read("backend/server.js");
const code = (s) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");

describe("PREMIUM_TRIAL_DAYS", () => {
  const head = "const PREMIUM_TRIAL_DAYS = (() => {";
  const start = server.indexOf(head);
  const body = server.slice(start, server.indexOf("\n})();", start) + "\n})();".length);
  const parse = (raw) => {
    const warnings = [];
    const env = raw === undefined ? {} : { PREMIUM_TRIAL_DAYS: raw };
    const fn = new Function("process", "console", body.replace("const PREMIUM_TRIAL_DAYS =", "return"));
    const value = fn({ env }, { warn: (m) => warnings.push(m) });
    return { value, warnings };
  };

  it("exists", () => expect(start).toBeGreaterThan(0));
  it("defaults to 14 days", () => {
    expect(parse(undefined).value).toBe(14);
    expect(parse("").value).toBe(14);
  });
  it("0 switches the trial off, without a warning", () => {
    expect(parse("0")).toEqual({ value: 0, warnings: [] });
  });
  it("takes a whole number up to 90", () => {
    expect(parse("7").value).toBe(7);
    expect(parse(" 30 ").value).toBe(30);
    expect(parse("90").value).toBe(90);
  });
  it("a typo warns and falls back to 14, never to 0 and never to more", () => {
    for (const raw of ["1e3", "3.5", "-1", "91", "abc", "14 days"]) {
      const r = parse(raw);
      expect([raw, r.value, r.warnings.length]).toEqual([raw, 14, 1]);
    }
  });
});

describe("both account creation paths grant it", () => {
  const inserts = code(server).match(/INSERT INTO users \([^)]*\)[\s\S]*?RETURNING \*`,\s*\[[^\]]*\]/g) ?? [];

  it("there are exactly two INSERTs into users, and both carry the trial", () => {
    expect(inserts.length).toBe(2);
    for (const ins of inserts) {
      expect(ins).toMatch(/bonus_premium_until, trial_started_at\)/);
      expect(ins).toMatch(/\$\{trialValuesSql\(5\)\}/);
      expect(ins).toMatch(/PREMIUM_TRIAL_DAYS\]$/);
    }
  });

  it("one is the Google signup, which is verified on arrival", () => {
    expect(inserts.some((i) => /google_id, is_verified/.test(i))).toBe(true);
  });

  it("the SQL grants nothing at 0 days", () => {
    const start = server.indexOf("const trialValuesSql = (n) =>");
    const helper = server.slice(start, server.indexOf(";", server.indexOf("END`", start)) + 1);
    const sql = new Function(helper + "\nreturn trialValuesSql(5);")();
    expect(sql).toBe(
      "CASE WHEN $5::int > 0 THEN NOW() + make_interval(days => $5::int) END, CASE WHEN $5::int > 0 THEN NOW() END",
    );
  });

  it("the marker column is added at boot", () => {
    expect(server).toMatch(/ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ/);
  });
});

describe("the account says whether a purchase stands behind its Premium", () => {
  const lift = (sig) => {
    const i = server.indexOf(sig);
    return server.slice(i, server.indexOf("\n}\n", i) + 2);
  };
  const formatUser = new Function(lift("function hasBonusPremium(") + lift("function formatUser(") + "\nreturn formatUser;")();
  const future = new Date(Date.now() + 5 * 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();

  it("in the trial: Premium, no paid plan", () => {
    const u = formatUser({ is_paid: false, bonus_premium_until: future });
    expect([u.isPaid, u.hasPaidPlan, u.bonusPremiumUntil]).toEqual([true, false, future]);
  });
  it("after the trial: free", () => {
    const u = formatUser({ is_paid: false, bonus_premium_until: past });
    expect([u.isPaid, u.hasPaidPlan]).toEqual([false, false]);
  });
  it("bought: both true, during the trial or after it", () => {
    expect(formatUser({ is_paid: true, bonus_premium_until: future }).hasPaidPlan).toBe(true);
    expect(formatUser({ is_paid: true, bonus_premium_until: null }).isPaid).toBe(true);
  });
});

describe("the app reads the purchase, not the Premium, where that is the question", () => {
  const upgrade = code(read("app/upgrade.tsx"));
  const profile = code(read("app/(tabs)/profile.tsx"));
  const dashboard = code(read("app/(tabs)/index.tsx"));

  it("the purchase screen opens on the plans for an account with no purchase", () => {
    expect(upgrade).toMatch(/useState\(hasPaidPlan\(user\)\)/);
    expect(upgrade).not.toMatch(/useState\(user\?\.isPaid/);
  });

  it("a purchase counts as confirmed only when the server reports a paid plan", () => {
    const i = upgrade.indexOf("const applyServerVerdict");
    const fn = upgrade.slice(i, upgrade.indexOf("\n  };", i));
    expect(fn).toMatch(/const paid = hasPaidPlan\(sync\.user as any\);/);
    expect(fn).toMatch(/return paid;/);
    expect(fn).not.toMatch(/return sync\.user\.isPaid/);
  });

  it("the purchase screen says when free Premium ends", () => {
    expect(upgrade).toMatch(/freeUntil && \(/);
    expect(upgrade).toMatch(/t\("upgrade\.freeUntilTitle", \{ date: fmtD\(parseApiDate\(freeUntil\)!, "PP"\) \}\)/);
  });

  it("Settings offers Google Play's Manage subscription only with a purchase behind it", () => {
    const free = profile.indexOf("{freeUntil ? (");
    const manage = profile.indexOf("play.google.com/store/account/subscriptions");
    expect(free).toBeGreaterThan(0);
    expect(manage).toBeGreaterThan(free);
    expect(profile.slice(free, manage)).toMatch(/\) : isPremium \? \(/);
  });

  it("the dashboard shows the row while free Premium runs", () => {
    expect(dashboard).toMatch(/const freeUntil = freePremiumUntil\(user\);/);
    expect(dashboard).toMatch(/key: "freePremium"/);
  });
});

describe("copy", () => {
  const keys = {
    dashboard: ["freePremiumUntil", "freePremiumDaysLeft_one", "freePremiumDaysLeft_other", "freePremiumEndsToday"],
    upgrade: ["freeUntilTitle", "freeUntilBody"],
    profile: ["freePremiumUntil", "freePremiumSub"],
  };
  const en = JSON.parse(read("locales/en.json"));
  const de = JSON.parse(read("locales/de.json"));

  it("every new string exists in both languages, carries the same tokens, and is not left in English", () => {
    for (const [sec, ks] of Object.entries(keys)) {
      for (const k of ks) {
        const a = en[sec][k];
        const b = de[sec][k];
        expect([sec, k, typeof a, typeof b]).toEqual([sec, k, "string", "string"]);
        const tokens = (s) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();
        expect([sec, k, tokens(b)]).toEqual([sec, k, tokens(a)]);
        expect([sec, k, b === a]).toEqual([sec, k, false]);
      }
    }
  });

  it("the purchase screen does not hide that a plan bought now starts today", () => {
    expect(en.upgrade.freeUntilBody).toMatch(/starts today/);
    expect(de.upgrade.freeUntilBody).toMatch(/beginnt sofort/);
  });

  it("the referral screen no longer calls free Premium a referral bonus", () => {
    expect(en.referFriend.bonusActive).toBe("Free Premium active until {{date}}");
    expect(de.referFriend.bonusActive).toBe("Kostenloses Premium aktiv bis {{date}}");
  });
});
