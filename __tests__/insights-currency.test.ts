/* buildTips added raw prices across currencies, found 2026-11-07: a 1500 yen
   row joined a euro total as 1500 euros, counted as "expensive" against a 50
   euro threshold, and a tracked price in one currency was compared with a
   market price converted into another. The price-rise tip also printed the
   raw API cycle, "pro monthly", to a German reader.
   These drive the real function. Rates are USD based, as the store keeps
   them: 1 USD = 0.9 EUR = 150 JPY, so 1500 JPY is 9.00 EUR. */
import * as fs from "fs";
import * as path from "path";
import { buildTips, Sub } from "../app/insights";

const fmtC = (n: number, cur?: string | null) => `${cur ?? "BASE"}:${n.toFixed(2)}`;
const tr = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}|${JSON.stringify(opts)}` : key);
const ctx = { baseCurrencyCode: "EUR", rates: { USD: 1, EUR: 0.9, JPY: 150 } };
const later = new Date(Date.now() + 30 * 86400000).toISOString();

function sub(o: Partial<Sub>): Sub {
  return { id: 1, name: "X", price: 10, billingCycle: "monthly", category: "other", currency: "EUR", nextBillingDate: later, ...o };
}

const streaming = [
  sub({ id: 1, name: "Netflix", price: 15.99, category: "streaming" }),
  sub({ id: 2, name: "Disney+", price: 10.99, category: "streaming" }),
  sub({ id: 3, name: "U-Next", price: 1500, category: "streaming", currency: "JPY" }),
];

describe("buildTips adds money in one currency", () => {
  it("converts each row before totalling a category", () => {
    const tip = buildTips(streaming, fmtC, tr, 50, ctx).find((t) => t.id === "streaming-overlap")!;
    expect(tip.detail).toContain('"total":"BASE:35.98"');
  });

  it("picks the cheapest service by its converted price", () => {
    const tip = buildTips(streaming, fmtC, tr, 50, ctx).find((t) => t.id === "streaming-overlap")!;
    // U-Next at 9.00 EUR, not Disney+ at 10.99, and the saving is counted in euros.
    expect(tip.savingsHint).toContain('"amount":"JPY:1500.00"');
    expect(tip.savingsValue).toBeCloseTo(9, 2);
  });

  it("does not call a 1500 yen row expensive at a 50 euro threshold", () => {
    const tips = buildTips([sub({ id: 9, name: "Yen", price: 1500, currency: "JPY" })], fmtC, tr, 50, ctx);
    expect(tips.find((t) => t.id === "exp-9")).toBeUndefined();
  });

  it("still calls a 60 euro row expensive", () => {
    const tips = buildTips([sub({ id: 8, name: "Gym", price: 60 })], fmtC, tr, 50, ctx);
    expect(tips.find((t) => t.id === "exp-8")).toBeDefined();
  });

  it("leaves every amount as it was without a currency context", () => {
    const tip = buildTips(streaming, fmtC, tr, 50).find((t) => t.id === "streaming-overlap")!;
    expect(tip.detail).toContain('"total":"BASE:1526.98"');
  });
});

describe("the price rise tip names the cycle in the reader's language", () => {
  it("passes the translated noun, not the API word", () => {
    const tips = buildTips([sub({ id: 5, name: "Spotify", priceIncrease: { from: 10.99, to: 12.99 } } as any)], fmtC, tr, 50, ctx);
    const tip = tips.find((t) => t.id === "price-up-5")!;
    expect(tip.detail).toContain('"cycle":"common.cycleMonthly"');
    expect(tip.detail).not.toContain('"cycle":"monthly"');
  });
});

describe("the Insights screen's own total", () => {
  it("comes from the per currency parts, as on the dashboard", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "app", "insights.tsx"), "utf8");
    expect(src).toMatch(/sumMixedInBase\(summary\?\.monthlyByCurrency, rates, baseCurrencyCode, summary\?\.monthlyTotal \?\? 0\)/);
  });
});
