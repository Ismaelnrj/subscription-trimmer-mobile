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

/* HOW MONEY IS WRITTEN, in one place for every surface that writes it.

   German writes a decimal COMMA, groups thousands with a POINT and puts the
   symbol AFTER the amount: "13,99 €", "1.500,00 €". English puts the symbol
   first and groups thousands with a COMMA: "€13.99", "$1,403.40". The reminders
   and the server's emails already wrote German this way while every screen in
   the app wrote "€13.99" in German too, so the same charge read two different
   ways depending on where you met it.

   English grouping came later, 2026-11-12: the first version left English
   ungrouped to change nothing for an English reader, and the store screenshots
   then showed "$1403.40 a year" on the dashboard, which no American writes.

   The space before the symbol is a NO-BREAK space, so a narrow cell can never
   leave "€" alone on the next line.

   Done by hand rather than with toLocaleString("de-DE"): this module has no
   imports and runs in the notification scheduler, and the output must not
   depend on which Intl data a phone's JavaScript engine carries. */
const NBSP = " ";

function roundMoney(amount: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

export function formatMoney(amount: number, symbol: string, decimals: number, language?: string | null): string {
  const german = String(language ?? "").toLowerCase().startsWith("de");
  const sign = amount < 0 ? "-" : "";
  const [whole, fraction] = roundMoney(Math.abs(amount), decimals).toFixed(decimals).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, german ? "." : ",");
  if (!german) return `${symbol}${sign}${grouped}${fraction ? `.${fraction}` : ""}`;
  return `${sign}${grouped}${fraction ? `,${fraction}` : ""}${NBSP}${symbol}`;
}
