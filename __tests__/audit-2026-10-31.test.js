/* Audit, 2026-10-31, before build 41. Each block is a defect that was real on
   master at 10fa537c, and each assertion fails against that commit. */

const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const SRC = read("backend/server.js");

function handlerFrom(start) {
  const a = SRC.indexOf(start);
  if (a < 0) throw new Error(`not found: ${start}`);
  return SRC.slice(a, SRC.indexOf("\n});\n", a) + 4);
}

function call(handler, req) {
  return new Promise((resolve, reject) => {
    let status = 200;
    const res = {
      status(c) { status = c; return this; },
      json(body) { resolve({ status, body }); return this; },
    };
    Promise.resolve(handler({ headers: {}, userId: 5, ...req }, res)).catch(reject);
  });
}

describe("saving notification preferences is a partial update", () => {
  /* It wrote every column straight through: an absent key stored NULL, an
     absent emailReminders turned email reminders OFF, and an absent or odd
     renewalAlertDays reset a seven day lead to three. */
  function build(row) {
    const queries = [];
    const pool = {
      query: async (sql, params) => {
        queries.push({ sql, params });
        if (/^UPDATE notification_preferences/.test(sql.trim())) {
          const cols = ["renewal_alerts", "spending_alerts", "weekly_summary", "push_enabled", "email_reminders", "renewal_alert_days"];
          cols.forEach((c, i) => {
            const coalesced = new RegExp(`${c} = COALESCE\\(\\$${i + 1}, ${c}\\)`).test(sql);
            if (coalesced) { if (params[i] !== null) row[c] = params[i]; } else row[c] = params[i] ?? null;
          });
        }
        return { rows: [] };
      },
    };
    let handler;
    const app = { post: (_p, _mw, fn) => { handler = fn; } };
    // eslint-disable-next-line no-new-func
    new Function("app", "pool", "authMiddleware", "trpc", "handleError", handlerFrom("app.post('/api/trpc/notifications.updatePreferences'"))(
      app, pool, null, (d) => ({ result: { data: d } }), (e) => { throw e; });
    return { save: (body) => call(handler, { body }), row, queries };
  }

  const full = () => ({ renewal_alerts: true, spending_alerts: true, weekly_summary: false, push_enabled: true, email_reminders: true, renewal_alert_days: 7 });

  it("a body that names one field changes only that field", async () => {
    const { save, row } = build(full());
    await save({ pushEnabled: false });
    expect(row).toEqual({ ...full(), push_enabled: false });
  });

  it("does not switch email reminders off when the key is absent", async () => {
    const { save, row } = build(full());
    await save({ renewalAlerts: false });
    expect(row.email_reminders).toBe(true);
  });

  it("keeps a seven day lead when the value is absent or not 1, 3 or 7", async () => {
    const { save, row } = build(full());
    await save({ renewalAlertDays: 30 });
    expect(row.renewal_alert_days).toBe(7);
    await save({ renewalAlertDays: 1 });
    expect(row.renewal_alert_days).toBe(1);
  });

  it("ignores a non boolean rather than storing it", async () => {
    const { save, row } = build(full());
    await save({ pushEnabled: "no" });
    expect(row.push_enabled).toBe(true);
  });

  it("still clears an unsubscribe on an explicit true", async () => {
    const { save, queries } = build(full());
    await save({ emailReminders: true });
    expect(queries.some((q) => /email_opt_out = FALSE/.test(q.sql))).toBe(true);
  });

  it("reads a NULL left by the old update as the column default", () => {
    const get = handlerFrom("app.get('/api/trpc/notifications.getPreferences'");
    expect(get).toMatch(/renewalAlerts: p\.renewal_alerts \?\? true/);
    expect(get).toMatch(/pushEnabled: p\.push_enabled \?\? true/);
  });
});

describe("guessing the current password on the change password path is limited", () => {
  /* It had no limit at all, so a stolen access token (good for an hour) could
     try current passwords as fast as bcrypt allowed, then set a new password
     and, through the session rotation, lock the owner out. */
  function build() {
    const start = SRC.indexOf("const LOGIN_MAX_FAILURES");
    const end = SRC.indexOf("app.post('/api/auth/login'", start);
    const helpers = SRC.slice(start, end);
    const user = { id: 3, email: "a@example.com", password_hash: "OLD" };
    const pool = { query: async () => ({ rows: [{ ...user }] }) };
    let handler;
    const app = { patch: (_p, _mw, fn) => { handler = fn; } };
    // eslint-disable-next-line no-new-func
    new Function(
      "app", "pool", "authMiddleware", "bcrypt", "validatePassword", "issueTokens", "formatUser", "handleError",
      helpers + handlerFrom("app.patch('/api/auth/profile'"),
    )(app, pool, null,
      { compare: async (pw, h) => h === "OLD" && pw === "Right1234", hash: async (pw) => `NEW:${pw}` },
      () => null, async () => ({ accessToken: "a", refreshToken: "r" }), (u) => ({ id: u.id }), (e) => { throw e; });
    return (currentPassword) => call(handler, { userId: 3, body: { currentPassword, newPassword: "Newpass123" } });
  }

  it("refuses with 429 after ten wrong guesses, even with the right one", async () => {
    const change = build();
    for (let i = 0; i < 10; i++) expect((await change("wrong")).status).toBe(400);
    expect((await change("wrong")).status).toBe(429);
    expect((await change("Right1234")).status).toBe(429);
  });

  it("nine wrong guesses still let the right password through", async () => {
    const change = build();
    for (let i = 0; i < 9; i++) await change("wrong");
    expect((await change("Right1234")).status).toBe(200);
  });
});

describe("a transaction whose connection died is not handed back to the pool", () => {
  it("both checked out clients are released with the error", () => {
    for (const name of ["async function withSubscriptionLimitLock", "async function rewardReferral"]) {
      const a = SRC.indexOf(name);
      const body = SRC.slice(a, SRC.indexOf("\n}\n", a));
      expect(body).toMatch(/let broken;/);
      expect(body).toMatch(/ROLLBACK'\)\.catch\(\(\w+\) => \{ broken = \w+; \}\)/);
      expect(body).toMatch(/client\.release\(broken\)/);
    }
  });
});

describe("the app reads its build number from the installed package", () => {
  /* Constants.expoConfig is the app.json of the running UPDATE, so once
     app.json says 41 every build 40 phone that takes an update says 41 too:
     the Build Info panel lies and the minimum version gate stops asking
     exactly the phones it exists for. */
  it("the Build Info panel and the update gate both use nativeBuild()", () => {
    expect(read("app/help-support.tsx")).toMatch(/Native build: \{nativeBuild\(\)\.versionCode/);
    expect(read("components/UpdateAvailableModal.tsx")).toMatch(/nativeBuild\(\)\.versionCode/);
  });

  it("nothing else reads the version code from expoConfig", () => {
    const files = [];
    const walk = (d) => {
      for (const f of fs.readdirSync(path.join(__dirname, "..", d), { withFileTypes: true })) {
        const p = `${d}/${f.name}`;
        if (f.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f.name)) files.push(p);
      }
    };
    ["app", "components", "lib"].forEach(walk);
    const offenders = files.filter((p) => p !== "lib/app-build.ts" && /expoConfig\?*\.android\?*\.versionCode/.test(read(p)));
    expect(offenders).toEqual([]);
  });

  it("expo-application is loaded inside a try, so a missing module cannot crash launch", () => {
    const src = read("lib/app-build.ts");
    expect(src).toMatch(/try \{\s*const Application = require\("expo-application"\)/);
    expect(src).not.toMatch(/^import .* from "expo-application"/m);
  });
});

describe("client side defects", () => {
  it("the session expired alert is localised, in both languages", () => {
    const api = read("lib/api.ts");
    expect(api).toMatch(/i18n\.t\("common\.sessionExpiredTitle"/);
    expect(api).toMatch(/i18n\.t\("common\.sessionExpiredBody"/);
    for (const l of ["en", "de"]) {
      const j = JSON.parse(read(`locales/${l}.json`));
      expect(j.common.sessionExpiredTitle).toBeTruthy();
      expect(j.common.sessionExpiredBody).toBeTruthy();
    }
  });

  it("the price increase push respects the push switch and waits for preferences", () => {
    const s = read("app/(tabs)/subscriptions.tsx");
    expect(s).toMatch(/getQueryData\(\["notifications", "preferences"\]\)/);
    expect(s).toMatch(/if \(!prefs\) return data;/);
    expect(s).toMatch(/if \(pushOn\) \{\s*sendLocalNotification/);
  });

  it("no stored value can throw out of the list fetch or a review tap", () => {
    const s = read("app/(tabs)/subscriptions.tsx");
    // Every JSON.parse in the screen sits inside a try.
    const parses = s.split("JSON.parse(").length - 1;
    const guarded = (s.match(/try \{\s*(const \w+ = raw \? )JSON\.parse\(/g) || []).length;
    expect(parses).toBe(guarded);
  });

  it("the offline cache does not import AsyncStorage at module load", () => {
    const src = read("lib/offline-cache.ts");
    expect(src).not.toMatch(/^import .*async-storage/m);
    expect(src).toMatch(/require\("@react-native-async-storage\/async-storage"\)/);
  });
});
