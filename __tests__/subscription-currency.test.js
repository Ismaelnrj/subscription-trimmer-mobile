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
