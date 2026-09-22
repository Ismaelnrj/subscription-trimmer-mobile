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

// Hook that returns a formatter with live conversion built in
/* `fromCurrency` is the currency the amount is stored in. Optional, so every
   existing one argument call site keeps working and each can be upgraded
   deliberately rather than all at once.
   A CONVERTED FIGURE IS PREFIXED WITH `~`, and that is not decoration. A rate
   from api.frankfurter.app is today's rate applied to a price that will be
   charged on some other day in the row's own currency, so the number shown is
   an estimate and the only dishonest version is the one that looks exact.
   The marker is decided from the CURRENCY CODES rather than from whether the
   number changed, because a conversion can coincidentally return the same
   figure and that is still an estimate. */
/* WHAT THIS DOES NOT FIX YET, stated rather than left to be discovered.
   Every place that SUMS prices, the monthly and yearly totals, the category
   breakdown, the weekly chart, still adds raw numbers and then converts once
   from the global base. That is correct while a user's rows share one currency,
   which is every user today, because the backfill gave each of them their own
   settings currency. It is wrong the moment somebody switches currency and adds
   a row, because the sum mixes units before converting.
   Fixing it means converting INSIDE each reducer rather than after it, which
   touches every aggregate and is its own change. Doing half of it would be
   worse than either end: per-row prices right and totals silently wrong is
   harder to notice than both being wrong the same way.
   So this stage is deliberately display-only, and the inconsistency window is
   narrow: one currency per user means no difference at all. */
export function useFmt(): (amount: number, fromCurrency?: string | null) => string {
  const { currency, convert, baseCurrencyCode } = useCurrencyStore();
  return (amount: number, fromCurrency?: string | null) => {
    const from = String(fromCurrency || baseCurrencyCode).toUpperCase();
    const converted = convert(amount, fromCurrency);
    const decimals = currency.code === "JPY" ? 0 : 2;
    const text = `${currency.symbol}${roundTo(converted, decimals).toFixed(decimals)}`;
    return from === currency.code ? text : `~${text}`;
  };
}
