/* A price is a number with a unit, and this table could not store the unit.
 *
 * `subscriptions.price` was a bare NUMERIC. The currency lived in ONE global
 * `baseCurrencyCode` in the client's SecureStore, which `setCurrency` ties to
 * the DISPLAY currency. So the stored number never changed and its MEANING
 * followed whatever the person last picked.
 *
 * Measured against the real lib/currency-store.ts before this was written: a
 * 15.99 EUR subscription displays as 15.99 USD after switching to dollars,
 * where a true conversion is 17.38. And a row entered in dollars, read while
 * the app is in euros, is wrong in the other direction. Two currencies could
 * never coexist, because one global base described every row.
 *
 * THE RULE WORTH THE MOST HERE is that an existing row's currency moves only
 * when the PRICE moves. The edit form seeds every field from the stored row
 * and posts them all back, so renaming Netflix resubmits an unchanged price.
 * If the currency followed the app's current display currency on every save,
 * editing a NAME while the app happened to be in dollars would relabel a euro
 * price as dollars. That is not hypothetical: billing_anchor_day shipped with
 * exactly that bug and had to be fixed within hours.
 */

const fs = require("fs");
const path = require("path");

const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
const SERVER = read("backend", "server.js");
const SCREEN = read("app", "(tabs)", "subscriptions.tsx");

/** A brace-matched block starting at the first `{` after `token`.
 *
 *  NOT a plain brace counter, and the first draft of this file was one. Every
 *  `${...}` inside a template literal carries a `}` that decrements the depth,
 *  so a naive counter ends the handler early and then matches whatever follows
 *  it. It also must skip COMMENTS: the first version reported the hardcoded
 *  dollar sign as still present when the only surviving copy was inside the
 *  comment explaining that it had been removed. A checker that reads
 *  documentation as code reports a fixed defect as live, which is the mirror
 *  of the silent pass this repo keeps recording.
 *
 *  So this walks the source skipping string literals, template literals and
 *  both comment forms, and counts only braces that are really code. */
function block(src, token) {
  const at = src.indexOf(token);
  if (at === -1) return "";
  const open = src.indexOf("{", at);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); if (i === -1) break; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i); if (i === -1) break; i++; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) { if (src[i] === "\\") i++; i++; }
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return src.slice(at, i + 1);
  }
  return "";
}

const createHandler = block(SERVER, "'/api/trpc/subscriptions.create'");
const updateHandler = block(SERVER, "'/api/trpc/subscriptions.update'");

describe("the column exists and is backfilled once", () => {
  it("adds subscriptions.currency", () => {
    expect(SERVER).toMatch(/ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency TEXT/);
  });

  it("backfills only rows where it is NULL, so it can never overwrite a real value", () => {
    // The guess is made ONCE, at migration time. Without the NULL guard a
    // redeploy would relabel every row with the user's CURRENT currency, which
    // is the corruption this column exists to prevent.
    expect(SERVER).toMatch(/UPDATE subscriptions s[\s\S]{0,200}?AND s\.currency IS NULL/);
  });

  it("gives a user with no settings row an honest default rather than null", () => {
    expect(SERVER).toMatch(/UPDATE subscriptions SET currency = 'USD' WHERE currency IS NULL/);
  });

  it("runs the backfill AFTER user_settings exists", () => {
    /* The backfill JOINs user_settings. The first draft of this change ran it
       beside the ALTER, which is ~50 lines BEFORE that table is created, so on
       a FRESH database initDB threw `relation "user_settings" does not exist`
       and the service never finished booting. It worked fine on production,
       where the table already existed, so it would have shipped green and
       broken only the next new environment. Ordering is the whole assertion. */
    const settingsAt = SERVER.indexOf("CREATE TABLE IF NOT EXISTS user_settings");
    const backfillAt = SERVER.indexOf("UPDATE subscriptions s");
    expect(settingsAt).toBeGreaterThan(0);
    expect(backfillAt).toBeGreaterThan(settingsAt);
  });
});

describe("what gets stored on create", () => {
  it("writes the currency alongside the price", () => {
    expect(createHandler).toMatch(/INSERT INTO subscriptions[^']*currency/);
  });

  it("resolves it rather than trusting the body", () => {
    // An unknown code is a client bug, not a user action, so it must not reach
    // the column. resolveCurrency falls back to the user's settings currency.
    expect(createHandler).toMatch(/resolveCurrency\(req\.userId, req\.body\.currency\)/);
  });

  it("no longer stamps a dollar sign on every notification", () => {
    // It told a euro subscriber their price was in dollars, in their own
    // notification list. Same defect class as the missing column.
    // Scoped to the INSERT rather than the whole handler, because the comment
    // above that line quotes the old form on purpose and a file-wide search
    // matches the explanation instead of the code.
    const insert = SERVER.slice(SERVER.indexOf("'Subscription Added'") - 200,
                                SERVER.indexOf("'Subscription Added'") + 200);
    expect(insert).toMatch(/\$\{currency\} \$\{price\}/);
    expect(insert).not.toMatch(/\(\$\$\{price\}/);
  });
});

describe("what happens on update, which is where the trap is", () => {
  it("only moves the currency when the price actually changed", () => {
    expect(updateHandler).toMatch(/priceChanged/);
    expect(updateHandler).toMatch(/const priceChanged = [^\n]*existing\.price[^\n]*!==\s*price/);
  });

  it("keeps the stored currency when the price is unchanged", () => {
    // The whole point: editing a name must not relabel the price.
    expect(updateHandler).toMatch(/priceChanged\s*\?[\s\S]{0,120}?existing\.currency/);
  });

  it("persists it in the UPDATE statement", () => {
    expect(updateHandler).toMatch(/UPDATE subscriptions SET[^']*currency = \$8/);
  });
});

describe("the client sends what it knows", () => {
  it("puts the entry currency in the create and update payload", () => {
    expect(SCREEN).toMatch(/currency: baseCurrencyCode/);
  });

  it("tags the sample subscriptions USD, since those are the US figures", () => {
    // Sending the display currency would assert 15.99 is 15.99 in euros, which
    // is the same error the column exists to stop, made by the sample data.
    const examples = SCREEN.slice(SCREEN.indexOf("const examples = ["));
    expect(examples.slice(0, 700)).toMatch(/Netflix[^}]*currency: "USD"/);
  });
});

describe("the API hands the currency back", () => {
  it("formatSub returns it", () => {
    expect(block(SERVER, "function formatSub")).toMatch(/currency: s\.currency \|\| null/);
  });

  it("returns null rather than inventing a default for a pre-migration row", () => {
    // A reader must handle absent. Defaulting here would hide whether the
    // backfill ran at all.
    expect(block(SERVER, "function formatSub")).not.toMatch(/currency: s\.currency \|\| ['"]USD['"]/);
  });
});

/* ---- stage two: the display converts from the ROW's currency ---- */

const STORE = read("lib", "currency-store.ts");

describe("conversion reads the row's currency, not one global base", () => {
  it("convert takes an optional source currency", () => {
    expect(STORE).toMatch(/convert:\s*\(amount: number, fromCurrency\?: string \| null\)/);
  });

  it("the source currency wins over the global base", () => {
    expect(STORE).toMatch(/const from = String\(fromCurrency \|\| baseCurrencyCode\)\.toUpperCase\(\)/);
  });

  it("rates are looked up by that currency rather than the base", () => {
    // The bug in miniature: reading rates[baseCurrencyCode] here is what made
    // every row share one unit no matter what it was entered in.
    expect(STORE).toMatch(/const baseRate = rates\[from\]/);
    expect(STORE).not.toMatch(/const baseRate = rates\[baseCurrencyCode\]/);
  });

  it("falls back to the global base for a row with no currency", () => {
    // Pre-migration rows must keep the OLD behaviour rather than get a guess.
    expect(STORE).toMatch(/fromCurrency \|\| baseCurrencyCode/);
  });
});

describe("a row is shown in its own currency, never converted", () => {
  /* Regional pricing is set by the provider, not by an exchange rate. Netflix
     Standard is 15.99 EUR in DACH and 19.99 USD in the US, and neither figure
     is a conversion of the other, so a euro row rendered in a dollar-displaying
     app as ~$17.38 names an amount that will appear on nobody's statement.
     Measured against the real store before and after:

       row  Netflix 15.99 EUR, app in USD   ~$17.38  ->  EUR15.99
       row  Spotify  9.99 USD, app in EUR   ~EUR9.19 ->  $9.99
       agg  monthly total (base EUR)        ~$41.28  ->  ~$41.28  unchanged
       row  legacy row with no currency     ~$13.04  ->  ~$13.04  unchanged  */

  it("renders a named currency with that currency's own symbol", () => {
    expect(STORE).toMatch(/const own = CURRENCIES\.find\(x => x\.code === code\)/);
    expect(STORE).toMatch(/return `\$\{own\.symbol\}\$\{roundTo\(amount, d\)\.toFixed\(d\)\}`/);
  });

  it("returns the stored amount untouched for a named currency", () => {
    // `convert` must not appear inside the row branch: converting there IS the
    // defect. The branch formats `amount`, which is the number as entered.
    const fn = STORE.slice(STORE.indexOf("export function useFmt"));
    const rowBranch = fn.slice(fn.indexOf("if (fromCurrency)"), fn.indexOf("const from = String(baseCurrencyCode)"));
    expect(rowBranch).not.toMatch(/convert\(/);
    expect(rowBranch).toMatch(/roundTo\(amount,/);
  });

  it("carries no tilde on a row, because an exact figure is not an estimate", () => {
    /* THE COMMENTS MUST COME OUT FIRST, and the first draft of this assertion
       did not do it and failed against correct code. The branch explains
       itself by quoting the very figure it exists to stop printing, `~$17.38`,
       so a raw substring search finds a tilde in prose and reports the fix as
       the defect. Same shape as the four regex lessons already on record: what
       a comment SAYS is not what the code DOES. Only block comments are
       stripped, deliberately, because stripping `//` to end of line would eat
       a `//` inside a URL, which has already caused a false failure here. */
    const fn = STORE.slice(STORE.indexOf("export function useFmt"));
    const rowBranch = fn.slice(fn.indexOf("if (fromCurrency)"), fn.indexOf("const from = String(baseCurrencyCode)"));
    const code = rowBranch.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toContain("~");
    // and prove the stripping actually removed something, so a future change
    // that drops the comment cannot make this pass vacuously.
    expect(code.length).toBeLessThan(rowBranch.length);
  });

  it("an unrecognised code falls through rather than inventing a symbol", () => {
    // The server validates against the same nine codes, so this is a guard.
    // Rendering an unknown code with the DISPLAY symbol would mislabel it.
    const fn = STORE.slice(STORE.indexOf("export function useFmt"));
    expect(fn).toMatch(/if \(own\) \{/);
  });
});

describe("an aggregate still converts, and still says it is an estimate", () => {
  it("useFmt prefixes a tilde when the base and display currencies differ", () => {
    expect(STORE).toMatch(/return from === currency\.code \? text : `~\$\{text\}`/);
  });

  it("decides from the codes, not from whether the number changed", () => {
    // A conversion can coincidentally return the same figure and it is still an
    // estimate, so comparing amounts would under-report.
    expect(STORE).not.toMatch(/converted !== amount \? `~/);
  });

  it("the aggregate branch converts from the global base", () => {
    // Passing no source currency is the signal that this is a sum, already
    // expressed in the user's base currency.
    expect(STORE).toMatch(/const converted = convert\(amount, null\)/);
  });

  it("a sum is still added before it is converted, and that is recorded", () => {
    /* The known remaining gap. Totals add RAW numbers and convert once, which
       is exact while a user's rows share one currency and wrong the moment
       they do not. It must stay written down rather than be discovered. */
    expect(STORE).toMatch(/WHAT THIS DOES NOT FIX YET/);
  });
});

describe("a derived per-row figure carries its row's currency too", () => {
  /* The stage two scan below catches a bare `fmtC(sub.price)`. It cannot catch
     an amount COMPUTED from one row and then formatted, which is how two sites
     in insights.tsx were left reading the display currency: the price increase
     sentence would have said "from EUR15.99 to EUR17.99, costing you $26.06
     more per year", mixing two currencies inside one sentence. */
  const INSIGHTS = read("app", "insights.tsx");

  it("the price increase names its extra in the row's currency", () => {
    expect(INSIGHTS).toMatch(/extra: fmtC\(annualExtra, s\.currency\)/);
    expect(INSIGHTS).not.toMatch(/extra: fmtC\(annualExtra\)/);
  });

  it("the streaming tip names the cheapest row in its own currency", () => {
    expect(INSIGHTS).toMatch(/fmtC\(toMonthly\(cheapest\.price, cheapest\.billingCycle\), cheapest\.currency\)/);
  });

  it("a genuine cross-row comparison is still converted", () => {
    /* The market price insight compares a CATALOGUE price against a TRACKED
       one, which can be in different currencies, so it converts both into the
       base first and formats them as aggregates. Passing a row currency there
       would label a converted figure with the wrong unit. */
    expect(INSIGHTS).toMatch(/market: fmtC\(marketMonthlyInBase\)/);
    expect(INSIGHTS).toMatch(/tracked: fmtC\(trackedMonthly\)/);
  });
});

describe("every per-row display passes the row's currency", () => {
  const SITES = [
    ["app/(tabs)/subscriptions.tsx", ["subscriptions.tsx"]],
    ["app/subscription-details.tsx", ["subscription-details.tsx"]],
    ["app/(tabs)/calendar.tsx", ["calendar.tsx"]],
    ["app/(tabs)/index.tsx", ["index.tsx"]],
    ["app/insights.tsx", ["insights.tsx"]],
  ];
  it.each(SITES.map(([label, parts]) => [label, parts]))("%s has no bare per-row fmtC", (label, parts) => {
    const src = parts[0] === "subscriptions.tsx" || parts[0] === "calendar.tsx" || parts[0] === "index.tsx"
      ? read("app", "(tabs)", parts[0])
      : read("app", parts[0]);
    // A per-row amount formatted without its currency is the defect returning.
    expect(src).not.toMatch(/fmtC\((?:sub|s|nextSub)\.price\)/);
  });
});
