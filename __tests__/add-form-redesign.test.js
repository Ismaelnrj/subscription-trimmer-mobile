/* The add form, redone 2026-11-07 on the dashboard's scale. These pin the
   parts that were measured rather than chosen, so a later tidy cannot quietly
   undo them:
   - a field needs a label that stays visible and is spoken: a placeholder
     disappears the moment somebody types, which is when they check what the
     field was;
   - the chosen billing cycle is ink, like the chosen category, never white
     on primary, which is 4.02:1 in dark mode, under the text floor;
   - the trial is a switch, a yes or no, not a chip that reads like a filter;
   - the copy says subscription, the word the rest of the app uses, rather
     than "Expense", which made the form sound like a budgeting app. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RAW = fs.readFileSync(path.join(ROOT, "app", "(tabs)", "subscriptions.tsx"), "utf8");
const SUBS = RAW.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const en = JSON.parse(fs.readFileSync(path.join(ROOT, "locales", "en.json"), "utf8")).subscriptions;
const de = JSON.parse(fs.readFileSync(path.join(ROOT, "locales", "de.json"), "utf8")).subscriptions;

function styleBody(name) {
  const at = SUBS.indexOf(`    ${name}: {`, SUBS.indexOf("function makeStyles"));
  if (at < 0) throw new Error(`no style ${name}`);
  let i = SUBS.indexOf("{", at), depth = 0;
  for (let j = i; j < SUBS.length; j++) {
    if (SUBS[j] === "{") depth++;
    else if (SUBS[j] === "}" && --depth === 0) return SUBS.slice(i, j + 1);
  }
  throw new Error(`unclosed style ${name}`);
}

describe("the add form", () => {
  it("strips comments before reading, so prose cannot satisfy an assertion", () => {
    expect(SUBS.length).toBeLessThan(RAW.length);
  });

  it("labels the name and price fields with visible, spoken labels", () => {
    expect(SUBS).toContain('<Text style={styles.label}>{t("subscriptions.nameLabel")}</Text>');
    expect(SUBS).toContain('<Text style={styles.label}>{t("subscriptions.priceLabel")}</Text>');
    expect(SUBS).toContain('accessibilityLabel={t("subscriptions.nameLabel")}');
    expect(SUBS).toContain('accessibilityLabel={t("subscriptions.priceLabel")}');
    for (const l of [en, de]) {
      expect(l.nameLabel).toBeTruthy();
      expect(l.priceLabel).toBeTruthy();
    }
  });

  it("shows the price's currency beside the field instead of inside a placeholder", () => {
    expect(SUBS).toContain("<Text style={styles.priceCurrency}>{baseCurrencyCode}</Text>");
    expect(en.pricePlaceholder).not.toMatch(/\{\{currency\}\}/);
    expect(de.pricePlaceholder).not.toMatch(/\{\{currency\}\}/);
  });

  it("chooses a billing cycle in a segmented control with no white text on primary", () => {
    expect(SUBS).toMatch(/accessibilityRole="radiogroup"/);
    expect(SUBS).toMatch(/accessibilityState=\{\{ selected: on \}\}/);
    expect(styleBody("segmentOn")).toContain("c.text");
    expect(styleBody("segmentOn")).not.toContain("c.primary");
    expect(styleBody("segmentTextOn")).toContain("c.bg");
    expect(styleBody("segmentTextOn")).not.toMatch(/#fff/i);
  });

  it("asks about the trial with a switch whose off state is visible", () => {
    expect(SUBS).toMatch(/<Switch[\s\S]{0,200}value=\{!!formData\.isFreeTrial\}/);
    expect(SUBS).not.toContain("styles.trialToggle");
    // c.border as the off track measured 1.31:1 on the card: a switch nobody can see is off.
    expect(SUBS).toContain("trackColor={{ false: c.textSecondary, true: c.success }}");
  });

  it("marks the chosen category by inverting it, not with white on primary", () => {
    expect(styleBody("chipActive")).toContain("c.text");
    expect(styleBody("chipTextActive")).toContain("c.bg");
  });

  it("offers six quick picks, two full rows of three", () => {
    expect(SUBS).toContain("marksFirst(getRegionalPopularTemplates(preferDach)).slice(0, 6)");
    expect(styleBody("quickPickLabel")).toContain("typeScale.caption");
    // A fixed 31.8% plus two 8dp gaps came to just over 100% and wrapped two per row.
    expect(styleBody("quickPickItem")).toMatch(/flexBasis: "30%", flexGrow: 1/);
  });

  it("calls the thing a subscription in both languages", () => {
    for (const k of ["addExpenseTitle", "editExpenseTitle", "addExpense"]) {
      expect(en[k]).not.toMatch(/expense/i);
      expect(de[k]).not.toMatch(/ausgabe/i);
      expect(en[k]).not.toMatch(/^\+/);
      expect(de[k]).not.toMatch(/^\+/);
    }
  });

  it("keeps every form type size on the scale, at 13 or more", () => {
    for (const name of ["label", "templateSectionLabel", "templateChipName", "templateChipPrice", "quickPickLabel", "emailPasteLabel"]) {
      expect(styleBody(name)).not.toMatch(/fontSize: (\d|1[012])\b/);
    }
  });
});
