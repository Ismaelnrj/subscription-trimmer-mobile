// Records the real app for Part 2 of the story reel: open Gym's actions, Delete, choose
// "I cancelled it", and hold on the card with the yearly amount kept.
//   node tools/reels/story/record-cancel.js <outdir> <tokens file> [en|de]
// Needs the web preview on :8091 and the real backend on :3000, like record-app.js. Refresh
// tokens rotate on use, so take a fresh pair before every run (log in again), and reset the
// row first, or the second run finds Gym already cancelled:
//   update subscriptions set cancelled_at = null, is_active = true where name = 'Gym';
// The web preview cannot draw Android's native dialog: the scratch copy's react-native-web
// Alert is patched to record window.__alerts (CLAUDE.md, "WEB PREVIEW TRAP, a third one"),
// and this script presses "I cancelled it" from there. The dialog is therefore NOT in the
// footage; the edit cuts from the Delete tap straight to the card, which itself says
// "marked as cancelled", so nothing on screen claims a delete saves money.
const { chromium } = require('playwright');
const fs = require('fs');
const [outdir, tokfile, lang = 'en'] = process.argv.slice(2);
const [token, refresh] = fs.readFileSync(tokfile, 'utf8').trim().split(' ');
const row = process.env.REEL_ROW || 'Gym'; // any row: REEL_ROW='Disney+' for the announcement reel
const L = {
  en: { actions: `Actions for ${row}`, del: `Delete ${row}`, locale: 'en-US' },
  de: { actions: `Aktionen für ${row}`, del: `${row} löschen`, locale: 'de-DE' },
}[lang];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 3, locale: L.locale, timezoneId: 'Asia/Dhaka', colorScheme: 'light' });
  await ctx.addInitScript(([t, r, lang]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      const s = (k, v) => localStorage.setItem('ss_' + k, v);
      s('auth_token', t); s('refresh_token', r); s('onboarding_done', 'true'); s('app_language', lang); s('theme_mode', 'light');
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
  }, [token, refresh, lang]);
  await ctx.route(/subscription-trimmer-mobile-production\.up\.railway\.app/, async (route) => {
    const url = route.request().url().replace(/^https:\/\/subscription-trimmer-mobile-production\.up\.railway\.app/, 'http://127.0.0.1:3000');
    try { const res = await route.fetch({ url }); await route.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }); } catch { await route.abort(); }
  });
  await ctx.route(/posthog|sentry|frankfurter|revenuecat/, (r) => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto('http://localhost:8091/subscriptions', { waitUntil: 'load' });
  await p.getByLabel(L.actions).waitFor({ timeout: 20000 });
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

  await p.waitForTimeout(900); mark('actions');
  await p.getByLabel(L.actions).click();
  await p.waitForTimeout(1100); mark('delete');
  await p.getByLabel(L.del).click();
  await p.waitForTimeout(500); mark('pressed');
  const pressed = await p.evaluate(() => {
    const a = (window.__alerts || []).slice(-1)[0];
    const btn = a && a.buttons && a.buttons[a.buttons.length - 1];
    if (!btn || !btn.onPress) return null;
    btn.onPress();
    return btn.text;
  });
  if (!pressed) throw new Error('no recorded alert to answer');
  await p.waitForTimeout(4200); mark('end');
  await cdp.send('Page.stopScreencast');
  const tEnd = frames.length ? frames[frames.length - 1].t + 0.5 : 0;
  let list = '';
  frames.forEach((fr, i) => { const next = i + 1 < frames.length ? frames[i + 1].t : tEnd; list += `file '${fr.f}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}\n`; });
  if (frames.length) list += `file '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(`${fdir}/list.txt`, list);
  marks.frames = frames.length;
  marks.firstFrameAfterStart = frames.length ? +(frames[0].t - tStart).toFixed(3) : null;
  marks.pressed = pressed;
  fs.writeFileSync(`${outdir}/cancel-marks.json`, JSON.stringify({ fdir, ...marks }));
  console.log(fdir, JSON.stringify(marks), 'errors:', errs.length ? errs.join(' || ') : 'none');
  await b.close();
})();
