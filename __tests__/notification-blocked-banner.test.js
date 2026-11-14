/* Notification settings says when Android is blocking Trimio.
 *
 * The push switch on that screen is a Trimio preference stored on the server.
 * Android's own permission and the reminder channel are separate, and either
 * can be off while the switch reads on. Until 2026-11-14 nothing said so, and
 * the permission is asked at most once, after an add (lib/reminder-primer.ts),
 * so a person who refused it then had no way back inside the app: reminders
 * were queued every day and never shown.
 *
 * Source reading: the screen needs a full React Native render to drive, and
 * the decision it makes is four lines, pinned here line by line. The data it
 * reads (permission, channel importance) is measured behaviourally in
 * reminder-diagnostics.test.js. */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "../app/notification-preferences.tsx"), "utf8");
const en = require("../locales/en.json").notifPrefs;
const de = require("../locales/de.json").notifPrefs;

describe("the blocked notifications warning", () => {
  it("reads what the phone allows, and again on returning from Android settings", () => {
    expect(src).toMatch(/readReminderDiagnostics\(\)\.then\(setPhone\)/);
    expect(src).toMatch(/AppState\.addEventListener\("change"/);
  });

  it("counts a switched off channel as blocked, not only a refused permission", () => {
    expect(src).toMatch(/const channelOff = phone\?\.channelImportance != null && phone\.channelImportance <= 2;/);
    expect(src).toMatch(/const blocked = !!phone && \(phone\.permission !== "granted" \|\| channelOff\);/);
  });

  it("asks when Android still can, and otherwise opens Android's settings for Trimio", () => {
    expect(src).toMatch(/const canAsk = phone\?\.permission === "undetermined";/);
    expect(src).toMatch(/if \(canAsk\) \{\s*await registerForPushNotificationsAsync\(\)/);
    expect(src).toMatch(/Linking\.openSettings\(\)/);
  });

  it("stays away when the person switched push off in Trimio themselves", () => {
    expect(src).toMatch(/\{blocked && prefs\.pushEnabled !== false && \(/);
  });

  it("is written in both languages", () => {
    for (const key of ["blockedTitle", "blockedBody", "blockedAllow", "blockedOpenSettings"]) {
      expect(typeof en[key]).toBe("string");
      expect(typeof de[key]).toBe("string");
      expect(de[key]).not.toBe(en[key]);
    }
  });
});
