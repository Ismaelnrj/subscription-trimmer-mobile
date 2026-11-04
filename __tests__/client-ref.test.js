/* The server half of offline adding: a create sent twice is saved once.

   SOURCE READING, and it says so, because the behaviour lives in PostgreSQL
   and CI has none. The behaviour was measured on 2026-11-04 by booting the
   real server, and the previous one (master at ff77ee74), each on a fresh
   PostgreSQL 16 database, and sending both the same requests:

                                              this change     previous
     the same create sent again               200, same id    409 duplicate
     resend of the entry filling slot five    200, same id    403 free limit
     Add anyway, answer lost, sent again      1 row           2 rows
     8 copies of one entry at once            8 x 200, 1 row  1 x 200, 7 x 409
     a genuinely new sixth entry              403             403
     another account, same ref value          its own row     its own row
     a malformed ref                          saved, no ref   saved

   A refusal of a resend is not harmless: the phone would show an entry that
   IS saved as "could not be saved". And booting the new server twice on a
   database built and filled by the previous one left every row byte for byte
   unchanged, with pg_dump --schema-only identical to a fresh database's.

   These assertions pin the shape that produced those numbers. */

const fs = require("fs");
const path = require("path");

const server = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function block(startMarker, endMarker) {
  const a = server.indexOf(startMarker);
  if (a < 0) throw new Error("missing " + startMarker);
  const b = server.indexOf(endMarker, a + startMarker.length);
  if (b < 0) throw new Error("missing end of " + startMarker);
  return server.slice(a, b);
}

const create = block("app.post('/api/trpc/subscriptions.create'", "\napp.");
const initDB = block("async function initDB", "\nasync function ");

describe("the column", () => {
  it("is added after the table exists, with no backfill", () => {
    const createTable = initDB.indexOf("CREATE TABLE IF NOT EXISTS subscriptions");
    const alter = initDB.indexOf("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS client_ref TEXT");
    expect(createTable).toBeGreaterThan(-1);
    expect(alter).toBeGreaterThan(createTable);
    expect(initDB).not.toMatch(/UPDATE subscriptions SET client_ref/);
  });

  it("is unique per user and only where present, so older rows and older builds are untouched", () => {
    expect(initDB).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_client_ref\s+ON subscriptions\(user_id, client_ref\) WHERE client_ref IS NOT NULL/,
    );
  });

  it("is written on insert and read back on every row", () => {
    expect(create).toMatch(/INSERT INTO subscriptions \([^)]*client_ref\)/);
    expect(create).toMatch(/currency, clientRef\]/);
    expect(block("function formatSub(s)", "\nfunction ")).toMatch(/clientRef: s\.client_ref \|\| null/);
  });
});

describe("the create handler", () => {
  it("treats a malformed ref as absent rather than refusing the entry", () => {
    expect(create).toMatch(/\/\^\[A-Za-z0-9_-\]\{8,64\}\$\/\.test\(req\.body\.clientRef\)\s*\?\s*req\.body\.clientRef\s*:\s*null/);
  });

  it("answers a resend with the saved row BEFORE the free limit and same-name checks", () => {
    const lock = create.indexOf("withSubscriptionLimitLock(req.userId, async (db) => {");
    const replay = create.indexOf("SELECT * FROM subscriptions WHERE user_id = $1 AND client_ref = $2");
    const limit = create.indexOf("FREE_SUBSCRIPTION_LIMIT");
    const dup = create.indexOf("DUPLICATE_SUBSCRIPTION");
    expect(lock).toBeGreaterThan(-1);
    // Inside the lock, so two copies sent at once cannot both get past it.
    expect(replay).toBeGreaterThan(lock);
    expect(replay).toBeLessThan(limit);
    expect(replay).toBeLessThan(dup);
  });

  it("scopes the lookup to the signed in user, through the locked connection", () => {
    expect(create).toMatch(/await db\.query\('SELECT \* FROM subscriptions WHERE user_id = \$1 AND client_ref = \$2', \[req\.userId, clientRef\]\)/);
  });

  it("does not announce a resend a second time", () => {
    const replayReturn = create.indexOf("if (outcome.replay) return res.json(trpc(formatSub(outcome.row)));");
    const notification = create.indexOf("INSERT INTO notifications");
    expect(replayReturn).toBeGreaterThan(-1);
    expect(replayReturn).toBeLessThan(notification);
  });
});
