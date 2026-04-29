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

interface CurrencyState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  loadCurrency: () => Promise<void>;
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  currency: CURRENCIES[0],

  setCurrency: (currency) => {
    SecureStore.setItemAsync("selected_currency", JSON.stringify(currency)).catch(() => {});
    set({ currency });
  },

  loadCurrency: async () => {
    try {
      const stored = await SecureStore.getItemAsync("selected_currency");
      if (stored) set({ currency: JSON.parse(stored) });
    } catch {}
  },
}));

export function fmt(amount: number, symbol: string): string {
  return `${symbol}${amount.toFixed(2)}`;
}
