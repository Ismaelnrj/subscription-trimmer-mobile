/* Finding 3 from Codex's recheck of 31a93689.
 *
 * Cancelling reminders did not stop scheduling that was already in flight. The
 * generation check ran once, at the top of each subscription, so the dangerous
 * moment was not covered: if the sign-out landed while an enqueue was awaiting
 * the OS, that enqueue completed AFTERWARDS and the notification stayed. The
 * same iteration then queued the trial reminder with no check at all.
 *
 * Behavioural, through the real scheduler against a mocked OS queue whose
 * scheduleNotificationAsync can be made to hang on demand. A source-reading
 * test cannot express "while pending", which is the entire defect. */

const mockQueue = new Map();
let mockNextId = 0;
let mockGate = null;

/** Make every subsequent enqueue park until released. This is the pending
 *  operation: without it the race has no window and the old code passes. */
function openGate() {
  let release;
  const promise = new Promise((r) => { release = r; });
  mockGate = { promise, release };
  return mockGate;
}
function closeGate() { mockGate = null; }

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date" },
  scheduleNotificationAsync: jest.fn(async (request) => {
    if (mockGate) await mockGate.promise;
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

const { scheduleRenewalReminders, cancelAllReminders } = require("../lib/notification-scheduler");

const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// One subscription that produces BOTH a renewal and a trial reminder, because
// the trial enqueue is the one that had no generation check in front of it.
const SUBS = [{ id: 1, name: "Netflix", price: 15.99, nextBillingDate: inDays(30), trialEndDate: inDays(20) }];

// The scheduler is fire-and-forget in places; let the microtask queue drain.
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  mockQueue.clear();
  closeGate();
});

describe("signing out stops scheduling that is already in flight", () => {
  it("queues a renewal and a trial reminder when nothing interrupts it", async () => {
    // The control. Without this the tests below pass by scheduling nothing.
    await scheduleRenewalReminders(SUBS, "$", {});
    expect(mockQueue.size).toBe(2);
  });

  it("leaves nothing behind when the cancel lands mid-enqueue", async () => {
    const gate = openGate();
    const run = scheduleRenewalReminders(SUBS, "$", {});
    await new Promise((r) => setImmediate(r));   // reach the parked enqueue

    await cancelAllReminders();
    gate.release();
    closeGate();
    await run;
    await settle();

    // Before the fix: 2. The renewal landed after the cancel and the trial was
    // then enqueued on top of it, both carrying the old account's name.
    expect(mockQueue.size).toBe(0);
  });

  it("does not enqueue the trial reminder after cancellation", async () => {
    const gate = openGate();
    const run = scheduleRenewalReminders(SUBS, "$", {});
    await new Promise((r) => setImmediate(r));
    await cancelAllReminders();
    gate.release();
    closeGate();
    await run;
    await settle();

    const titles = [...mockQueue.values()].map((r) => r.content.title);
    expect(titles).toEqual([]);
  });

  it("still schedules normally for the session that comes next", async () => {
    // A guard that also breaks the working case is not a fix.
    await cancelAllReminders();
    await scheduleRenewalReminders(SUBS, "$", {});
    await settle();
    expect(mockQueue.size).toBe(2);
  });

  it("does not let a cancelled run's cleanup wipe the next session's queue", async () => {
    /* The sweep in cancelAllReminders runs after the in-flight run settles,
       which can be long after somebody has signed in again. Unguarded it would
       clear the NEW account's reminders. */
    const gate = openGate();
    const old = scheduleRenewalReminders(SUBS, "$", {});
    await new Promise((r) => setImmediate(r));
    await cancelAllReminders();
    closeGate();
    gate.release();
    await old;

    await scheduleRenewalReminders(SUBS, "$", {});
    await settle();
    expect(mockQueue.size).toBe(2);
  });
});

describe("a preference change beats a run that is already going", () => {
  it("an older enabled run cannot refill a newly disabled queue", async () => {
    /* Turning reminders off while a scheduling run is parked inside the OS: the
       older run resumes afterwards and used to re-queue everything, so the
       switch appeared to do nothing until the next refetch. */
    const gate = openGate();
    const stale = scheduleRenewalReminders(SUBS, "$", {});
    await new Promise((r) => setImmediate(r));

    closeGate();
    const fresh = scheduleRenewalReminders(SUBS, "$", { pushEnabled: false });
    gate.release();
    await Promise.all([stale, fresh]);
    await settle();

    expect(mockQueue.size).toBe(0);
  });

  it("and the newer run wins even when it is the enabling one", async () => {
    const gate = openGate();
    const stale = scheduleRenewalReminders(SUBS, "$", { pushEnabled: false });
    await new Promise((r) => setImmediate(r));
    closeGate();
    const fresh = scheduleRenewalReminders(SUBS, "$", {});
    gate.release();
    await Promise.all([stale, fresh]);
    await settle();

    expect(mockQueue.size).toBe(2);
  });
});
