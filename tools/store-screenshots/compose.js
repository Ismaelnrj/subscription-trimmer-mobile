// Composes the 1080x1920 Play Store frames in store-assets/screenshots from raw
// app screenshots (see README.md beside this file for where those come from).
// Usage: node compose.js <lang> <work dir holding raw-<lang>-light/ and raw-<lang>-dark/>
//
// THE SECOND SET, 2026-11-26, in the look the app now opens with (the Brand
// panel): the navy stage and its rings behind the phone, the mint lens behind
// it for depth, larger type, the whole phone and the app's whole screen, and on
// the first frame the real reminder notification the app sends, in its own
// words, inside the phone as Android shows it. The last frame keeps the light
// ground so the set does not read as one picture six times.
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

// THE WHOLE PHONE, 2026-11-27, the owner's call ("should be the whole phone
// without leaving anything out"): the phone stands complete inside the frame,
// and the app's complete screen inside the phone, tab bar included. Its size
// follows from the room under the caption, not the other way round.
const PHONE_TOP = 492;
const PHONE_BOTTOM = 1872;
const BEZEL = 14;
const STATUS_H = 44;
const GESTURE_H = 26;
const RAW_W = 1170;
const RAW_H = 2532;
const IMG_H = PHONE_BOTTOM - PHONE_TOP - 2 * BEZEL - STATUS_H - GESTURE_H;
const SCREEN_W = Math.round((IMG_H * RAW_W) / RAW_H);
const PHONE_W = SCREEN_W + 2 * BEZEL;
const PHONE_LEFT = Math.round((1080 - PHONE_W) / 2);

const html = ({ shot, bar, foot, ground, title, sub, lens, note, h1 }) => {
  const stage = ground === 'stage';
  const barText = bar.dark ? '#F2F1EC' : '#142B3A';
  const pill = foot.dark ? '#F2F1EC' : '#142B3A';
  const lensLeft = lens === 'left' ? -210 : PHONE_LEFT + PHONE_W - 40;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:M;font-weight:400;src:${font('Regular')}}
@font-face{font-family:M;font-weight:600;src:${font('SemiBold')}}
@font-face{font-family:M;font-weight:700;src:${font('Bold')}}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:M;
 background:${stage ? `#142B3A url(${url('assets/brand/stage.png')}) right top / auto 1920px no-repeat` : '#F3F5F6'}}
.lens{position:absolute;left:${lensLeft}px;top:${note ? 1060 : 900}px;width:460px;height:460px}
.cap{position:absolute;left:88px;right:88px;top:96px}
h1{text-wrap:balance;margin:0;font-weight:700;font-size:${h1}px;line-height:1.06;letter-spacing:-2px;color:${stage ? INK_ON_STAGE : INK}}
p{text-wrap:pretty;margin:26px 0 0;font-weight:400;font-size:38px;line-height:1.34;color:${stage ? LEAD_ON_STAGE : SLATE}}
.phone{position:absolute;left:${PHONE_LEFT}px;top:${PHONE_TOP}px;width:${PHONE_W}px;height:${PHONE_BOTTOM - PHONE_TOP}px;border-radius:66px;background:#060D12;
 box-shadow:0 36px 100px rgba(0,0,0,${stage ? 0.5 : 0.22})}
.screen{position:absolute;left:${BEZEL}px;top:${BEZEL}px;width:${SCREEN_W}px;bottom:${BEZEL}px;border-radius:52px;overflow:hidden;background:${bar.color};display:flex;flex-direction:column}
.status{flex:none;height:${STATUS_H}px;display:flex;align-items:center;justify-content:space-between;padding:0 34px;color:${barText};font-weight:600;font-size:21px;position:relative}
.cam{position:absolute;left:50%;top:11px;width:22px;height:22px;margin-left:-11px;border-radius:50%;background:#060D12}
.icons{display:flex;gap:9px;align-items:center}
.shot{display:block;flex:none;width:${SCREEN_W}px;height:${IMG_H}px}
.gesture{flex:1;background:${foot.color};display:flex;align-items:center;justify-content:center}
.gesture span{width:120px;height:5px;border-radius:3px;background:${pill};opacity:.55}
.note{position:absolute;left:${PHONE_LEFT + BEZEL + 10}px;width:${SCREEN_W - 20}px;box-sizing:border-box;top:${PHONE_TOP + BEZEL + 6}px;
 background:#FFFFFF;border-radius:28px;padding:14px 20px 16px;box-shadow:0 18px 50px rgba(6,13,18,.40)}
.nhead{display:flex;align-items:center;gap:10px;color:${SLATE};font-size:17px;font-weight:600}
.nicon{width:26px;height:26px;border-radius:50%;background:#142B3A;display:flex;align-items:center;justify-content:center}
.nicon img{width:15px;height:16px}
.dot{width:4px;height:4px;border-radius:50%;background:${SLATE}}
.ntitle{margin-top:8px;color:${INK};font-weight:600;font-size:23px;line-height:1.25}
.nbody{margin-top:3px;color:${SLATE};font-size:20px;line-height:1.35}
</style></head><body>
<img class="lens" src="${url('assets/brand/stage-lens.png')}">
<div class="cap"><h1>${title}</h1><p>${sub}</p></div>
<div class="phone"><div class="screen">
 <div class="status"><span>${cfg.clock}</span><span class="cam"></span>
  <span class="icons">
   <svg width="23" height="17" viewBox="0 0 26 20"><path d="M13 19 1 6a17 17 0 0 1 24 0Z" fill="${barText}"/></svg>
   <svg width="19" height="19" viewBox="0 0 22 22"><path d="M21 1v20H1Z" fill="${barText}"/></svg>
   <svg width="12" height="21" viewBox="0 0 14 24"><rect x="4" y="0" width="6" height="3" rx="1" fill="${barText}"/><rect x="0" y="3" width="14" height="21" rx="2.5" fill="${barText}"/></svg>
  </span></div>
 <img class="shot" src="${data(shot)}">
 <div class="gesture"><span></span></div>
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
    // The status bar takes the colour at the top of the app's own screen, the
    // gesture strip the colour at its foot (the tab bar).
    await p.setContent(`<canvas id=c></canvas><img id=i src="${data(shot)}">`);
    const px = await p.evaluate(async () => {
      const img = document.getElementById('i'); await img.decode();
      const c = document.getElementById('c'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const at = (y) => {
        const [r, gr, bl] = g.getImageData(10, y, 1, 1).data;
        return { color: `rgb(${r},${gr},${bl})`, dark: (0.2126 * r + 0.7152 * gr + 0.0722 * bl) / 255 < 0.5 };
      };
      return { w: img.naturalWidth, h: img.naturalHeight, top: at(10), foot: at(img.naturalHeight - 4) };
    });
    if (px.w !== RAW_W || px.h !== RAW_H) throw new Error(`${shot} is ${px.w}x${px.h}, not ${RAW_W}x${RAW_H}: the screen would be cropped or stretched`);
    // The reminder fires at the default lead, three days before the renewal
    // the dashboard shows, on the day the screens were shot.
    let note = null;
    if (withNote) {
      const due = new Date(fs.statSync(shot).mtime.getTime() + 3 * 86400000);
      const n = cfg.notification;
      note = { ...n, body: n.body.replace('{date}', due.toLocaleDateString(n.locale)) };
    }
    // The caption gets the room above the phone: the headline steps down from
    // 92 px until it fits, and a caption that still does not fit is an error.
    let capBottom = Infinity, h1 = 96;
    while (capBottom + 36 > PHONE_TOP && h1 > 68) {
      h1 -= 4;
      fs.writeFileSync(path.join(S, 'tmp.html'), html({ shot, bar: px.top, foot: px.foot, ground, title, sub, lens, note, h1 }));
      await p.goto('file://' + path.join(S, 'tmp.html'));
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(150);
      capBottom = await p.evaluate(() => document.querySelector('.cap').getBoundingClientRect().bottom);
    }
    if (capBottom + 36 > PHONE_TOP) throw new Error(`caption too tall on ${screen}: ${capBottom}`);
    const fams = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').length);
    const name = `${String(i + 1).padStart(2, '0')}-${screen}${theme === 'dark' ? '-dark' : ''}.png`;
    await p.screenshot({ path: path.join(out, name) });
    console.log(name, 'headline', h1, 'caption ends', Math.round(capBottom), 'phone', PHONE_W, 'x', PHONE_BOTTOM - PHONE_TOP, 'fonts', fams);
  }
  await b.close();
})();
