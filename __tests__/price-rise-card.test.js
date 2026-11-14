/* The screen half of the price rise card. Source reading: it needs a full
 * React Native render to drive, and what matters here is a short list of
 * things that would each silently break it. The decision itself is measured
 * behaviourally in price-watch.test.js. */
const fs = require("fs");
const path = require("path");

const card = fs.readFileSync(path.join(__dirname, "../components/PriceRiseCard.tsx"), "utf8");
const dashboard = fs.readFileSync(path.join(__dirname, "../app/(tabs)/index.tsx"), "utf8");
const en = require("../locales/en.json").priceRise;
const de = require("../locales/de.json").priceRise;

describe("the price rise card", () => {
  it("is on the dashboard, under the totals, for every account", () => {
    expect(dashboard).toMatch(/<PriceRiseCard subscriptions=\{subscriptions as any\} \/>/);
    const summary = dashboard.indexOf("<View style={styles.summary}>");
    const placed = dashboard.indexOf("<PriceRiseCard");
    const goal = dashboard.indexOf("{showGoal && (");
    expect(summary).toBeGreaterThan(0);
    expect(placed).toBeGreaterThan(summary);
    expect(placed).toBeLessThan(goal);
    // Not gated on Premium: the warning is the product's promise.
    expect(card).not.toMatch(/isPaid|isPremium/);
  });

  it("lays the server's prices over the bundled catalogue before matching", () => {
    expect(card).toMatch(/queryKey: \["catalogue", "prices"\]/);
    expect(card).toMatch(/apiClient\.get\("\/trpc\/catalogue\.prices"\)/);
    expect(card).toMatch(/withServerPrices\(SERVICE_TEMPLATES, serverPrices\)/);
  });

  it("sends the whole row back on update, so the trial date and category survive", () => {
    // subscriptions.update is a full update: an absent trialEndDate is stored as NULL.
    const post = card.slice(card.indexOf('apiClient.post("/trpc/subscriptions.update"'), card.indexOf("track(\"price_rise\", { action: \"updated\" })"));
    for (const field of ["id: sub.id", "name: sub.name", "price: rise.to", "billingCycle: sub.billingCycle", "category:", "trialEndDate:", "currency: rise.currency"]) {
      expect(post).toContain(field);
    }
  });

  it("refreshes what the new price changes, and says so when it fails", () => {
    for (const key of ['["subscriptions"]', '["analytics"]', '["alerts"]']) expect(card).toContain(`queryKey: ${key}`);
    expect(card).toMatch(/setFailed\(true\)/);
    expect(card).toMatch(/if \(saving\) return;/);
  });

  it("remembers a kept price per row and figure, on this phone", () => {
    expect(card).toMatch(/\[String\(rise\.subscriptionId\)\]: rise\.key/);
    expect(card).toMatch(/unanswered\(findPriceRises\(/);
  });

  it("follows the design rules: ink button, no mint, theme tokens", () => {
    expect(card).toMatch(/backgroundColor: c\.text,/);
    expect(card).toMatch(/color: c\.bg/);
    expect(card).not.toMatch(/c\.(success|accent)\b/);
    expect(card).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it("is written in both languages, with the same placeholders", () => {
    const tokens = (s) => (s.match(/\{\{\w+\}\}/g) || []).sort().join();
    for (const key of ["title", "body", "update", "keep", "failed"]) {
      expect(typeof en[key]).toBe("string");
      expect(typeof de[key]).toBe("string");
      expect(de[key]).not.toBe(en[key]);
      expect(tokens(de[key])).toBe(tokens(en[key]));
    }
    expect(tokens(en.body)).toBe("{{cycle}},{{date}},{{from}},{{to}}");
  });
});
