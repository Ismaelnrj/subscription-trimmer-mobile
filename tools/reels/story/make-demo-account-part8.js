// Part 8 demo account: her own Netflix Standard row renewing in 3 days (the scandal), with two others, at the catalogue's checked DACH
// prices (Netflix Standard 15.99, Spotify Premium 12.99, Amazon Prime 8.99, verified 2026-09).
//   node tools/reels/story/make-demo-account-part8.js /tmp/tokens-part8   (against the local backend on :3000)
// Then: update users set is_verified = true where email like 'story8-%';
const base = 'http://127.0.0.1:3000/api';
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rows = [['Netflix Standard', 15.99, 'streaming', 3], ['Spotify Premium', 12.99, 'entertainment', 10], ['Amazon Prime', 8.99, 'streaming', 17]];
(async () => {
  const email = `story8-${Date.now()}@example.com`;
  const reg = await (await fetch(base + '/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': 'en' }, body: JSON.stringify({ email, password: 'Preview123', name: 'Mia' }) })).json();
  const h = { 'content-type': 'application/json', 'accept-language': 'en', authorization: 'Bearer ' + reg.token };
  await fetch(base + '/trpc/settings.update', { method: 'POST', headers: h, body: JSON.stringify({ currency: 'EUR', currencySymbol: '€' }) });
  for (const [name, price, category, n] of rows) {
    const c = await fetch(base + '/trpc/subscriptions.create', { method: 'POST', headers: h, body: JSON.stringify({ name, price, billingCycle: 'monthly', category, currency: 'EUR', nextBillingDate: day(n) }) });
    if (!c.ok) console.log('create failed', name, c.status, await c.text());
  }
  require('fs').writeFileSync(process.argv[2] || '/tmp/tokens-part8', reg.token + ' ' + reg.refreshToken);
  console.log(email, reg.user.id);
})();
