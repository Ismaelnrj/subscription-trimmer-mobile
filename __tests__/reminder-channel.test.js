/* Every reminder is posted to Trimio's own channel, "Renewal reminders".
 *
 * lib/notifications.ts creates that channel at high importance, and until
 * 2026-11-14 no reminder named it. expo-notifications 0.31 then posts to its
 * fallback channel, "Miscellaneous" (read off its BaseNotificationBuilder.kt),
 * so the channel Android lists under Trimio carried nothing, and the one that
 * carried the reminders could be muted without anybody knowing it was them.
 *
 * Behavioural for the scheduler (the real one, against a mocked OS queue that
 * keeps what it was given), plus a scan of every trigger in the app so a new
 * notification cannot be added without a channel. */
const fs = require("fs");
const path = require("path");

const mockQueue = new Map();
let mockNextId = 0;

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date", TIME_INTERVAL: "timeInterval" },
  scheduleNotificationAsync: jest.fn(async (request) => {
    const id = `n${++mockNextId}`;
    mockQueue.set(id, request);
    return id;
  }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => { mockQueue.clear(); }),
  cancelScheduledNotificationAsync: jest.fn(async (id) => { mockQueue.delete(id); }),
}));

jest.mock("../lib/notifications", () => ({
  registerForPushNotificationsAsync: jest.fn(async () => {}),
}));

jest.mock("../lib/i18n", () => ({
  __esModule: true,
  default: { language: "en", t: (k) => k },
}));

const { scheduleRenewalReminders, setFreePremiumEnd } = require("../lib/notification-scheduler");
const { REMINDER_CHANNEL_ID } = require("../lib/reminder-channel");

const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

describe("reminders are posted to the Renewal reminders channel", () => {
  it("is the channel lib/notifications.ts creates", () => {
    const src = fs.readFileSync(path.join(__dirname, "../lib/notifications.ts"), "utf8");
    expect(src).toMatch(/setNotificationChannelAsync\(REMINDER_CHANNEL_ID,/);
    expect(REMINDER_CHANNEL_ID).toBe("default");
  });

  it("names it on every renewal, trial and free Premium reminder", async () => {
    setFreePremiumEnd(inDays(10));
    await scheduleRenewalReminders(
      [{ id: 1, name: "Netflix", price: 15.99, currency: "EUR", billingCycle: "monthly",
         nextBillingDate: inDays(12), trialEndDate: inDays(9), isActive: true }],
      "€",
      { pushEnabled: true, renewalAlerts: true, renewalAlertDays: 3 }
    );
    const triggers = [...mockQueue.values()].map((r) => r.trigger);
    // Renewals, the trial and the free Premium reminder: all three kinds.
    expect(triggers.length).toBeGreaterThanOrEqual(3);
    for (const trigger of triggers) expect(trigger.channelId).toBe(REMINDER_CHANNEL_ID);
    setFreePremiumEnd(null);
  });
});

describe("no notification anywhere in the app is posted without a channel", () => {
  const roots = ["app", "lib", "components"].map((d) => path.join(__dirname, "..", d));
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) files.push(full);
    }
  };
  roots.forEach(walk);

  it("finds the triggers it is meant to check (guards the scan)", () => {
    const count = files.reduce(
      (n, f) => n + (fs.readFileSync(f, "utf8").match(/SchedulableTriggerInputTypes\.\w+/g) || []).length, 0);
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it("every trigger object names channelId", () => {
    const missing = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      // The trigger object literal: from "trigger: {" to its closing brace on the same line.
      for (const m of src.matchAll(/trigger:\s*\{[^\n]*SchedulableTriggerInputTypes[^\n]*\}/g)) {
        if (!/channelId:/.test(m[0])) missing.push(`${path.relative(path.join(__dirname, ".."), file)}: ${m[0]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
