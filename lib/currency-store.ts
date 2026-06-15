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
  convert: (amount: number) => number;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  currency: CURRENCIES[0],
  baseCurrencyCode: "USD",
  rates: FALLBACK_RATES,

  setCurrency: (currency) => {
    SecureStore.setItemAsync("selected_currency", JSON.stringify(currency)).catch(() => {});
    set({ currency });
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
      if (stored) set({ currency: JSON.parse(stored) });
      if (base) set({ baseCurrencyCode: base });
    } catch {}
  },

  fetchRates: async () => {
    try {
      const res = await fetch("https://api.frankfurter.app/latest?base=USD");
      if (!res.ok) return;
      const data = await res.json();
      set({ rates: { USD: 1, ...data.rates } });
    } catch {
      // keep fallback rates
    }
  },

  convert: (amount: number) => {
    const { rates, baseCurrencyCode, currency } = get();
    if (baseCurrencyCode === currency.code) return amount;
    const baseRate = rates[baseCurrencyCode] ?? 1;
    const targetRate = rates[currency.code] ?? 1;
    return amount * (targetRate / baseRate);
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
export function useFmt(): (amount: number) => string {
  const { currency, convert } = useCurrencyStore();
  return (amount: number) => {
    const converted = convert(amount);
    const decimals = currency.code === "JPY" ? 0 : 2;
    return `${currency.symbol}${roundTo(converted, decimals).toFixed(decimals)}`;
  };
}
