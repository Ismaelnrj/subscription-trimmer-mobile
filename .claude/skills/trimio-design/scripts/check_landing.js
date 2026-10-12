#!/usr/bin/env node
// Measures the generated landing pages in a real Chromium rather than reading
// their CSS, because three of the four rules below are about where things LAND
// on a screen, and only a layout engine knows that.
//
//   node .claude/skills/trimio-design/scripts/check_landing.js
//   node .claude/skills/trimio-design/scripts/check_landing.js backend/landing-de.html
//   node .claude/skills/trimio-design/scripts/check_landing.js --ci   (as CI runs it)
//
// With no argument it checks backend/landing.html and backend/landing-de.html.
// Always measure the GENERATED pages: tools/build-landing.py is the only thing
// that writes them, so a fix goes into its source and then gets re-measured here.
//
// The four checks:
//   1. hero fits    the headline and the first call to action sit inside the
//                   first screen at phone and desktop sizes
//   2. hero lead    the paragraph under the headline is 20 words or fewer
//   3. eyebrows     a small uppercase label above a section heading; after one,
//                   the next two sections carry none
//   4. collapse     at 320 and 360 wide nothing scrolls sideways, and every grid
//                   still running several columns is listed so somebody looks
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
// --ci: used by .github/workflows/checks.yml. Same checks, but the eyebrow rule
// is reported rather than failed, see where it is printed.
const CI = process.argv.includes("--ci");

function servedFile(urlPath) {
  if (urlPath === "/mark.svg") return path.join(BACKEND, "mark.svg");
  const font = urlPath.match(/^\/fonts\/([A-Za-z0-9-]+\.woff2)$/);
  if (font) return path.join(BACKEND, "fonts", font[1]);
  return null;
}

async function openPage(browser, htmlFile, viewport) {
  const page = await browser.newPage({ viewport });
  const html = fs.readFileSync(htmlFile, "utf8");
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/page") {
      return route.fulfill({ body: html, contentType: "text/html; charset=utf-8" });
    }
    const file = servedFile(url.pathname);
    if (file && fs.existsSync(file)) return route.fulfill({ path: file });
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(ORIGIN + "/page", { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // Without the real font every measurement is of a different page, so refuse.
  const fontOk = await page.evaluate(() => document.fonts.check('800 40px "Montserrat"'));
  if (!fontOk) throw new Error("Montserrat did not load, measurements would not match production");
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

async function checkFile(browser, file) {
  const rel = path.relative(REPO, file);
  const failures = [];
  console.log(`\n${rel}`);

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
  return failures;
}

(async () => {
  const pw = loadPlaywright();
  if (!pw) {
    console.error("cannot run: playwright not found (it is preinstalled in cloud sessions, not on every machine)");
    process.exit(2);
  }
  const args = process.argv.slice(2).filter((a) => a !== "--ci");
  const files = (args.length ? args : ["backend/landing.html", "backend/landing-de.html"]).map((f) =>
    path.resolve(REPO, f),
  );
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
