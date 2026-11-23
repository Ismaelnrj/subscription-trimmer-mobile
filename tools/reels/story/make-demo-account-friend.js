// "The friend" demo account: the four subscriptions of the friend who has none, at the catalogue's checked DACH prices
// where there is one (Netflix Standard 15.99, Spotify Premium 12.99, verified 2026-09) and his own price where there is
// not (Gym 29.90, Audible 9.95).
//   node tools/reels/story/make-demo-account-friend.js /tmp/tokens-friend   (against the local backend on :3000)
// Then: update users set is_verified = true where email like 'storyf-%';
const base = 'http://127.0.0.1:3000/api';
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rows = [['Audible', 9.95, 'entertainment', 2], ['Netflix Standard', 15.99, 'streaming', 6], ['Spotify Premium', 12.99, 'entertainment', 11], ['Gym', 29.90, 'fitness', 19]];
(async () => {
  const email = `storyf-${Date.now()}@example.com`;
  const reg = await (await fetch(base + '/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': 'en' }, body: JSON.stringify({ email, password: 'Preview123', name: 'Jonas' }) })).json();
  const h = { 'content-type': 'application/json', 'accept-language': 'en', authorization: 'Bearer ' + reg.token };
  await fetch(base + '/trpc/settings.update', { method: 'POST', headers: h, body: JSON.stringify({ currency: 'EUR', currencySymbol: '€' }) });
  for (const [name, price, category, n] of rows) {
    const c = await fetch(base + '/trpc/subscriptions.create', { method: 'POST', headers: h, body: JSON.stringify({ name, price, billingCycle: 'monthly', category, currency: 'EUR', nextBillingDate: day(n) }) });
    if (!c.ok) console.log('create failed', name, c.status, await c.text());
  }
  require('fs').writeFileSync(process.argv[2] || '/tmp/tokens-friend', reg.token + ' ' + reg.refreshToken);
  console.log(email, reg.user.id);
})();
