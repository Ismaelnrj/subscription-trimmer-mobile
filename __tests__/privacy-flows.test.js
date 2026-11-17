/* Two data flows the privacy policy does not allow, closed 2026-11-17.
 *
 * 1. The app fetched an Expo push token on every launch with notifications
 *    allowed and never used it (every reminder is scheduled on the phone),
 *    which sent device details to Expo's push service, a provider the policy
 *    does not list.
 * 2. subscription_added sent the stored category to PostHog, and a custom
 *    category is whatever the person typed; the policy says analytics never
 *    sees what somebody tracks.
 */
const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("data the app does not send", () => {
  it("no push token is fetched anywhere in the app", () => {
    for (const f of ["lib/notifications.ts", "lib/notification-scheduler.ts", "lib/reminder-primer.ts", "app/_layout.tsx"]) {
      expect(`${f}: ${/getExpoPushTokenAsync|getDevicePushTokenAsync/.test(code(read(f)))}`).toBe(`${f}: false`);
    }
  });

  it("subscription_added carries only a built in category", () => {
    for (const f of ["app/(tabs)/subscriptions.tsx", "app/_layout.tsx"]) {
      const src = code(read(f));
      const i = src.indexOf('track("subscription_added"');
      expect(i).toBeGreaterThan(-1);
      const call = src.slice(i, src.indexOf(")", src.indexOf("category", i)) + 1);
      expect(`${f}: ${call}`).toMatch(/category: canonicalCategory\(/);
    }
  });
});
