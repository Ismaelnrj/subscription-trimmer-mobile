import { buildTips, Sub } from "../app/insights";

const fmtC = (n: number) => `$${n.toFixed(2)}`;
// The tips are asserted on by id, never by copy, so echoing the key back is
// enough to stand in for i18next here.
const tr = (key: string) => key;

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

/* These lean on real rows in lib/service-templates.ts, so they are sensitive
   to that catalogue in two ways worth knowing about.

   The name has to exist. An earlier change stripped region tokens from every
   template name, which renamed "Drei AT S" to "Drei S" and quietly orphaned
   the fixture this suite used for its currency conversion case, so the test
   was asserting against a template that no longer existed.

   The row also has to carry a recent `verified` date, because the insight now
   stays quiet for prices nobody has checked. Only a handful of rows have one,
   and these tests deliberately use those: a fixture on an unverified row would
   pass or fail for the wrong reason. */
describe("buildTips market price alert", () => {
  it("flags a subscription tracked well below the known market price", () => {
    // Netflix Standard is 15.99 EUR in the DACH catalogue, verified.
    const subs = [makeSub({ price: 10 })];
    const tips = buildTips(subs, fmtC, tr, 50, { baseCurrencyCode: "EUR", rates: { USD: 1, EUR: 1 } });
    expect(tips.some((t) => t.id === "market-price-1")).toBe(true);
  });

  it("does not flag when the tracked price already matches the market price", () => {
    const subs = [makeSub({ price: 15.99 })];
    const tips = buildTips(subs, fmtC, tr, 50, { baseCurrencyCode: "EUR", rates: { USD: 1, EUR: 1 } });
    expect(tips.some((t) => t.id === "market-price-1")).toBe(false);
  });

  it("does not flag when no currency context is provided", () => {
    const subs = [makeSub({ price: 5 })];
    const tips = buildTips(subs, fmtC, tr, 50);
    expect(tips.some((t) => t.id === "market-price-1")).toBe(false);
  });

  it("does not flag subscriptions that don't exactly match a known service name", () => {
    // The catalogue has "Netflix Standard", not "Netflix".
    const subs = [makeSub({ name: "Netflix", price: 5 })];
    const tips = buildTips(subs, fmtC, tr, 50, { baseCurrencyCode: "EUR", rates: { USD: 1, EUR: 1 } });
    expect(tips.some((t) => t.id === "market-price-1")).toBe(false);
  });

  it("stays quiet for a service whose price has never been verified", () => {
    // Apple TV+ is in the catalogue but carries no verified date, so the app
    // has no business telling anyone what it costs.
    const subs = [makeSub({ name: "Apple TV+", price: 1 })];
    const tips = buildTips(subs, fmtC, tr, 50, { baseCurrencyCode: "USD", rates: { USD: 1, EUR: 1 } });
    expect(tips.some((t) => t.id === "market-price-1")).toBe(false);
  });

  it("converts currencies when the tracked base differs from the template's", () => {
    /* "Netflix Basis m. Werbung" exists only in EUR and is verified, so it is
       selected even with a USD base and the conversion actually runs.
       Rates are USD based (units per 1 USD), so EUR 0.5 means one euro is two
       dollars: 6.99 EUR becomes 13.98 USD against 10 tracked. */
    const subs = [makeSub({ name: "Netflix Basis m. Werbung", price: 10 })];
    const rates = { USD: 1, EUR: 0.5 };
    const tips = buildTips(subs, fmtC, tr, 50, { baseCurrencyCode: "USD", rates });
    expect(tips.some((t) => t.id === "market-price-1")).toBe(true);
  });
});
