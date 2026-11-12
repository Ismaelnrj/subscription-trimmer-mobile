// Composes the 1080x1920 Play Store frames in store-assets/screenshots from raw
// app screenshots (see README.md beside this file for where those come from).
// Usage: node compose.js <lang> <work dir holding raw-<lang>/, raw-<lang>-dark/, bars.json>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const lang = process.argv[2];
const S = path.resolve(process.argv[3]);
const frames = JSON.parse(fs.readFileSync(path.join(__dirname, 'captions.json'), 'utf8'))[lang];
const font = (w) => `url(file://${ROOT}/assets/fonts/Montserrat-${w}.ttf)`;
const html = (shot, bar, ground, title, sub, time) => {
  const navy = ground === 'navy';
  const bg = navy ? '#142B3A' : '#F3F5F6';
  const ink = navy ? '#FFFFFF' : '#142B3A';
  const soft = navy ? '#C5D0D7' : '#52616B';
  const rule = navy ? '#55C6A3' : '#1F7A62';
  const barText = bar.dark ? '#F2F1EC' : '#142B3A';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:M;font-weight:400;src:${font('Regular')}}
@font-face{font-family:M;font-weight:600;src:${font('SemiBold')}}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:${bg};font-family:M}
.cap{position:absolute;left:96px;right:96px;top:120px}
.rule{width:72px;height:8px;border-radius:4px;background:${rule};margin-bottom:40px}
h1{text-wrap:balance;margin:0;font-weight:600;font-size:76px;line-height:1.12;letter-spacing:-1.5px;color:${ink}}
p{text-wrap:pretty;margin:28px 0 0;font-weight:400;font-size:38px;line-height:1.38;color:${soft}}
.phone{position:absolute;left:160px;top:__TOP__px;width:760px;height:1700px;border-radius:76px;background:#060D12;
 box-shadow:0 30px 80px rgba(0,0,0,${navy ? 0.45 : 0.22})}
.screen{position:absolute;left:16px;top:16px;right:16px;bottom:0;border-radius:60px 60px 0 0;overflow:hidden;background:${bar.color}}
.status{height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 34px;color:${barText};font-weight:600;font-size:23px;position:relative}
.cam{position:absolute;left:50%;top:12px;width:24px;height:24px;margin-left:-12px;border-radius:50%;background:#060D12}
.icons{display:flex;gap:10px;align-items:center}
.screen img{display:block;width:728px}
</style></head><body>
<div class="cap"><div class="rule"></div><h1>${title}</h1><p>${sub}</p></div>
<div class="phone"><div class="screen">
 <div class="status"><span>${time}</span><span class="cam"></span>
  <span class="icons">
   <svg width="26" height="20" viewBox="0 0 26 20"><path d="M13 19 1 6a17 17 0 0 1 24 0Z" fill="${barText}"/></svg>
   <svg width="22" height="22" viewBox="0 0 22 22"><path d="M21 1v20H1Z" fill="${barText}"/></svg>
   <svg width="14" height="24" viewBox="0 0 14 24"><rect x="4" y="0" width="6" height="3" rx="1" fill="${barText}"/><rect x="0" y="3" width="14" height="21" rx="2.5" fill="${barText}"/></svg>
  </span></div>
 <img src="data:image/png;base64,${fs.readFileSync(shot).toString('base64')}">
</div></div></body></html>`;
};
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const out = path.join(S, 'frames', lang); fs.mkdirSync(out, { recursive: true });
  const bars = JSON.parse(fs.readFileSync(path.join(S, 'bars.json'), 'utf8'));
  for (let i = 0; i < frames.length; i++) {
    const [screen, theme, ground, title, sub] = frames[i];
    const dir = theme === 'dark' ? `raw-${lang}-dark` : `raw-${lang}`;
    const shot = path.join(S, dir, screen + '.png');
    const bar = bars[`${dir}/${screen}`];
    // The phone starts below the caption block, which is measured, not guessed.
    // The app greets by time of day (shot in the evening), so the clock agrees.
    let doc = html(shot, bar, ground, title, sub, lang === 'de' ? '19:42' : '7:42');
    fs.writeFileSync(path.join(S, 'tmp.html'), doc.replace('__TOP__', '0'));
    await p.goto('file://' + path.join(S, 'tmp.html'));
    await p.evaluate(() => document.fonts.ready);
    const capBottom = await p.evaluate(() => document.querySelector('.cap').getBoundingClientRect().bottom);
    const top = 560; // one position for every frame; the tallest caption ends at 471
    if (capBottom + 48 > top) throw new Error(`caption too tall: ${capBottom}`);
    fs.writeFileSync(path.join(S, 'tmp.html'), doc.replace('__TOP__', String(top)));
    await p.goto('file://' + path.join(S, 'tmp.html'));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(200);
    const fams = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').length);
    const name = `${String(i + 1).padStart(2, '0')}-${screen}${theme === 'dark' ? '-dark' : ''}.png`;
    await p.screenshot({ path: path.join(out, name) });
    console.log(name, 'phone top', top, 'fonts loaded', fams);
  }
  await b.close();
})();
