/* The calendar dots say WHAT, and now also say what they mean.
 *
 * The grid draws up to three category colours per day, and until this legend
 * the colours were the only carrier of that meaning anywhere on the screen.
 * Tapping a day lists its subscriptions but never names the colour it just
 * drew, so the mapping could only be inferred one day at a time, by somebody
 * who thought to try. Eleven categories, five-pixel dots, no key.
 *
 * WHAT THIS PINS, in order of how expensive it is to get wrong:
 *
 * 1. The legend is keyed by the CANONICAL category, the one whose colour is
 *    actually drawn. getCategoryIcon resolves every unrecognised name to one
 *    grey, so a legend built from raw category names lists "gaming" and
 *    "books" as two entries against a single dot, naming a distinction the
 *    grid does not draw. This is the same defect as the a11y renewal count
 *    that read markedDates (deduplicated by colour) instead of the real
 *    occurrences, and it fails the same way: invisible to anyone who can see
 *    the dots, wrong for the person reading the words.
 *
 * 2. Its colours are exactly the colours on screen this month. A key that
 *    lists absent categories, or omits a present one, is worse than none.
 *
 * 3. The names are translated. Category names have never been localised
 *    anywhere in this app, which was survivable while the name only labelled
 *    something already identifiable. In a legend the name IS the content, and
 *    "Entertainment" beside a purple dot in a German app says the colour is a
 *    guess.
 */

const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|\/\/[^\n]*/g, "");

const { canonicalCategory } = require("../lib/category-label");
const { getCategoryIcon, CATEGORY_ICON, DEFAULT_CATEGORIES } = require("../lib/categories");

const SCREEN = strip(read("app/(tabs)/calendar.tsx"));
const GRID = strip(read("components/MonthCalendarGrid.tsx"));
const EN = JSON.parse(read("locales/en.json"));
const DE = JSON.parse(read("locales/de.json"));

/* What the grid DRAWS beside what the legend SAYS. drawnColors is the screen's
 * markedDates rule verbatim; legendColors MIRRORS the screen's legend memo,
 * because a memo inside a component cannot be mounted here. Both call the real
 * getCategoryIcon and the real canonicalCategory, so the resolution being
 * checked is the shipped one, and the source-reading test below is what ties
 * the screen to this mirror rather than letting the two drift apart. */
const drawnColors = (subs) => [...new Set(subs.map((s) => getCategoryIcon(s.category).color))];
const legendColors = (subs) => {
  const counts = new Map();
  for (const sub of subs) {
    const cat = canonicalCategory(sub.category);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([cat]) => getCategoryIcon(cat).color);
};

describe("the legend names exactly the colours the grid draws", () => {
  it("collapses every custom category onto the one grey the dots use", () => {
    /* THE assertion in this file. Two custom categories are two names and one
       dot, so they must be one legend entry. */
    const day = [{ category: "gaming" }, { category: "books" }, { category: "streaming" }];
    expect(drawnColors(day).length).toBe(2);
    expect(legendColors(day).length).toBe(2);
    expect(new Set(legendColors(day))).toEqual(new Set(drawnColors(day)));
    expect(legendColors(day)).toContain(CATEGORY_ICON.other.color);
  });

  it("agrees with the grid across every built-in category", () => {
    const subs = DEFAULT_CATEGORIES.map((category) => ({ category }));
    expect(new Set(legendColors(subs))).toEqual(new Set(drawnColors(subs)));
    expect(legendColors(subs).length).toBe(DEFAULT_CATEGORIES.length);
  });

  it("lists a colour once however many renewals carry it", () => {
    const subs = [{ category: "streaming" }, { category: "streaming" }, { category: "streaming" }];
    expect(legendColors(subs)).toEqual([CATEGORY_ICON.streaming.color]);
  });

  it("orders by how many renewals a category has, then by name", () => {
    // The colour a reader meets most often is the first one they read.
    const subs = [
      { category: "software" },
      { category: "streaming" }, { category: "streaming" },
      { category: "health" },
    ];
    expect(legendColors(subs)).toEqual([
      CATEGORY_ICON.streaming.color, // 2
      CATEGORY_ICON.health.color,    // 1, "Health" before "Software"
      CATEGORY_ICON.software.color,
    ]);
  });

  it("is empty for a month with nothing in it", () => {
    expect(legendColors([])).toEqual([]);
  });

  it("no two categories share a colour, which is what makes the colour the key", () => {
    /* The legend keys its rows on the colour, because the colour is the thing
       being explained. Two categories sharing one would collide as a React key
       AND be undecodable on the grid, so the palette's distinctness is load
       bearing in a second place now. */
    const colors = DEFAULT_CATEGORIES.map((cat) => CATEGORY_ICON[cat].color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe("the screen builds it from what is drawn", () => {
  it("derives from occurrencesByDay, not from markedDates", () => {
    /* markedDates is deduplicated by colour, so counting off it would order
       the legend by number of COLOURS rather than number of renewals. Same
       trap as renewalCounts and dayTotals, which both say so in their own
       comments. */
    const memo = SCREEN.slice(SCREEN.indexOf("const legend = useMemo"));
    const body = memo.slice(0, memo.indexOf("}, ["));
    expect(body).toMatch(/occurrencesByDay/);
    expect(body).not.toMatch(/markedDates/);
  });

  it("canonicalises before counting", () => {
    const memo = SCREEN.slice(SCREEN.indexOf("const legend = useMemo"));
    expect(memo.slice(0, memo.indexOf("}, ["))).toMatch(/canonicalCategory\(sub\.category\)/);
  });

  it("recomputes when the month does", () => {
    const memo = SCREEN.slice(SCREEN.indexOf("const legend = useMemo"));
    // occurrencesByDay already depends on month, so this is the whole chain.
    expect(memo.slice(memo.indexOf("}, ["))).toMatch(/\[occurrencesByDay/);
  });

  it("hands the grid finished strings", () => {
    // The grid renders a colour and a name. It must never learn what a
    // category is, which is what lets it take a plain colour list at all.
    expect(SCREEN).toMatch(/legend=\{legend\}/);
    expect(GRID).not.toMatch(/getCategoryIcon|categoryLabel|CATEGORY_ICON/);
  });
});

describe("the grid renders it without leaving furniture behind", () => {
  it("draws nothing at all when there is nothing to decode", () => {
    // A rule and a gap under a month with no renewals is furniture.
    expect(GRID).toMatch(/legend && legend\.length > 0 &&/);
  });

  it("speaks as one thing rather than eleven unexplained words", () => {
    /* A screen reader meeting eleven separate "Streaming", "Software" nodes
       with no dot it can see gets a word list. One labelled container says
       what the list IS. */
    expect(GRID).toMatch(/accessibilityLabel=\{t\("calendar\.a11yLegend"/);
    expect(GRID).toMatch(/importantForAccessibility="no-hide-descendants"/);
  });

  it("keeps the name legible rather than borrowing contrast from the dot", () => {
    /* At 11px this is among the smallest type in the app. textMuted measures
       2.98:1 on the light card, under the 4.5:1 floor, which is exactly the
       reasoning already recorded for the day amount two styles above it. */
    const style = /legendName: \{([^}]*)\}/.exec(GRID);
    expect(style).not.toBe(null);
    expect(style[1]).toMatch(/color: c\.text\b/);
    expect(style[1]).not.toMatch(/textMuted|primary|accent/);
  });
});

describe("the names are translated, and that is not cosmetic", () => {
  it("both files carry a name for every built-in category", () => {
    for (const file of [EN, DE]) {
      expect(Object.keys(file.categoryNames).sort()).toEqual([...DEFAULT_CATEGORIES].sort());
    }
  });

  it("the German is German, not the English copied across", () => {
    /* The check that actually bites. Streaming, Software and Fitness are the
       same word in both languages, so a half-done translation looks complete
       until you read the ones that are not. */
    for (const cat of ["entertainment", "health", "education", "utilities", "insurance", "memberships", "other", "food"]) {
      expect(DE.categoryNames[cat]).not.toBe(EN.categoryNames[cat]);
    }
  });

  it("every name is a single capitalised noun, so the capitalize transform is a no-op", () => {
    /* legendName carries textTransform: "capitalize" for the sake of a custom
       category, which arrives exactly as the user typed it. That is only safe
       while no built-in name is a phrase: "This Is A Free Trial" is already on
       record here as what the transform does to a sentence. */
    for (const file of [EN, DE]) {
      for (const name of Object.values(file.categoryNames)) {
        expect(name).toMatch(/^[A-ZÄÖÜ][^\s]*$/);
      }
    }
  });

  it("the spoken label exists in both languages, with no dash", () => {
    for (const file of [EN, DE]) {
      const s = file.calendar.a11yLegend;
      expect(typeof s).toBe("string");
      expect(s).toMatch(/\{\{categories\}\}/);
      expect(s.match(/—|–|\S\s+-\s+\S/)).toBeNull();
    }
  });

  it("a custom category keeps the user's own word", () => {
    // Only the built-ins are translated. A user who typed "gaming" gets
    // "gaming" back, capitalised by the style like every other surface.
    const KEYS = /const KEYS: Record<string, string> = \{([^}]*)\}/.exec(read("lib/category-label.ts"));
    expect(KEYS).not.toBe(null);
    for (const cat of DEFAULT_CATEGORIES) expect(KEYS[1]).toMatch(new RegExp(`\\b${cat}:`));
    expect(strip(read("lib/category-label.ts"))).toMatch(/return key \? t\(key\) : raw;/);
  });
});
