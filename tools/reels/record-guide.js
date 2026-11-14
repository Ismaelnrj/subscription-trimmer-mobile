// Records the real app (react-native-web) tapping into a cancel guide, full screen 9:16, for a reel.
// Made 2026-11-14 for the Higgsfield pilot; see tools/reels/README.md, "The second method".
// Chrome's own screencast at device pixels (1170x2079): Playwright's recordVideo captures at CSS size
// and pads the rest of a 1080x1920 frame with grey, which is useless for a full screen reel.
// Usage: node tools/reels/record-guide.js <outdir> <de|en> <light|dark> [service name, default Netflix Standard]
// Needs the web preview on :8091, the backend on :3000 and /tmp/pgs/tokens-vid-<lang> (README step 1).
const { chromium } = require('playwright');
const fs = require('fs');
const [outdir, lang, theme, service = 'Netflix Standard'] = process.argv.slice(2);
const [token, refresh] = fs.readFileSync(`/tmp/pgs/tokens-vid-${lang}`, 'utf8').trim().split(' ');
const cur = lang === 'de' ? { code: 'EUR', symbol: '€', name: 'Euro' } : { code: 'USD', symbol: '$', name: 'US Dollar' };
const L = lang === 'de' ? { more: 'Aktionen für ' + service, guide: 'So kündigst du', open: 'Kündigungsseite öffnen' } : { more: 'Actions for ' + service, guide: 'How to cancel', open: 'Open cancellation page' };
(async () => {
  const b = await chromium.launch();
  const t0 = Date.now();
  const ctx = await b.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 3, locale: lang === 'de' ? 'de-DE' : 'en-US', colorScheme: theme });
  await ctx.addInitScript(([t, r, lang, theme, cur]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      const s = (k, v) => localStorage.setItem('ss_' + k, v);
      s('auth_token', t); s('refresh_token', r); s('onboarding_done', 'true');
      s('app_language', lang); s('theme_mode', theme);
      s('review_renewal_state_v2', JSON.stringify({ lastShown: Date.now(), count: 3 }));
      s('selected_currency', JSON.stringify(cur)); s('base_currency_code', cur.code);
    }
    // A touch dot, so a viewer can follow each tap.
    addEventListener('pointerdown', (e) => {
      const d = document.createElement('div');
      Object.assign(d.style, { position: 'fixed', left: (e.clientX - 22) + 'px', top: (e.clientY - 22) + 'px', width: '44px', height: '44px',
        borderRadius: '50%', background: 'rgba(20,43,58,0.28)', border: '2px solid rgba(255,255,255,0.9)', pointerEvents: 'none', zIndex: 99999,
        transition: 'transform 450ms ease-out, opacity 450ms ease-out' });
      document.body.appendChild(d);
      requestAnimationFrame(() => { d.style.transform = 'scale(1.5)'; d.style.opacity = '0'; });
      setTimeout(() => d.remove(), 600);
    }, true);
  }, [token, refresh, lang, theme, cur]);
  await ctx.route(/subscription-trimmer-mobile-production\.up\.railway\.app/, async (route) => {
    const url = route.request().url().replace(/^https:\/\/subscription-trimmer-mobile-production\.up\.railway\.app/, 'http://127.0.0.1:3000');
    try {
      const res = await route.fetch({ url });
      await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    } catch (e) { await route.abort(); }
  });
  await ctx.route(/posthog|sentry|frankfurter|revenuecat/, (r) => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto('http://localhost:8091/subscriptions', { waitUntil: 'load' });
  await p.waitForTimeout(7000);

  const fdir = `${outdir}/frames-${lang}-${theme}-${Date.now()}`;
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

  // Smooth scroll so the Netflix row and the actions it opens are on screen
  // when they are tapped, rather than tapped off screen.
  const smooth = (by, dur) => p.evaluate(async ([by, dur]) => {
    const els = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 40 && getComputedStyle(d).overflowY !== 'visible' && d.getBoundingClientRect().height > 300);
    const el = els[els.length - 1];
    if (!el) return;
    const from = el.scrollTop, to = Math.min(el.scrollHeight - el.clientHeight, from + by), start = performance.now();
    await new Promise((res) => {
      const step = (now) => {
        const k = Math.min(1, (now - start) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        el.scrollTop = from + (to - from) * e;
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }, [by, dur]);
  await p.waitForTimeout(700);
  await smooth(300, 900);
  await p.waitForTimeout(300); mark('more');
  await p.getByLabel(L.more).first().click();
  await p.waitForTimeout(1100); mark('tapGuide');
  await p.getByText(L.guide, { exact: true }).first().click();
  await p.waitForTimeout(450); mark('guide');
  // Past the note at the top quickly (it names Apple, and the reels stay clear
  // of it), then the slow read through the steps.
  await smooth(230, 350);
  mark('pastNote');
  await p.evaluate(async () => {
    const els = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 40 && getComputedStyle(d).overflowY !== 'visible' && d.getBoundingClientRect().height > 300);
    const el = els[els.length - 1];
    if (!el) return;
    const from = el.scrollTop, to = Math.min(el.scrollHeight - el.clientHeight, from + 420), dur = 2400, start = performance.now();
    await new Promise((res) => {
      const step = (now) => {
        const k = Math.min(1, (now - start) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        el.scrollTop = from + (to - from) * e;
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  });
  mark('scrolled');
  // Hold on the steps, then tap the button that opens the provider's page.
  ctx.on('page', (np) => np.close().catch(() => {}));
  await p.waitForTimeout(1700);
  await p.getByText(L.open, { exact: true }).first().click({ noWaitAfter: true }); mark('tapOpen');
  await p.waitForTimeout(900); mark('end');
  await cdp.send('Page.stopScreencast');
  const tEnd = frames.length ? frames[frames.length - 1].t + 2.0 : 0;

  // A concat list with real durations: the screencast only sends a frame when something changed.
  let list = '';
  frames.forEach((fr, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : tEnd;
    list += `file '${fr.f}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}\n`;
  });
  if (frames.length) list += `file '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(`${fdir}/list.txt`, list);
  marks.frames = frames.length;
  marks.span = frames.length ? +(tEnd - frames[0].t).toFixed(3) : 0;
  marks.firstFrameAfterStart = frames.length ? +(frames[0].t - tStart).toFixed(3) : null;
  fs.writeFileSync(`${outdir}/cancel-${lang}-${theme}-${service.split(' ')[0].toLowerCase()}.json`, JSON.stringify({ fdir, ...marks }));
  console.log(lang, fdir, JSON.stringify(marks), 'errors:', errs.length ? errs.join(' || ') : 'none');
  await ctx.close();
  await b.close();
})();
