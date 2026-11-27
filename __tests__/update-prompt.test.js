/**
 * THE "NEW VERSION ON GOOGLE PLAY" PROMPT ASKS THE RIGHT PHONES, AND NOT ON
 * EVERY LAUNCH.
 *
 * The owner, 2026-11-27: people should be told when there is an update, with
 * a popup asking them to update. The popup already existed
 * (components/UpdateAvailableModal.tsx, switched on by MIN_ANDROID_VERSION_CODE
 * in Railway), but "Later" only closed it, so an older phone was asked again
 * at every launch: a nag, the fastest way to an uninstall. lib/update-prompt.ts
 * now decides, and "Later" (or Android's back button) holds for a few days.
 */
const fs = require("fs");
const path = require("path");
const { shouldPromptUpdate, SNOOZE_DAYS } = require("../lib/update-prompt");

const NOW = Date.UTC(2026, 10, 27, 12);
const DAY = 86400000;

describe("shouldPromptUpdate", () => {
  test("asks a phone older than the minimum", () => {
    expect(shouldPromptUpdate(40, 42, null, NOW)).toBe(true);
    expect(shouldPromptUpdate(41, 42, null, NOW)).toBe(true);
  });

  test("never asks a phone already on the minimum or newer", () => {
    expect(shouldPromptUpdate(42, 42, null, NOW)).toBe(false);
    expect(shouldPromptUpdate(43, 42, null, NOW)).toBe(false);
  });

  test("an unset or broken minimum never asks (Railway unset means 0)", () => {
    for (const min of [0, NaN, -1, 41.5]) expect(shouldPromptUpdate(40, min, null, NOW)).toBe(false);
  });

  test("an unknown installed build is never asked", () => {
    expect(shouldPromptUpdate(null, 42, null, NOW)).toBe(false);
  });

  test("Later holds for SNOOZE_DAYS, then it asks again", () => {
    const snooze = { code: 42, until: NOW + SNOOZE_DAYS * DAY };
    expect(shouldPromptUpdate(40, 42, snooze, NOW)).toBe(false);
    expect(shouldPromptUpdate(40, 42, snooze, NOW + SNOOZE_DAYS * DAY)).toBe(true);
  });

  test("a newer minimum asks at once, whatever was snoozed before", () => {
    expect(shouldPromptUpdate(41, 43, { code: 42, until: NOW + 2 * DAY }, NOW)).toBe(true);
  });
});

describe("the popup uses it", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "components/UpdateAvailableModal.tsx"), "utf8");

  test("decides with shouldPromptUpdate on the installed build", () => {
    expect(src).toMatch(/shouldPromptUpdate\(nativeBuild\(\)\.versionCode, min, snooze, Date\.now\(\)\)/);
  });

  test("Later and Android's back button both snooze", () => {
    expect(src).toMatch(/onRequestClose=\{later\}/);
    expect(src).toMatch(/style=\{styles\.laterButton\} onPress=\{later\}/);
    expect(src).toMatch(/const later = \(\) => \{\s*setVisible\(false\);\s*snoozeUpdatePrompt\(minimum\);/);
  });
});
