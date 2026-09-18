/* Dates, prices and the copy rule, across the screens.

   These are the defects that survive because nothing breaks: a date renders,
   a price renders, a dash looks like punctuation. Source-reading, because every
   one of them lives inside a React component tree that cannot mount here. */

const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const UI_FILES = [
  "app/(tabs)/subscriptions.tsx",
  "app/(tabs)/index.tsx",
  "app/(tabs)/analytics.tsx",
  "app/(tabs)/calendar.tsx",
  "app/(tabs)/profile.tsx",
  "app/refer-a-friend.tsx",
  "app/notifications.tsx",
  "app/notification-preferences.tsx",
  "app/upgrade.tsx",
  "app/insights.tsx",
  "app/account-settings.tsx",
  "components/PremiumGate.tsx",
];

describe("dates follow the app's language, not the phone's", () => {
  it("no screen calls toLocaleDateString with no locale", () => {
    /* A bare toLocaleDateString() uses the DEVICE locale. A German user on an
       English phone read English dates inside German UI, and vice versa. */
    for (const f of UI_FILES) {
      expect(read(f).includes("toLocaleDateString()")).toBe(false);
    }
  });

  it("no screen hardcodes a locale", () => {
    // notification-preferences pinned "en-GB", so German users always got English.
    for (const f of UI_FILES) {
      expect(/toLocaleDateString\("[a-z]{2}-[A-Z]{2}"/.test(read(f))).toBe(false);
    }
  });

  it("uses the helper that already existed rather than a new one", () => {
    for (const f of ["app/notifications.tsx", "app/refer-a-friend.tsx", "app/notification-preferences.tsx"]) {
      expect(read(f)).toMatch(/useDateFormat/);
    }
  });
});

describe("an invalid date cannot take a screen down", () => {
  const LOCALE = read("lib/date-locale.ts");

  it("useDateFormat guards before calling date-fns", () => {
    /* date-fns `format` THROWS a RangeError on an invalid date, where the
       toLocaleDateString() calls it replaced returned the harmless string
       "Invalid Date". Inside a render a throw reaches the ErrorBoundary, so one
       malformed date from the API would replace a screen with the crash screen.

       Reachable: notification-preferences derives its value from
       new Date(x).getTime(), NaN for a bad date, and notifications formats
       n.createdAt straight off the API. */
    expect(LOCALE).toMatch(/Number\.isFinite\(ms\)/);
    expect(LOCALE).toMatch(/try\s*\{/);
    expect(LOCALE).toMatch(/catch/);
  });

  it("the guard behaves, mirrored", () => {
    // Mirror of the helper's rule, since the real one is a hook.
    const fmt = (date) => {
      const ms = typeof date === "number" ? date : date?.getTime?.();
      if (ms == null || !Number.isFinite(ms)) return "";
      return "formatted";
    };
    expect(fmt(new Date("not-a-date"))).toBe("");
    expect(fmt(new Date(NaN))).toBe("");
    expect(fmt(NaN)).toBe("");
    expect(fmt(undefined)).toBe("");
    expect(fmt(null)).toBe("");
    expect(fmt(new Date(2026, 8, 18))).toBe("formatted");
    expect(fmt(Date.now())).toBe("formatted");
  });
});

describe("the purchase screen shows the price Play will charge", () => {
  const UPGRADE = read("app/upgrade.tsx");

  it("reads RevenueCat's localized priceString", () => {
    /* The offerings were already fetched and used ONLY to make the purchase.
       Every price displayed came from hardcoded USD, so a subscriber in Austria
       read "$2.99" on the screen where they decide to pay. */
    expect(UPGRADE).toMatch(/priceString/);
  });

  it("keeps the hardcoded prices as a fallback, not as the answer", () => {
    expect(UPGRADE).toMatch(/priceString\s*\?\?\s*fallback/);
    expect(UPGRADE).toMatch(/PREMIUM_PRICES/);
  });

  it("does not pass PREMIUM_PRICES straight to a plan's price field", () => {
    expect(/price:\s*PREMIUM_PRICES\./.test(UPGRADE)).toBe(false);
  });
});

describe("the premium banner is translated and priced from one source", () => {
  const RAW = read("components/PremiumGate.tsx");
  /* Comments stripped first. The comment in that file QUOTES the strings it
     replaced, which is the point of it, and asserting against the raw source
     therefore failed on the explanation rather than on the code. Assert on what
     runs, not on what is written about it. */
  const GATE = RAW.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|\/\/[^\n]*/g, "");

  it("has no hardcoded English left", () => {
    expect(GATE.includes("Unlock Premium")).toBe(false);
  });

  it("has no price written inline", () => {
    expect(GATE.includes("$2.99")).toBe(false);
    expect(GATE).toMatch(/PREMIUM_PRICES\.monthly/);
  });

  it("reuses the key that already said this in both languages", () => {
    expect(GATE).toMatch(/t\("profile\.unlockPremium"/);
  });
});

describe("no dash as clause punctuation in any user-facing text", () => {
  it("not in the locale files", () => {
    for (const f of ["locales/en.json", "locales/de.json"]) {
      const flat = [];
      (function walk(o) {
        for (const v of Object.values(o)) {
          if (v && typeof v === "object") walk(v);
          else if (typeof v === "string") flat.push(v);
        }
      })(JSON.parse(read(f)));
      for (const s of flat) {
        expect(s.match(/—|–|\S\s+-\s+\S/)).toBeNull();
      }
    }
  });

  it("not in JSX text nodes either", () => {
    /* The locale files were already clean. The violation was in JSX, which the
       locale check cannot see: "{s.name} — {date}" in notification-preferences
       and "Unlock Premium — from $2.99/mo" in PremiumGate. */
    for (const f of UI_FILES) {
      const src = read(f).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
      expect(src.match(/>\s*[^<>{}]*\s—\s[^<>{}]*</)).toBeNull();
      expect(src.match(/\}\s*—\s*\{/)).toBeNull();
    }
  });
});
