/* Two reminder findings from the Codex review of a578150b, 2026-10-18, built
 * with the owner's yes the same day.
 *
 *   4. Only the stored next payment was queued, so somebody who stopped
 *      opening the app got one warning and then none for every later cycle.
 *      The next few payments within REMINDER_HORIZON_DAYS are queued now.
 *   5. A renewal added inside the lead time got no warning at all. It now
 *      falls back to 09:00 the day before, never to an immediate notification.
 *
 * Behavioural, through the real scheduler against a mocked OS queue, the same
 * harness as notification-race.test.js. Also measured on Node type stripping
 * with real date-fns 2.30.0 against both versions, frozen to Sat 17 Oct 10:00:
 * a monthly row went from 1 queued reminder to 2, a weekly row from 0 (its
 * lead time had passed) to 4, a stale stored date from 0 to 2; paused, push off
 * and renewal alerts off were unchanged. */

const mockQueue = [];
jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date" },
  scheduleNotificationAsync: jest.fn(async (request) => { mockQueue.push(request); return `n${mockQueue.length}`; }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => { mockQueue.length = 0; }),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
}));
jest.mock("../lib/notifications", () => ({ registerForPushNotificationsAsync: jest.fn(async () => {}) }));
jest.mock("../lib/i18n", () => ({ __esModule: true, default: { language: "en", t: (k) => k } }));

const { scheduleRenewalReminders } = require("../lib/notification-scheduler");

const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const sub = (o) => ({ id: 1, name: "Netflix", price: 9.99, currency: "EUR", isActive: true, ...o });
const renewals = () => mockQueue.filter((r) => r.content.title === "notifications.reminders.renewTitle");

beforeEach(() => { mockQueue.length = 0; });

describe("later cycles are queued, not only the next payment", () => {
  it("a monthly row due in 20 days queues this cycle and the next", async () => {
    await scheduleRenewalReminders([sub({ billingCycle: "monthly", nextBillingDate: inDays(20) })], "€", {});
    expect(renewals().length).toBe(2);
  });

  it("a weekly row is capped so it cannot crowd out the rest", async () => {
    await scheduleRenewalReminders([sub({ billingCycle: "weekly", nextBillingDate: inDays(10) })], "€", {});
    expect(renewals().length).toBe(4);
  });

  it("a paused row still queues nothing", async () => {
    await scheduleRenewalReminders([sub({ billingCycle: "monthly", nextBillingDate: inDays(20), isActive: false })], "€", {});
    expect(mockQueue.length).toBe(0);
  });
});

describe("a renewal inside the lead time falls back to the day before", () => {
  it("due in 2 days with a 7 day lead: one reminder, 09:00 tomorrow", async () => {
    await scheduleRenewalReminders([sub({ billingCycle: "yearly", nextBillingDate: inDays(2) })], "€", { renewalAlertDays: 7 });
    const r = renewals();
    expect(r.length).toBe(1);
    const at = r[0].trigger.date;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours()]).toEqual(
      [tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 9]);
  });

  it("nothing is ever scheduled in the past", async () => {
    await scheduleRenewalReminders([sub({ billingCycle: "weekly", nextBillingDate: inDays(1) })], "€", { renewalAlertDays: 3 });
    for (const r of mockQueue) expect(r.trigger.date.getTime()).toBeGreaterThan(Date.now());
  });
});
