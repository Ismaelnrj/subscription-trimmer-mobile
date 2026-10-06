/**
 * THE DASHBOARD A NEW USER LANDS ON IS IN THEIR LANGUAGE.
 *
 * Found 2026-10-06 walking the first session after signup. Every free user saw
 * a Premium card titled "Budget Goal & Progress Bar" in English, German or not,
 * and the onboarding estimate banner ("You guessed 5. You actually have 3
 * recurring expenses.") was English JSX with a hand-built plural, while both
 * locales already carried the German for each. The Premium budget card also
 * said "of <amount>" in English.
 *
 * None of these is a t() call, a locale key or a template literal, which is why
 * the locale scans never saw them: a JSX attribute string and JSX text.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const DASH = fs.readFileSync(path.join(root, 'app', '(tabs)', 'index.tsx'), 'utf8');
const en = JSON.parse(fs.readFileSync(path.join(root, 'locales', 'en.json'), 'utf8')).dashboard;
const de = JSON.parse(fs.readFileSync(path.join(root, 'locales', 'de.json'), 'utf8')).dashboard;
const tokens = (s) => (s.match(/\{\{\w+\}\}/g) || []).sort();

describe('the first screen after signup', () => {
  it('the free Premium card reads its copy from the locale', () => {
    expect(DASH).not.toContain('Budget Goal & Progress Bar');
    expect(DASH).not.toMatch(/description="Set a monthly spending limit/);
    expect(DASH).toContain('title={t("accountSettings.premiumBudgetTitle")}');
  });

  it('the estimate banner is translated and pluralised by i18next', () => {
    expect(DASH).not.toMatch(/You guessed \{/);
    expect(DASH).not.toMatch(/recurring expense\s*\{/);
    expect(DASH).toMatch(/t\("dashboard\.youGuessed", \{[^}]*count: estimateBanner\.actual/);
  });

  it('the budget card says "of" in the reader\'s language', () => {
    expect(DASH).not.toMatch(/>of \{fmtC/);
    expect(DASH).toContain('t("dashboard.budgetOf", { amount: fmtC(budgetGoal) })');
  });

  it('both locales carry the keys with the same tokens, in the _one/_other form the app uses', () => {
    for (const k of ['youGuessed_one', 'youGuessed_other', 'budgetOf']) {
      expect(typeof en[k]).toBe('string');
      expect(typeof de[k]).toBe('string');
      expect(tokens(de[k])).toEqual(tokens(en[k]));
    }
    expect(en.youGuessed).toBeUndefined();
    expect(de.youGuessed).toBeUndefined();
  });
});
