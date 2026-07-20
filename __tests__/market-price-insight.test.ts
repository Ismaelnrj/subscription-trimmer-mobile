import { buildTips, Sub } from "../app/insights";

const fmtC = (n: number) => `$${n.toFixed(2)}`;

function makeSub(overrides: Partial<Sub>): Sub {
  return {
    id: 1,
    name: "Netflix Standard",
    price: 10,
    billingCycle: "monthly",
    category: "streaming",
    nextBillingDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    ...overrides,
  };
}

describe("buildTips market price alert", () => {
  it("flags a subscription tracked well below the known market price", () => {
    const subs = [makeSub({ price: 10 })]; // Netflix Standard template is $15.49/mo
    const tips = buildTips(subs, fmtC, 50, { baseCurrencyCode: "USD", rates: { USD: 1 } });
    expect(tips.some((t) => t.id === "market-price-1")).toBe(true);
  });

  it("does not flag when the tracked price already matches or exceeds the market price", () => {
    const subs = [makeSub({ price: 15.49 })];
    const tips = buildTips(subs, fmtC, 50, { baseCurrencyCode: "USD", rates: { USD: 1 } });
    expect(tips.some((t) => t.id === "market-price-1")).toBe(false);
  });

  it("does not flag when no currency context is provided", () => {
    const subs = [makeSub({ price: 5 })];
    const tips = buildTips(subs, fmtC, 50);
    expect(tips.some((t) => t.id === "market-price-1")).toBe(false);
  });

  it("does not flag subscriptions that don't exactly match a known service name", () => {
    const subs = [makeSub({ name: "Netflix", price: 5 })]; // template is "Netflix Standard", not "Netflix"
    const tips = buildTips(subs, fmtC, 50, { baseCurrencyCode: "USD", rates: { USD: 1 } });
    expect(tips.some((t) => t.id === "market-price-1")).toBe(false);
  });

  it("converts currencies correctly when the tracked base currency differs from the template's", () => {
    // Drei AT S template is tagged EUR 22.90/mo. User tracks in USD at a rate
    // where EUR is cheaper than USD (rates are USD-based: units per 1 USD).
    const subs = [makeSub({ name: "Drei AT S", price: 10, category: "utilities" })];
    const rates = { USD: 1, EUR: 0.5 }; // 1 USD = 0.5 EUR, i.e. EUR is the stronger currency
    // 22.90 EUR -> USD: 22.90 * (rates.USD / rates.EUR) = 22.90 * (1/0.5) = 45.80 USD
    const tips = buildTips(subs, fmtC, 50, { baseCurrencyCode: "USD", rates });
    expect(tips.some((t) => t.id === "market-price-1")).toBe(true);
  });
});
