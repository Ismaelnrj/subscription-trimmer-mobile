/* ONE REFRESH TOKEN PER SESSION, 2026-11-24.

   The refresh token used to live in users.refresh_token_hash, one slot per
   account, so a second login anywhere (the website's form, a tablet) overwrote
   the phone's token: the phone was refused on its next refresh, within the
   hour, signed out, and the sign out threw away whatever was waiting offline.
   Now each login is its own row in refresh_tokens.

   issueTokens and the refresh and logout handlers are lifted out of server.js
   and run against an in-memory stand in for the two tables, keyed on the exact
   statements the server sends. What this cannot show, and was measured instead
   on a real PostgreSQL 16 the same day (old server, then new, one database):
   the CREATE and the foreign key cascade, the transaction, the legacy UPDATE ...
   FROM, the 10 session cap, a password change, two refreshes racing (one 200,
   one 401), and a second boot of initDB. */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");
const lift = (start) => {
  const a = SRC.indexOf(start);
  if (a < 0) throw new Error(`not found: ${start}`);
  return SRC.slice(a, SRC.indexOf("\n});\n", a) + 4);
};
const fnSrc = (() => {
  const a = SRC.indexOf("async function issueTokens(");
  return SRC.slice(a, SRC.indexOf("\n}\n", a) + 2);
})();

function build() {
  const sessions = new Map(); // token hash -> { id, user_id, expires_at }
  const legacy = new Map(); // token hash -> { id, expires }
  let nextId = 1;
  const db = {
    async query(sql, p = []) {
      const s = sql.replace(/\s+/g, " ").trim();
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(s)) return { rows: [] };
      if (s.startsWith("SELECT is_verified")) return { rows: [{ is_verified: true, has_password: true }] };
      if (s.startsWith("INSERT INTO refresh_tokens")) { sessions.set(p[1], { id: nextId++, user_id: p[0], expires_at: p[2] }); return { rows: [] }; }
      if (s.startsWith("DELETE FROM refresh_tokens WHERE user_id = $1 AND (expires_at")) return { rows: [] };
      if (s.startsWith("DELETE FROM refresh_tokens WHERE token_hash = $1 RETURNING")) {
        const row = sessions.get(p[0]); sessions.delete(p[0]); return { rows: row ? [row] : [] };
      }
      if (s.startsWith("UPDATE users u SET refresh_token_hash = NULL")) {
        const row = legacy.get(p[0]); legacy.delete(p[0]);
        return { rows: row ? [{ user_id: row.id, expires_at: row.expires }] : [] };
      }
      if (s.startsWith("DELETE FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2")) {
        const row = sessions.get(p[1]); if (row && row.user_id === p[0]) sessions.delete(p[1]); return { rows: [] };
      }
      if (s === "DELETE FROM refresh_tokens WHERE user_id = $1") {
        for (const [h, r] of sessions) if (r.user_id === p[0]) sessions.delete(h); return { rows: [] };
      }
      if (s.startsWith("UPDATE users SET refresh_token_hash = NULL")) return { rows: [] };
      return { rows: [] };
    },
  };
  const pool = { ...db, connect: async () => ({ ...db, release() {} }) };
  const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");
  const jwt = { sign: (c) => `access-${c.userId}` };
  const routes = {};
  const app = { post: (p, ...fns) => { routes[p] = fns[fns.length - 1]; } };
  const handleError = (e) => { throw e; };
  const authMiddleware = null;
  const issueTokens = new Function(
    "jwt", "JWT_SECRET", "pool", "crypto", "hashToken", "ACCESS_TOKEN_EXPIRY", "REFRESH_TOKEN_EXPIRY_MS",
    `${fnSrc}; return issueTokens;`,
  )(jwt, "s", pool, crypto, hashToken, "1h", 90 * 86400000);
  new Function("app", "pool", "hashToken", "issueTokens", "handleError", "authMiddleware",
    lift("app.post('/api/auth/refresh'") + lift("app.post('/api/auth/logout'"),
  )(app, pool, hashToken, issueTokens, handleError, authMiddleware);
  const call = async (route, body, userId) => {
    let status = 200; let out;
    const res = { status(c) { status = c; return this; }, json(b) { out = b; return this; } };
    await routes[route]({ body, userId }, res);
    return { status, body: out };
  };
  return {
    sessions, legacy, hashToken,
    login: (userId) => issueTokens(userId),
    refresh: (refreshToken) => call("/api/auth/refresh", { refreshToken }),
    logout: (userId, body) => call("/api/auth/logout", body, userId),
  };
}

describe("refresh tokens are per session", () => {
  it("a second login leaves the first session working", async () => {
    const t = build();
    const phone = await t.login(7);
    const web = await t.login(7);
    expect((await t.refresh(phone.refreshToken)).status).toBe(200);
    expect((await t.refresh(web.refreshToken)).status).toBe(200);
  });

  it("a refresh rotates only its own session, and a used token is refused", async () => {
    const t = build();
    const phone = await t.login(7);
    const web = await t.login(7);
    const next = await t.refresh(phone.refreshToken);
    expect(next.status).toBe(200);
    expect((await t.refresh(phone.refreshToken)).status).toBe(401);
    expect((await t.refresh(next.body.refreshToken)).status).toBe(200);
    expect((await t.refresh(web.refreshToken)).status).toBe(200);
  });

  it("logging out with this device's token ends only this device", async () => {
    const t = build();
    const phone = await t.login(7);
    const web = await t.login(7);
    expect((await t.logout(7, { refreshToken: web.refreshToken })).status).toBe(200);
    expect((await t.refresh(web.refreshToken)).status).toBe(401);
    expect((await t.refresh(phone.refreshToken)).status).toBe(200);
  });

  it("an app that logs out without a body still ends every session, as before", async () => {
    const t = build();
    const a = await t.login(7);
    const b = await t.login(7);
    const other = await t.login(8);
    await t.logout(7, {});
    expect((await t.refresh(a.refreshToken)).status).toBe(401);
    expect((await t.refresh(b.refreshToken)).status).toBe(401);
    expect((await t.refresh(other.refreshToken)).status).toBe(200);
  });

  it("a token issued before the change refreshes once, so the deploy signs nobody out", async () => {
    const t = build();
    t.legacy.set(t.hashToken("old-token"), { id: 7, expires: new Date(Date.now() + 86400000) });
    const first = await t.refresh("old-token");
    expect(first.status).toBe(200);
    expect((await t.refresh("old-token")).status).toBe(401);
    expect((await t.refresh(first.body.refreshToken)).status).toBe(200);
  });

  it("an expired legacy token is refused", async () => {
    const t = build();
    t.legacy.set(t.hashToken("stale"), { id: 7, expires: new Date(Date.now() - 1000) });
    expect((await t.refresh("stale")).status).toBe(401);
  });
});

describe("every path that must end all sessions still does", () => {
  const between = (a, b) => SRC.slice(SRC.indexOf(a), SRC.indexOf(b, SRC.indexOf(a)));
  it("a new password deletes every session before issuing this device's", () => {
    const branch = between("A NEW PASSWORD ENDS EVERY OTHER SESSION", "loginFailures.delete(failureKey)");
    expect(branch.indexOf("DELETE FROM refresh_tokens WHERE user_id = $1")).toBeGreaterThan(-1);
    expect(branch.indexOf("DELETE FROM refresh_tokens WHERE user_id = $1")).toBeLessThan(branch.indexOf("issueTokens(req.userId)"));
  });
  it("a password reset and a Google takeover of an unverified account delete them all", () => {
    expect(between("app.post('/api/auth/reset-password'", "\n});\n")).toMatch(/DELETE FROM refresh_tokens WHERE user_id = \$1', \[user\.id\]/);
    expect(between("if (!user.is_verified && user.password_hash)", "} else {")).toMatch(/DELETE FROM refresh_tokens WHERE user_id = \$1', \[user\.id\]/);
  });
  it("the table cascades with the account, so deleting an account deletes its sessions", () => {
    const create = SRC.slice(SRC.indexOf("CREATE TABLE IF NOT EXISTS refresh_tokens"));
    expect(create.slice(0, create.indexOf("`);"))).toMatch(/user_id INTEGER NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
    expect(SRC.indexOf("CREATE TABLE IF NOT EXISTS refresh_tokens")).toBeGreaterThan(-1);
  });
  it("the app names its own session when it logs out", () => {
    const store = fs.readFileSync(path.join(__dirname, "..", "lib", "auth-store.ts"), "utf8");
    expect(store).toMatch(/apiClient\.post\("\/auth\/logout", refreshToken \? \{ refreshToken \} : \{\}\)/);
  });
});
