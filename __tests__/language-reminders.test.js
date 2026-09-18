/* Finding 1 from Codex's recheck of 31a93689.
 *
 * Switching language reschedules every queued reminder, because the OS bakes
 * the text in when the notification is scheduled and pending ones would
 * otherwise stay in the old language. It called the scheduler with no
 * preferences at all, and the scheduler's `{}` default means push on, renewal
 * alerts on and a three day lead. So changing language RE-ENABLED reminders
 * somebody had switched off, and quietly replaced a seven day choice with three.
 *
 * Behavioural, through the real language store. A scheduler unit test cannot
 * catch this: the scheduler was always right, the caller was not passing it
 * anything. */

const mockPrefs = { value: undefined };
const mockScheduleRenewalReminders = jest.fn(async () => {});

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(async () => {}),
  getItemAsync: jest.fn(async () => null),
}));

jest.mock("../lib/i18n", () => ({
  __esModule: true,
  default: { language: "en", changeLanguage: jest.fn(async () => {}) },
}));

jest.mock("../lib/query-client", () => ({
  queryClient: {
    getQueryData: jest.fn((key) => {
      if (key[0] === "subscriptions") return [{ id: 1, name: "Netflix", price: 15.99, nextBillingDate: "2026-12-01" }];
      if (key[0] === "notifications") return mockPrefs.value;
      return undefined;
    }),
  },
  resetQueryCache: jest.fn(),
}));

jest.mock("../lib/currency-store", () => ({
  useCurrencyStore: { getState: () => ({ currency: { symbol: "$" } }) },
}));

jest.mock("../lib/notification-scheduler", () => ({
  scheduleRenewalReminders: mockScheduleRenewalReminders,
  cancelAllReminders: jest.fn(async () => {}),
}));

const { useLanguageStore } = require("../lib/language-store");

/* The reschedule is deliberately not awaited into setLanguage, so that changing
   language cannot fail on a denied notification permission. That means the call
   arrives a few microtasks later, after three dynamic imports resolve. */
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  mockScheduleRenewalReminders.mockClear();
  mockPrefs.value = undefined;
});

describe("changing language must not change anybody's notification settings", () => {
  it("reschedules at all", async () => {
    // The control: everything below is about WHAT it passes, so first pin that
    // it still passes anything.
    await useLanguageStore.getState().setLanguage("de");
    await settle();
    expect(mockScheduleRenewalReminders).toHaveBeenCalled();
  });

  it("carries the user's disabled push setting through", async () => {
    mockPrefs.value = { pushEnabled: false, renewalAlerts: true, renewalAlertDays: 3 };
    await useLanguageStore.getState().setLanguage("de");
    await settle();

    // Before the fix this third argument was absent entirely, and the
    // scheduler's default re-enabled push.
    const prefs = mockScheduleRenewalReminders.mock.calls[0][2];
    expect(prefs.pushEnabled).toBe(false);
  });

  it("carries a disabled renewal alert through", async () => {
    mockPrefs.value = { pushEnabled: true, renewalAlerts: false, renewalAlertDays: 7 };
    await useLanguageStore.getState().setLanguage("en");
    await settle();
    expect(mockScheduleRenewalReminders.mock.calls[0][2].renewalAlerts).toBe(false);
  });

  it("keeps a seven day lead time instead of dropping to three", async () => {
    mockPrefs.value = { pushEnabled: true, renewalAlerts: true, renewalAlertDays: 7 };
    await useLanguageStore.getState().setLanguage("de");
    await settle();
    expect(mockScheduleRenewalReminders.mock.calls[0][2].renewalAlertDays).toBe(7);
  });

  it("passes an empty object rather than undefined when preferences have not loaded", async () => {
    /* An unloaded preference is not consent to enable anything, but it is not
       consent to disable either: the scheduler treats absent as ON on purpose,
       because silently dropping reminders because a query was slow is the one
       failure this product cannot afford. What matters here is that the third
       argument is always present and never undefined. */
    mockPrefs.value = undefined;
    await useLanguageStore.getState().setLanguage("de");
    await settle();
    expect(mockScheduleRenewalReminders.mock.calls[0][2]).toEqual({});
  });

  it("reads the preferences from the same cache key the rest of the app writes", async () => {
    // A different key would read undefined forever and look like it worked.
    const { queryClient } = require("../lib/query-client");
    mockPrefs.value = { pushEnabled: false };
    await useLanguageStore.getState().setLanguage("de");
    await settle();
    const keys = queryClient.getQueryData.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(keys).toContain(JSON.stringify(["notifications", "preferences"]));
  });
});
