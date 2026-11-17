// Records the real app for Part 4 of the story reel: the list's "Paste email", a pasted
// confirmation email, and the form the parser fills in. Then a 3x still of the filled form.
//   node tools/reels/story/record-paste.js <outdir> <tokens file>
// Same setup as record-trial.js: the web preview on :8091 and the real backend on :3000.
// Nothing is saved: the take ends on the filled form, so the demo account is unchanged.
// The email is a short demo text at the catalogue's checked price (Amazon Prime DACH 8.99,
// verified 2026-09-05), not a copy of any real email.
const { chromium } = require('playwright');
const fs = require('fs');
const [outdir, tokfile] = process.argv.slice(2);
const [token, refresh] = fs.readFileSync(tokfile, 'utf8').trim().split(' ');
const RECEIPT = 'Amazon Prime\nThanks for being a Prime member.\nAmazon Prime: €8.99 per month\nNext payment: December 3, 2026';
fs.mkdirSync(outdir, { recursive: true });

async function context(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 3, locale: 'en-US', timezoneId: 'Pacific/Honolulu', colorScheme: 'light' });
  await ctx.addInitScript(([t, r]) => {
    const s = (k, v) => localStorage.setItem('ss_' + k, v);
    if (!localStorage.getItem('ss_seeded_p4')) { s('seeded_p4', '1'); s('auth_token', t); s('refresh_token', r); }
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

async function scrollToFields(p) {
  await p.mouse.move(195, 400);
  for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 40); await p.waitForTimeout(30); }
}

(async () => {
  const b = await chromium.launch();
  // 1. The recording: list, tap "Paste email", the email lands, the form fills.
  const ctx = await context(b);
  const p = await ctx.newPage();
  await p.goto('http://localhost:8091/subscriptions', { waitUntil: 'load' });
  await p.getByText('Paste email', { exact: true }).first().waitFor({ timeout: 20000 });
  await p.waitForTimeout(2500);
  const fdir = `${outdir}/paste-${Date.now()}`;
  fs.mkdirSync(fdir, { recursive: true });
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const f = `${fdir}/${String(frames.length).padStart(5, '0')}.jpg`;
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    frames.push({ f, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 1170, maxHeight: 2079, everyNthFrame: 1 });
  const t0 = Date.now() / 1000; const marks = {};
  const mark = (k) => { marks[k] = +(Date.now() / 1000 - t0).toFixed(3); };
  await p.waitForTimeout(600); mark('tap');
  await p.getByText('Paste email', { exact: true }).first().click();
  await p.locator('textarea').first().waitFor({ timeout: 10000 });
  await p.waitForTimeout(700); mark('paste');
  await p.locator('textarea').first().fill(RECEIPT);
  await p.getByText(/Detected:/).first().waitFor({ timeout: 10000 }); mark('detected');
  await p.waitForTimeout(500);
  await scrollToFields(p);
  await p.waitForTimeout(1200); mark('end');
  await cdp.send('Page.stopScreencast');
  const tEnd = frames.length ? frames[frames.length - 1].t + 0.5 : 0;
  let list = '';
  frames.forEach((fr, i) => { const next = i + 1 < frames.length ? frames[i + 1].t : tEnd; list += `file '${fr.f}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}\n`; });
  if (frames.length) list += `file '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(`${fdir}/list.txt`, list);
  marks.frames = frames.length; marks.firstFrame = frames.length ? +(frames[0].t - t0).toFixed(3) : null;
  // 2. The still: the same filled form as a 3x screenshot, for the held shot.
  await p.screenshot({ path: `${outdir}/filled.png` });
  fs.writeFileSync(`${outdir}/paste-marks.json`, JSON.stringify({ fdir, marks }));
  console.log('paste', fdir, JSON.stringify(marks));
  await b.close();
})();
