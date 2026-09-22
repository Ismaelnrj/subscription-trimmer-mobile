/* The client half of the cancellation lifecycle.

   SOURCE READING, and that is the honest label: these screens cannot be rendered
   here, so what is checked is that the wiring exists and that the specific
   mistakes this codebase has already paid for are absent. The arithmetic is
   covered behaviourally in subscription-cancel.test.js, against the real
   handlers, which is where the money actually gets decided. */

const fs = require("fs");
const path = require("path");
const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

const SUBS = read("app", "(tabs)", "subscriptions.tsx");
const SCREEN = read("app", "cancelled.tsx");
const LAYOUT = read("app", "_layout.tsx");
const PROFILE = read("app", "(tabs)", "profile.tsx");
const EN = JSON.parse(read("locales", "en.json"));
const DE = JSON.parse(read("locales", "de.json"));

describe("the delete dialog asks what happened instead of assuming", () => {
  it("offers cancelling as well as deleting", () => {
    /* The moment somebody reaches for delete is usually the moment they
       cancelled the service, and the only thing on offer threw the row away
       along with any record of what they had been paying. */
    expect(SUBS).toMatch(/t\("subscriptions\.iCancelledIt"\)/);
    expect(SUBS).toMatch(/setCancelledMutation\.mutate\(\{ id: sub\.id \}\)/);
  });

  it("keeps deleting available and still marked destructive", () => {
    // Replacing delete rather than adding beside it would strand anybody who
    // added a row by mistake and wants it gone.
    expect(SUBS).toMatch(/style: "destructive", onPress: \(\) => deleteMutation\.mutate\(sub\)/);
  });

  it("puts the non destructive answer in the positive slot", () => {
    /* A three button Alert on Android maps the array to neutral, negative,
       positive IN ORDER, so the last entry is the prominent one. Keeping must be
       easier to hit than destroying. */
    const dialog = SUBS.slice(SUBS.indexOf("const confirmDelete"), SUBS.indexOf("const handleRateApp"));
    expect(dialog.indexOf("iCancelledIt")).toBeGreaterThan(dialog.indexOf("deleteForever"));
  });

  it("adds no fourth icon to the card action row", () => {
    /* That row already carries three unlabelled icon buttons, one of which
       destroys data, which this repo has on record as a real accessibility cost.
       Both the trash icon and the swipe already route to confirmDelete, so one
       dialog covers both entry points without a new control. */
    const actions = SUBS.slice(SUBS.indexOf("<View style={styles.actionButtons}>"), SUBS.indexOf("</Swipeable>"));
    expect(actions).not.toMatch(/setCancelledMutation/);
  });
});

describe("the cancelled screen does not repeat known defects", () => {
  it("handles isError rather than falling through to the empty state", () => {
    /* Shipped once already on the subscriptions screen: a dropped connection
       told somebody they had no subscriptions. Here it would say they have never
       cancelled anything, which is the same lie about their own data. */
    expect(SCREEN).toMatch(/isError/);
    const errBranch = SCREEN.indexOf("if (isError)");
    const emptyBranch = SCREEN.indexOf("subs.length === 0");
    expect(errBranch).toBeGreaterThan(-1);
    expect(errBranch).toBeLessThan(emptyBranch);
  });

  it("shows every amount in the currency it was charged in", () => {
    // The rule shipped earlier the same day: passing the currency means show it
    // exact in that currency, never a conversion of it.
    expect(SCREEN).toMatch(/fmtC\(sub\.amountAvoided, sub\.currency\)/);
    expect(SCREEN).toMatch(/fmtC\(tot\.amount, tot\.currency\)/);
    expect(SCREEN).not.toMatch(/fmtC\(sub\.amountAvoided\)/);
  });

  it("never sums one figure across currencies", () => {
    /* Adding 15.99 EUR to 9.99 USD needs a rate. The server groups by currency
       and the screen renders one card per group, so there is nothing here that
       could flatten them into a single wrong number. */
    expect(SCREEN).toMatch(/totals\.map/);
    expect(SCREEN).not.toMatch(/totals\.reduce/);
  });

  it("pluralises on a single count", () => {
    /* i18next pluralises on `count` alone, so a string carrying two numbers gets
       the second one wrong in every language with plural rules. */
    expect(SCREEN).toMatch(/cancelled\.totalMeta", \{ count: tot\.subscriptions \}/);
    expect(EN.cancelled.totalMeta_one).not.toMatch(/\{\{charges\}\}/);
    expect(DE.cancelled.totalMeta_one).not.toMatch(/\{\{charges\}\}/);
  });

  it("says plainly why a figure can be zero", () => {
    /* A yearly subscription cancelled last month has genuinely avoided nothing
       yet. Explaining that is what makes the number trustworthy; a bigger number
       that invented the charge would not be. */
    expect(SCREEN).toMatch(/cancelled\.explainer/);
    expect(EN.cancelled.explainer).toMatch(/yearly/i);
    expect(SCREEN).toMatch(/cancelled\.nothingYet/);
  });

  it("turns the free tier refusal into the upgrade prompt", () => {
    /* Restoring makes a row live again, so the server answers FREE_LIMIT_REACHED.
       Showing a generic failure would leave the user at a dead end with no idea
       why. It is the same code subscriptions.create has always returned. */
    /* COMMENTS STRIPPED FIRST. The branch explains itself by naming the very
       code it tests for, so a whole file search finds it in prose and stays
       green after the branch is disabled. Caught by a mutation: `if (code ===
       ...)` was replaced with `if (false)` and nothing went red. Third time
       today; block comments only, since stripping `//` to end of line eats a
       URL. */
    const code = SCREEN.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(code.length).toBeLessThan(SCREEN.length);
    expect(code).toMatch(/if \(code === "FREE_LIMIT_REACHED"\)/);
    expect(code).toMatch(/cancelled\.restoreBlockedBody/);
  });

  it("invalidates the lists that actually changed", () => {
    // Cancelling moves a row between two separately cached queries, so
    // invalidating one leaves the other stale until a cold start.
    expect(SUBS).toMatch(/queryKey: \["cancelledSubscriptions"\]/);
    expect(SCREEN).toMatch(/queryKey: \["subscriptions"\]/);
    expect(SCREEN).toMatch(/queryKey: \["analytics"\]/);
  });

  it("reads cancelledAt as an INSTANT, which is not the parseApiDate defect", () => {
    /* A standing grep in this repo flags `new Date(sub.` as that defect. This is
       not it. The rule covers fields that mean A DAY stored at midnight UTC,
       where local conversion moves the day west of UTC. cancelled_at is a real
       instant written by the server's NOW(), so local conversion is correct, and
       slicing its UTC calendar day would show the wrong one to anybody who
       cancelled in the evening west of UTC. The comment is asserted so the
       reasoning survives the next sweep. */
    expect(SCREEN).toMatch(/new Date\(sub\.cancelledAt\)/);
    expect(SCREEN).toMatch(/genuine INSTANT/);
    expect(SCREEN).not.toMatch(/parseApiDate\(sub\.cancelledAt\)/);
  });
});

describe("the screen is reachable and localised", () => {
  it("is registered with a translated title", () => {
    expect(LAYOUT).toMatch(/name="cancelled"/);
    expect(LAYOUT).toMatch(/t\("screenTitles\.cancelled"\)/);
  });

  it("is linked from the profile menu", () => {
    // A screen nothing navigates to is a screen nobody finds.
    expect(PROFILE).toMatch(/router\.push\("\/cancelled"\)/);
    expect(PROFILE).toMatch(/t\("profile\.cancelled"\)/);
  });

  it("carries every key it renders, in both languages", () => {
    const used = [...SCREEN.matchAll(/t\("([a-zA-Z0-9_.]+)"/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(8);
    const get = (obj, k) => k.split(".").reduce((o, part) => (o == null ? o : o[part]), obj);
    for (const key of used) {
      /* A pluralised key is stored as name_one / name_other and looked up by the
         bare name, so resolving it directly would report a false miss. */
      const ok = (obj) => get(obj, key) !== undefined
        || get(obj, key + "_one") !== undefined
        || get(obj, key + "_other") !== undefined;
      expect(ok(EN)).toBe(true);
      expect(ok(DE)).toBe(true);
    }
  });

  it("has a German plural pair that is not a copy of the English", () => {
    expect(DE.cancelled.avoided_one).not.toBe(EN.cancelled.avoided_one);
    expect(DE.cancelled.avoided_other).not.toBe(EN.cancelled.avoided_other);
    // "Abbuchung" is the word a German bank statement uses, which is the term
    // this product has settled on everywhere else.
    expect(DE.cancelled.avoided_other).toMatch(/Abbuchungen/);
  });

  it("renders no bare English string in the new screen", () => {
    /* The upgrade.tsx lesson: three English words survived every sweep because
       they were plain object values rather than t() calls or JSX text. Here the
       check is that JSX text nodes are all interpolations. */
    const textNodes = [...SCREEN.matchAll(/>([^<>{}\n]{3,})</g)].map((m) => m[1].trim()).filter(Boolean);
    expect(textNodes.filter((x) => /[a-zA-Z]{3}/.test(x))).toEqual([]);
  });
});
