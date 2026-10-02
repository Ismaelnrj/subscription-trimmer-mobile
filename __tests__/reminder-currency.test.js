/**
 * A RENEWAL REMINDER NAMES THE ROW'S OWN CURRENCY.
 *
 * The push reminder printed each row's RAW price beside the APP's currency
 * symbol, so it named charges nobody would see. MEASURED on 2026-10-02 by
 * running the real lib/notification-scheduler.ts (HEAD and the fix) on Node
 * type stripping, only its import specifiers rewritten to local stubs, for a
 * euro user with four rows. German reminder amounts, before:
 *     9,99 €  ·  15,99 €  ·  1.500,00 €  ·  4,50 €
 * after:
 *     9,99 $  ·  15,99 €  ·  1.500 ¥     ·  4,50 €
 * A 1500 yen row was announced as fifteen hundred EUROS. The fourth row has no
 * currency, so the app symbol is still the honest reading and is unchanged.
 *
 * Source reading, because the scheduler is TypeScript and the behavioural half
 * is the measurement above; notification-race.test.js still drives the real
 * module under jest in CI.
 */
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const sched = read('lib/notification-scheduler.ts');
const store = read('lib/currency-store.ts');
const list = read('lib/currencies.ts');

describe('the reminder amount', () => {
  test('formatAmount is handed the row currency, and the loop passes it', () => {
    expect(sched).toMatch(/function formatAmount\(price: unknown, rowCurrency: unknown, fallbackSymbol: string\)/);
    expect(sched).toContain('formatAmount(sub.price, sub.currency, currencySymbol)');
    expect(sched).not.toMatch(/formatAmount\(sub\.price, currencySymbol\)/);
  });

  test('the app symbol is only the fallback for a row with no known currency', () => {
    expect(sched).toMatch(/const symbol = own \? own\.symbol : fallbackSymbol;/);
  });

  test('yen is written without decimals, as every screen writes it', () => {
    expect(sched).toMatch(/own\?\.code === "JPY" \? 0 : 2/);
  });

  test('the public signature is unchanged, so no caller can pass the wrong thing', () => {
    // Adding a parameter to an exported function is what shipped
    // "TypeError: 50 is not a function" in September 2026.
    expect(sched).toMatch(/export function scheduleRenewalReminders\(\s*subscriptions: any\[\],\s*currencySymbol: string,\s*prefs/);
  });
});

describe('one currency list, with no native imports', () => {
  test('the scheduler reads it from the dependency-free module', () => {
    expect(sched).toContain('import { CURRENCIES } from "./currencies";');
    expect(sched).not.toMatch(/from "\.\/currency-store"/);
  });

  test('currencies.ts imports nothing', () => {
    expect(list).not.toMatch(/^\s*import\s/m);
    expect((list.match(/code: "/g) || []).length).toBe(9);
  });

  test('currency-store re-exports it and no longer holds a copy', () => {
    expect(store).toContain('import { CURRENCIES } from "./currencies";');
    expect(store).toContain('export { CURRENCIES };');
    expect(store).not.toMatch(/CURRENCIES = \[/);
  });
});

describe('no English placeholder on the auth screens', () => {
  test('register and verify-email fall back to their localised strings', () => {
    expect(read('app/register.tsx')).not.toContain('"Something went wrong."');
    const verify = read('app/verify-email.tsx');
    expect(verify).not.toContain('"Unknown error"');
    expect(verify).not.toMatch(/err\.message \|\|/);
  });
});
