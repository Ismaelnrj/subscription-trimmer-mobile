// Records the real app for Part 6 of the story reel: Settings, the tap on "Cancelled
// subscriptions", and the Cancelled screen showing what cancelling the Gym has avoided so
// far (one 29.90 charge), plus a 3x still of that screen for the held shot.
//   node tools/reels/story/record-cancelled.js <outdir> <tokens file>
// Same setup as record-price.js: the web preview on :8091 and the real backend on :3000,
// with the account from make-demo-account-part6.js and its backdated cancellation. Nothing
// is changed by the recording, so one account serves any number of runs.
const { chromium } = require('playwright');
const fs = require('fs');
const [outdir, tokfile] = process.argv.slice(2);
const [token, refresh] = fs.readFileSync(tokfile, 'utf8').trim().split(' ');
fs.mkdirSync(outdir, { recursive: true });

async function context(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 3, locale: 'en-US', timezoneId: process.env.REEL_TZ || 'Pacific/Honolulu', colorScheme: 'light' });
  await ctx.addInitScript(([t, r]) => {
    const s = (k, v) => localStorage.setItem('ss_' + k, v);
    if (!localStorage.getItem('ss_seeded_p6')) { s('seeded_p6', '1'); s('auth_token', t); s('refresh_token', r); }
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
  // The recording: Settings, then the tap on "Cancelled subscriptions". The 3x still for
  // the held shot is taken at the end, after the tap, so it carries the same back arrow.
  await p.goto('http://localhost:8091/profile', { waitUntil: 'load' });
  const row = p.getByText('Cancelled subscriptions', { exact: true }).first();
  await row.waitFor({ timeout: 20000 });
  await row.scrollIntoViewIfNeeded();
  await p.waitForTimeout(1500);
  const fdir = `${outdir}/cancelled-${Date.now()}`;
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
  await p.waitForTimeout(1000); mark('tap');
  await row.click();
  await p.getByText('Avoided since cancelling', { exact: true }).first().waitFor({ timeout: 10000 });
  mark('shown');
  await p.waitForTimeout(2000); mark('end');
  await cdp.send('Page.stopScreencast');
  await p.screenshot({ path: `${outdir}/cancelled.png` });
  const tEnd = frames.length ? frames[frames.length - 1].t + 0.5 : 0;
  let list = '';
  frames.forEach((fr, i) => { const next = i + 1 < frames.length ? frames[i + 1].t : tEnd; list += `file '${fr.f}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}\n`; });
  if (frames.length) list += `file '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(`${fdir}/list.txt`, list);
  marks.frames = frames.length; marks.firstFrame = frames.length ? +(frames[0].t - t0).toFixed(3) : null;
  fs.writeFileSync(`${outdir}/cancelled-marks.json`, JSON.stringify({ fdir, marks, errs }));
  console.log('cancelled', fdir, JSON.stringify(marks), errs.length ? 'ERRORS ' + errs.join(' | ') : '');
  await b.close();
})();
