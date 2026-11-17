/* An email unsubscribe must survive an unrelated switch (2026-11-17).
 *
 * The unsubscribe link sets only users.email_opt_out, getPreferences went on
 * reporting email reminders as on, and the app posted every field on any
 * change, so turning push alerts off sent emailReminders: true, which
 * updatePreferences reads as consent and so cleared the unsubscribe. Drives
 * the REAL getPreferences on a stub pool; measured end to end separately on
 * the real server and PostgreSQL 16.
 */
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");
const route = (sig) => { const i = SRC.indexOf(sig); return SRC.slice(i, SRC.indexOf("\n});\n", i) + 5); };

function getPrefs(row) {
  let handler;
  const app = { get: (_p, _mw, h) => { handler = h; } };
  const pool = { query: async (sql) => (/SELECT np\.\*, u\.email_opt_out/.test(sql) || /SELECT \* FROM notification_preferences/.test(sql) ? { rows: [row] } : { rows: [] }) };
  new Function("app", "pool", "authMiddleware", "trpc", "handleError", route("app.get('/api/trpc/notifications.getPreferences'"))(
    app, pool, null, (d) => ({ result: { data: d } }), (e) => { throw e; });
  return new Promise((resolve, reject) => {
    const res = { status() { return this; }, json: (b) => resolve(b.result.data) };
    Promise.resolve(handler({ userId: 1 }, res)).catch(reject);
  });
}

describe("an unsubscribe is reported, and not undone by another switch", () => {
  it("reports email reminders off once the person has unsubscribed", async () => {
    expect((await getPrefs({ email_reminders: true, email_opt_out: true })).emailReminders).toBe(false);
  });
  it("still reports them on for somebody who has not", async () => {
    expect((await getPrefs({ email_reminders: true, email_opt_out: false })).emailReminders).toBe(true);
  });
  it("the preferences screen sends only the switch that changed", () => {
    const screen = fs.readFileSync(path.join(__dirname, "..", "app", "notification-preferences.tsx"), "utf8");
    expect(screen).toMatch(/updateMutation\.mutate\(\{ \[key\]: value \}\)/);
    expect(screen).not.toMatch(/mutate\(\{ \.\.\.prefs/);
  });
});
