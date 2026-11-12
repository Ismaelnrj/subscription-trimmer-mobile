// Store screenshots of the real app (react-native-web) against the local real backend.
// Usage: node shoot-store.js <outdir> <lang> <theme>
const { chromium } = require('playwright');
const fs = require('fs');
const [outdir, lang, theme] = process.argv.slice(2);
const [token, refresh] = fs.readFileSync(`/tmp/pgs/tokens-store-${lang}`, 'utf8').trim().split(' ');
const cur = lang === 'de' ? { code: 'EUR', symbol: '€', name: 'Euro' } : { code: 'USD', symbol: '$', name: 'US Dollar' };
const RECEIPT = lang === 'de'
  ? 'Disney+\nWillkommen bei Disney+.\nDisney+ Standard: 10,99 € pro Monat\nNächste Zahlung: 3. Dezember 2026'
  : 'YouTube\nThanks for joining YouTube Premium.\nYouTube Premium: $15.99 per month\nNext payment: December 3, 2026';
(async () => {
  fs.mkdirSync(outdir, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: lang === 'de' ? 'de-DE' : 'en-US', colorScheme: theme });
  await ctx.addInitScript(([t, r, lang, theme, cur]) => {
    const s = (k, v) => localStorage.setItem('ss_' + k, v);
    s('auth_token', t); s('refresh_token', r); s('onboarding_done', 'true');
    s('app_language', lang); s('theme_mode', theme);
    s('review_renewal_state_v2', JSON.stringify({ lastShown: Date.now(), count: 3 }));
    s('selected_currency', JSON.stringify(cur)); s('base_currency_code', cur.code);
  }, [token, refresh, lang, theme, cur]);
  await ctx.route(/subscription-trimmer-mobile-production\.up\.railway\.app/, async (route) => {
    const url = route.request().url().replace(/^https:\/\/subscription-trimmer-mobile-production\.up\.railway\.app/, 'http://127.0.0.1:3000');
    try {
      const res = await route.fetch({ url });
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    } catch (_e) { await route.abort(); }
  });
  await ctx.route(/posthog|sentry|frankfurter|revenuecat/, (r) => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  const go = async (route, name, after) => {
    await p.goto('http://localhost:8091' + route, { waitUntil: 'load' });
    await p.waitForTimeout(8000);
    if (after) await after();
    await p.screenshot({ path: `${outdir}/${name}.png` });
    console.log(name, p.url().replace('http://localhost:8091', ''));
  };
  await go('/', 'dashboard');
  await go('/calendar', 'calendar', async () => {
    // The grid tab: the label also names the bottom tab, so take the one nearer the top.
    const tabs = p.getByText(lang === 'de' ? 'Kalender' : 'Calendar', { exact: true });
    let best = null, bestY = 1e9;
    for (let i = 0; i < await tabs.count(); i++) { const bb = await tabs.nth(i).boundingBox(); if (bb && bb.y > 90 && bb.y < bestY) { bestY = bb.y; best = tabs.nth(i); } }
    await best.click();
    await p.waitForTimeout(1500);
  });
  await go('/analytics', 'stats');
  await go('/subscriptions', 'list');
  await go('/cancel-guide?name=' + encodeURIComponent('Netflix Standard'), 'cancel');
  await go('/notification-preferences', 'reminders');
  await go('/subscriptions?from=paste', 'paste', async () => {
    const ta = p.locator('textarea').first();
    for (let i = 0; i < 3 && !(await ta.count()); i++) { await p.goto('http://localhost:8091/subscriptions?from=paste', { waitUntil: 'load' }); await p.waitForTimeout(8000); }
    await ta.fill(RECEIPT);
    await p.waitForTimeout(1200);
    await ta.evaluate((el) => { let n = el.parentElement; while (n && !(n.scrollHeight > n.clientHeight + 20 && getComputedStyle(n).overflowY !== 'visible')) n = n.parentElement; if (n) { const top = el.getBoundingClientRect().top - n.getBoundingClientRect().top + n.scrollTop; n.scrollTop = top - 150; } });
    await p.waitForTimeout(800);
  });
  console.log('errors:', [...new Set(errs)].slice(0, 5).join(' || ') || 'none');
  await b.close();
})();
