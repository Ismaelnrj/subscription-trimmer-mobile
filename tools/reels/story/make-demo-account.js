// Story reel demo account: English app, euro prices from the DACH catalogue rows that carry a verified date.
//   node tools/reels/story/make-demo-account.js en /tmp/tokens   (against the local backend on :3000)
// Then mark it verified in the local database, or the dashboard shows the verify banner:
//   update users set is_verified = true;
const base = 'http://127.0.0.1:3000/api';
const [lang, out] = process.argv.slice(2);
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rows = [
  ['Netflix Standard', 15.99, 'streaming', 3],
  ['Spotify Premium', 12.99, 'entertainment', 8],
  ['Xbox Game Pass Ultimate', 20.99, 'entertainment', 12],
  ['Gym', 29.90, 'fitness', 19],
];
(async () => {
  const email = `story-${lang}-${Date.now()}@example.com`;
  const r = await fetch(base + '/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': lang }, body: JSON.stringify({ email, password: 'Preview123', name: 'Mia' }) });
  const reg = await r.json();
  const h = { 'content-type': 'application/json', 'accept-language': lang, authorization: 'Bearer ' + reg.token };
  const s = await fetch(base + '/trpc/settings.update', { method: 'POST', headers: h, body: JSON.stringify({ currency: 'EUR', currencySymbol: '€' }) });
  if (!s.ok) console.log('settings failed', s.status, await s.text());
  for (const [name, price, category, n] of rows) {
    const c = await fetch(base + '/trpc/subscriptions.create', { method: 'POST', headers: h, body: JSON.stringify({ name, price, billingCycle: 'monthly', category, currency: 'EUR', nextBillingDate: day(n) }) });
    if (!c.ok) console.log('create failed', name, c.status, await c.text());
  }
  require('fs').writeFileSync(out, reg.token + ' ' + reg.refreshToken);
  console.log(lang, email, reg.user.id);
})();
