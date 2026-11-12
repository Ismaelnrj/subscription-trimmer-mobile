/* ONE WAY TO WRITE MONEY, decided 2026-11-07 with the owner ("13,99 € would
   be better"). German reads "13,99 €" and "1.500,00 €"; English keeps
   "€13.99". Until then the reminders and the server's emails wrote German this
   way while every screen in the app wrote "€13.99" to a German reader, so the
   same charge read two ways depending on where you met it.

   Also pinned here, from the same request: where the German copy said
   "Ausgabe" (expense) for something that is a subscription, it says "Abo".
   "Ausgaben" meaning SPENDING ("Ausgaben nach Kategorie", "Monatliche
   Ausgaben") is correct German and stays; only the subscription-naming keys
   are listed below. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (s) => s.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const { formatMoney } = require("../lib/currencies");
const { formatTemplatePrice, SERVICE_TEMPLATES } = require("../lib/service-templates");
const NBSP = " ";

describe("formatMoney", () => {
  it("writes German with a decimal comma, grouped thousands and the symbol after", () => {
    expect(formatMoney(13.99, "€", 2, "de")).toBe(`13,99${NBSP}€`);
    expect(formatMoney(1500, "€", 2, "de")).toBe(`1.500,00${NBSP}€`);
    expect(formatMoney(1234567.891, "€", 2, "de-AT")).toBe(`1.234.567,89${NBSP}€`);
    expect(formatMoney(9.99, "$", 2, "de")).toBe(`9,99${NBSP}$`);
    expect(formatMoney(1500, "¥", 0, "de")).toBe(`1.500${NBSP}¥`);
    expect(formatMoney(-5, "€", 2, "de")).toBe(`-5,00${NBSP}€`);
  });

  it("rounds before it groups, so 999.999 is a thousand", () => {
    expect(formatMoney(999.999, "€", 2, "de")).toBe(`1.000,00${NBSP}€`);
    expect(formatMoney(1.005, "€", 2, "de")).toBe(`1,01${NBSP}€`);
  });

  it("writes English with the symbol first and a comma for thousands", () => {
    expect(formatMoney(13.99, "€", 2, "en")).toBe("€13.99");
    expect(formatMoney(1500, "¥", 0, "en")).toBe("¥1,500");
    expect(formatMoney(1403.4, "$", 2, "en")).toBe("$1,403.40");
    expect(formatMoney(1234567.891, "$", 2, "en")).toBe("$1,234,567.89");
    expect(formatMoney(999.999, "$", 2, "en")).toBe("$1,000.00");
    expect(formatMoney(13.99, "€", 2, undefined)).toBe("€13.99");
    // The sign stays where it always was, after the symbol.
    expect(formatMoney(-5, "€", 2, "en")).toBe("€-5.00");
  });

  it("keeps the symbol on the amount's line: a no-break space, never a plain one", () => {
    expect(formatMoney(13.99, "€", 2, "de")).not.toContain("13,99 €");
  });
});

describe("every place that writes money goes through it", () => {
  it("the screens' formatter, for a row and for a total", () => {
    const store = code(read("lib/currency-store.ts"));
    const fn = store.slice(store.indexOf("export function useFmt"));
    expect((fn.match(/formatMoney\(/g) || []).length).toBe(2);
    expect(fn).toMatch(/const language = i18n\.language;/);
  });

  it("the calendar's day amounts, the add form's price hint and the reminders", () => {
    expect(code(read("app/(tabs)/calendar.tsx"))).toMatch(/fmtCompact = \(amount: number\) => formatMoney\(/);
    expect(code(read("app/(tabs)/subscriptions.tsx"))).toMatch(/≈ \{formatMoney\(converted, currency\.symbol, decimals, i18n\.language\)\}/);
    expect(code(read("lib/notification-scheduler.ts"))).not.toMatch(/toLocaleString\(/);
  });

  it("no screen glues a symbol to a number by hand", () => {
    const files = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    walk("app");
    walk("components");
    const hits = files.filter((f) => /\{currency\.symbol\}\{|\$\{currency\.symbol\}\$\{/.test(code(read(f))));
    expect(hits).toEqual([]);
  });

  it("no translation glues a symbol to a number either", () => {
    /* Account settings said "Standard: €50/Monat" to German readers until
       2026-11-12: "{{symbol}}50" in a locale string, which the screen scan
       above cannot see. A default amount is passed in formatted instead. */
    const glued = [];
    for (const lang of ["en", "de"]) {
      const walk = (o, at) => Object.entries(o).forEach(([k, v]) =>
        typeof v === "string" ? /\{\{symbol\}\}\s*\d/.test(v) && glued.push(`${lang}.${at}${k}`) : walk(v, `${at}${k}.`));
      walk(JSON.parse(read(`locales/${lang}.json`)), "");
    }
    expect(glued).toEqual([]);
  });

  it("the service picker's chips read German in German", () => {
    const netflix = SERVICE_TEMPLATES.find((t) => t.currency === "EUR" && t.billingCycle === "monthly");
    expect(formatTemplatePrice(netflix, "de")).toBe(`${formatMoney(netflix.defaultPrice, "€", 2, "de")}/Monat`);
    expect(formatTemplatePrice(netflix, "en")).toBe(`€${netflix.defaultPrice.toFixed(2)}/mo`);
    expect(code(read("app/(tabs)/subscriptions.tsx"))).toContain("formatTemplatePrice(tpl, i18n.language)");
  });
});

describe("a subscription is an Abo in German", () => {
  const de = JSON.parse(read("locales/de.json"));
  const subscriptionKeys = [
    ["tabs", "subscriptions"],
    ["dashboard", "addExpense"],
    ["dashboard", "recentExpenses"],
    ["dashboard", "emptyExpenses"],
    ["dashboard", "youGuessed_one"],
    ["dashboard", "youGuessed_other"],
    ["subscriptionDetails", "couldntLoad"],
    ["helpSupport", "faq1A"],
    ["helpSupport", "faq2A"],
  ];
  it.each(subscriptionKeys)("%s.%s says Abo, not Ausgabe", (section, key) => {
    expect(de[section][key]).not.toMatch(/Ausgabe/);
  });

  it("the help describes the list as it is now: three dots, then Edit", () => {
    const en = JSON.parse(read("locales/en.json"));
    expect(en.helpSupport.faq2A).not.toMatch(/pencil/i);
    expect(de.helpSupport.faq2A).not.toMatch(/Stift/);
    expect(en.helpSupport.faq1A).not.toMatch(/Subscriptions tab/);
  });
});
