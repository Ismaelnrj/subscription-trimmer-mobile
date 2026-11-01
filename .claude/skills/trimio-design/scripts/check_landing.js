#!/usr/bin/env node
// Measures the generated site pages in a real Chromium rather than reading
// their CSS, because most of the rules below are about what a browser actually
// does: where things LAND on a screen, what the Tab key reaches, what still
// moves when the reader asked for less motion.
//
//   node .claude/skills/trimio-design/scripts/check_landing.js
//   node .claude/skills/trimio-design/scripts/check_landing.js backend/landing-de.html
//   node .claude/skills/trimio-design/scripts/check_landing.js --ci   (as CI runs it)
//
// With no argument it checks both landing pages and every cancellation guide
// page under backend/guides/. Always measure the GENERATED pages:
// tools/build-landing.py and tools/build-guides.mjs are the only things that
// write them, so a fix goes into their sources and then gets re-measured here.
//
// LANDING PAGES ONLY (the guide pages have no hero):
//   1. hero fits    the headline and the first call to action sit inside the
//                   first screen at phone and desktop sizes
//   2. hero lead    the paragraph under the headline is 20 words or fewer
//   3. eyebrows     a small uppercase label above a section heading; after one,
//                   the next two sections carry none
//   4. collapse     at 320 and 360 wide nothing scrolls sideways, and every grid
//                   still running several columns is listed so somebody looks
//
// EVERY PAGE, added 2026-11-01 from Vercel's Web Interface Guidelines, keeping
// only the rules that can be measured and that fit a static page:
//   5. names        every form control has a label, every link and button has
//                   a name a screen reader can say, every image has an alt
//   6. headings     one h1, and no level skipped (an h1 followed by an h3)
//   7. focus        every element the Tab key reaches shows a visible change:
//                   an outline, or a different shadow, border or background
//   8. motion       with the phone set to reduce motion, nothing animates
//   9. shift        layout shift while assets load slowly, REPORTED, not failed
//                   (see the note where it is printed)
//  10. language     the German page carries no label, placeholder, alt or
//                   title left identical to the English page's
//
// Fonts and the mark are served from backend/ exactly as server.js serves them,
// so Montserrat really loads and the measurements match production. Anything
// pointing off the page (PostHog) is refused, so the check never reaches the
// network and never sends an event.
//
// Exit 0 clean, 1 if a check failed, 2 if it could not run at all. A check that
// cannot run says so; it never exits 0 having measured nothing.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (_) {}
  try {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    return require(path.join(root, "playwright"));
  } catch (_) {
    return null;
  }
}

const REPO = path.resolve(__dirname, "../../../..");
const BACKEND = path.join(REPO, "backend");
const ORIGIN = "http://trimio.test";

const HERO_VIEWPORTS = [
  { width: 360, height: 640, label: "small phone 360x640" },
  { width: 390, height: 844, label: "phone 390x844" },
  { width: 1280, height: 800, label: "desktop 1280x800" },
];
const NARROW = [320, 360];
const LEAD_MAX_WORDS = 20;
// Google's own "good" line for cumulative layout shift.
const SHIFT_GOOD = 0.1;
// Every asset is held back this long in the shift check, so a font or image
// arriving after first paint shows up the way it does on a slow connection.
const SLOW_ASSET_MS = 150;
// --ci: used by .github/workflows/checks.yml. Same checks, but the eyebrow rule
// is reported rather than failed, see where it is printed.
const CI = process.argv.includes("--ci");

function servedFile(urlPath) {
  if (urlPath === "/mark.svg") return path.join(BACKEND, "mark.svg");
  const font = urlPath.match(/^\/fonts\/([A-Za-z0-9-]+\.woff2)$/);
  if (font) return path.join(BACKEND, "fonts", font[1]);
  return null;
}

async function openPage(browser, htmlFile, viewport, opts = {}) {
  const page = await browser.newPage({ viewport, reducedMotion: opts.reducedMotion || "no-preference" });
  if (opts.initScript) await page.addInitScript(opts.initScript);
  const html = fs.readFileSync(htmlFile, "utf8");
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/page") {
      return route.fulfill({ body: html, contentType: "text/html; charset=utf-8" });
    }
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    const file = servedFile(url.pathname);
    if (file && fs.existsSync(file)) return route.fulfill({ path: file });
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(ORIGIN + "/page", { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // Without the real font every measurement is of a different page, so refuse.
  const fontOk = await page.evaluate(() => {
    const used = [...document.fonts].filter((f) => f.family.replace(/"/g, "") === "Montserrat");
    return used.length > 0 && used.some((f) => f.status === "loaded");
  });
  if (!fontOk) throw new Error(`Montserrat did not load on ${path.relative(REPO, htmlFile)}, measurements would not match production`);
  return page;
}

// Runs in the page. An eyebrow is judged by what it LOOKS like, not by class
// name, so a label introduced under a new class is still found.
function measureStructure(leadMax) {
  const sections = [...document.querySelectorAll("main section, body > section")]
    .filter((s) => !s.closest("[hidden]") && !s.closest("[role=dialog]"))
    .filter((s, i, all) => !all.some((o) => o !== s && o.contains(s)));
  const isEyebrow = (el) => {
    if (!el || !(el.textContent || "").trim()) return false;
    const cs = getComputedStyle(el);
    const spacing = parseFloat(cs.letterSpacing) || 0;
    return cs.textTransform === "uppercase" && spacing > 0 && parseFloat(cs.fontSize) <= 14;
  };
  const rows = sections.map((s) => {
    const heading = s.querySelector("h1, h2");
    let label = null;
    if (heading) {
      // Walk back from the heading through its earlier siblings, so a label
      // sitting one wrapper up is still seen.
      let node = heading;
      while (node && node !== s && !label) {
        let prev = node.previousElementSibling;
        while (prev && !label) {
          if (isEyebrow(prev)) label = prev.textContent.trim();
          prev = prev.previousElementSibling;
        }
        node = node.parentElement;
      }
    }
    const name = s.id || (s.className || "").split(" ")[0] || "section";
    return { name, heading: heading ? heading.textContent.trim().slice(0, 60) : null, label };
  });

  const h1 = document.querySelector("h1");
  let lead = null;
  if (h1) {
    let el = h1.nextElementSibling;
    while (el && el.tagName !== "P") el = el.nextElementSibling;
    if (el) lead = el.textContent.trim();
  }
  const words = lead ? lead.split(/\s+/).filter(Boolean).length : 0;
  return { rows, lead, words, leadMax };
}

function measureHero() {
  const h1 = document.querySelector("h1");
  if (!h1) return { error: "no h1 on the page" };
  const hero = h1.closest("section") || h1.parentElement;
  const cta = [...hero.querySelectorAll("a, button")].find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const bottom = (el) => el.getBoundingClientRect().bottom + window.scrollY;
  return {
    viewport: window.innerHeight,
    headlineBottom: Math.round(bottom(h1)),
    cta: cta ? cta.textContent.trim().slice(0, 40) : null,
    ctaBottom: cta ? Math.round(bottom(cta)) : null,
  };
}

function measureCollapse() {
  const width = document.documentElement.clientWidth;
  const scrollWidth = document.scrollingElement.scrollWidth;
  const grids = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("[hidden]") || el.closest("[role=dialog]")) continue;
    const cs = getComputedStyle(el);
    if (cs.display !== "grid" && cs.display !== "inline-grid") continue;
    const tracks = cs.gridTemplateColumns.split(" ").filter((t) => /px$/.test(t));
    if (tracks.length < 2) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cls = (n) => String(n.className || "").split(" ").filter(Boolean).join(".");
    const name = el.id ? "#" + el.id : cls(el) ? "." + cls(el) : `${el.tagName.toLowerCase()} in .${cls(el.parentElement) || el.parentElement.tagName.toLowerCase()}`;
    grids.push(`${name} ${tracks.map((t) => Math.round(parseFloat(t))).join("+")}px`);
  }
  return { width, scrollWidth, grids };
}

// 5 and 6, run in the page. Anything inside role="img" is skipped: a screen
// reader announces the image's own label and never reaches its children. The
// hero's phone mockup set this: its fake "Your upcoming" h3 broke the heading
// order until the mockup became role="img" with a label.
// aria-hidden is deliberately NOT skipped. The account dialog is aria-hidden
// while closed, and skipping it meant the first draft of this check never
// looked at the signup and login forms, the most important controls on the
// page, and passed a copy with a label removed from one of them.
function measureNamesAndHeadings() {
  const silent = (el) => !!el.closest('[role="img"]');
  const describe = (el) =>
    el.outerHTML.replace(/\s+/g, " ").slice(0, 90);
  const labelledBy = (el) =>
    (el.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .some((id) => id && (document.getElementById(id)?.textContent || "").trim());
  const hasLabel = (el) =>
    !!(el.getAttribute("aria-label") || "").trim() ||
    labelledBy(el) ||
    (!!el.id && [...document.querySelectorAll("label")].some((l) => l.htmlFor === el.id && l.textContent.trim())) ||
    !!(el.closest("label") && el.closest("label").textContent.trim()) ||
    !!(el.getAttribute("title") || "").trim();

  const names = [];
  for (const el of document.querySelectorAll("input, select, textarea")) {
    if (el.type === "hidden" || silent(el)) continue;
    // A placeholder is not a label: it disappears as soon as somebody types.
    if (!hasLabel(el)) names.push(`form control with no label: ${describe(el)}`);
  }
  for (const el of document.querySelectorAll("a[href], button")) {
    if (silent(el)) continue;
    const text = (el.textContent || "").trim();
    const imgAlt = [...el.querySelectorAll("img")].some((i) => (i.getAttribute("alt") || "").trim());
    if (!text && !imgAlt && !hasLabel(el)) names.push(`${el.tagName.toLowerCase()} with no name: ${describe(el)}`);
  }
  for (const img of document.querySelectorAll("img")) {
    // alt="" is right for a decorative image; a MISSING alt makes a screen
    // reader read the file name.
    if (!img.hasAttribute("alt")) names.push(`img with no alt: ${describe(img)}`);
  }

  const hs = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter((h) => !silent(h));
  const level = (h) => Number(h.tagName[1]);
  const said = (h) => `h${level(h)} "${h.textContent.trim().replace(/\s+/g, " ").slice(0, 40)}"`;
  const skips = [];
  for (let i = 1; i < hs.length; i++) {
    if (level(hs[i]) > level(hs[i - 1]) + 1) skips.push(`${said(hs[i - 1])} then ${said(hs[i])}`);
  }
  return { names, h1s: hs.filter((h) => level(h) === 1).length, headings: hs.length, skips };
}

// 7. Walks the page with the Tab key and, for each element it lands on,
// compares its focused style with its resting style. Transitions are switched
// off first so the END state of a focus style is what gets read, never a frame
// of it fading in.
async function measureFocus(page, opener = null) {
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" });
  await page.evaluate(() => {
    window.__rest = new Map();
    const look = (el) => {
      const cs = getComputedStyle(el);
      return [cs.boxShadow, cs.borderColor, cs.backgroundColor, cs.color, cs.textDecorationLine].join("|");
    };
    window.__look = look;
    for (const el of document.querySelectorAll("a[href], button, input, select, textarea, summary, [tabindex]")) {
      window.__rest.set(el, look(el));
    }
  });
  // A dialog's controls are only reachable once it is open, so the walk opens
  // it first and then stays inside it.
  if (opener) {
    await page.evaluate((sel) => document.querySelector(sel).click(), opener);
    await page.waitForTimeout(100);
  }
  const reached = [];
  const bare = [];
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate((inDialog) => {
      const el = document.activeElement;
      if (!el || el === document.body || el.dataset.tabSeen) return null;
      if (inDialog && !el.closest('[role="dialog"]')) return null;
      el.dataset.tabSeen = "1";
      const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1;
      const rest = window.__rest.get(el);
      const changed = rest !== undefined && rest !== window.__look(el);
      const text = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ");
      return { name: `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${text.slice(0, 30)}"`, visible: outline || changed };
    }, !!opener);
    if (!r) break;
    reached.push(r.name);
    if (!r.visible) bare.push(r.name);
  }
  return { reached, bare };
}

// 8. Runs in the page: animations still running that a person would see move.
function runningMotion() {
  return document
    .getAnimations()
    .filter((a) => {
      if (a.playState !== "running" || !a.effect) return false;
      const t = a.effect.getComputedTiming();
      return t.iterations === Infinity || t.duration > 50;
    })
    .map((a) => {
      const target = a.effect.target;
      const where = target ? (target.id ? "#" + target.id : "." + String(target.className || target.tagName).split(" ").filter(Boolean).join(".")) : "?";
      return `${a.animationName || a.transitionProperty || "animation"} on ${where}`;
    });
}

async function checkBasics(browser, file, failures) {
  // 5 and 6
  let page = await openPage(browser, file, { width: 1280, height: 800 });
  const nh = await page.evaluate(measureNamesAndHeadings);
  console.log(`  ${nh.names.length ? "FAIL" : "ok  "} names          ${nh.names.length ? nh.names.length + " without one" : "every control, link, button and image has one"}`);
  for (const n of nh.names) console.log(`         ${n}`);
  if (nh.names.length) failures.push(`${nh.names.length} element(s) with no accessible name`);
  const headingsOk = nh.h1s === 1 && nh.skips.length === 0;
  console.log(`  ${headingsOk ? "ok  " : "FAIL"} headings       ${nh.h1s} h1, ${nh.headings} headings, ${nh.skips.length} skipped level(s)`);
  for (const s of nh.skips) console.log(`         ${s}`);
  if (!headingsOk) failures.push(nh.h1s !== 1 ? `${nh.h1s} h1 elements` : `${nh.skips.length} skipped heading level(s)`);

  // 7, the page itself, then each account dialog mode opened in turn
  const modes = await page.evaluate(() => [...new Set([...document.querySelectorAll("[data-auth-open]")].map((b) => b.dataset.authOpen))]);
  const walks = [["page", await measureFocus(page)]];
  await page.close();
  for (const mode of modes) {
    const p = await openPage(browser, file, { width: 1280, height: 800 });
    walks.push([`${mode} dialog`, await measureFocus(p, `[data-auth-open="${mode}"]`)]);
    await p.close();
  }
  for (const [where, f] of walks) {
    const focusOk = f.reached.length > 0 && f.bare.length === 0;
    console.log(`  ${focusOk ? "ok  " : "FAIL"} focus          ${where}: Tab reaches ${f.reached.length}, ${f.bare.length} show no focus`);
    for (const b of f.bare) console.log(`         no visible focus: ${b}`);
    if (!f.reached.length) failures.push(`the Tab key reaches nothing in the ${where}`);
    if (f.bare.length) failures.push(`${f.bare.length} element(s) in the ${where} show no focus`);
  }

  // 8. Phone sized, scrolled top to bottom, so scroll triggered reveals fire.
  page = await openPage(browser, file, { width: 390, height: 844 }, { reducedMotion: "reduce" });
  const moving = new Set();
  const height = await page.evaluate(() => document.scrollingElement.scrollHeight);
  for (let y = 0; y <= height; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(60);
    for (const m of await page.evaluate(runningMotion)) moving.add(m);
  }
  await page.close();
  console.log(`  ${moving.size ? "FAIL" : "ok  "} motion         reduce motion: ${moving.size ? [...moving].join("; ") : "nothing moves"}`);
  if (moving.size) failures.push(`${moving.size} animation(s) ignore reduced motion`);

  // 9. REPORTED, NOT FAILED. The number depends on the fallback font the
  // machine running this has, and a phone's fallback (Roboto on Android) is
  // not the sandbox's, so it is a direction rather than a measurement of what
  // a visitor gets. Google's field data would be the real number, and at this
  // traffic there is none.
  page = await openPage(browser, file, { width: 360, height: 640 }, {
    delayMs: SLOW_ASSET_MS,
    initScript: () => {
      window.__shift = 0;
      window.__shifted = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__shift += e.value;
          for (const s of e.sources || []) {
            const n = s.node;
            if (n) window.__shifted.push(n.nodeType === 1 ? "." + String(n.className).split(" ")[0] : "text");
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    },
  });
  await page.waitForTimeout(800);
  const shift = await page.evaluate(() => ({ total: window.__shift, moved: [...new Set(window.__shifted)].slice(0, 6) }));
  await page.close();
  const word = shift.total <= SHIFT_GOOD ? "ok  " : "note";
  console.log(`  ${word} shift          ${shift.total.toFixed(3)} at 360x640 with assets ${SLOW_ASSET_MS}ms late (good is ${SHIFT_GOOD} or less)${shift.total > SHIFT_GOOD ? ", moved: " + shift.moved.join(", ") : ""}`);
}

// 10. No browser needed: the text of the two files is compared directly.
// Only text a person or a screen reader is handed: labels, placeholders, alts,
// titles, and the page title and description. A string has to carry at least
// two words to count, so a shared "Name", "Trimio" or "Netflix" is not a
// finding; an address like you@example.com is skipped for the same reason.
function readableAttributes(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = new Set();
  const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  for (const m of src.matchAll(/\s(placeholder|aria-label|alt|title)="([^"]*)"/g)) out.add(`${m[1]} "${decode(m[2])}"`);
  for (const m of src.matchAll(/<title>([^<]*)<\/title>/g)) out.add(`<title> "${decode(m[1])}"`);
  for (const m of src.matchAll(/<meta\s+(?:name|property)="(description|og:title|og:description)"\s+content="([^"]*)"/g)) out.add(`${m[1]} "${decode(m[2])}"`);
  return [...out].filter((s) => {
    const value = s.slice(s.indexOf('"') + 1, -1);
    return !value.includes("@") && (value.match(/\p{L}{2,}/gu) || []).length >= 2;
  });
}

function checkLanguagePair(enFile, deFile, failures) {
  const en = new Set(readableAttributes(enFile));
  const same = readableAttributes(deFile).filter((s) => en.has(s));
  const rel = path.relative(REPO, deFile);
  console.log(`\n${rel} against ${path.relative(REPO, enFile)}`);
  console.log(`  ${same.length ? "FAIL" : "ok  "} language       ${same.length ? same.length + " left in English" : "no label, placeholder, alt or title left in English"}`);
  for (const s of same) console.log(`         ${s}`);
  if (same.length) failures.push(`${same.length} English string(s) on ${rel}`);
}

async function checkLanding(browser, file, failures) {
  // 1. hero fits
  for (const vp of HERO_VIEWPORTS) {
    const page = await openPage(browser, file, { width: vp.width, height: vp.height });
    const m = await page.evaluate(measureHero);
    await page.close();
    if (m.error) {
      failures.push(m.error);
      console.log(`  FAIL hero fits      ${m.error}`);
      break;
    }
    const ok = m.headlineBottom <= m.viewport && m.ctaBottom !== null && m.ctaBottom <= m.viewport;
    const what = m.cta === null ? "no call to action in the hero" : `headline ends ${m.headlineBottom}px, "${m.cta}" ends ${m.ctaBottom}px`;
    console.log(`  ${ok ? "ok  " : "FAIL"} hero fits      ${vp.label}: ${what}, screen ${m.viewport}px`);
    if (!ok) failures.push(`hero does not fit at ${vp.label}`);
  }

  // 2 and 3 do not depend on width, measured once at desktop size
  const page = await openPage(browser, file, { width: 1280, height: 800 });
  const s = await page.evaluate(measureStructure, LEAD_MAX_WORDS);
  await page.close();

  if (!s.lead) {
    failures.push("no paragraph under the h1");
    console.log("  FAIL hero lead      no paragraph found under the h1");
  } else {
    const ok = s.words <= LEAD_MAX_WORDS;
    console.log(`  ${ok ? "ok  " : "FAIL"} hero lead      ${s.words} words (max ${LEAD_MAX_WORDS}): "${s.lead}"`);
    if (!ok) failures.push(`hero lead is ${s.words} words`);
  }

  let lastLabelled = -99;
  const crowded = [];
  s.rows.forEach((r, i) => {
    if (!r.label) return;
    if (i - lastLabelled <= 2) crowded.push(`${r.name} ("${r.label}")`);
    lastLabelled = i;
  });
  const labelled = s.rows.filter((r) => r.label).length;
  // In CI the eyebrow rule reports but does not fail: it is a taste call the
  // owner has not made, and a check that is red by design trains everybody to
  // stop reading red. The other three are facts about the page and do fail.
  const eyebrowWord = crowded.length ? (CI ? "note" : "FAIL") : "ok  ";
  console.log(`  ${eyebrowWord} eyebrows       ${labelled} of ${s.rows.length} sections carry one`);
  for (const r of s.rows) console.log(`         ${r.label ? "[" + r.label + "]" : "-"}  ${r.name}`);
  if (crowded.length) {
    console.log(`         within two sections of the previous label: ${crowded.join(", ")}`);
    if (!CI) failures.push(`${crowded.length} eyebrow(s) too close together`);
  }

  // 4. collapse
  for (const w of NARROW) {
    const p = await openPage(browser, file, { width: w, height: 800 });
    const c = await p.evaluate(measureCollapse);
    await p.close();
    const ok = c.scrollWidth <= c.width;
    console.log(`  ${ok ? "ok  " : "FAIL"} collapse       ${w}px: page ${c.scrollWidth}px wide on a ${c.width}px screen`);
    if (!ok) failures.push(`scrolls sideways at ${w}px`);
    if (w === 360 && c.grids.length) {
      console.log(`         still multi-column at 360, look at each: ${c.grids.join("; ")}`);
    }
  }
}

async function checkFile(browser, file) {
  const failures = [];
  console.log(`\n${path.relative(REPO, file)}`);
  if (path.basename(file).startsWith("landing")) await checkLanding(browser, file, failures);
  await checkBasics(browser, file, failures);
  return failures;
}

function defaultFiles() {
  const files = ["backend/landing.html", "backend/landing-de.html"];
  for (const lang of ["en", "de"]) {
    const dir = path.join(BACKEND, "guides", lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".html")).sort()) files.push(`backend/guides/${lang}/${f}`);
  }
  return files;
}

// The German twin of an English page, by the naming both generators use.
function germanTwin(file) {
  if (path.basename(file) === "landing.html") return path.join(path.dirname(file), "landing-de.html");
  const m = file.match(/^(.*[\\/]guides[\\/])en([\\/][^\\/]+\.html)$/);
  return m ? m[1] + "de" + m[2] : null;
}

(async () => {
  const pw = loadPlaywright();
  if (!pw) {
    console.error("cannot run: playwright not found (it is preinstalled in cloud sessions, not on every machine)");
    process.exit(2);
  }
  const args = process.argv.slice(2).filter((a) => a !== "--ci");
  const files = (args.length ? args : defaultFiles()).map((f) => path.resolve(REPO, f));
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`cannot run: ${f} does not exist`);
      process.exit(2);
    }
  }
  let browser;
  try {
    const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
    browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  } catch (e) {
    console.error(`cannot run: chromium did not start (${e.message.split("\n")[0]})`);
    process.exit(2);
  }
  let failed = 0;
  try {
    for (const f of files) failed += (await checkFile(browser, f)).length;
    const pairFailures = [];
    for (const f of files) {
      const de = germanTwin(f);
      if (de && files.includes(de)) checkLanguagePair(f, de, pairFailures);
    }
    failed += pairFailures.length;
  } catch (e) {
    console.error(`cannot run: ${e.message.split("\n")[0]}`);
    await browser.close();
    process.exit(2);
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
  process.exit(failed ? 1 : 0);
})();
