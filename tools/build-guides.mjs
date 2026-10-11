// Builds the public cancellation guide pages from lib/cancellation-guides.ts,
// the same data the app's Cancel guide screen reads, so a correction made for
// one reaches both.
//
//   node --experimental-strip-types tools/build-guides.mjs
//
// (Node 22.6 or newer. From Node 23.6 the flag is on by default.)
//
// Writes backend/guides/{en,de}/<slug>.html, an index per language, and
// backend/guides/manifest.json, which server.js reads for its routes and the
// sitemap. Served at /cancel/<slug> and /de/kuendigen/<slug>.
//
// ONLY GUIDES WITH A `verified` DATE ARE PUBLISHED, and the build refuses a
// page entry whose guide has none. Each page prints "last checked" with that
// date, so publishing an unchecked guide would be a false claim on a public
// page. Adding a guide here therefore means checking its steps first.
//
// Do not hand edit the output. Change the data or this file and re-run it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLocalizedGuide } from "../lib/cancellation-guides.ts";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(REPO, "backend", "guides");
const SITE = "https://www.subtrimio.com";
const PLAY = "https://play.google.com/store/apps/details?id=com.trimio.app";

// The pilot set, 2026-10-11: four of the biggest DACH subscriptions plus
// YouTube Premium. `name` is what a person types into a search box.
const PAGES = [
  { key: "netflix", slug: "netflix", name: "Netflix" },
  { key: "spotify", slug: "spotify", name: "Spotify Premium" },
  { key: "disney", slug: "disney-plus", name: "Disney+" },
  { key: "amazon prime", slug: "amazon-prime", name: "Amazon Prime" },
  { key: "youtube", slug: "youtube-premium", name: "YouTube Premium" },
];

const PATHS = {
  en: { index: "/cancel", page: (s) => `/cancel/${s}`, home: "/", privacy: "/privacy-policy", terms: "/terms" },
  de: { index: "/de/kuendigen", page: (s) => `/de/kuendigen/${s}`, home: "/de", privacy: "/de/datenschutz", terms: "/de/nutzungsbedingungen" },
};

const COPY = {
  en: {
    htmlLang: "en",
    title: (n, k) => `How to cancel ${n}: ${k} steps (2026) | Trimio`,
    description: (n, k, d) => `Cancel ${n} in ${k} steps, checked on ${d}. Includes what to do if you pay through Google Play, Apple or a provider.`,
    h1: (n) => `How to cancel ${n}`,
    sub: (k) => `${k} steps, in the order you will see them.`,
    checked: (d) => `Last checked ${d}`,
    independent: (n) => `Trimio is not affiliated with ${n}.`,
    stepsLabel: "Steps",
    open: (n) => `Open the ${n} cancellation page`,
    goodToKnow: "Good to know",
    ctaTitle: "Never miss a renewal again",
    ctaText: "Trimio reminds you before every charge, so you can cancel in time. No bank access, ever. Free on Android.",
    ctaPlay: "Get it on Google Play",
    ctaMore: "How Trimio works",
    more: "More cancellation guides",
    indexTitle: "Cancellation guides, step by step | Trimio",
    indexDescription: "Step by step guides to cancel Netflix, Spotify, Disney+, Amazon Prime and YouTube Premium, each checked against the service's own help pages.",
    indexH1: "Cancellation guides",
    indexSub: "Step by step, each one checked against the service's own help pages.",
    privacy: "Privacy",
    terms: "Terms",
    contact: "Contact",
    home: "Trimio home",
    date: (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    quote: (t) => t.replace(/"([^"]+)"/g, "“$1”"),
  },
  de: {
    htmlLang: "de",
    title: (n, k) => `${n} kündigen: Anleitung in ${k} Schritten (2026) | Trimio`,
    description: (n, k, d) => `So kündigst du ${n} in ${k} Schritten, geprüft am ${d}. Mit Hinweisen, falls du über Google Play, Apple oder einen Anbieter zahlst.`,
    h1: (n) => `${n} kündigen`,
    sub: (k) => `${k} Schritte, in der Reihenfolge, in der du sie siehst.`,
    checked: (d) => `Zuletzt geprüft am ${d}`,
    independent: (n) => `Trimio ist nicht mit ${n} verbunden.`,
    stepsLabel: "Schritte",
    open: (n) => `Kündigungsseite von ${n} öffnen`,
    goodToKnow: "Gut zu wissen",
    ctaTitle: "Nie wieder eine Verlängerung verpassen",
    ctaText: "Trimio erinnert dich vor jeder Abbuchung, damit du rechtzeitig kündigen kannst. Ohne Zugriff auf dein Bankkonto. Kostenlos für Android.",
    ctaPlay: "Bei Google Play laden",
    ctaMore: "So funktioniert Trimio",
    more: "Weitere Kündigungsanleitungen",
    indexTitle: "Kündigungsanleitungen Schritt für Schritt | Trimio",
    indexDescription: "Anleitungen zum Kündigen von Netflix, Spotify, Disney+, Amazon Prime und YouTube Premium, jeweils mit den Hilfeseiten der Anbieter abgeglichen.",
    indexH1: "Kündigungsanleitungen",
    indexSub: "Schritt für Schritt, jeweils mit den Hilfeseiten der Anbieter abgeglichen.",
    privacy: "Datenschutz",
    terms: "Nutzungsbedingungen",
    contact: "Kontakt",
    home: "Trimio Startseite",
    date: (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    quote: (t) => t.replace(/"([^"]+)"/g, "„$1“"),
  },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONTS = [[400, "Regular"], [700, "Bold"], [800, "ExtraBold"]]
  .map(([w, n]) => `@font-face { font-family: Montserrat; font-style: normal; font-weight: ${w}; font-display: swap; src: url('/fonts/Montserrat-${n}.woff2') format('woff2'); }`)
  .join("\n");

// Colours are the site's own tokens. Text pairs measured with the trimio-design
// contrast checker on 2026-10-11: navy on warm 13.51:1, slate on paper 6.19:1,
// deepened mint #1F7A62 on paper 5.05:1, white on navy 14.62:1, the CTA's 82%
// white on navy 9.88:1.
const CSS = `${FONTS}
:root { --navy: #142B3A; --mint: #55C6A3; --mint-deep: #1F7A62; --mint-soft: #DDF4EC; --warm: #F7F6F1; --paper: #FCFBF8; --slate: #52616B; --line: rgba(20,43,58,.12); }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--warm); color: var(--navy); font-family: Montserrat, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.6; }
a { color: inherit; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--mint-deep); outline-offset: 3px; border-radius: 8px; }
.skip { position: absolute; left: -9999px; top: 8px; background: var(--navy); color: #fff; padding: 10px 14px; border-radius: 10px; z-index: 10; }
.skip:focus { left: 8px; }
.wrap { width: 100%; max-width: 792px; margin: 0 auto; padding: 0 16px; }
.nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 0; }
.brand { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; font-weight: 800; font-size: 20px; text-decoration: none; }
.brand img { width: 34px; height: 34px; }
.lang { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper); }
.lang a { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 40px; border-radius: 999px; font-size: 13px; font-weight: 800; text-decoration: none; color: var(--slate); }
.lang a[aria-current="true"] { background: var(--navy); color: #fff; }
main { padding: 24px 0 56px; }
h1 { font-size: clamp(34px, 7vw, 52px); line-height: 1.05; letter-spacing: -.035em; margin: 8px 0 12px; text-wrap: balance; }
.sub { font-size: 18px; color: var(--slate); margin: 0 0 10px; }
.meta { font-size: 14px; color: var(--slate); margin: 0 0 28px; }
.meta strong { color: var(--mint-deep); }
.steps { list-style: none; padding: 0; margin: 0 0 24px; counter-reset: step; display: grid; gap: 12px; }
.steps li { counter-increment: step; position: relative; background: var(--paper); border: 1px solid var(--line); border-radius: 18px; padding: 18px 18px 18px 64px; font-size: 17px; }
.steps li::before { content: counter(step); position: absolute; left: 16px; top: 16px; width: 34px; height: 34px; border-radius: 50%; background: var(--navy); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 15px; }
.button { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 24px; border-radius: 999px; font-weight: 700; text-decoration: none; text-align: center; }
.button-dark { background: var(--navy); color: #fff; }
.button-light { background: #fff; color: var(--navy); }
.button-ghost { border: 1px solid rgba(255,255,255,.35); color: #fff; }
.note { margin: 28px 0 0; padding: 18px 20px; border-left: 4px solid var(--mint); background: var(--paper); border-radius: 0 16px 16px 0; }
.note h2 { font-size: 15px; margin: 0 0 6px; }
.note p { margin: 0; color: var(--slate); }
.cta { margin: 40px 0 0; background: var(--navy); color: #fff; border-radius: 28px; padding: 28px 24px; }
.cta h2 { margin: 0 0 8px; font-size: 26px; line-height: 1.15; letter-spacing: -.02em; }
.cta p { margin: 0 0 20px; color: rgba(255,255,255,.82); }
.cta .actions { display: flex; flex-wrap: wrap; gap: 12px; }
.more { margin: 40px 0 0; }
.more h2 { font-size: 20px; margin: 0 0 12px; }
.more ul, .index ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.more a, .index a { display: flex; align-items: center; justify-content: space-between; min-height: 52px; padding: 12px 18px; background: var(--paper); border: 1px solid var(--line); border-radius: 16px; font-weight: 700; text-decoration: none; }
.more a::after, .index a::after { content: "\\203A"; color: var(--mint-deep); font-size: 22px; }
footer { border-top: 1px solid var(--line); padding: 24px 0 40px; font-size: 14px; color: var(--slate); display: flex; flex-wrap: wrap; gap: 8px 20px; justify-content: space-between; }
footer nav { display: flex; flex-wrap: wrap; gap: 4px 18px; }
footer a { display: inline-flex; min-height: 44px; align-items: center; }
@media (max-width: 520px) { .cta .actions .button { width: 100%; } .steps li { font-size: 16px; } }
`;

// Same cookieless PostHog setup as the landing page: memory persistence, no
// autocapture, no replay, Do Not Track honoured. Covered by section 15 of the
// privacy policy. Pageviews plus one click event.
const ANALYTICS = `<script>
(function () {
  window.trimioTrack = function () {};
  try { if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return; } catch (e) { return; }
  var s = document.createElement('script');
  s.src = 'https://eu-assets.i.posthog.com/static/array.js';
  s.async = true;
  s.onload = function () {
    if (!window.posthog || !window.posthog.init) return;
    window.posthog.init('phc_wFoqNGYxoY64mxQ5TMrJbME5KP3xii7GvTkvp7hs4q6P', {
      api_host: 'https://eu.i.posthog.com', autocapture: false, disable_session_recording: true,
      capture_pageview: true, persistence: 'memory', respect_dnt: true
    });
    window.trimioTrack = function (e, p) { try { window.posthog.capture(e, p); } catch (x) {} };
  };
  s.onerror = function () {};
  document.head.appendChild(s);
})();
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('[data-track]');
  if (a) window.trimioTrack(a.getAttribute('data-track'), { guide: document.body.dataset.guide || 'index', lang: document.documentElement.lang });
});
</script>`;

function shell({ lang, title, description, canonicalPath, altPaths, guide, body }) {
  const c = COPY[lang];
  const p = PATHS[lang];
  const other = lang === "en" ? "de" : "en";
  return `<!doctype html>
<html lang="${c.htmlLang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="theme-color" content="#F7F6F1" />
  <link rel="canonical" href="${SITE}${canonicalPath}" />
  <link rel="alternate" hreflang="en" href="${SITE}${altPaths.en}" />
  <link rel="alternate" hreflang="de" href="${SITE}${altPaths.de}" />
  <link rel="alternate" hreflang="x-default" href="${SITE}${altPaths.en}" />
  <link rel="icon" href="/mark.svg" type="image/svg+xml" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${SITE}${canonicalPath}" />
  <meta property="og:image" content="${SITE}/${lang === "de" ? "og-de.png" : "og.png"}" />
  <link rel="preload" href="/fonts/Montserrat-ExtraBold.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/Montserrat-Regular.woff2" as="font" type="font/woff2" crossorigin />
  <style>${CSS}</style>
  ${ANALYTICS}
</head>
<body${guide ? ` data-guide="${esc(guide)}"` : ""}>
  <a class="skip" href="#main">${lang === "de" ? "Zum Inhalt springen" : "Skip to content"}</a>
  <div class="wrap">
    <header class="nav">
      <a class="brand" href="${p.home}" aria-label="${esc(c.home)}"><img src="/mark.svg" alt="" width="34" height="34" /><span>Trimio</span></a>
      <nav class="lang" aria-label="${lang === "de" ? "Sprache" : "Language"}">
        <a href="${altPaths.en}" hreflang="en" lang="en"${lang === "en" ? ' aria-current="true"' : ""}>EN</a>
        <a href="${altPaths.de}" hreflang="de" lang="de"${lang === "de" ? ' aria-current="true"' : ""}>DE</a>
      </nav>
    </header>
    <main id="main">
${body}
    </main>
    <footer>
      <span>© 2026 Trimio · ${lang === "de" ? "Wien, Österreich" : "Vienna, Austria"}</span>
      <nav aria-label="${lang === "de" ? "Rechtliches" : "Legal"}">
        <a href="${p.privacy}">${c.privacy}</a>
        <a href="${p.terms}">${c.terms}</a>
        <a href="mailto:trimio@subtrimio.com">${c.contact}</a>
      </nav>
    </footer>
  </div>
</body>
</html>
`;
}

function cta(lang) {
  const c = COPY[lang];
  return `      <section class="cta" aria-labelledby="cta-title">
        <h2 id="cta-title">${esc(c.ctaTitle)}</h2>
        <p>${esc(c.ctaText)}</p>
        <div class="actions">
          <a class="button button-light" href="${PLAY}" data-track="guide_play_store_click">${esc(c.ctaPlay)}</a>
          <a class="button button-ghost" href="${PATHS[lang].home}">${esc(c.ctaMore)}</a>
        </div>
      </section>`;
}

function guidePage(entry, lang) {
  const c = COPY[lang];
  const g = getLocalizedGuide(entry.key);
  const steps = g.steps[lang];
  const url = typeof g.url === "string" ? g.url : g.url[lang];
  const date = c.date(g.verified);
  const others = PAGES.filter((o) => o !== entry);
  const body = `      <h1>${esc(c.h1(entry.name))}</h1>
      <p class="sub">${esc(c.sub(steps.length))}</p>
      <p class="meta"><strong>${esc(c.checked(date))}</strong>. ${esc(c.independent(entry.name))}</p>
      <ol class="steps" aria-label="${c.stepsLabel}">
${steps.map((s) => `        <li>${esc(c.quote(s))}</li>`).join("\n")}
      </ol>
      ${url ? `<a class="button button-dark" href="${esc(url)}" rel="nofollow noopener" target="_blank">${esc(c.open(entry.name))}</a>` : ""}
${g.note ? `      <aside class="note"><h2>${c.goodToKnow}</h2><p>${esc(c.quote(g.note[lang]))}</p></aside>` : ""}
${cta(lang)}
      <section class="more" aria-labelledby="more-title">
        <h2 id="more-title">${esc(c.more)}</h2>
        <ul>
${others.map((o) => `          <li><a href="${PATHS[lang].page(o.slug)}">${esc(c.h1(o.name))}</a></li>`).join("\n")}
        </ul>
      </section>`;
  return shell({
    lang,
    title: c.title(entry.name, steps.length),
    description: c.description(entry.name, steps.length, date),
    canonicalPath: PATHS[lang].page(entry.slug),
    altPaths: { en: PATHS.en.page(entry.slug), de: PATHS.de.page(entry.slug) },
    guide: entry.slug,
    body,
  });
}

function indexPage(lang) {
  const c = COPY[lang];
  const body = `      <h1>${esc(c.indexH1)}</h1>
      <p class="sub">${esc(c.indexSub)}</p>
      <nav class="index" aria-label="${esc(c.indexH1)}" style="margin-top:24px">
        <ul>
${PAGES.map((o) => `          <li><a href="${PATHS[lang].page(o.slug)}">${esc(c.h1(o.name))}</a></li>`).join("\n")}
        </ul>
      </nav>
${cta(lang)}`;
  return shell({
    lang,
    title: c.indexTitle,
    description: c.indexDescription,
    canonicalPath: PATHS[lang].index,
    altPaths: { en: PATHS.en.index, de: PATHS.de.index },
    guide: null,
    body,
  });
}

// Refuse rather than publish something untrue.
for (const e of PAGES) {
  const g = getLocalizedGuide(e.key);
  if (!g) throw new Error(`no guide for key "${e.key}"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.verified || "")) throw new Error(`guide "${e.key}" has no verified date, check its steps before publishing it`);
  if (!/^[a-z0-9-]+$/.test(e.slug)) throw new Error(`bad slug "${e.slug}"`);
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const lang of ["en", "de"]) {
  fs.mkdirSync(path.join(OUT, lang), { recursive: true });
  fs.writeFileSync(path.join(OUT, lang, "index.html"), indexPage(lang));
  for (const e of PAGES) fs.writeFileSync(path.join(OUT, lang, `${e.slug}.html`), guidePage(e, lang));
}
const manifest = {
  _note: "Generated by tools/build-guides.mjs. server.js reads this for the /cancel and /de/kuendigen routes and the sitemap.",
  guides: PAGES.map((e) => ({ slug: e.slug, lastmod: getLocalizedGuide(e.key).verified })),
};
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${PAGES.length * 2 + 2} pages and manifest.json to backend/guides`);
