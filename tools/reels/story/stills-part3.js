// Sharp stills for Part 3 of the story reel, at 3x like a phone screen:
//   node tools/reels/story/stills-part3.js <outdir> <tokens file>
// dashboard.png: the dashboard with "Trials ending soon" (YouTube Premium, 1d left).
// guide.png: YouTube Premium's cancel guide, scrolled by 256 px. The note above the steps
// names Apple and the page ends before it can scroll away, so assemble-part3.py crops below
// it; nothing in the screen itself is changed.
// The web preview's screencast only delivers CSS-size frames (390 wide) whatever the scale
// factor, so the held shots come from screenshots instead; only the taps stay a recording.
// Same setup as record-trial.js: web preview on :8091, the real backend on :3000.
const { chromium } = require('playwright');
const fs = require('fs');
const [outdir, tokfile] = process.argv.slice(2);
const [token, refresh] = fs.readFileSync(tokfile, 'utf8').trim().split(' ');
fs.mkdirSync(outdir, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 3, locale: 'en-US', timezoneId: 'Pacific/Honolulu', colorScheme: 'light' });
  await ctx.addInitScript(([t, r]) => {
    const s = (k, v) => localStorage.setItem('ss_' + k, v);
    if (!localStorage.getItem('ss_seeded_p3')) { s('seeded_p3', '1'); s('auth_token', t); s('refresh_token', r); }
    s('onboarding_done', 'true'); s('app_language', 'en'); s('theme_mode', 'light');
    s('review_renewal_state_v2', JSON.stringify({ lastShown: Date.now(), count: 3 }));
    s('selected_currency', JSON.stringify({ code: 'EUR', symbol: '€', name: 'Euro' })); s('base_currency_code', 'EUR');
  }, [token, refresh]);
  await ctx.route(/subscription-trimmer-mobile-production\.up\.railway\.app/, async (route) => {
    const url = route.request().url().replace(/^https:\/\/subscription-trimmer-mobile-production\.up\.railway\.app/, 'http://127.0.0.1:3000');
    try { const res = await route.fetch({ url }); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }); } catch { await route.abort(); }
  });
  await ctx.route(/posthog|sentry|frankfurter|revenuecat/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto('http://localhost:8091/', { waitUntil: 'load' });
  await p.getByText('Trials ending soon').waitFor({ timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${outdir}/dashboard.png` });
  await p.goto('http://localhost:8091/subscriptions', { waitUntil: 'load' });
  const btn = p.getByLabel('Actions for YouTube Premium');
  await btn.waitFor({ timeout: 20000 });
  await p.waitForTimeout(1500);
  await btn.click();
  await p.waitForTimeout(800);
  await p.getByText('How to cancel', { exact: true }).first().click();
  await p.getByText('How to cancel YouTube Premium').waitFor({ timeout: 10000 });
  await p.waitForTimeout(800);
  await p.mouse.move(195, 400);
  for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 32); await p.waitForTimeout(30); }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${outdir}/guide.png` });
  console.log('stills ->', outdir);
  await b.close();
})();
