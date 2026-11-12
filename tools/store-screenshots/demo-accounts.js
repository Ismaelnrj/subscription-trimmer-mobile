// Store screenshot demo accounts: real API, catalogue prices that carry a verified date.
const base = 'http://127.0.0.1:3000/api';
const [lang, out] = process.argv.slice(2);
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const SETS = {
  de: { cur: 'EUR', name: 'Lena', rows: [
    ['Netflix Standard', 15.99, 'streaming', 2],
    ['Spotify Premium', 12.99, 'entertainment', 6],
    ['Amazon Prime', 8.99, 'streaming', 11],
    ['YouTube Premium', 14.99, 'entertainment', 17],
    ['Xbox Game Pass Ultimate', 20.99, 'entertainment', 4, 4],
    ['Fitnessstudio', 29.90, 'fitness', 23],
  ] },
  en: { cur: 'USD', name: 'Sam', rows: [
    ['Netflix Standard', 19.99, 'streaming', 2],
    ['Spotify Premium', 12.99, 'entertainment', 6],
    ['Amazon Prime', 14.99, 'streaming', 11],
    ['Microsoft 365 Personal', 6.99, 'software', 17],
    ['Xbox Game Pass Ultimate', 22.99, 'entertainment', 4, 4],
    ['Gym', 39.00, 'fitness', 23],
  ] },
};
(async () => {
  const set = SETS[lang];
  const email = `store-${lang}-${Date.now()}@example.com`;
  const r = await fetch(base + '/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': lang }, body: JSON.stringify({ email, password: 'Preview123', name: set.name }) });
  const reg = await r.json();
  const h = { 'content-type': 'application/json', 'accept-language': lang, authorization: 'Bearer ' + reg.token };
  await fetch(base + '/trpc/settings.update', { method: 'POST', headers: h, body: JSON.stringify({ currency: set.cur, currencySymbol: set.cur === 'EUR' ? '€' : '$' }) });
  for (const [name, price, category, n, trial] of set.rows) {
    const body = { name, price, billingCycle: 'monthly', category, currency: set.cur, nextBillingDate: day(n) };
    if (trial) body.trialEndDate = day(trial);
    const c = await fetch(base + '/trpc/subscriptions.create', { method: 'POST', headers: h, body: JSON.stringify(body) });
    if (!c.ok) console.log('create failed', name, c.status, await c.text());
  }
  require('fs').writeFileSync(out, reg.token + ' ' + reg.refreshToken);
  console.log(lang, email, reg.user.id);
})();
