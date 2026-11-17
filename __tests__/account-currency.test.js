/* The currency belongs to the account, not only to the phone (2026-11-17).
 *
 * It used to live in SecureStore alone, so a reinstall, a new phone or another
 * account signing in on this one started from USD, and rows added then were
 * saved as dollars whatever the account used. Drives the REAL store with
 * SecureStore mocked.
 */
const mockSecure = new Map();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (k) => (mockSecure.has(k) ? mockSecure.get(k) : null),
  setItemAsync: async (k, v) => { mockSecure.set(k, v); },
  deleteItemAsync: async (k) => { mockSecure.delete(k); },
}));

const { useCurrencyStore, CURRENCIES } = require("../lib/currency-store");
const EUR = CURRENCIES.find((c) => c.code === "EUR");
const GBP = CURRENCIES.find((c) => c.code === "GBP");
const state = () => useCurrencyStore.getState();
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  mockSecure.clear();
  await state().clearCurrencyChoice();
  await state().loadCurrency();
});

describe("a phone with no currency of its own takes the account's", () => {
  it("a fresh install signs in and gets EUR, saved for the next offline launch", async () => {
    expect(state().baseCurrencyCode).toBe("USD");
    state().applyAccountCurrency("EUR");
    expect(state().currency.code).toBe("EUR");
    expect(state().baseCurrencyCode).toBe("EUR");
    await settle();
    expect(mockSecure.get("base_currency_code")).toBe("EUR");
  });

  it("a currency picked on this phone is never overridden by the account", async () => {
    state().setCurrency(GBP);
    state().applyAccountCurrency("EUR");
    expect(state().currency.code).toBe("GBP");
  });

  it("a choice already stored from an earlier launch wins too", async () => {
    mockSecure.set("selected_currency", JSON.stringify(GBP));
    mockSecure.set("base_currency_code", "GBP");
    await state().loadCurrency();
    state().applyAccountCurrency("EUR");
    expect(state().baseCurrencyCode).toBe("GBP");
  });

  it("an unknown or missing code changes nothing", () => {
    state().applyAccountCurrency("XYZ");
    state().applyAccountCurrency(undefined);
    expect(state().baseCurrencyCode).toBe("USD");
  });

  it("signing out leaves the currency with the account, so the next one starts clean", async () => {
    state().setCurrency(EUR);
    await state().clearCurrencyChoice();
    expect(state().baseCurrencyCode).toBe("USD");
    expect(mockSecure.has("selected_currency")).toBe(false);
    state().applyAccountCurrency("GBP");
    expect(state().baseCurrencyCode).toBe("GBP");
  });

  it("the auth store clears it on sign out and on a change of account", () => {
    const fs = require("fs");
    const src = fs.readFileSync(require("path").join(__dirname, "..", "lib", "auth-store.ts"), "utf8");
    expect((src.match(/clearCurrencyChoice\(\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("currency names read in the app's language (2026-11-17)", () => {
  const de = require("../locales/de.json");
  const en = require("../locales/en.json");
  it("both locales name every currency the picker offers", () => {
    for (const c of CURRENCIES) {
      expect(`${c.code}: ${typeof en.currencyNames[c.code]}`).toBe(`${c.code}: string`);
      expect(`${c.code}: ${typeof de.currencyNames[c.code]}`).toBe(`${c.code}: string`);
    }
    expect(de.currencyNames.GBP).toBe("Britisches Pfund");
  });
  it("Account settings shows the translated name, not the English literal", () => {
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "app", "account-settings.tsx"), "utf8");
    expect(src).not.toMatch(/\{(currency|item)\.name\}/);
    expect((src.match(/t\(`currencyNames\.\$\{/g) || []).length).toBe(2);
  });
});
