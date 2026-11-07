/* The purchase screen, redone 2026-11-07. Its false claims were fixed first,
   on their own, and are pinned in paywall-claims.test.js. These pin the
   redesign:
   - the coffee line and its "pays for itself" are gone with the hook card;
   - yearly leads, the owner's call, and nothing calls lifetime "best value";
   - a chosen plan is ink, never white on primary (4.02:1 in dark mode);
   - the table's ticks and dashes are spoken, not read out as "em dash". */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RAW = fs.readFileSync(path.join(ROOT, "app", "upgrade.tsx"), "utf8");
const SRC = RAW.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const locale = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, "locales", `${l}.json`), "utf8")).upgrade;
const en = locale("en");
const de = locale("de");

function styleBody(name) {
  const at = SRC.indexOf(`    ${name}: {`, SRC.indexOf("function makeStyles"));
  if (at < 0) throw new Error(`no style ${name}`);
  let depth = 0;
  for (let j = SRC.indexOf("{", at); j < SRC.length; j++) {
    if (SRC[j] === "{") depth++;
    else if (SRC[j] === "}" && --depth === 0) return SRC.slice(at, j + 1);
  }
  throw new Error(`unclosed ${name}`);
}

describe("the purchase screen's plans and copy", () => {
  it("strips comments before reading, so prose cannot satisfy an assertion", () => {
    expect(SRC.length).toBeLessThan(RAW.length);
  });

  it("makes no claim it cannot back", () => {
    for (const l of [en, de]) {
      expect(l.costNote).toBeUndefined();
      expect(l.bestValue).toBeUndefined();
    }
    expect(SRC).not.toContain("bestValue");
  });

  it("leads with the yearly plan", () => {
    const plans = SRC.slice(SRC.indexOf("const PLANS"), SRC.indexOf("];", SRC.indexOf("const PLANS")));
    expect(plans.indexOf('key: "yearly"')).toBeGreaterThan(-1);
    expect(plans.indexOf('key: "yearly"')).toBeLessThan(plans.indexOf('key: "monthly"'));
    expect(SRC).toContain('useState<PlanKey>("yearly")');
  });
});

describe("the purchase screen's layout", () => {
  it("draws no off-palette colour and no hero block", () => {
    expect(SRC).not.toMatch(/#FCD34D/i);
    expect(SRC).not.toContain("styles.hero");
  });

  it("marks the chosen plan in ink, as a radio the screen reader can read", () => {
    expect(styleBody("planOn")).toContain("c.text");
    expect(styleBody("planOn")).not.toContain("c.primary");
    expect(SRC).toContain('accessibilityRole="radiogroup"');
    expect(SRC).toContain('accessibilityRole="radio"');
    expect(SRC).toContain("accessibilityState={{ selected: active }}");
  });

  it("speaks the table's ticks and dashes", () => {
    expect(SRC).toContain('accessibilityLabel={v ? t("upgrade.included") : t("upgrade.notIncluded")}');
    for (const l of [en, de]) {
      expect(l.included).toBeTruthy();
      expect(l.notIncluded).toBeTruthy();
    }
    expect(SRC).not.toMatch(/free: "—"/);
  });

  it("keeps every size on the scale, nothing under 13", () => {
    const styles = SRC.slice(SRC.indexOf("function makeStyles"));
    expect(styles).not.toMatch(/fontSize: (\d|1[012])\b/);
  });

  it("fits every table label in its column: no word over 20 letters", () => {
    /* "E-Mail-Verlängerungserinnerungen" is one 32 letter word. It cannot wrap,
       so it pushed its row's tick and dash out of line in the German render. */
    for (const l of [en, de]) {
      for (const [k, v] of Object.entries(l).filter(([k]) => k.startsWith("feat_"))) {
        const longest = Math.max(...String(v).split(/[\s-]+/).map((w) => w.length));
        expect([k, longest <= 20]).toEqual([k, true]);
      }
    }
  });

  it("gives restore a full touch target", () => {
    expect(styleBody("restoreButton")).toMatch(/minHeight: 48/);
  });
});
