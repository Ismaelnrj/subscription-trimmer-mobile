import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export const CURRENCIES = [
  { code: "USD", symbol: "$",   name: "US Dollar" },
  { code: "EUR", symbol: "€",   name: "Euro" },
  { code: "GBP", symbol: "£",   name: "British Pound" },
  { code: "BRL", symbol: "R$",  name: "Brazilian Real" },
  { code: "CAD", symbol: "C$",  name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$",  name: "Australian Dollar" },
  { code: "JPY", symbol: "¥",   name: "Japanese Yen" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "INR", symbol: "₹",   name: "Indian Rupee" },
];

export type Currency = (typeof CURRENCIES)[0];

// Fallback rates with USD as base (used if network fetch fails)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, BRL: 5.05, CAD: 1.36,
  AUD: 1.53, JPY: 149.5, MXN: 17.2, INR: 83.1,
};

interface CurrencyState {
  currency: Currency;
  baseCurrencyCode: string;
  rates: Record<string, number>;
  setCurrency: (c: Currency) => void;
  setBaseCurrency: (code: string) => void;
  loadCurrency: () => Promise<void>;
  fetchRates: () => Promise<void>;
  /* `fromCurrency` is the currency the AMOUNT is in, which for a subscription
     is the one it was entered in and stored on the row. Optional so all
     existing one argument callers keep the previous behaviour, which is to
     assume the global base. */
  convert: (amount: number, fromCurrency?: string | null) => number;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  currency: CURRENCIES[0],
  baseCurrencyCode: "USD",
  rates: FALLBACK_RATES,

  /* Picking a currency sets the one prices are entered in as well as the one
     they are shown in.

     setBaseCurrency existed but was never called from anywhere, so
     baseCurrencyCode stayed "USD" for every user forever. Two things followed
     from that. The add form asked for "Price in USD" no matter where you live,
     and useFmt then converted whatever you typed from dollars into your
     display currency, so an Austrian entering 12.04 for a 12.04 euro
     subscription saw it come back as about 10.35. The only way to be right was
     to convert every price into dollars in your head first, which nobody does.

     Tying the two together means what you type is what you see. Conversion
     still exists and still matters, it just applies where it was always meant
     to: a subscription billed in a currency other than the one you picked. */
  setCurrency: (currency) => {
    SecureStore.setItemAsync("selected_currency", JSON.stringify(currency)).catch(() => {});
    SecureStore.setItemAsync("base_currency_code", currency.code).catch(() => {});
    set({ currency, baseCurrencyCode: currency.code });
  },

  setBaseCurrency: (code) => {
    SecureStore.setItemAsync("base_currency_code", code).catch(() => {});
    set({ baseCurrencyCode: code });
  },

  loadCurrency: async () => {
    try {
      const [stored, base] = await Promise.all([
        SecureStore.getItemAsync("selected_currency"),
        SecureStore.getItemAsync("base_currency_code"),
      ]);
      const currency = stored ? JSON.parse(stored) : null;
      if (currency) set({ currency });
      // A stored base wins, so anyone who really did enter prices in dollars
      // keeps that reading. Otherwise the base follows the chosen currency
      // rather than falling back to USD, which is what left every existing
      // user entering dollars without being told.
      set({ baseCurrencyCode: base || currency?.code || "USD" });
    } catch {}
  },

  fetchRates: async () => {
    try {
      const res = await fetch("https://api.frankfurter.app/latest?base=USD");
      if (!res.ok) return;
      const data = await res.json();
      /* Every price the app displays is computed from these numbers, so a third
         party's bad afternoon must not reach the store. This used to spread
         `data.rates` in unchecked: a single 0 turned every converted price into
         Infinity, and a single NaN turned them all into NaN, so the whole app
         would read "€NaN" with nothing having thrown. Keep only finite positive
         numbers, and if that leaves nothing usable, keep the existing rates
         rather than replacing good ones with an empty set. */
      const clean: Record<string, number> = {};
      for (const [code, rate] of Object.entries(data?.rates ?? {})) {
        const n = Number(rate);
        if (Number.isFinite(n) && n > 0) clean[code] = n;
      }
      if (Object.keys(clean).length === 0) return;
      set({ rates: { ...get().rates, USD: 1, ...clean } });
    } catch {
      // keep fallback rates
    }
  },

  convert: (amount: number, fromCurrency?: string | null) => {
    const { rates, baseCurrencyCode, currency } = get();
    /* THE ROW'S OWN CURRENCY WINS OVER THE GLOBAL BASE, which is the whole
       point of subscriptions.currency existing. Before this, ONE base described
       every row, so a 15.99 EUR subscription read as 15.99 USD the moment
       somebody switched currency: measured at 15.99 against a true 17.38.
       Falls back to the global base when a row has no currency, which is only
       a row written before the column existed, so old behaviour is preserved
       rather than replaced by a guess. */
    const from = String(fromCurrency || baseCurrencyCode).toUpperCase();
    if (from === currency.code) return amount;
    /* `?? 1` was the only guard here and it catches null and undefined ONLY, so
       a rate of 0 still divided through to Infinity and a NaN rate still
       propagated. Both render as a price: "€Infinity", "€NaN". Showing an
       unconverted number is a small, quiet error; showing NaN where somebody's
       monthly cost should be looks like the app has fallen over. So anything
       not finite and positive falls back to returning the amount untouched. */
    const baseRate = rates[from];
    const targetRate = rates[currency.code];
    const usable = (r: unknown): r is number => typeof r === "number" && Number.isFinite(r) && r > 0;
    if (!usable(baseRate) || !usable(targetRate)) return amount;
    const converted = amount * (targetRate / baseRate);
    return Number.isFinite(converted) ? converted : amount;
  },
}));

// Round to a fixed number of decimals, compensating for binary floating-point
// error so e.g. 1.005 rounds to 1.01 instead of 1.00.
function roundTo(amount: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

// Simple format without conversion (for raw display)
export function fmt(amount: number, symbol: string): string {
  return `${symbol}${roundTo(amount, 2).toFixed(2)}`;
}

/* THE FORMATTER, AND THE ONE RULE THAT DECIDES WHAT IT DOES.
   `fromCurrency` is the currency the amount is stored in, and PASSING IT IS
   THE SIGNAL THAT THIS IS A SINGLE ROW rather than a total. It is optional so
   that every aggregate call site keeps its existing one argument form.

     fmtC(sub.price, sub.currency)   one row   -> its own currency, exact
     fmtC(monthlyTotal)              a sum     -> display currency, prefixed ~

   WHY A ROW IS NOT CONVERTED. Regional pricing is set by the provider and not
   by an exchange rate: Netflix Standard is 15.99 EUR in DACH and 19.99 USD in
   the US, and 15.99 EUR converted is neither of those. A row showing ~$17.38
   therefore names a figure that will never appear on a statement, which is the
   one thing this product cannot afford to do. The stored number is already
   true, so it is shown.

   WHY A TOTAL STILL IS. Adding rows priced in different currencies needs one
   unit, so there is no honest alternative, and `~` says so. The marker is
   decided from the CURRENCY CODES rather than from whether the number changed,
   because a conversion can coincidentally return the same figure and that is
   still an estimate.

   WHAT THIS DOES NOT FIX YET, stated rather than left to be discovered. Every
   place that SUMS prices, the monthly and yearly totals, the category
   breakdown, the weekly chart, still adds RAW numbers and converts once from
   the global base, so a sum mixes units before converting. That is exactly
   correct while a user's rows share one currency, which is every user today
   because the backfill gave each of them their own settings currency. It is
   wrong the moment somebody switches currency and adds a row.
   Fixing it means converting INSIDE each reducer rather than after it, which
   touches every aggregate and is its own change.
   NOTE THAT THE PER-ROW RULE ABOVE MAKES THIS MORE VISIBLE, not less, and that
   is the right direction: rows now read in their own currencies, so a total
   that does not match them is something a user can SEE rather than a silent
   arithmetic error. A defect you can notice is cheaper than one you cannot. */
export function useFmt(): (amount: number, fromCurrency?: string | null) => string {
  const { currency, convert, baseCurrencyCode } = useCurrencyStore();
  return (amount: number, fromCurrency?: string | null) => {
    /* A ROW THAT NAMES ITS OWN CURRENCY IS SHOWN IN IT, NEVER CONVERTED.
       Netflix charges an Austrian 15.99 EUR and an American 19.99 USD, and
       neither figure is a conversion of the other: regional pricing is set by
       the provider, not by an exchange rate. So a euro row rendered as ~$17.38
       names an amount that will appear on nobody's statement, on a screen whose
       whole job is saying what is about to be debited. The row already holds
       the true number; showing anything else is a worse answer. */
    if (fromCurrency) {
      const code = String(fromCurrency).toUpperCase();
      const own = CURRENCIES.find(x => x.code === code);
      if (own) {
        const d = own.code === "JPY" ? 0 : 2;
        return `${own.symbol}${roundTo(amount, d).toFixed(d)}`;
      }
      /* An unrecognised code falls through to the convert path rather than
         being rendered with a symbol we do not have. The server validates
         against the same nine codes, so this is a guard and not a live case. */
    }
    /* NO SOURCE CURRENCY NAMED MEANS THIS IS AN AGGREGATE, already summed in
       the user's base currency, so it converts to the display currency and
       keeps the `~`: a total in a currency none of its parts were priced in
       really is an estimate, and it moves with a rate the user did not set. */
    const from = String(baseCurrencyCode).toUpperCase();
    const converted = convert(amount, null);
    const decimals = currency.code === "JPY" ? 0 : 2;
    const text = `${currency.symbol}${roundTo(converted, decimals).toFixed(decimals)}`;
    return from === currency.code ? text : `~${text}`;
  };
}
