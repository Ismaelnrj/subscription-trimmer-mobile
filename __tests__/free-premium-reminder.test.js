/* The reverse trial's reminder, 2026-11-07, with the owner's yes: one phone
 * notification before free Premium ends, two days ahead at 09:00, the day
 * before when that has passed, nothing when both have.
 *
 * Behavioural, through the real scheduler against a mocked OS queue (the same
 * mocks as notification-race.test.js), with only Date frozen so the 09:00
 * arithmetic is the same at every hour CI happens to run. */

const mockQueue = new Map();
let mockNextId = 0;

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date" },
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

// The key, plus the count when one is passed, so the plural actually chosen is visible.
jest.mock("../lib/i18n", () => ({
  __esModule: true,
  default: { language: "en", t: (k, o) => (o && o.count != null ? `${k}:${o.count}` : k) },
}));

const { scheduleRenewalReminders, setFreePremiumEnd, cancelAllReminders } = require("../lib/notification-scheduler");

const END = "2026-11-21T14:30:00.000Z"; // a trial started 7 November at 14:30 UTC
const at = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
const only = () => [...mockQueue.values()];
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

function freeze(local) {
  jest.useFakeTimers({ now: local, doNotFake: ["setTimeout", "setImmediate", "setInterval", "clearTimeout", "clearInterval", "nextTick", "queueMicrotask"] });
}

beforeEach(async () => {
  setFreePremiumEnd(null);
  await cancelAllReminders();
  mockQueue.clear();
});
afterEach(() => jest.useRealTimers());

describe("one reminder before free Premium ends", () => {
  it("two days ahead at 09:00, saying two days", async () => {
    freeze(new Date(2026, 10, 7, 12, 0));
    setFreePremiumEnd(END);
    await scheduleRenewalReminders([], "€", {});
    expect(only().map((r) => r.content.title)).toEqual(["notifications.reminders.freePremiumTitle:2"]);
    expect(at(only()[0].trigger.date)).toEqual(new Date(2026, 10, 19, 9, 0));
    expect(only()[0].content.body).toBe("notifications.reminders.freePremiumBody");
  });

  it("the day before when two days ahead has passed, saying tomorrow", async () => {
    freeze(new Date(2026, 10, 19, 10, 0));
    setFreePremiumEnd(END);
    await scheduleRenewalReminders([], "€", {});
    expect(only().map((r) => r.content.title)).toEqual(["notifications.reminders.freePremiumTitle:1"]);
    expect(at(only()[0].trigger.date)).toEqual(new Date(2026, 10, 20, 9, 0));
  });

  it("nothing when both have passed, never a late one", async () => {
    freeze(new Date(2026, 10, 20, 10, 0));
    setFreePremiumEnd(END);
    await scheduleRenewalReminders([], "€", {});
    expect(mockQueue.size).toBe(0);
  });

  it("nothing with no free Premium, so renewal-only behaviour is unchanged", async () => {
    freeze(new Date(2026, 10, 7, 12, 0));
    await scheduleRenewalReminders([], "€", {});
    expect(mockQueue.size).toBe(0);
  });
});

describe("it follows the switches and the account", () => {
  it("push off means none", async () => {
    freeze(new Date(2026, 10, 7, 12, 0));
    setFreePremiumEnd(END);
    await scheduleRenewalReminders([], "€", { pushEnabled: false });
    expect(mockQueue.size).toBe(0);
  });

  it("renewal alerts off does not remove it: it is not a renewal", async () => {
    freeze(new Date(2026, 10, 7, 12, 0));
    setFreePremiumEnd(END);
    await scheduleRenewalReminders([], "€", { renewalAlerts: false });
    expect(mockQueue.size).toBe(1);
  });

  it("is withdrawn at once when free Premium stops, as on a purchase", async () => {
    freeze(new Date(2026, 10, 7, 12, 0));
    setFreePremiumEnd(END);
    await scheduleRenewalReminders([], "€", {});
    expect(mockQueue.size).toBe(1);
    setFreePremiumEnd(null);
    await settle();
    expect(mockQueue.size).toBe(0);
  });

  it("sits beside the renewal reminders, which still arrive", async () => {
    freeze(new Date(2026, 10, 7, 12, 0));
    setFreePremiumEnd(END);
    const subs = [{ id: 1, name: "Netflix", price: 15.99, currency: "EUR", billingCycle: "yearly", nextBillingDate: "2026-11-30" }];
    await scheduleRenewalReminders(subs, "€", {});
    const titles = only().map((r) => r.content.title).sort();
    expect(titles).toEqual(["notifications.reminders.freePremiumTitle:2", "notifications.reminders.renewTitle"]);
  });

  it("is gone after sign out", async () => {
    freeze(new Date(2026, 10, 7, 12, 0));
    setFreePremiumEnd(END);
    await scheduleRenewalReminders([], "€", {});
    await cancelAllReminders();
    await settle();
    expect(mockQueue.size).toBe(0);
  });
});

describe("the copy", () => {
  const en = require("../locales/en.json").notifications.reminders;
  const de = require("../locales/de.json").notifications.reminders;
  it("both languages carry both plural forms and the body", () => {
    for (const r of [en, de]) {
      expect(r.freePremiumTitle_one).toBeTruthy();
      expect(r.freePremiumTitle_other).toContain("{{count}}");
      expect(r.freePremiumBody).toBeTruthy();
    }
    expect(de.freePremiumTitle_other).not.toBe(en.freePremiumTitle_other);
  });
});
