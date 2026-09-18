/* settings.update is a PARTIAL update, and this pins that.

   It used to be partial for three columns and a full replace for budget_goal,
   sitting in the same statement. That asymmetry reads as deliberate, which is
   why it survived: COALESCE on three lines and a bare assignment on the fourth
   looks like someone meant it.

   The consequence was silent. Any caller saving a DIFFERENT setting had to
   resend budgetGoal or lose it, so both callers passed
   `settings?.budgetGoal ?? null`, which is null until the settings query
   resolves. Changing your currency, or adding a custom category, before that
   first load landed wiped the budget goal and reset the currency to USD. No
   error anywhere: the write succeeded, it just wrote defaults. */

const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const SERVER = read("backend/server.js");

const HANDLER = (() => {
  const start = SERVER.indexOf("app.post('/api/trpc/settings.update'");
  if (start === -1) throw new Error("settings.update not found");
  const rest = SERVER.slice(start + 1);
  const next = rest.search(/\napp\.(get|post|put|delete|use)\(/);
  return next === -1 ? rest : rest.slice(0, next);
})();

describe("settings.update leaves absent fields alone", () => {
  it("decides on the KEY, not on the value", () => {
    /* Presence of the key is the only way to tell "do not touch this" from
       "clear it". A value test cannot: null means both. */
    expect(HANDLER).toMatch(/hasOwnProperty\.call\(req\.body, 'budgetGoal'\)/);
  });

  it("no longer assigns budget_goal unconditionally", () => {
    // The defect, exactly: `SET budget_goal = $1,` with no guard.
    expect(HANDLER).not.toMatch(/SET budget_goal = \$1,/);
  });

  it("guards the budget_goal write", () => {
    expect(HANDLER).toMatch(/budget_goal = CASE WHEN/);
  });

  it("preserves currency when it is not supplied", () => {
    /* This one reset a euro subscriber to USD, which is worse than it sounds:
       the currency decides what every stored price is interpreted as, so the
       numbers stay and their meaning changes. */
    expect(HANDLER).toMatch(/currency = COALESCE\(/);
    expect(HANDLER).toMatch(/currency_symbol = COALESCE\(/);
    expect(HANDLER).not.toMatch(/currency \|\| 'USD'/);
    expect(HANDLER).not.toMatch(/currencySymbol \|\| '\$'/);
  });

  it("still preserves the two fields that were already correct", () => {
    expect(HANDLER).toMatch(/custom_categories = COALESCE\(/);
    expect(HANDLER).toMatch(/alert_threshold = COALESCE\(/);
  });

  it("still validates a supplied budgetGoal", () => {
    // Preserving on absence must not become accepting anything on presence.
    expect(HANDLER).toMatch(/budgetGoal must be a positive number or null/);
  });
});

describe("no caller resends a field it is not editing", () => {
  /* The rule that keeps the fix working. Resending a neighbouring field to
     "protect" it is what caused this, and it is an easy thing to add back while
     fixing something unrelated. */

  it("the alert threshold save sends no budgetGoal", () => {
    const src = read("app/account-settings.tsx");
    const fn = src.slice(src.indexOf("const handleSaveAlertThreshold"), src.indexOf("const handleSelectCurrency"));
    expect(fn).toMatch(/alertThreshold: threshold/);
    expect(fn).not.toMatch(/budgetGoal/);
  });

  it("the currency picker sends no budgetGoal", () => {
    const src = read("app/account-settings.tsx");
    const fn = src.slice(src.indexOf("const handleSelectCurrency"), src.indexOf("return ("));
    expect(fn).toMatch(/currency: cur\.code/);
    expect(fn).not.toMatch(/budgetGoal/);
  });

  it("the category save sends ONLY the categories", () => {
    const src = read("app/(tabs)/subscriptions.tsx");
    const fn = src.slice(src.indexOf("const settingsMutation"), src.indexOf("const createMutation"));
    const call = fn.slice(fn.indexOf('apiClient.post("/trpc/settings.update"'));
    expect(call).toMatch(/customCategories: cats/);
    expect(call).not.toMatch(/budgetGoal/);
    expect(call).not.toMatch(/currency/);
  });

  it("a failed settings load does not look like having no settings", () => {
    /* The budget field stays empty, the "current goal" line is conditional on
       the value so it hides, and the clear button goes with it. Somebody with a
       50 euro budget on a dropped connection saw exactly what somebody with no
       budget saw, with nothing indicating a failure. Same shape as the
       subscriptions.tsx defect from the 2026-09-12 review. */
    const src = read("app/account-settings.tsx");
    expect(src).toMatch(/isError:\s*settingsError/);
    expect(src).toMatch(/settingsError\s*&&/);
    expect(src).toMatch(/accountSettings\.couldntLoad/);
  });

  it("that warning is announced to a screen reader", () => {
    expect(read("app/account-settings.tsx")).toMatch(/accessibilityRole="alert"/);
  });

  it("saving the budget itself still sends it, including an explicit null", () => {
    /* The other half of the contract. Clearing a budget goal is a real action
       and has to keep working, which is why absence and null cannot mean the
       same thing. */
    const src = read("app/account-settings.tsx");
    const save = src.slice(src.indexOf("const handleSaveBudget"), src.indexOf("/* Neither of these"));
    expect(save).toMatch(/budgetGoal: goal/);
    expect(src).toMatch(/settingsMutation\.mutate\(\{ budgetGoal: null/);
  });
});
