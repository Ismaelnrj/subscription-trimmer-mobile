/* The 2026-09-20 audit pass, four defects that each survived because nothing
   broke: a date rendered, a word rendered, a bar rendered, a button responded
   to a tap. Source-reading plus a real-module check, because every one of them
   lives inside a React component tree that cannot mount here. */

const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

describe("the renewal date on a subscription card names the right day", () => {
  /* next_billing_date is TIMESTAMPTZ stored at midnight UTC, so new Date() on
     it resolves to the PREVIOUS local day at any negative offset. Measured: a
     16 October renewal read "15 Oct" in New York, Los Angeles, Sao Paulo and
     Mexico City, all four of which the currency picker offers. The calendar
     was fixed for this and the card was not, so one subscription named two
     different days on two screens. */
  const src = read("app/(tabs)/subscriptions.tsx");

  it("does not parse nextBillingDate with a bare new Date()", () => {
    expect(/new Date\(\s*sub\.nextBillingDate\s*\)/.test(src)).toBe(false);
  });

  it("renders the card date through parseApiDate", () => {
    expect(src).toMatch(/const nextDate = parseApiDate\(sub\.nextBillingDate\)/);
    expect(src).toMatch(/t\("subscriptions\.next", \{ date: fmtD\(nextDate, "P"\) \}\)/);
  });

  it("falls back to the no-date string rather than rendering Invalid Date", () => {
    // parseApiDate returns null for an unreadable value; the guard must be the
    // PARSED date, not the raw field, or a bad value renders "Invalid Date".
    expect(src).toMatch(/\{nextDate\s*\n?\s*\?\s*t\("subscriptions\.next"/);
  });
});

describe("no screen renders a raw API category or cycle", () => {
  it("insights localises the category in both duplicate tips", () => {
    /* buildTips is an exported function and cannot call a hook, so it uses the
       plain localiseCategory with the `t` it is ALREADY handed. Adding a
       parameter here is what caused "TypeError: 50 is not a function". */
    const src = read("app/insights.tsx");
    expect(src).toMatch(/import \{ localiseCategory \} from "\.\.\/lib\/category-label"/);
    expect(/category: cat \}/.test(src)).toBe(false);
    expect((src.match(/localiseCategory\(cat, t\)/g) || []).length).toBe(2);
  });

  it("buildTips keeps the signature its two call sites pass", () => {
    // The guard that stops the crash above from being reintroduced.
    const src = read("app/insights.tsx");
    const sig = src.slice(src.indexOf("export function buildTips"));
    const params = sig.slice(sig.indexOf("("), sig.indexOf("): Tip[]"));
    expect(params).toContain("subs:");
    expect(params).toContain("fmtC:");
    expect(params).toContain("t:");
    expect(params).toContain("singleSubThreshold");
    expect(params).toContain("currencyContext");
    expect(params).not.toContain("categoryLabel");
  });

  it("the dashboard trial card localises the billing cycle", () => {
    /* "{{amount}}/{{cycle}} charged on expiry" rendered "10,00 EUR/monthly"
       for a German user. The NOUN form, because the string reads as a rate. */
    const src = read("app/(tabs)/index.tsx");
    expect(src).toMatch(/const cycleLabel = useCycleLabel\(\)/);
    expect(src).toMatch(/cycle: cycleLabel\(sub\.billingCycle\)/);
    expect(/cycle: sub\.billingCycle \}/.test(src)).toBe(false);
  });
});

describe("the weekly spending chart only counts charges that happen", () => {
  /* The panel promises to show "which weeks your subscriptions hit hardest"
     and was drawing a bar for a week where nothing hits. The calendar stopped
     drawing dots for the same projections; this chart kept counting them, so
     one month's money had two answers on two screens. */
  const src = read("app/(tabs)/analytics.tsx");

  it("filters phantom occurrences out of the buckets", () => {
    expect(src).toMatch(/import \{ getOccurrencesInMonth, isPhantomOccurrence \}/);
    expect(src).toMatch(/if \(isPhantomOccurrence\(sub, date, today\)\) continue;/);
  });

  it("holds today in a memo rather than reading it inline", () => {
    // Read inline, the bucket memo takes a new dependency every render.
    expect(src).toMatch(/const today = useMemo\(\(\) => new Date\(\), \[\]\)/);
    expect(src).toMatch(/\}, \[subscriptions, today\]\)/);
  });
});

describe("every icon-only button tells a screen reader what it does", () => {
  /* A TouchableOpacity containing only an icon has no text to announce, so
     TalkBack reads "button" and nothing else. The subscriptions screen had
     three per row, one of which deletes the subscription, and the five review
     stars were indistinguishable from each other, which makes rating
     impossible rather than merely awkward. */
  const glob = (dir) => {
    const out = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".tsx")) out.push(p);
      }
    };
    walk(path.join(__dirname, "..", dir));
    return out;
  };

  const unlabelled = () => {
    const found = [];
    for (const file of [...glob("app"), ...glob("components")]) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!/<(TouchableOpacity|Pressable)\b/.test(lines[i])) continue;
        const buf = [];
        for (let j = i; j < Math.min(lines.length, i + 40); j++) {
          buf.push(lines[j]);
          const chunk = buf.join("\n");
          const opens = (chunk.match(/<(TouchableOpacity|Pressable)\b/g) || []).length;
          const closes = (chunk.match(/<\/(TouchableOpacity|Pressable)>/g) || []).length;
          const selfClosed = (chunk.match(/<(TouchableOpacity|Pressable)\b[^>]*\/>/g) || []).length;
          if (opens > 0 && closes + selfClosed >= opens) break;
        }
        const block = buf.join("\n");
        const hasIcon = block.includes("MaterialCommunityIcons") || block.includes("Ionicons");
        if (hasIcon && !block.includes("<Text") && !block.includes("accessibilityLabel")) {
          found.push(`${path.relative(path.join(__dirname, ".."), file)}:${i + 1}`);
        }
      }
    }
    return found;
  };

  it("finds no icon-only touchable without an accessibilityLabel", () => {
    expect(unlabelled()).toEqual([]);
  });
});

describe("the accessibility strings are real, translated and parity-clean", () => {
  const en = JSON.parse(read("locales/en.json"));
  const de = JSON.parse(read("locales/de.json"));
  const NEW = [
    "common.a11yShowPassword", "common.a11yHidePassword", "common.a11yDismiss",
    "common.a11yBack", "common.a11yPremiumLocked",
    "subscriptions.a11yPause", "subscriptions.a11yResume", "subscriptions.a11yEdit",
    "subscriptions.a11yDelete", "subscriptions.a11yExportReport",
    "subscriptions.a11yExportCalendar",
    "subscriptions.a11yRateStars_one", "subscriptions.a11yRateStars_other",
  ];
  const at = (d, k) => k.split(".").reduce((o, p) => (o == null ? o : o[p]), d);

  it.each(NEW)("%s exists in both languages", (key) => {
    expect(typeof at(en, key)).toBe("string");
    expect(typeof at(de, key)).toBe("string");
  });

  it("no accessibility string was left in English in the German file", () => {
    /* The guard the calendar legend work already needed: copying the English
       across is the cheap way to make a parity check pass while shipping an
       English label to a German user. */
    for (const key of NEW) expect(at(de, key)).not.toBe(at(en, key));
  });

  it("the name and count tokens match across the pair", () => {
    const toks = (s) => (String(s).match(/\{\{(\w+)/g) || []).sort();
    for (const key of NEW) expect(toks(at(de, key))).toEqual(toks(at(en, key)));
  });
});

describe("the controls people tap most clear the 48dp floor", () => {
  /* From a design sweep on 2026-09-22. The script that found these says in its
     own output that it reads SOURCE, not a rendered tree, so it cannot know a
     real dp height: of 15 findings, 12 were real and 3 were false positives (a
     whole subscription card, a full screen modal overlay, a 60dp icon tile).
     They were checked one at a time rather than mass-fixed.

     Only the two with a real consequence are pinned here. The rest were text
     links fixed with hitSlop, which expands the touch area without moving any
     layout, and a hardcoded list of those would go stale the moment somebody
     adds a link. */

  it("the tab bar tab carries its own height floor", () => {
    /* THE PRIMARY NAVIGATION OF THE WHOLE APP, and the subtlest of the set.
       `tab` is flex:1 in a row, so it stretches to the bar's CONTENT box only:
       the bar's paddingTop and the bottom safe-area inset are part of the BAR
       and are not tappable. So the tab was as tall as an icon plus an 11px
       label, under 48, while the bar LOOKED taller than that. A visual height
       is not a touch target. */
    const src = read("components/CustomTabBar.tsx");
    const tab = src.slice(src.indexOf("tab: {"), src.indexOf("}", src.indexOf("tab: {")));
    expect(tab).toMatch(/minHeight:\s*48/);
    // minHeight rather than padding, which the design script says in as many
    // words: padding leaves the height at the mercy of the font.
    expect(tab).not.toMatch(/paddingVertical/);
  });

  it("the calendar day amount is readable, as its own comment demands", () => {
    /* `dayTotal` was fontSize 9 directly under a comment reading "An amount is
       information, not decoration: if it cannot be read it may as well not be
       drawn." The comment was arguing against the code above it.
       The reserved slot has to move WITH it or the amount is clipped, which is
       why calendar-grid-geometry.test.js derives dayMeta from these parts. */
    const src = read("components/MonthCalendarGrid.tsx");
    const block = src.slice(src.indexOf("dayTotal: {"), src.indexOf("}", src.indexOf("dayTotal: {")));
    const size = Number((block.match(/fontSize:\s*(\d+)/) || [])[1]);
    expect(size).toBeGreaterThanOrEqual(12);
  });

  it("the purchase screen states its terms at a readable size", () => {
    /* planSub sits under a price and legalNote carries the subscription terms.
       Both were under the floor on the one screen where a misread costs money.
       The plan BADGE is deliberately left at 9: an uppercase chip is
       decoration, and this test does not pretend otherwise. */
    const src = read("app/upgrade.tsx");
    for (const name of ["planSub", "legalNote"]) {
      const block = src.slice(src.indexOf(`${name}: {`), src.indexOf("}", src.indexOf(`${name}: {`)));
      const size = Number((block.match(/fontSize:\s*(\d+)/) || [])[1]);
      expect(size).toBeGreaterThanOrEqual(12);
    }
  });
});
