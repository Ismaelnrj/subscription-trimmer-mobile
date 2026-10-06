#!/usr/bin/env node
/* Builds lib/brand-mark-data.ts, the brand marks the app draws beside a
   subscription, from the simple-icons package.

   WHY BUNDLED: until 2026-10-06 every logo in the app came from
   logo.clearbit.com, which HubSpot shut down in December 2025, so every request
   failed and every row fell back to a category icon. Bundled marks need no
   network, cannot be shut down by a third party, and send nobody a request
   saying which services a user pays for.

   SOURCE: simple-icons (https://simpleicons.org), whose icon data is CC0. The
   marks themselves are trademarks of their owners; the app uses them only to
   identify the user's own subscription to that service, in the brand's own
   colour and unaltered.

   RUN, from the repo root (neither package is a dependency of the app, and
   both go in ONE install: a second --no-save install prunes the first):
     npm install --no-save --prefix /tmp/si simple-icons@16.34.0 svg-path-bbox@2.1.0
     node tools/build-brand-marks.js /tmp/si/node_modules

   THE GROUND IS MEASURED, NOT CHOSEN. Each mark sits on white when its brand
   colour reaches 3:1 against white (WCAG 1.4.11, non-text contrast), and on
   Ink Navy otherwise. Spotify green on white is 1.92:1 and disappears; on navy
   it is 7.62:1, which is also how Spotify presents itself.

   WORDMARKS ARE REFUSED. A mark more than 2.5 times wider than tall is drawn
   about 4dp high inside a 36dp circle, which is a smudge rather than a logo.
   RTL (5.7), YouTube TV (5.4), Zoom (4.4), Garmin (3.7) and the HBO Max "max"
   wordmark (3.7) were measured that way and left out on purpose: those rows
   keep their category icon, and YouTube TV takes YouTube's own mark. The guard
   below fails the build if one is added back.

   MATCHING IS BY THE START OF THE SUBSCRIPTION'S NAME, never a substring, and
   ordered most specific first ("youtube music" before "youtube"). A name is
   the user's own label for one subscription, so "Sky Cinema" starting with
   "sky" is Sky; "Skype" is not, because the character after the prefix must
   not be a letter or digit. Ordinary words that are not reliably the brand
   ("max", bare "ea") are deliberately absent. */
const fs = require("fs");
const path = require("path");

// [simple-icons slug, name prefixes]. Order is load bearing: first match wins.
const MARKS = [
  ["youtubemusic", ["youtube music"]],
  ["youtube", ["youtube"]],
  ["applemusic", ["apple music"]],
  ["applearcade", ["apple arcade"]],
  ["appletv", ["apple tv"]],
  ["icloud", ["icloud"]],
  ["apple", ["apple one", "apple"]],
  ["netflix", ["netflix"]],
  ["spotify", ["spotify"]],
  ["dazn", ["dazn"]],
  ["hbo", ["hbo max", "hbo"]],
  ["paramountplus", ["paramount"]],
  ["crunchyroll", ["crunchyroll"]],
  ["mubi", ["mubi"]],
  ["sky", ["sky"]],
  ["deezer", ["deezer"]],
  ["tidal", ["tidal"]],
  ["audible", ["audible"]],
  ["playstation", ["playstation", "ps plus"]],
  ["ea", ["ea play"]],
  ["google", ["google one", "google"]],
  ["dropbox", ["dropbox"]],
  ["backblaze", ["backblaze"]],
  ["1password", ["1password"]],
  ["lastpass", ["lastpass"]],
  ["dashlane", ["dashlane"]],
  ["nordvpn", ["nordvpn", "nord vpn"]],
  ["expressvpn", ["expressvpn"]],
  ["surfshark", ["surfshark"]],
  ["github", ["github"]],
  ["notion", ["notion"]],
  ["figma", ["figma"]],
  ["grammarly", ["grammarly"]],
  ["duolingo", ["duolingo"]],
  ["coursera", ["coursera"]],
  ["codecademy", ["codecademy"]],
  ["skillshare", ["skillshare"]],
  ["headspace", ["headspace"]],
  ["strava", ["strava"]],
  ["peloton", ["peloton"]],
  ["fitbit", ["fitbit"]],
  ["hellofresh", ["hellofresh"]],
  ["deutschetelekom", ["telekom", "magentatv", "magentamobil", "magenta"]],
  ["vodafone", ["vodafone"]],
  ["o2", ["o2"]],
  ["sunrise", ["sunrise"]],
];

const WHITE = "#FFFFFF";
const NAVY = "#142B3A";
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const MAX_ASPECT = 2.5;

const modules = process.argv[2];
if (!modules) {
  console.error("usage: node tools/build-brand-marks.js <node_modules holding simple-icons and svg-path-bbox>");
  process.exit(2);
}
const pkgDir = path.resolve(modules, "simple-icons");
const si = require(pkgDir);
const { svgPathBbox } = require(path.resolve(modules, "svg-path-bbox"));
const version = require(path.join(pkgDir, "package.json")).version;
const bySlug = {};
for (const icon of Object.values(si)) if (icon && icon.slug) bySlug[icon.slug] = icon;

const rows = MARKS.map(([slug, match]) => {
  const icon = bySlug[slug];
  if (!icon) {
    console.error(`simple-icons ${version} has no "${slug}"`);
    process.exit(1);
  }
  const [x0, y0, x1, y1] = svgPathBbox(icon.path);
  const aspect = (x1 - x0) / (y1 - y0);
  if (aspect > MAX_ASPECT) {
    console.error(`${slug} is ${aspect.toFixed(2)} times wider than tall, a wordmark too small to read in a circle`);
    process.exit(1);
  }
  const hex = `#${icon.hex.toUpperCase()}`;
  const ground = ratio(hex, WHITE) >= 3 ? WHITE : NAVY;
  if (ratio(hex, ground) < 3) {
    console.error(`${slug} ${hex} reaches 3:1 on neither ground`);
    process.exit(1);
  }
  return { slug, title: icon.title, hex, ground, match, path: icon.path };
});

const out = [
  `/* GENERATED by tools/build-brand-marks.js from simple-icons ${version}. Do not`,
  "   hand edit: change the MARKS table there and re-run it. Icon data is CC0;",
  "   the marks are trademarks of their owners, shown only to identify the",
  "   user's own subscription to that service. */",
  "",
  "export type BrandMark = {",
  "  slug: string;",
  "  title: string;",
  "  hex: string;",
  "  ground: string;",
  "  match: readonly string[];",
  "  path: string;",
  "};",
  "",
  "export const BRAND_MARKS: readonly BrandMark[] = [",
  ...rows.map((r) => `  ${JSON.stringify(r)},`),
  "];",
  "",
].join("\n");

const dest = path.join(__dirname, "..", "lib", "brand-mark-data.ts");
fs.writeFileSync(dest, out);
console.log(`wrote ${rows.length} marks, ${out.length} bytes, to ${path.relative(process.cwd(), dest)}`);
for (const r of rows) console.log(`  ${r.slug.padEnd(16)} ${r.hex} on ${r.ground === WHITE ? "white" : "navy "} ${ratio(r.hex, r.ground).toFixed(2)}:1`);
