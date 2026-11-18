// One 3x still of the real app for a held shot in a story reel, nothing recorded or tapped.
//   node tools/reels/story/shoot-still.js <url> "<text to wait for>" out.png <tokens file> ["<text to scroll into view>"]
// Same setup as record-price.js: the web preview on :8091, the real backend on :3000, and
// REEL_TZ to match the scene's time of day (the dashboard greets by the local hour).
const { chromium } = require('playwright');
const fs = require('fs');
const [url, waitText, out, tokfile, scrollText] = process.argv.slice(2);
const [token, refresh] = fs.readFileSync(tokfile, 'utf8').trim().split(' ');

async function context(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 3, locale: 'en-US', timezoneId: process.env.REEL_TZ || 'Pacific/Honolulu', colorScheme: 'light' });
  await ctx.addInitScript(([t, r]) => {
    const s = (k, v) => localStorage.setItem('ss_' + k, v);
    if (!localStorage.getItem('ss_seeded_still')) { s('seeded_still', '1'); s('auth_token', t); s('refresh_token', r); }
    s('onboarding_done', 'true'); s('app_language', 'en'); s('theme_mode', 'light');
    s('review_renewal_state_v2', JSON.stringify({ lastShown: Date.now(), count: 3 }));
    s('selected_currency', JSON.stringify({ code: 'EUR', symbol: '€', name: 'Euro' })); s('base_currency_code', 'EUR');
    addEventListener('pointerdown', (e) => {
      const d = document.createElement('div');
      Object.assign(d.style, { position: 'fixed', left: (e.clientX - 22) + 'px', top: (e.clientY - 22) + 'px', width: '44px', height: '44px',
        borderRadius: '50%', background: 'rgba(20,43,58,0.28)', border: '2px solid rgba(255,255,255,0.9)', pointerEvents: 'none', zIndex: 99999,
        transition: 'transform 450ms ease-out, opacity 450ms ease-out' });
      document.body.appendChild(d);
      requestAnimationFrame(() => { d.style.transform = 'scale(1.5)'; d.style.opacity = '0'; });
      setTimeout(() => d.remove(), 600);
    }, true);
  }, [token, refresh]);
  await ctx.route(/subscription-trimmer-mobile-production\.up\.railway\.app/, async (route) => {
    const url = route.request().url().replace(/^https:\/\/subscription-trimmer-mobile-production\.up\.railway\.app/, 'http://127.0.0.1:3000');
    try { const res = await route.fetch({ url }); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }); } catch { await route.abort(); }
  });
  await ctx.route(/posthog|sentry|frankfurter|revenuecat/, (r) => r.abort());
  return ctx;
}

(async () => {
  const b = await chromium.launch();
  const ctx = await context(b);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(url, { waitUntil: 'load' });
  await p.getByText(waitText, { exact: true }).first().waitFor({ timeout: 20000 });
  if (scrollText) await p.getByText(scrollText, { exact: true }).first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(2000);
  await p.screenshot({ path: out });
  console.log('still', out, errs.length ? 'ERRORS ' + errs.join(' | ') : '');
  await b.close();
})();
