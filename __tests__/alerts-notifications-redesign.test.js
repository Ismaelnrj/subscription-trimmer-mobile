/* Alerts and Notifications, redone 2026-11-07. Both drew every row as its own
   card with a coloured left edge; Alerts painted low severity in Tailwind
   blue (#3B82F6 on #DBEAFE, off palette and a pale block on the dark card),
   and its "View Subscription" button opened the whole list. Notifications
   tinted unread cards and offered an 11px "Mark read" button a few dp tall. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const code = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const ALERTS = code("app/alerts.tsx");
const NOTES = code("app/notifications.tsx");

describe("Alerts", () => {
  it("takes every colour from the theme", () => {
    expect(ALERTS).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(ALERTS).not.toMatch(/borderLeft/);
  });

  it("opens the subscription an alert is about", () => {
    expect(ALERTS).toMatch(/router\.push\(`\/subscription-details\?id=\$\{alert\.subscriptionId\}`\)/);
    expect(ALERTS).not.toContain("alerts.viewSubscription");
  });

  it("lists alerts in one grouped card on the type scale", () => {
    expect(ALERTS).toMatch(/i > 0 && styles\.rowDivider/);
    expect(ALERTS).not.toMatch(/fontSize: \d+|fontWeight/);
  });
});

describe("Notifications", () => {
  it("marks unread with a dot and a stronger title, no tinted card or edge", () => {
    expect(NOTES).not.toMatch(/borderLeft|notificationCardUnread/);
    expect(NOTES).toContain("styles.unreadDot");
  });

  it("marks a row read by tapping it, not by a tiny button", () => {
    expect(NOTES).toMatch(/onPress=\{\(\) => \{ if \(!n\.read\) markAsReadMutation\.mutate\(n\.id\); \}\}/);
    expect(NOTES).not.toContain("styles.actionButton");
  });

  it("gives Mark all read a full target and sets text on the scale", () => {
    expect(NOTES).toMatch(/markAllButton: \{[^}]*minHeight: 48/);
    expect(NOTES).not.toMatch(/fontSize: \d+|fontWeight/);
  });
});
