/**
 * initDB MUST BE ABLE TO BUILD AN EMPTY DATABASE.
 *
 * Until 2026-10-01 it could not. It ran three ALTER TABLE subscriptions
 * statements and a backfill UPDATE 43 lines BEFORE `CREATE TABLE IF NOT EXISTS
 * subscriptions`. Production never noticed, because its table already existed
 * and every CREATE here is IF NOT EXISTS. An empty database did notice: the
 * first ALTER threw `relation "subscriptions" does not exist` and the service
 * never booted. A replacement database, a restore into a fresh instance, or a
 * staging environment, which is to say the day things are already going wrong.
 *
 * THIS IS A SCAN, NOT A LIST. For every table initDB creates, its CREATE must
 * come before any ALTER, UPDATE, INSERT, index, foreign key, read or regclass
 * that names it. That covers the table nobody has added yet, which a check on
 * subscriptions alone would not.
 *
 * SOURCE READING, and what was measured separately on a real PostgreSQL 16 on
 * 2026-10-01, against both versions of initDB:
 *   the old one on an EMPTY database fails with the error above;
 *   the new one succeeds, and succeeds again when run a second time;
 *   on a production shaped database (tables predating the ALTERs, old initDB
 *   already run, real rows present) the new one boots, leaves every row byte
 *   for byte unchanged, and keeps a month end billing_anchor_day of 31;
 *   pg_dump --schema-only of the fresh path and the production path is
 *   IDENTICAL, column order included.
 * Do not read a green run of THIS file as proof of any of that.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'server.js'), 'utf8');

function initDbCode() {
  const i = src.indexOf('async function initDB(');
  expect(i).toBeGreaterThan(-1);
  const j = src.indexOf('\n}\n', i);
  expect(j).toBeGreaterThan(i);
  const body = src.slice(i, j);
  /* Comments here name tables in prose ("subscriptions IS CREATED HERE"), so
     they are stripped before scanning. Block comments, and lines that START
     with //, never // mid line, which would eat a URL. The strip must remove
     something, so it cannot pass vacuously. */
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  expect(code.length).toBeLessThan(body.length);
  return code;
}

function createdTables(code) {
  const out = [];
  const re = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(/g;
  let m;
  while ((m = re.exec(code))) out.push({ table: m[1], at: m.index });
  return out;
}

function firstUse(code, table, createAt) {
  const uses = [
    `ALTER TABLE ${table}\\b`,
    `UPDATE ${table}\\b`,
    `INSERT INTO ${table}\\b`,
    `\\bON ${table}\\s*\\(`,
    `REFERENCES ${table}\\s*\\(`,
    `\\bFROM ${table}\\b`,
    `\\bJOIN ${table}\\b`,
    `'${table}'::regclass`,
  ];
  let first = null;
  for (const u of uses) {
    const re = new RegExp(u, 'g');
    let m;
    while ((m = re.exec(code))) {
      // A table's own CREATE statement does not count as using it first.
      if (m.index === createAt) continue;
      if (first === null || m.index < first.at) first = { at: m.index, text: m[0] };
      break;
    }
  }
  return first;
}

describe('initDB builds an empty database', () => {
  const code = initDbCode();
  const tables = createdTables(code);

  test('the scan sees every table initDB creates', () => {
    expect(tables.map((t) => t.table).sort()).toEqual([
      'notification_preferences', 'notifications', 'price_history',
      'subscriptions', 'user_settings', 'users',
    ]);
  });

  test('every table is created before anything touches it', () => {
    const late = [];
    for (const { table, at } of tables) {
      const use = firstUse(code, table, at);
      if (use && use.at < at) {
        const line = code.slice(0, use.at).split('\n').length;
        late.push(`${table}: "${use.text}" on initDB line ${line}, before its CREATE`);
      }
    }
    expect(late).toEqual([]);
  });

  /* The comment explaining the move is what stops a tidy-up putting the CREATE
     back beside the ALTERs that follow it further down. */
  test('the reason the subscriptions CREATE sits where it does is written beside it', () => {
    const i = src.indexOf('subscriptions IS CREATED HERE, directly above the first statement');
    const j = src.indexOf('CREATE TABLE IF NOT EXISTS subscriptions (');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(j - i).toBeLessThan(1500);
  });
});
