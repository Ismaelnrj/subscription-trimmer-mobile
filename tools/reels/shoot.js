// Raw screens for the Instagram reels, from the REAL app (react-native-web)
// against the real backend on a local PostgreSQL. Never drawn or generated.
//   node tools/reels/shoot.js <lang> <token file> <out dir>
// The token file holds "<access token> <refresh token>" for a demo account made
// with tools/store-screenshots/demo-accounts.js and marked verified (otherwise
// the dashboard leads with the verify banner). Expects the preview on :8091.
const { chromium } = require('playwright');
const fs = require('fs');
const [lang, tokenFile, out] = process.argv.slice(2);
const RECEIPT = lang === 'de'
  ? 'Disney+\nWillkommen bei Disney+.\nDisney+ Standard: 10,99 € pro Monat\nNächste Zahlung: 3. Dezember 2026'
  : 'YouTube\nThanks for joining YouTube Premium.\nYouTube Premium: $15.99 per month\nNext payment: December 3, 2026';
(async () => {
  const [token, refresh] = fs.readFileSync(tokenFile, 'utf8').trim().split(' ');
  const cur = lang === 'de' ? { code: 'EUR', symbol: '€', name: 'Euro' } : { code: 'USD', symbol: '$', name: 'US Dollar' };
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: lang === 'de' ? 'de-DE' : 'en-US' });
  await ctx.addInitScript(([t, r, lang, cur]) => {
    const s = (k, v) => localStorage.setItem('ss_' + k, v);
    if (!localStorage.getItem('ss_auth_token')) { s('auth_token', t); s('refresh_token', r); }
    s('onboarding_done', 'true'); s('app_language', lang); s('theme_mode', 'light');
    s('review_renewal_state_v2', JSON.stringify({ lastShown: Date.now(), count: 3 }));
    s('first_goal_dismissed', 'true');
    s('selected_currency', JSON.stringify(cur)); s('base_currency_code', cur.code);
  }, [token, refresh, lang, cur]);
  await ctx.route(/subscription-trimmer-mobile-production\.up\.railway\.app/, async (route) => {
    const url = route.request().url().replace(/^https:\/\/subscription-trimmer-mobile-production\.up\.railway\.app/, 'http://127.0.0.1:3000');
    try { const res = await route.fetch({ url }); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }); }
    catch (_e) { await route.abort(); }
  });
  await ctx.route(/posthog|sentry|frankfurter|revenuecat/, (r) => r.abort());
  const p = await ctx.newPage();
  const go = async (route) => { await p.goto('http://localhost:8091' + route, { waitUntil: 'load' }); await p.waitForTimeout(7000); };
  await go('/'); await p.screenshot({ path: `${out}/dash.png` });
  await go('/cancel-guide?name=' + encodeURIComponent('Netflix Standard')); await p.screenshot({ path: `${out}/cancel.png` });
  await go('/notification-preferences'); await p.screenshot({ path: `${out}/prefs.png` });
  await go('/subscriptions?from=paste');
  const ta = p.locator('textarea').first();
  for (let i = 0; i < 3 && !(await ta.count()); i++) await go('/subscriptions?from=paste');
  await p.screenshot({ path: `${out}/paste0.png` });
  await ta.fill(RECEIPT); await p.waitForTimeout(1200);           // the real parser fills the form
  await p.screenshot({ path: `${out}/paste1.png` });
  await p.evaluate(() => {                                         // bring name, price and cycle into view
    const t = document.querySelector('textarea'); let n = t.parentElement;
    while (n && !(n.scrollHeight > n.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(n).overflowY))) n = n.parentElement;
    n.scrollTop = n.scrollTop + t.getBoundingClientRect().top - n.getBoundingClientRect().top - 40;
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/paste2.png` });
  await b.close();
})();
