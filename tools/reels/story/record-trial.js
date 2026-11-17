// Records the real app for Part 3 of the story reel: the dashboard's "Trials ending soon"
// card (YouTube Premium, 1d left), then the list's "How to cancel" for it and the guide.
//   node tools/reels/story/record-trial.js <outdir> <tokens file>
// Needs the web preview on :8091 and the real backend on :3000, like record-cancel.js, and a
// YouTube Premium row created with trialEndDate = tomorrow in the recording's time zone.
// Pacific/Honolulu makes the dashboard say "Good morning", to match the morning kitchen.
// The guide's note names Apple ("billed through Apple or Google Play") and posts never show
// Apple. The page ends before the note can scroll fully away (its last line stays in view),
// so assemble-part3.py uses only the taps from this recording, stopping one frame before the
// guide opens, and shows the steps as a crop of stills-part3.js's still from below the note.
const { chromium } = require('playwright');
const fs = require('fs');
const [outdir, tokfile] = process.argv.slice(2);
const [token, refresh] = fs.readFileSync(tokfile, 'utf8').trim().split(' ');

async function shoot(ctx, name, path, act) {
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto('http://localhost:8091' + path, { waitUntil: 'load' });
  await p.waitForTimeout(4500);
  const fdir = `${outdir}/${name}-${Date.now()}`;
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
  await act(p, (k) => { marks[k] = +(Date.now() / 1000 - t0).toFixed(3); });
  await cdp.send('Page.stopScreencast');
  const tEnd = frames.length ? frames[frames.length - 1].t + 0.5 : 0;
  let list = '';
  frames.forEach((fr, i) => { const next = i + 1 < frames.length ? frames[i + 1].t : tEnd; list += `file '${fr.f}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}\n`; });
  if (frames.length) list += `file '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(`${fdir}/list.txt`, list);
  marks.frames = frames.length; marks.firstFrame = frames.length ? +(frames[0].t - t0).toFixed(3) : null;
  console.log(name, fdir, JSON.stringify(marks), 'errors:', errs.length ? errs.join(' || ') : 'none');
  await p.close();
  return { fdir, marks };
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 3, locale: 'en-US', timezoneId: 'Pacific/Honolulu', colorScheme: 'light' });
  await ctx.addInitScript(([t, r]) => {
    const s = (k, v) => localStorage.setItem('ss_' + k, v);
    if (!localStorage.getItem('ss_seeded_p3')) {
      s('seeded_p3', '1'); s('auth_token', t); s('refresh_token', r);
    }
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

  const dash = await shoot(ctx, 'dash', '/', async (p, mark) => {
    await p.getByText('Trials ending soon').waitFor({ timeout: 20000 });
    mark('start'); await p.waitForTimeout(2600); mark('end');
  });
  const guide = await shoot(ctx, 'guide', '/subscriptions', async (p, mark) => {
    const btn = p.getByLabel('Actions for YouTube Premium');
    await btn.waitFor({ timeout: 20000 });
    await btn.scrollIntoViewIfNeeded();
    await p.waitForTimeout(700); mark('actions');
    await btn.click();
    await p.waitForTimeout(800); mark('howto');
    await p.getByText('How to cancel', { exact: true }).first().click();
    await p.getByText('How to cancel YouTube Premium').waitFor({ timeout: 10000 });
    await p.waitForTimeout(700); mark('guide');
    await p.mouse.move(195, 420);
    for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 32); await p.waitForTimeout(30); }
    await p.waitForTimeout(2300); mark('end');
  });
  fs.writeFileSync(`${outdir}/trial-marks.json`, JSON.stringify({ dash, guide }));
  await b.close();
})();
