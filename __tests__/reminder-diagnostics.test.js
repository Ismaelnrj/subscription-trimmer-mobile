/* The Build Info panel reads out the phone's side of reminders.
 *
 * Added 2026-11-14 after the owner reported that reminder emails arrive and
 * phone reminders do not. The app's own path was read end to end and holds;
 * what could not be seen is whether Android lets Trimio post, whether the
 * channel was switched off, and whether anything is queued. All three fail
 * silently, so the panel says them.
 *
 * Behavioural for readReminderDiagnostics and sendTestReminder against a
 * mocked expo-notifications, plus a source check that the panel prints them. */
const fs = require("fs");
const path = require("path");

const mockState = { permission: { status: "granted", canAskAgain: true }, channel: { importance: 6 }, requests: [], scheduled: [] };

jest.mock("react-native", () => ({ Platform: { OS: "android" } }));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: "x" } } } } }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { HIGH: 6 },
  SchedulableTriggerInputTypes: { DATE: "date", TIME_INTERVAL: "timeInterval" },
  getPermissionsAsync: jest.fn(async () => mockState.permission),
  getNotificationChannelAsync: jest.fn(async () => mockState.channel),
  getAllScheduledNotificationsAsync: jest.fn(async () => mockState.requests),
  scheduleNotificationAsync: jest.fn(async (r) => { mockState.scheduled.push(r); return "id"; }),
}));

const { readReminderDiagnostics, sendTestReminder } = require("../lib/notifications");
const { REMINDER_CHANNEL_ID } = require("../lib/reminder-channel");

describe("readReminderDiagnostics", () => {
  it("reports permission, channel, the queue size and the earliest reminder", async () => {
    mockState.permission = { status: "granted", canAskAgain: true };
    mockState.channel = { importance: 6 };
    mockState.requests = [
      { content: { title: "Spotify renews in 3 days" }, trigger: { type: "date", value: Date.UTC(2026, 11, 3, 8) } },
      { content: { title: "Netflix renews in 3 days" }, trigger: { type: "date", value: Date.UTC(2026, 10, 20, 8) } },
    ];
    const d = await readReminderDiagnostics();
    expect(d.permission).toBe("granted");
    expect(d.channelImportance).toBe(6);
    expect(d.queued).toBe(2);
    expect(d.next).toEqual({ at: Date.UTC(2026, 10, 20, 8), title: "Netflix renews in 3 days" });
  });

  it("says denied when Android will not ask again, and reads a switched off channel", async () => {
    mockState.permission = { status: "undetermined", canAskAgain: false };
    mockState.channel = { importance: 2 };
    mockState.requests = [];
    const d = await readReminderDiagnostics();
    expect(d.permission).toBe("denied");
    expect(d.channelImportance).toBe(2);
    expect(d.queued).toBe(0);
    expect(d.next).toBeNull();
  });

  it("reports a missing channel as null and accepts a { date } trigger", async () => {
    mockState.permission = { status: "undetermined", canAskAgain: true };
    mockState.channel = null;
    mockState.requests = [{ content: { title: "Trial ends" }, trigger: { type: "date", date: "2026-11-20T08:00:00Z" } }];
    const d = await readReminderDiagnostics();
    expect(d.permission).toBe("undetermined");
    expect(d.channelImportance).toBeNull();
    expect(d.next.at).toBe(Date.parse("2026-11-20T08:00:00Z"));
  });
});

describe("sendTestReminder", () => {
  it("goes through the same alarm and channel as a real reminder", async () => {
    mockState.scheduled = [];
    await sendTestReminder("Trimio test reminder", "body", 10);
    expect(mockState.scheduled).toHaveLength(1);
    expect(mockState.scheduled[0].trigger).toEqual({ type: "timeInterval", seconds: 10, channelId: REMINDER_CHANNEL_ID });
  });
});

describe("the Build Info panel prints them", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app/help-support.tsx"), "utf8");
  it("shows the four lines and the test button", () => {
    for (const label of ["Notifications allowed:", "Reminder channel:", "Reminders queued:", "Next reminder:"]) {
      expect(src).toContain(label);
    }
    expect(src).toMatch(/sendTestReminder\(t\("helpSupport\.testReminderTitle"\)/);
    expect(src).toMatch(/AppState\.addEventListener\("change"/);
  });
});
