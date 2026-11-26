// Composes the 1080x1920 Play Store frames in store-assets/screenshots from raw
// app screenshots (see README.md beside this file for where those come from).
// Usage: node compose.js <lang> <work dir holding raw-<lang>-light/ and raw-<lang>-dark/>
//
// THE SECOND SET, 2026-11-26, in the look the app now opens with (the Brand
// panel): the navy stage and its rings behind the phone, the mint lens behind
// it for depth, larger type, a larger phone, and on the first frame the real
// reminder notification the app sends, in its own words. The last frame keeps
// the light ground so the set does not read as one picture six times.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const lang = process.argv[2];
const S = path.resolve(process.argv[3]);
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'captions.json'), 'utf8'))[lang];
const url = (p) => `file://${path.join(ROOT, p)}`;
const font = (w) => `url(${url(`assets/fonts/Montserrat-${w}.ttf`)})`;
const data = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;

// Palette, all from lib/theme.ts: STAGE.ink and STAGE.lead on the stage, ink
// and slate on the light ground. Measured on the stage's two ends in the theme.
const INK_ON_STAGE = '#F2F1EC';
const LEAD_ON_STAGE = '#C5D0D6';
const INK = '#142B3A';
const SLATE = '#52616B';

const PHONE_TOP = 640;
const PHONE_W = 880;

const html = ({ shot, bar, ground, title, sub, lens, note }) => {
  const stage = ground === 'stage';
  const barText = bar.dark ? '#F2F1EC' : '#142B3A';
  const lensLeft = lens === 'left' ? -170 : 1080 - 330;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:M;font-weight:400;src:${font('Regular')}}
@font-face{font-family:M;font-weight:600;src:${font('SemiBold')}}
@font-face{font-family:M;font-weight:700;src:${font('Bold')}}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:M;
 background:${stage ? `#142B3A url(${url('assets/brand/stage.png')}) right top / auto 1920px no-repeat` : '#F3F5F6'}}
.lens{position:absolute;left:${lensLeft}px;top:${note ? 1040 : 880}px;width:500px;height:500px}
.cap{position:absolute;left:88px;right:88px;top:104px}
h1{text-wrap:balance;margin:0;font-weight:700;font-size:92px;line-height:1.06;letter-spacing:-2.2px;color:${stage ? INK_ON_STAGE : INK}}
p{text-wrap:pretty;margin:30px 0 0;font-weight:400;font-size:40px;line-height:1.36;color:${stage ? LEAD_ON_STAGE : SLATE}}
.phone{position:absolute;left:${(1080 - PHONE_W) / 2}px;top:${PHONE_TOP}px;width:${PHONE_W}px;height:1700px;border-radius:88px;background:#060D12;
 box-shadow:0 40px 110px rgba(0,0,0,${stage ? 0.5 : 0.22})}
.screen{position:absolute;left:16px;top:16px;right:16px;bottom:0;border-radius:72px 72px 0 0;overflow:hidden;background:${bar.color}}
.status{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 40px;color:${barText};font-weight:600;font-size:26px;position:relative}
.cam{position:absolute;left:50%;top:14px;width:26px;height:26px;margin-left:-13px;border-radius:50%;background:#060D12}
.icons{display:flex;gap:12px;align-items:center}
.screen img{display:block;width:${PHONE_W - 32}px}
.note{position:absolute;left:72px;right:72px;top:${PHONE_TOP + 14}px;background:#FFFFFF;border-radius:40px;padding:34px 40px 38px;
 box-shadow:0 30px 80px rgba(6,13,18,.45)}
.nhead{display:flex;align-items:center;gap:16px;color:${SLATE};font-size:27px;font-weight:600}
.nicon{width:44px;height:44px;border-radius:50%;background:#142B3A;display:flex;align-items:center;justify-content:center}
.nicon img{width:26px;height:28px}
.dot{width:6px;height:6px;border-radius:50%;background:${SLATE}}
.ntitle{margin-top:20px;color:${INK};font-weight:600;font-size:38px;line-height:1.25}
.nbody{margin-top:8px;color:${SLATE};font-size:32px;line-height:1.35}
</style></head><body>
<img class="lens" src="${url('assets/brand/stage-lens.png')}">
<div class="cap"><h1>${title}</h1><p>${sub}</p></div>
<div class="phone"><div class="screen">
 <div class="status"><span>${cfg.clock}</span><span class="cam"></span>
  <span class="icons">
   <svg width="30" height="22" viewBox="0 0 26 20"><path d="M13 19 1 6a17 17 0 0 1 24 0Z" fill="${barText}"/></svg>
   <svg width="25" height="25" viewBox="0 0 22 22"><path d="M21 1v20H1Z" fill="${barText}"/></svg>
   <svg width="16" height="27" viewBox="0 0 14 24"><rect x="4" y="0" width="6" height="3" rx="1" fill="${barText}"/><rect x="0" y="3" width="14" height="21" rx="2.5" fill="${barText}"/></svg>
  </span></div>
 <img src="${data(shot)}">
</div></div>
${note ? `<div class="note"><div class="nhead"><span class="nicon"><img src="${url('assets/brand/mark-on-dark.png')}"></span>${note.app}<span class="dot"></span>${note.when}</div>
 <div class="ntitle">${note.title}</div><div class="nbody">${note.body}</div></div>` : ''}
</body></html>`;
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const out = path.join(S, 'frames', lang); fs.mkdirSync(out, { recursive: true });
  for (let i = 0; i < cfg.frames.length; i++) {
    const [screen, theme, ground, title, sub, lens, withNote] = cfg.frames[i];
    const shot = path.join(S, `raw-${lang}-${theme}`, screen + '.png');
    // The status bar takes the colour at the top of the app's own screen.
    await p.setContent(`<canvas id=c></canvas><img id=i src="${data(shot)}">`);
    const bar = await p.evaluate(async () => {
      const img = document.getElementById('i'); await img.decode();
      const c = document.getElementById('c'); c.width = img.naturalWidth; c.height = 20;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const [r, gr, bl] = g.getImageData(10, 10, 1, 1).data;
      return { color: `rgb(${r},${gr},${bl})`, dark: (0.2126 * r + 0.7152 * gr + 0.0722 * bl) / 255 < 0.5 };
    });
    // The reminder fires at the default lead, three days before the renewal
    // the dashboard shows, on the day the screens were shot.
    let note = null;
    if (withNote) {
      const due = new Date(fs.statSync(shot).mtime.getTime() + 3 * 86400000);
      const n = cfg.notification;
      note = { ...n, body: n.body.replace('{date}', due.toLocaleDateString(n.locale)) };
    }
    const doc = html({ shot, bar, ground, title, sub, lens, note });
    fs.writeFileSync(path.join(S, 'tmp.html'), doc);
    await p.goto('file://' + path.join(S, 'tmp.html'));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(200);
    // The phone starts below the caption block, which is measured, not guessed.
    const capBottom = await p.evaluate(() => document.querySelector('.cap').getBoundingClientRect().bottom);
    if (capBottom + 40 > PHONE_TOP) throw new Error(`caption too tall on ${screen}: ${capBottom}`);
    const fams = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').length);
    const name = `${String(i + 1).padStart(2, '0')}-${screen}${theme === 'dark' ? '-dark' : ''}.png`;
    await p.screenshot({ path: path.join(out, name) });
    console.log(name, 'caption ends', Math.round(capBottom), 'fonts', fams, note ? note.body : '');
  }
  await b.close();
})();
