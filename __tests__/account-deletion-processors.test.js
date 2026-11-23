/**
 * Two gaps on account deletion, found by the security pass of 2026-11-23:
 *
 * 1. A paying subscriber was never told that deleting the account does not
 *    cancel the Google Play subscription, so they would go on being charged
 *    with no account to use. The delete dialog (for a paid plan) and the
 *    public /delete-account page now say so, in both languages.
 * 2. The privacy policy promises personal information is deleted with the
 *    account, and RevenueCat kept the customer (random app user id plus the
 *    Play purchase history). It is now deleted the way PostHog is: after the
 *    row, never awaited, every failure swallowed and reported.
 *
 * The RevenueCat helper is lifted out of server.js by string index and run
 * against a stub fetch, so the request it makes is measured, not read.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
const screen = fs.readFileSync(path.join(root, "app", "account-settings.tsx"), "utf8");
const en = JSON.parse(fs.readFileSync(path.join(root, "locales", "en.json"), "utf8"));
const de = JSON.parse(fs.readFileSync(path.join(root, "locales", "de.json"), "utf8"));

function lift(name) {
  const start = server.indexOf(`async function ${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  let depth = 0;
  for (let i = server.indexOf("{", start); i < server.length; i++) {
    if (server[i] === "{") depth++;
    else if (server[i] === "}" && --depth === 0) return server.slice(start, i + 1);
  }
  throw new Error(`${name} not closed`);
}

function makeEraser({ key = "sk_test", fetchImpl }) {
  const calls = [];
  const reports = [];
  const fetch = async (url, init) => { calls.push({ url, init }); return fetchImpl(url, init); };
  const fn = new Function(
    "fetch", "REVENUECAT_SECRET_API_KEY", "OUTBOUND_TIMEOUT_MS", "reportServerError", "AbortSignal", "console",
    `${lift("deleteRevenueCatSubscriber")}; return deleteRevenueCatSubscriber;`
  )(fetch, key, 10000, (e) => reports.push(e.message), { timeout: () => "signal" }, { log() {}, error() {} });
  return { fn, calls, reports };
}

describe("account deletion reaches RevenueCat", () => {
  it("deletes the customer by its encoded app user id, with a timeout", async () => {
    const { fn, calls, reports } = makeEraser({ fetchImpl: async () => ({ ok: true, status: 200 }) });
    await fn("u_1/x y");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.revenuecat.com/v1/subscribers/u_1%2Fx%20y");
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].init.headers.Authorization).toBe("Bearer sk_test");
    expect(calls[0].init.signal).toBe("signal");
    expect(reports).toEqual([]);
  });

  it("does nothing without the secret key or an id", async () => {
    const noKey = makeEraser({ key: null, fetchImpl: async () => ({ ok: true }) });
    await noKey.fn("u_1");
    const noId = makeEraser({ fetchImpl: async () => ({ ok: true }) });
    await noId.fn(null);
    expect(noKey.calls).toHaveLength(0);
    expect(noId.calls).toHaveLength(0);
  });

  it("treats 404 as nothing to erase, and swallows and reports a failure", async () => {
    const missing = makeEraser({ fetchImpl: async () => ({ ok: false, status: 404 }) });
    await expect(missing.fn("u_1")).resolves.toBeUndefined();
    expect(missing.reports).toEqual([]);
    const down = makeEraser({ fetchImpl: async () => { throw new Error("timeout"); } });
    await expect(down.fn("u_1")).resolves.toBeUndefined();
    const refused = makeEraser({ fetchImpl: async () => ({ ok: false, status: 500 }) });
    await refused.fn("u_1");
    expect(down.reports).toEqual(["RevenueCat erasure failed: timeout"]);
    expect(refused.reports).toEqual(["RevenueCat erasure failed: delete 500"]);
  });

  it("runs after the user row is deleted, with the id read before, and is not awaited", () => {
    const handler = server.slice(server.indexOf("app.delete('/api/auth/account'"));
    const body = handler.slice(0, handler.indexOf("\n});") + 4);
    const read = body.indexOf("const deletedOpenId = user.open_id;");
    const del = body.indexOf("DELETE FROM users WHERE id = $1");
    const call = body.indexOf("deleteRevenueCatSubscriber(deletedOpenId);");
    expect(read).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(read);
    expect(call).toBeGreaterThan(del);
    expect(body).not.toMatch(/await\s+deleteRevenueCatSubscriber/);
  });
});

describe("a paying subscriber is told deleting does not cancel Google Play", () => {
  it("shows the warning and the way to cancel only for a paid plan", () => {
    expect(screen).toMatch(/import \{ hasPaidPlan \} from "\.\.\/lib\/premium-status"/);
    const at = screen.indexOf('t("accountSettings.deletePlayWarning")');
    expect(at).toBeGreaterThan(-1);
    const guard = screen.lastIndexOf("{hasPaidPlan(user) && (", at);
    expect(guard).toBeGreaterThan(screen.indexOf('t("accountSettings.deleteModalDesc")'));
    expect(screen.slice(at, at + 800)).toMatch(/play\.google\.com\/store\/account\/subscriptions\?package=com\.trimio\.app/);
  });

  it("says it in both languages, in the app and on the public page", () => {
    expect(en.accountSettings.deletePlayWarning).toMatch(/does not cancel/);
    expect(de.accountSettings.deletePlayWarning).toMatch(/nicht gekündigt/);
    expect(en.accountSettings.deletePlayManage).toMatch(/Google Play/);
    expect(de.accountSettings.deletePlayManage).toMatch(/Google Play/);
    const page = server.slice(server.indexOf("const DELETE_PAGE = {"), server.indexOf("app.get('/delete-account'"));
    expect(page).toMatch(/deleting your account does not cancel it/);
    expect(page).toMatch(/wird es durch das Löschen nicht gekündigt/);
  });
});
