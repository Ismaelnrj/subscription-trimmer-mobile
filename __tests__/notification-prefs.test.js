/* Findings 1, 4, 5 and 6 from Codex's review of 2026-09-18.

   The shared shape of all four: a setting or a sign-out that changed a database
   row or a bit of state and left the device doing exactly what it was doing
   before. Nothing errored, so nothing surfaced. */

const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const SCHEDULER = read("lib/notification-scheduler.ts");
const AUTH = read("lib/auth-store.ts");
const DASH = read("app/(tabs)/index.tsx");
const PREFS_SCREEN = read("app/notification-preferences.tsx");
const SERVER = read("backend/server.js");

describe("finding 1: an expired session must not leak its cache into the next one", () => {
  it("compares identity with null counted as an identity", () => {
    /* `user && previous && previous.id !== user.id` skips BOTH null
       transitions. An expired session goes A -> null -> B, so neither half
       fired and account B read account A's subscriptions out of the global
       query keys. */
    expect(AUTH).toMatch(/previousId\s*=\s*get\(\)\.user\?\.id\s*\?\?\s*null/);
    expect(AUTH).toMatch(/nextId\s*=\s*user\?\.id\s*\?\?\s*null/);
    expect(AUTH).toMatch(/previousId\s*!==\s*nextId/);
  });

  it("no longer requires both users to exist before resetting", () => {
    const code = AUTH.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(/if\s*\(user && previous && previous\.id !== user\.id\)/.test(code)).toBe(false);
  });

  it("the rule, mirrored", () => {
    const shouldReset = (prev, next) => (prev?.id ?? null) !== (next?.id ?? null);
    const A = { id: 1 }, B = { id: 2 };
    expect(shouldReset(A, null)).toBe(true);    // sign-out
    expect(shouldReset(null, B)).toBe(true);    // the leak: login after expiry
    expect(shouldReset(A, B)).toBe(true);       // direct switch
    expect(shouldReset(A, { id: 1 })).toBe(false); // profile refresh keeps the cache
    expect(shouldReset(null, null)).toBe(false);
  });

  it("restoring a session goes through the same setter", () => {
    // restoreToken used a bare set(), bypassing the identity check entirely.
    expect(AUTH).toMatch(/get\(\)\.setUser\(res\.data\)/);
  });
});

describe("finding 5: reminders must not outlive the session", () => {
  it("exports a cancel that sign-out can call", () => {
    expect(SCHEDULER).toMatch(/export async function cancelAllReminders/);
  });

  it("logout cancels the OS queue", () => {
    expect(AUTH).toMatch(/cancelAllReminders\(\)/);
  });

  it("an identity change cancels it too", () => {
    // Covers the expired-session path, which never reaches logout().
    /* Slice from the IMPLEMENTATION. `setLoading:` appears in the AuthState
       interface ABOVE setUser, so a bare indexOf returns an inverted, empty
       slice and the assertion fails against nothing. Same trap the
       account-isolation tests already guard against. */
    const impl = AUTH.slice(AUTH.indexOf("create<AuthState>"));
    const setUser = impl.slice(impl.indexOf("setUser: (user)"), impl.indexOf("setLoading:"));
    expect(setUser).toMatch(/cancelAllReminders/);
  });

  it("a scheduler already running cannot re-add them", () => {
    /* Scheduling awaits once per notification, so a run that started before
       sign-out can finish after it. The cancel alone does not cover that. */
    expect(SCHEDULER).toMatch(/let sessionGeneration = 0/);
    expect(SCHEDULER).toMatch(/const myGeneration = sessionGeneration/);
    expect(SCHEDULER).toMatch(/if \(sessionGeneration !== myGeneration\) return/);
  });
});

describe("finding 4: the preference switches must reach the device", () => {
  it("the scheduler accepts preferences at all", () => {
    expect(SCHEDULER).toMatch(/prefs: ReminderPrefs = \{\}/);
  });

  it("push off schedules nothing", () => {
    expect(SCHEDULER).toMatch(/prefs\.pushEnabled === false/);
  });

  it("renewal alerts off schedules no renewal reminders", () => {
    expect(SCHEDULER).toMatch(/renewalRemindersOn = prefs\.renewalAlerts !== false/);
  });

  it("honours the chosen lead time instead of always 7, 3 and 1", () => {
    /* The screen offers 1, 3 or 7 as a SINGLE choice. Scheduling all three
       ignored the answer and gave three warnings to somebody who asked for one. */
    const code = SCHEDULER.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    expect(/daysBefore: 7[\s\S]{0,120}daysBefore: 3[\s\S]{0,120}daysBefore: 1/.test(code)).toBe(false);
    expect(SCHEDULER).toMatch(/daysBefore: leadDays/);
  });

  it("an absent preference means ON, not OFF", () => {
    // A slow preferences query must never silently drop somebody's reminders.
    const on = (p) => p.pushEnabled !== false && p.renewalAlerts !== false;
    expect(on({})).toBe(true);
    expect(on({ pushEnabled: undefined })).toBe(true);
    expect(on({ renewalAlerts: false })).toBe(false);
    expect(on({ pushEnabled: false })).toBe(false);
  });

  it("the dashboard fetches preferences and passes them", () => {
    expect(DASH).toMatch(/\["notifications", "preferences"\]/);
    expect(DASH).toMatch(/scheduleRenewalReminders\(data, currency\.symbol, notifPrefs/);
  });

  it("changing a preference reschedules without waiting for a refetch", () => {
    expect(DASH).toMatch(/notifPrefs\?\.pushEnabled, notifPrefs\?\.renewalAlerts, notifPrefs\?\.renewalAlertDays/);
  });
});

describe("finding 6: the preview and the sender must agree", () => {
  it("the app previews the same lead time the server uses", () => {
    const appDays = /const EMAIL_LEAD_DAYS = (\d+)/.exec(PREFS_SCREEN);
    const serverDays = /in3Days = new Date\(now\.getTime\(\) \+ (\d+) \* 86400000\)/.exec(SERVER);
    expect(appDays).not.toBe(null);
    expect(serverDays).not.toBe(null);
    expect(appDays[1]).toBe(serverDays[1]);
  });

  it("and the copy above it says the same number", () => {
    // The label already said 3 days in both languages, so the preview was the
    // only thing disagreeing and there was nothing to decide.
    for (const f of ["locales/en.json", "locales/de.json"]) {
      expect(JSON.parse(read(f)).notifPrefs.emailRemindersDesc).toMatch(/\b3\b/);
    }
  });
});
