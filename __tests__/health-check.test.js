// /health is what the cron-job.org uptime ping reads. It used to answer
// { status: 'ok' } unconditionally, so a database outage looked healthy.
// This drives the REAL handler, lifted out of server.js by string index, on a
// stub app and a stub pool.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'server.js'), 'utf8');
const start = src.indexOf('const HEALTH_DB_TIMEOUT_MS');
const end = src.indexOf('\n});\n', src.indexOf("app.get('/health'")) + 5;

function load(pool, timeoutMs) {
  let handler;
  const app = { get: (route, fn) => { if (route === '/health') handler = fn; } };
  const code = src.slice(start, end).replace(/HEALTH_DB_TIMEOUT_MS = \d+/, `HEALTH_DB_TIMEOUT_MS = ${timeoutMs}`);
  new Function('app', 'pool', code)(app, pool);
  return handler;
}

async function call(handler) {
  const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({}, res);
  return res;
}

describe('/health', () => {
  it('finds the handler in server.js', () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });

  it('answers 200 when the database answers', async () => {
    const res = await call(load({ query: async () => ({ rows: [{ '?column?': 1 }] }) }, 50));
    expect(res.code).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers 503 when the database refuses', async () => {
    const res = await call(load({ query: async () => { throw new Error('ECONNREFUSED 10.0.0.1:5432'); } }, 50));
    expect(res.code).toBe(503);
    expect(res.body.status).toBe('error');
  });

  it('answers 503 when the database hangs, instead of hanging the ping', async () => {
    const res = await call(load({ query: () => new Promise(() => {}) }, 30));
    expect(res.code).toBe(503);
  });

  it('never puts the database error text in the response', async () => {
    const res = await call(load({ query: async () => { throw new Error('password authentication failed for user "postgres"'); } }, 50));
    expect(JSON.stringify(res.body)).not.toMatch(/password|postgres|ECONN/);
  });
});
