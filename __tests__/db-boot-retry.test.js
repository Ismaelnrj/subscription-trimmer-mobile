/* Startup retry for the database connection, added 2026-10-24.
 *
 * Moving DATABASE_URL to Railway's private address crashed the backend twice
 * with `getaddrinfo ENOTFOUND postgres.railway.internal` in its first second,
 * while private networking showed ready on both services. A single attempt
 * meant one slow DNS answer took the service down. These tests lift the real
 * initDBWithRetry out of server.js by string index and drive it against a stub
 * initDB, with setTimeout replaced so the waits cost nothing. */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../backend/server.js'), 'utf8');
const start = src.indexOf('const DB_BOOT_RETRYABLE');
const end = src.indexOf('initDBWithRetry()\n');

function load(initDB) {
  const waits = [];
  const fakeSetTimeout = (fn, ms) => { waits.push(ms); fn(); };
  const quiet = { warn: () => {}, log: () => {}, error: () => {} };
  const fn = new Function('initDB', 'setTimeout', 'console',
    src.slice(start, end) + '; return initDBWithRetry;')(initDB, fakeSetTimeout, quiet);
  return { run: fn, waits };
}

function failing(times, code) {
  let calls = 0;
  const initDB = async () => {
    calls++;
    if (calls <= times) { const e = new Error(code); e.code = code; throw e; }
    return 'ready';
  };
  return { initDB, calls: () => calls };
}

async function caught(run) {
  try { await run(); } catch (e) { return e.code; }
  return 'resolved';
}

describe('database startup retry', () => {
  it('is found in server.js and is what boots the server', () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(src).toMatch(/initDBWithRetry\(\)\s*\n\s*\.then\(\(\) => app\.listen/);
  });

  it('succeeds once the private address resolves', async () => {
    const f = failing(3, 'ENOTFOUND');
    const { run, waits } = load(f.initDB);
    expect(await run()).toBe('ready');
    expect(f.calls()).toBe(4);
    expect(waits).toEqual([1000, 2000, 3000]);
  });

  it('gives up after ten attempts, so a wrong address still fails the deploy', async () => {
    const f = failing(99, 'ENOTFOUND');
    const { run } = load(f.initDB);
    expect(await caught(run)).toBe('ENOTFOUND');
    expect(f.calls()).toBe(10);
  });

  it('does not retry an error that is not about reaching the database', async () => {
    const f = failing(99, '42P01');
    const { run, waits } = load(f.initDB);
    expect(await caught(run)).toBe('42P01');
    expect(f.calls()).toBe(1);
    expect(waits).toEqual([]);
  });

  it('caps each wait at five seconds', async () => {
    const f = failing(9, 'ECONNREFUSED');
    const { run, waits } = load(f.initDB);
    await run();
    expect(Math.max(...waits)).toBe(5000);
  });
});
