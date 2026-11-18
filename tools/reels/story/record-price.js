// Records the real app for Part 5 of the story reel: the dashboard's price card for a
// tracked Netflix Standard (13.99) priced below its checked price (15.99, DACH, verified
// 2026-09-05), a 3x still of the card, then the tap on "Update to €15.99".
//   node tools/reels/story/record-price.js <outdir> <tokens file>
// Same setup as record-paste.js: the web preview on :8091 and the real backend on :3000.
// The tap DOES change the demo row (that is the feature), so make a fresh demo account
// for every run. The account's older 13.99 is the character's own price, not a claim
// about Netflix's history; the card says only what Trimio's checked list says.
// The kitchen is morning, so the greeting must read "Good morning": pass a time zone where
// it is morning when you record, e.g. REEL_TZ=Europe/Berlin around 08:00 to 11:00 UTC.
const { chromium } = require('playwright');
const fs = require('fs');
const [outdir, tokfile] = process.argv.slice(2);
const [token, refresh] = fs.readFileSync(tokfile, 'utf8').trim().split(' ');
fs.mkdirSync(outdir, { recursive: true });

async function context(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 3, locale: 'en-US', timezoneId: process.env.REEL_TZ || 'Pacific/Honolulu', colorScheme: 'light' });
  await ctx.addInitScript(([t, r]) => {
    const s = (k, v) => localStorage.setItem('ss_' + k, v);
    if (!localStorage.getItem('ss_seeded_p5')) { s('seeded_p5', '1'); s('auth_token', t); s('refresh_token', r); }
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
  await p.goto('http://localhost:8091/', { waitUntil: 'load' });
  const card = p.getByText('Netflix Standard costs more now', { exact: true }).first();
  await card.waitFor({ timeout: 20000 });
  await p.waitForTimeout(2500);
  // 1. The still: the card as a 3x screenshot, for the held shot.
  await p.screenshot({ path: `${outdir}/card.png` });
  // 2. The recording: the card, then the tap on "Update to €15.99".
  const fdir = `${outdir}/price-${Date.now()}`;
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
  await p.waitForTimeout(1200); mark('tap');
  await p.getByText('Update to €15.99', { exact: true }).first().click();
  await card.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  mark('gone');
  await p.waitForTimeout(1500); mark('end');
  await cdp.send('Page.stopScreencast');
  const tEnd = frames.length ? frames[frames.length - 1].t + 0.5 : 0;
  let list = '';
  frames.forEach((fr, i) => { const next = i + 1 < frames.length ? frames[i + 1].t : tEnd; list += `file '${fr.f}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}\n`; });
  if (frames.length) list += `file '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(`${fdir}/list.txt`, list);
  marks.frames = frames.length; marks.firstFrame = frames.length ? +(frames[0].t - t0).toFixed(3) : null;
  await p.screenshot({ path: `${outdir}/after.png` });
  fs.writeFileSync(`${outdir}/price-marks.json`, JSON.stringify({ fdir, marks, errs }));
  console.log('price', fdir, JSON.stringify(marks), errs.length ? 'ERRORS ' + errs.join(' | ') : '');
  await b.close();
})();
