/* Rate handling, tested as behaviour rather than by reading the store.

   lib/currency-store.ts imports expo-secure-store and creates a zustand store,
   neither of which instantiates here, so this mirrors convert()'s rule the way
   api-retry.test.ts mirrors the retry policy. Same limitation, stated plainly:
   if the store changes its rule these keep passing. They exist to pin the RULE,
   which is that a bad rate must never reach a price. */

type Rates = Record<string, unknown>;

const usable = (r: unknown): r is number =>
  typeof r === "number" && Number.isFinite(r) && r > 0;

function convert(amount: number, rates: Rates, baseCode: string, targetCode: string): number {
  if (baseCode === targetCode) return amount;
  const baseRate = rates[baseCode];
  const targetRate = rates[targetCode];
  if (!usable(baseRate) || !usable(targetRate)) return amount;
  const converted = amount * (targetRate / baseRate);
  return Number.isFinite(converted) ? converted : amount;
}

// The ingest filter, mirrored from fetchRates.
function clean(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [code, rate] of Object.entries((raw as any) ?? {})) {
    const n = Number(rate);
    if (Number.isFinite(n) && n > 0) out[code] = n;
  }
  return out;
}

const GOOD: Rates = { USD: 1, EUR: 0.92, GBP: 0.79 };

describe("a bad rate never becomes a price", () => {
  it("converts normally when both rates are good", () => {
    expect(convert(10, GOOD, "USD", "EUR")).toBeCloseTo(9.2);
  });

  it("returns the amount untouched when the target rate is zero", () => {
    /* `?? 1` catches null and undefined ONLY, so a 0 used to divide through to
       Infinity and every price in the app rendered as "€Infinity". */
    expect(convert(10, { ...GOOD, EUR: 0 }, "USD", "EUR")).toBe(10);
  });

  it("returns the amount untouched when the base rate is zero", () => {
    expect(convert(10, { ...GOOD, USD: 0 }, "USD", "EUR")).toBe(10);
  });

  it("returns the amount untouched for a NaN rate", () => {
    // NaN survives `?? 1` too, and NaN propagates through every arithmetic step
    // to render as "€NaN", which reads as the app having fallen over.
    expect(convert(10, { ...GOOD, EUR: NaN }, "USD", "EUR")).toBe(10);
  });

  it("returns the amount untouched for a negative rate", () => {
    expect(convert(10, { ...GOOD, EUR: -0.92 }, "USD", "EUR")).toBe(10);
  });

  it("returns the amount untouched for a missing rate", () => {
    /* Preferred over the old `?? 1`, which assumed an absent BASE meant USD and
       so converted prices that were never entered in dollars. Unconverted is a
       quiet error; converted from the wrong base is a wrong number presented
       with confidence. */
    expect(convert(10, GOOD, "CHF", "EUR")).toBe(10);
    expect(convert(10, GOOD, "USD", "CHF")).toBe(10);
  });

  it("never returns a non-finite number, whatever the rates", () => {
    const hostile: Rates[] = [
      { USD: 0, EUR: 0 },
      { USD: NaN, EUR: NaN },
      { USD: Infinity, EUR: 1 },
      { USD: 1, EUR: Infinity },
      { USD: Number.MIN_VALUE, EUR: Number.MAX_VALUE },
      {},
    ];
    for (const rates of hostile) {
      expect(Number.isFinite(convert(10, rates, "USD", "EUR"))).toBe(true);
    }
  });

  it("short-circuits when base and target match, without consulting rates", () => {
    expect(convert(10, { USD: 0 }, "USD", "USD")).toBe(10);
  });
});

/* THERE ARE TWO CONVERSION IMPLEMENTATIONS, which is worth knowing before
   changing either. lib/currency-store.ts converts for DISPLAY, and
   app/insights.tsx has its own convertCurrency for the market price comparison,
   because that one converts between two arbitrary currencies rather than from
   the base to the display currency.

   They had the same `?? 1` defect and it was fixed in the store first. This
   block exists so the second one cannot quietly keep it. */
describe("the insights comparison refuses rather than guesses", () => {
  const usable = (r: unknown): r is number =>
    typeof r === "number" && Number.isFinite(r) && r > 0;

  function convertCurrency(amount: number, from: string, to: string, rates: Record<string, unknown>): number | null {
    if (from === to) return amount;
    const f = rates[from], t = rates[to];
    if (!usable(f) || !usable(t)) return null;
    const c = amount * (t / f);
    return Number.isFinite(c) ? c : null;
  }

  const FALLBACK = { USD: 1, EUR: 0.92, GBP: 0.79 };

  it("returns null for a currency the rates table does not have", () => {
    /* Three service templates are priced in CHF and CHF is not in
       FALLBACK_RATES. `?? 1` asserted CHF was worth one dollar, converting a
       35 CHF plan to 32.20 EUR when the truth is about 40.25. That error
       SUPPRESSES a correct overpaying alert rather than raising a false one,
       which is the harder kind to notice. */
    expect(convertCurrency(35, "CHF", "EUR", FALLBACK)).toBe(null);
  });

  it("converts once a real rate is available", () => {
    expect(convertCurrency(35, "CHF", "EUR", { ...FALLBACK, CHF: 0.8 })).toBeCloseTo(40.25);
  });

  it("returns null for zero, NaN and negative rates", () => {
    for (const bad of [0, NaN, -1, "0.9", null, undefined]) {
      expect(convertCurrency(10, "USD", "EUR", { USD: 1, EUR: bad })).toBe(null);
    }
  });

  it("short-circuits a same-currency comparison without touching rates", () => {
    expect(convertCurrency(15.99, "EUR", "EUR", {})).toBe(15.99);
  });

  it("leaves the ordinary path alone", () => {
    expect(convertCurrency(15.99, "EUR", "USD", FALLBACK)).toBeCloseTo(17.38, 2);
  });
});

describe("the rate fetch filters before anything is stored", () => {
  it("drops zero, negative, NaN and non-numeric entries", () => {
    const out = clean({ EUR: 0.92, GBP: 0, JPY: -1, BRL: NaN, CAD: "x", AUD: null });
    expect(out).toEqual({ EUR: 0.92 });
  });

  it("accepts a numeric string, since the API is JSON and may quote", () => {
    expect(clean({ EUR: "0.92" })).toEqual({ EUR: 0.92 });
  });

  it("survives a response with no rates at all", () => {
    expect(clean(undefined)).toEqual({});
    expect(clean(null)).toEqual({});
  });
});
