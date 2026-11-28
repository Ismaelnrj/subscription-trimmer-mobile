/**
 * WHAT'S NEW IS SHOWN ONCE, TO PEOPLE WHO HAD THE OLD VERSION, AND NEVER
 * BESIDE THE PLAY PROMPT. EVERY UPDATE IS ANNOUNCED (owner, 2026-11-28), AND
 * ANYTHING MISSED ARRIVES AS ONE CARD.
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
const { whatsNewFor, ANNOUNCEMENTS, SHOW_FOR_DAYS, MAX_LINES } = require("../lib/whats-new");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const DAY = 86400000;
const item = (key) => ({ icon: "wifi-off", key });
const A = { id: "2026-11-27", date: "2026-11-27", items: [item("whatsNew.offline")] };
const B = { id: "2026-12-05", date: "2026-12-05", items: [item("whatsNew.look"), item("whatsNew.keep")] };
const LIST = [B, A]; // newest first, as in lib/whats-new.ts
const PUBLISHED = Date.parse(A.date);
const BEFORE = PUBLISHED - 30 * DAY;
const NOW = Date.parse(B.date) + 2 * DAY;
const keys = (r) => (r ? r.items.map((i) => i.key) : null);

describe("whatsNewFor", () => {
  test("a phone that saw nothing gets every announcement it had the old version for, as one card", () => {
    const r = whatsNewFor(LIST, null, BEFORE, NOW);
    expect(r.id).toBe("2026-12-05");
    expect(keys(r)).toEqual(["whatsNew.look", "whatsNew.keep", "whatsNew.offline"]);
  });

  test("a phone that saw the older one gets only the newer, and is remembered at the newest", () => {
    const r = whatsNewFor(LIST, A.id, BEFORE, NOW);
    expect(keys(r)).toEqual(["whatsNew.look", "whatsNew.keep"]);
    expect(r.id).toBe(B.id);
  });

  test("never twice: having seen the newest shows nothing", () => {
    expect(whatsNewFor(LIST, B.id, BEFORE, NOW)).toBeNull();
  });

  test("an id it does not know reads as nothing seen", () => {
    expect(keys(whatsNewFor(LIST, "2026-01-01", BEFORE, NOW))).toEqual(["whatsNew.look", "whatsNew.keep", "whatsNew.offline"]);
  });

  test("never what came before the install, nothing when the install time is unknown", () => {
    expect(keys(whatsNewFor(LIST, null, PUBLISHED + DAY, NOW))).toEqual(["whatsNew.look", "whatsNew.keep"]);
    expect(whatsNewFor(LIST, null, Date.parse(B.date), NOW)).toBeNull();
    expect(whatsNewFor(LIST, null, null, NOW)).toBeNull();
  });

  test("an entry dated to the minute it went out still reaches a phone installed earlier that day", () => {
    const at = { id: "t", date: "2026-11-28T08:17:45Z", items: [item("whatsNew.look")] };
    const now = Date.parse("2026-11-29");
    expect(keys(whatsNewFor([at], null, Date.parse("2026-11-28T05:00:00Z"), now))).toEqual(["whatsNew.look"]);
    expect(whatsNewFor([at], null, Date.parse("2026-11-28T09:00:00Z"), now)).toBeNull();
  });

  test("not once an announcement is old", () => {
    const late = Date.parse(B.date) + SHOW_FOR_DAYS * DAY;
    expect(whatsNewFor(LIST, null, BEFORE, late)).toBeNull();
    expect(keys(whatsNewFor(LIST, null, BEFORE, PUBLISHED + SHOW_FOR_DAYS * DAY))).toEqual(["whatsNew.look", "whatsNew.keep"]);
  });

  test("the card stays short and says each line once", () => {
    const many = Array.from({ length: 4 }, (_, i) => ({ id: `x${i}`, date: "2026-12-01", items: [item(`k${i}a`), item(`k${i}b`), item("whatsNew.look")] }));
    const r = whatsNewFor(many, null, BEFORE, NOW);
    expect(r.items.length).toBe(MAX_LINES);
    expect(new Set(keys(r)).size).toBe(MAX_LINES);
  });

  test("nothing announced, nothing shown", () => {
    expect(whatsNewFor([], null, BEFORE, NOW)).toBeNull();
    expect(whatsNewFor([{ ...A, items: [] }], null, BEFORE, NOW)).toBeNull();
  });
});

describe("the announcements", () => {
  const glyphs = JSON.parse(read("node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json"));
  const pick = (json, key) => key.split(".").reduce((o, k) => (o ? o[k] : undefined), json);

  test("run newest first, with unique ids and real dates", () => {
    const dates = ANNOUNCEMENTS.map((a) => Date.parse(a.date));
    for (const d of dates) expect(Number.isFinite(d)).toBe(true);
    for (let i = 1; i < dates.length; i++) expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    expect(new Set(ANNOUNCEMENTS.map((a) => a.id)).size).toBe(ANNOUNCEMENTS.length);
  });

  test("every line exists in both languages", () => {
    for (const lang of ["en", "de"]) {
      const json = JSON.parse(read(`locales/${lang}.json`));
      for (const key of ["whatsNew.title", "whatsNew.gotIt", ...ANNOUNCEMENTS.flatMap((a) => a.items.map((i) => i.key))]) {
        expect([lang, key, typeof pick(json, key)]).toEqual([lang, key, "string"]);
      }
    }
  });

  test("every icon exists, or Android draws a box", () => {
    for (const { icon } of ANNOUNCEMENTS.flatMap((a) => a.items)) expect([icon, icon in glyphs]).toEqual([icon, true]);
  });
});

describe("the popup", () => {
  const src = read("components/UpdateAvailableModal.tsx");

  test("both notices wait for the launch screen to go", () => {
    expect(src).toMatch(/visible=\{visible && ready\}/);
    expect(src).toMatch(/visible=\{!!news && ready\}/);
    expect(read("app/_layout.tsx")).toMatch(/<UpdateAvailableModal ready=\{!showAnimatedSplash\} \/>/);
  });

  test("what's new never follows the Play prompt in the same launch, and only signed in on the main screens", () => {
    expect(src).toMatch(/if \(!ready \|\| !checked \|\| storeAsked\.current \|\| newsDecided\.current\) return;/);
    expect(src).toMatch(/if \(!isAuthenticated \|\| !onMainScreens \|\| !ANNOUNCEMENTS\.length\) return;/);
  });

  test("leaving the main screens mid decision decides again on return, not never", () => {
    expect(src).toMatch(/if \(cancelled\) \{ newsDecided\.current = false; return; \}/);
  });

  test("a phone that cannot remember is not shown it, and Got it remembers", () => {
    expect(src).toMatch(/seen === "unknown"\) return;/);
    expect(src).toMatch(/const gotIt = \(\) => \{\s*if \(news\) markSeen\(news\.id\);\s*setNews\(null\);/);
    expect(src).toMatch(/setNews\(whatsNewFor\(ANNOUNCEMENTS, seen, installed, Date\.now\(\)\)\)/);
    expect(src).toMatch(/onRequestClose=\{gotIt\}/);
  });
});

/* Caught 2026-11-27 in the web preview, where the install time comes back
   empty: new Date(null) is 1970, so the card showed to a "phone" whose install
   date nobody knew. Unknown has to stay unknown. */
describe("installedAt", () => {
  const load = (impl) => {
    jest.resetModules();
    jest.doMock("expo-application", () => ({ getInstallationTimeAsync: impl }));
    return require("../lib/whats-new").installedAt;
  };
  afterEach(() => jest.dontMock("expo-application"));

  test("reads Android's install date", async () => {
    expect(await load(async () => new Date(Date.UTC(2026, 8, 1)))()).toBe(Date.UTC(2026, 8, 1));
  });

  test("nothing, the epoch or a failure is unknown, never 'long ago'", async () => {
    expect(await load(async () => null)()).toBeNull();
    expect(await load(async () => undefined)()).toBeNull();
    expect(await load(async () => new Date(0))()).toBeNull();
    expect(await load(async () => { throw new Error("unavailable"); })()).toBeNull();
  });
});
