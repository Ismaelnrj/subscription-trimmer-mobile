/* Renewal reminders, in both languages.

   This file was the largest localisation gap in the app and the least visible
   one, because a notification is the one surface you cannot see by opening the
   app and looking. 589 translated keys, a German store listing, German legal
   documents and a German landing page, and then the single message the product
   exists to send arrived in English.

   Source-reading rather than behavioural: scheduling needs expo-notifications
   and a real OS. So these pin that no English is baked in and that the German
   copy obeys the project's own rules. */

const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const SCHED = read("lib/notification-scheduler.ts");
const EN = JSON.parse(read("locales/en.json"));
const DE = JSON.parse(read("locales/de.json"));

describe("no English is baked into the scheduler", () => {
  it("has no hardcoded reminder strings left", () => {
    for (const gone of [
      "in 7 days", "in 3 days",
      "will be charged on",
      "trial ends tomorrow",
      "Cancel now if you",
    ]) {
      expect(SCHED.includes(gone)).toBe(false);
    }
  });

  it("builds every title and body through i18n", () => {
    expect(SCHED).toMatch(/i18n\.t\("notifications\.reminders\.renewTitle"/);
    expect(SCHED).toMatch(/i18n\.t\("notifications\.reminders\.renewBody"/);
    expect(SCHED).toMatch(/i18n\.t\("notifications\.reminders\.trialTitle"/);
    expect(SCHED).toMatch(/i18n\.t\("notifications\.reminders\.trialBody"/);
  });

  it("formats the date in the app's language, not the device's", () => {
    /* A bare toLocaleDateString() follows the DEVICE locale, so a German user
       on an English phone got an English date inside German text. */
    expect(SCHED).not.toMatch(/toLocaleDateString\(\)/);
    expect(SCHED).toMatch(/toLocaleDateString\(.*de-DE/);
  });

  it("never prints NaN at somebody", () => {
    // An unparseable price used to render "NaN will be charged".
    expect(SCHED).toMatch(/Number\.isFinite\(n\)/);
  });

  it("cannot break scheduling if i18n throws", () => {
    const idx = SCHED.indexOf("function lang()");
    expect(idx).toBeGreaterThan(-1);
    const fn = SCHED.slice(idx, idx + 220);
    expect(fn).toMatch(/try\s*\{/);
    expect(fn).toMatch(/catch/);
  });
});

describe("the German copy follows this project's own rules", () => {
  const de = DE.notifications.reminders;
  const en = EN.notifications.reminders;

  it("exists in both languages with the same keys", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });

  it("uses a decimal COMMA, which is why formatting is language aware", () => {
    /* tools/make-cut.py already refuses a decimal point in German video
       captions. A German notification reading "€10.00" would break a rule this
       project enforces on its own marketing. */
    expect(SCHED).toMatch(/toLocaleString\("de-DE"/);
  });

  it("stays informal, matching every other German surface", () => {
    const all = Object.values(de).join(" ");
    expect(all).not.toMatch(/\bSie\b/);
    expect(all).toMatch(/Kündige|dein|du/i);
  });

  it("says Testphase, never Probeabo", () => {
    const all = Object.values(de).join(" ");
    expect(all).not.toMatch(/Probeabo/);
    expect(all).toMatch(/Testphase/);
  });

  it("uses abbuchen for a charge, the verb a German bank statement uses", () => {
    // Matches chargedOnExpiry and the German tagline "Wissen, bevor abgebucht
    // wird", so the product says one thing across every surface.
    expect(de.renewBody).toMatch(/abgebucht/);
  });

  it("says verlängert for a renewal", () => {
    expect(de.renewTitle).toMatch(/verlängert/);
  });

  it("uses no dash as clause punctuation, in either language", () => {
    for (const block of [en, de]) {
      for (const [k, v] of Object.entries(block)) {
        expect(`${k}: ${v}`.match(/\S\s+[-–—]\s+\S|—/)).toBeNull();
      }
    }
  });
});

describe("switching language updates reminders already queued", () => {
  const STORE = read("lib/language-store.ts");

  it("reschedules on a language change", () => {
    /* The text is baked in when the OS schedules it, so pending reminders keep
       the old language until something reschedules them. */
    expect(STORE).toMatch(/rescheduleReminders\(\)/);
    expect(STORE).toMatch(/scheduleRenewalReminders/);
  });

  it("reads the subscriptions from the shared query cache", () => {
    expect(STORE).toMatch(/\["subscriptions", "list"\]/);
  });

  it("can never fail the language change itself", () => {
    const idx = STORE.indexOf("function rescheduleReminders");
    const fn = STORE.slice(idx, STORE.indexOf("export const useLanguageStore"));
    expect(fn).toMatch(/try\s*\{/);
    expect(fn).toMatch(/catch/);
    // fire and forget: the caller must not await it
    expect(STORE).not.toMatch(/await rescheduleReminders/);
  });
});
