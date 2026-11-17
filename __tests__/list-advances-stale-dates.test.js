/* subscriptions.list moves a passed billing date to the next one, the rule
 * alerts.list and the reminder email job already followed. Found 2026-11-17: the
 * list handed back the stale date, so a renewal that happened on 5 November read
 * "Due today, 5 Nov" on the dashboard twelve days later, because the dashboard
 * fires alerts.list in parallel and never refetches the list it already has.
 *
 * Drives the REAL handler lifted out of server.js, with the REAL date helpers,
 * on a stub pool. Measured separately on the real server and PostgreSQL 16.
 */
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");
const fn = (name) => {
  const i = SRC.indexOf(`function ${name}(`);
  return SRC.slice(i, SRC.indexOf("\n}\n", i) + 3);
};
const route = (sig) => {
  const i = SRC.indexOf(sig);
  return SRC.slice(i, SRC.indexOf("\n});\n", i) + 5);
};
const HELPERS = ["addMonthsUTC", "advanceBillingDate", "startOfUtcDay"].map(fn).join("\n");

function build(rows) {
  const writes = [];
  const pool = {
    query: async (sql, params) => {
      if (/^SELECT s\.\*/.test(sql.trim())) return { rows: rows.map((r) => ({ ...r })) };
      if (/^UPDATE subscriptions SET next_billing_date/.test(sql)) writes.push(params);
      return { rows: [] };
    },
  };
  let handler;
  const app = { get: (_p, _mw, h) => { handler = h; } };
  new Function("app", "pool", "authMiddleware", "trpc", "formatSub", "handleError",
    `${HELPERS}\n${route("app.get('/api/trpc/subscriptions.list'")}`,
  )(app, pool, null, (d) => ({ result: { data: d } }),
    (s) => ({ id: s.id, nextBillingDate: new Date(s.next_billing_date).toISOString().slice(0, 10) }),
    (e) => { throw e; });
  const get = () => new Promise((resolve, reject) => {
    const res = { status() { return this; }, json: (b) => resolve(b.result.data) };
    Promise.resolve(handler({ userId: 9, query: {} }, res)).catch(reject);
  });
  return { get, writes };
}

const RealDate = Date;
const FROZEN = new RealDate("2026-11-17T10:00:00Z").getTime();
beforeAll(() => {
  global.Date = class extends RealDate {
    constructor(...a) { if (a.length === 0) super(FROZEN); else super(...a); }
    static now() { return FROZEN; }
  };
});
afterAll(() => { global.Date = RealDate; });

describe("subscriptions.list moves a passed billing date to the next one", () => {
  it("a monthly renewal that passed on 5 Nov reads 5 Dec, and is saved", async () => {
    const { get, writes } = build([{ id: 1, billing_cycle: "monthly", next_billing_date: new Date("2026-11-05T00:00:00Z"), billing_anchor_day: 5, is_active: true }]);
    const [row] = await get();
    expect(row.nextBillingDate).toBe("2026-12-05");
    expect(writes).toHaveLength(1);
    expect(writes[0][2]).toBe(9);
  });

  it("today's date is not moved", async () => {
    const { get, writes } = build([{ id: 2, billing_cycle: "monthly", next_billing_date: new Date("2026-11-17T00:00:00Z"), billing_anchor_day: 17, is_active: true }]);
    expect((await get())[0].nextBillingDate).toBe("2026-11-17");
    expect(writes).toHaveLength(0);
  });

  it("a month end keeps its day: 31 Oct goes to 30 Nov with the anchor, not to the 31st of nothing", async () => {
    const { get } = build([{ id: 3, billing_cycle: "monthly", next_billing_date: new Date("2026-10-31T00:00:00Z"), billing_anchor_day: 31, is_active: true }]);
    expect((await get())[0].nextBillingDate).toBe("2026-11-30");
  });

  it("a paused row is left as it is, like alerts.list leaves it", async () => {
    const { get, writes } = build([{ id: 4, billing_cycle: "monthly", next_billing_date: new Date("2026-11-05T00:00:00Z"), billing_anchor_day: 5, is_active: false }]);
    expect((await get())[0].nextBillingDate).toBe("2026-11-05");
    expect(writes).toHaveLength(0);
  });

  it("the write only lands if nobody changed the date in between", () => {
    expect(route("app.get('/api/trpc/subscriptions.list'")).toMatch(/AND user_id = \$3 AND next_billing_date = \$4/);
  });
});
