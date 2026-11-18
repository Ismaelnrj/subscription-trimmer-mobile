// Part 6 demo account: the couple's subscriptions with the Gym (29.90 a month, billed on
// the 19th) cancelled, so the Cancelled screen shows what cancelling has really avoided.
//   node tools/reels/story/make-demo-account-part6.js /tmp/tokens-part6   (against the local backend on :3000)
// Then backdate the cancellation to about a month ago, which is the story's timeline
// (Part 2's cancel, then the trip), so exactly one gym charge has passed since:
//   update users set is_verified = true, email = 'mia@example.com';  (Settings shows the address)
//   update subscriptions set cancelled_at = now() - interval '33 days',
//     next_billing_date = date_trunc('day', now() - interval '30 days')
//     where name = 'Gym';
// The screen then reads "€29.90 avoided, 1 charge so far", computed by the server's own
// chargesAvoidedSince; nothing on it is typed in.
const base = 'http://127.0.0.1:3000/api';
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rows = [['Netflix Standard', 15.99, 'streaming', 3], ['Spotify Premium', 12.99, 'entertainment', 8], ['Amazon Prime', 8.99, 'shopping', 15], ['Gym', 29.90, 'fitness', 1]];
(async () => {
  const email = `story6-${Date.now()}@example.com`;
  const reg = await (await fetch(base + '/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': 'en' }, body: JSON.stringify({ email, password: 'Preview123', name: 'Mia' }) })).json();
  const h = { 'content-type': 'application/json', 'accept-language': 'en', authorization: 'Bearer ' + reg.token };
  await fetch(base + '/trpc/settings.update', { method: 'POST', headers: h, body: JSON.stringify({ currency: 'EUR', currencySymbol: '€' }) });
  let gymId = null;
  for (const [name, price, category, n] of rows) {
    const c = await fetch(base + '/trpc/subscriptions.create', { method: 'POST', headers: h, body: JSON.stringify({ name, price, billingCycle: 'monthly', category, currency: 'EUR', nextBillingDate: day(n) }) });
    if (!c.ok) { console.log('create failed', name, c.status, await c.text()); continue; }
    if (name === 'Gym') gymId = (await c.json()).result.data.id;
  }
  const x = await fetch(base + '/trpc/subscriptions.setCancelled', { method: 'POST', headers: h, body: JSON.stringify({ id: gymId, cancelled: true }) });
  if (!x.ok) console.log('cancel failed', x.status, await x.text());
  require('fs').writeFileSync(process.argv[2] || '/tmp/tokens-part6', reg.token + ' ' + reg.refreshToken);
  console.log(email, reg.user.id, 'gym', gymId);
})();
