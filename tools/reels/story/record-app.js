// Records the real app for the story reel: add Disney+ through the service search, then the dashboard total.
//   node tools/reels/story/record-app.js <outdir> <tokens file from make-demo-account.js>
// Needs the web preview on :8091 and the real backend on :3000 (CLAUDE.md, "A SANDBOX CAN NOW
// INSTALL, TYPECHECK, RUN JEST AND SEE THE APP"). The time zone is chosen so the dashboard says
// "Good evening" to match the lamp-lit scene: the greeting follows the local hour (18:00 on).
// Pick one where it is evening when you record, and still the same date.
const { chromium } = require('playwright');
const fs = require('fs');
const [outdir, tokfile] = process.argv.slice(2);
const [token, refresh] = fs.readFileSync(tokfile, 'utf8').trim().split(' ');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 3, locale: 'en-US', timezoneId: 'Asia/Dhaka', colorScheme: 'light' });
  await ctx.addInitScript(([t, r]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      const s = (k, v) => localStorage.setItem('ss_' + k, v);
      s('auth_token', t); s('refresh_token', r); s('onboarding_done', 'true'); s('app_language', 'en'); s('theme_mode', 'light');
      s('review_renewal_state_v2', JSON.stringify({ lastShown: Date.now(), count: 3 }));
      s('selected_currency', JSON.stringify({ code: 'EUR', symbol: '€', name: 'Euro' })); s('base_currency_code', 'EUR');
    }
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
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto('http://localhost:8091/', { waitUntil: 'load' });
  await p.waitForTimeout(6000);
  // Open the form before recording starts, so the clip opens on the add form.
  await p.getByLabel('Add subscription').first().click();
  await p.waitForTimeout(1500);

  const fdir = `${outdir}/frames-${Date.now()}`;
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
  const tStart = Date.now() / 1000;
  const marks = {};
  const mark = (k) => { marks[k] = +(Date.now() / 1000 - tStart).toFixed(3); };
  const smooth = (by, dur) => p.evaluate(async ([by, dur]) => {
    const els = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 40 && getComputedStyle(d).overflowY !== 'visible' && d.getBoundingClientRect().height > 300);
    const el = els[els.length - 1];
    if (!el) return;
    const from = el.scrollTop, to = Math.min(el.scrollHeight - el.clientHeight, from + by), start = performance.now();
    await new Promise((res) => {
      const step = (now) => { const k = Math.min(1, (now - start) / dur); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; el.scrollTop = from + (to - from) * e; if (k < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
    });
  }, [by, dur]);

  await p.waitForTimeout(700); mark('choose');
  await p.getByText('Choose a service', { exact: true }).first().click();
  await p.waitForTimeout(600); mark('type');
  const search = p.getByPlaceholder('Search services…').first();
  await search.click();
  await search.type('Disney', { delay: 120 });
  await p.waitForTimeout(700); mark('pick');
  await p.getByText('Disney+', { exact: true }).first().click();
  await p.waitForTimeout(900); mark('scroll');
  await smooth(900, 900);
  await p.waitForTimeout(500); mark('save');
  await p.getByText('Add subscription', { exact: true }).last().click();
  await p.waitForTimeout(1600); mark('list');
  await p.getByText('Dashboard', { exact: true }).last().click();
  await p.waitForTimeout(4500); mark('end');
  await cdp.send('Page.stopScreencast');
  const tEnd = frames.length ? frames[frames.length - 1].t + 0.5 : 0;
  let list = '';
  frames.forEach((fr, i) => { const next = i + 1 < frames.length ? frames[i + 1].t : tEnd; list += `file '${fr.f}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}\n`; });
  if (frames.length) list += `file '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(`${fdir}/list.txt`, list);
  marks.frames = frames.length;
  marks.firstFrameAfterStart = frames.length ? +(frames[0].t - tStart).toFixed(3) : null;
  fs.writeFileSync(`${outdir}/story-marks.json`, JSON.stringify({ fdir, ...marks }));
  console.log(fdir, JSON.stringify(marks), 'errors:', errs.length ? errs.join(' || ') : 'none');
  await b.close();
})();
