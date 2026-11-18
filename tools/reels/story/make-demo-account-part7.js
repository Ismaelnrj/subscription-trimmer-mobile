// Part 7 demo account: his own Tinder row (14.99 a month, the character's own price, not a
// catalogue claim) billing TOMORROW, so the dashboard's Upcoming list reads "Due tomorrow".
//   node tools/reels/story/make-demo-account-part7.js /tmp/tokens-part7   (against the local backend on :3000)
// Then: update users set is_verified = true, email = 'mia@example.com';
// Tinder is not in the catalogue, so the app draws its first letter, as for any custom name.
const base = 'http://127.0.0.1:3000/api';
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rows = [['Tinder', 14.99, 'other', 1], ['Amazon Prime', 8.99, 'shopping', 9], ['Spotify Premium', 12.99, 'entertainment', 14], ['Netflix Standard', 15.99, 'streaming', 20]];
(async () => {
  const email = `story7-${Date.now()}@example.com`;
  const reg = await (await fetch(base + '/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': 'en' }, body: JSON.stringify({ email, password: 'Preview123', name: 'Mia' }) })).json();
  const h = { 'content-type': 'application/json', 'accept-language': 'en', authorization: 'Bearer ' + reg.token };
  await fetch(base + '/trpc/settings.update', { method: 'POST', headers: h, body: JSON.stringify({ currency: 'EUR', currencySymbol: '€' }) });
  for (const [name, price, category, n] of rows) {
    const c = await fetch(base + '/trpc/subscriptions.create', { method: 'POST', headers: h, body: JSON.stringify({ name, price, billingCycle: 'monthly', category, currency: 'EUR', nextBillingDate: day(n) }) });
    if (!c.ok) console.log('create failed', name, c.status, await c.text());
  }
  require('fs').writeFileSync(process.argv[2] || '/tmp/tokens-part7', reg.token + ' ' + reg.refreshToken);
  console.log(email, reg.user.id);
})();
