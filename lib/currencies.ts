/* The nine currencies the app supports, in a module with NO imports.

   It lives apart from currency-store.ts so that code which only needs a symbol
   for a code, the notification scheduler above all, can read it without
   pulling zustand and expo-secure-store along. The scheduler is driven under
   jest by notification-race.test.js with its native modules mocked one by one,
   and a new native import there would be one more mock to keep in step.
   currency-store.ts re-exports this, so every existing import is unchanged. */
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
