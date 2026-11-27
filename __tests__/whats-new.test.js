/**
 * WHAT'S NEW IS SHOWN ONCE, TO PEOPLE WHO HAD THE OLD VERSION, AND NEVER
 * BESIDE THE PLAY PROMPT.
 *
 * The owner, 2026-11-27: people should know when an update has come. Over the
 * air updates land silently, so lib/whats-new.ts announces one, and the rules
 * below are what keep an announcement from becoming a nag: once per id, not to
 * a phone that installed after it, not once it is old, not when the phone
 * cannot remember having shown it, and never in the same launch as "a new
 * version is on Google Play".
 */
const fs = require("fs");
const path = require("path");
const { shouldShowWhatsNew, ANNOUNCEMENT, SHOW_FOR_DAYS } = require("../lib/whats-new");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const DAY = 86400000;
const A = { id: "2026-11-27", date: "2026-11-27", items: [{ icon: "wifi-off", key: "whatsNew.offline" }] };
const PUBLISHED = Date.parse(A.date);
const BEFORE = PUBLISHED - 30 * DAY;
const NOW = PUBLISHED + 5 * DAY;

describe("shouldShowWhatsNew", () => {
  test("shows to a phone that had Trimio before the announcement", () => {
    expect(shouldShowWhatsNew(A, null, BEFORE, NOW)).toBe(true);
    expect(shouldShowWhatsNew(A, "2026-10-01", BEFORE, NOW)).toBe(true);
  });

  test("never twice", () => {
    expect(shouldShowWhatsNew(A, A.id, BEFORE, NOW)).toBe(false);
  });

  test("never to a phone that installed on or after it, or whose install time is unknown", () => {
    expect(shouldShowWhatsNew(A, null, PUBLISHED, NOW)).toBe(false);
    expect(shouldShowWhatsNew(A, null, PUBLISHED + DAY, NOW)).toBe(false);
    expect(shouldShowWhatsNew(A, null, null, NOW)).toBe(false);
  });

  test("not once the announcement is old", () => {
    expect(shouldShowWhatsNew(A, null, BEFORE, PUBLISHED + SHOW_FOR_DAYS * DAY)).toBe(false);
  });

  test("nothing announced, nothing shown", () => {
    expect(shouldShowWhatsNew(null, null, BEFORE, NOW)).toBe(false);
    expect(shouldShowWhatsNew({ ...A, items: [] }, null, BEFORE, NOW)).toBe(false);
  });
});

describe("the current announcement", () => {
  const glyphs = JSON.parse(read("node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json"));
  const pick = (json, key) => key.split(".").reduce((o, k) => (o ? o[k] : undefined), json);

  test("has a real date and every line in both languages", () => {
    if (!ANNOUNCEMENT) return;
    expect(Number.isFinite(Date.parse(ANNOUNCEMENT.date))).toBe(true);
    for (const lang of ["en", "de"]) {
      const json = JSON.parse(read(`locales/${lang}.json`));
      for (const key of ["whatsNew.title", "whatsNew.gotIt", ...ANNOUNCEMENT.items.map((i) => i.key)]) {
        expect([lang, key, typeof pick(json, key)]).toEqual([lang, key, "string"]);
      }
    }
  });

  test("every icon exists, or Android draws a box", () => {
    if (!ANNOUNCEMENT) return;
    for (const { icon } of ANNOUNCEMENT.items) expect([icon, icon in glyphs]).toEqual([icon, true]);
  });
});

describe("the popup", () => {
  const src = read("components/UpdateAvailableModal.tsx");

  test("both notices wait for the launch screen to go", () => {
    expect(src).toMatch(/visible=\{visible && ready\}/);
    expect(src).toMatch(/visible=\{news && ready\}/);
    expect(read("app/_layout.tsx")).toMatch(/<UpdateAvailableModal ready=\{!showAnimatedSplash\} \/>/);
  });

  test("what's new never follows the Play prompt in the same launch, and only signed in on the main screens", () => {
    expect(src).toMatch(/if \(!ready \|\| !checked \|\| storeAsked\.current \|\| newsDecided\.current\) return;/);
    expect(src).toMatch(/if \(!isAuthenticated \|\| !onMainScreens \|\| !ANNOUNCEMENT\) return;/);
  });

  test("a phone that cannot remember is not shown it, and Got it remembers", () => {
    expect(src).toMatch(/seen === "unknown"\) return;/);
    expect(src).toMatch(/const gotIt = \(\) => \{\s*setNews\(false\);\s*if \(ANNOUNCEMENT\) markSeen\(ANNOUNCEMENT\.id\);/);
    expect(src).toMatch(/onRequestClose=\{gotIt\}/);
  });
});
