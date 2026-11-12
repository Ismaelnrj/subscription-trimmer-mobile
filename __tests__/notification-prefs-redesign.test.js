/* Notification preferences, redone 2026-11-07. Two switches went with it, on
   purpose: "Weekly summary" (on by default) promised an email no job has ever
   sent, and "Spending alerts" was stored but never read, so turning it off
   stopped nothing. This test fails if either comes back without something
   on the server that honours it. Also pinned: an off switch that shows (its
   track was c.border, 1.31:1 on the card), the lead time as an ink segmented
   control, no lock emoji, and the email preview in the reader's day order. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "app", "notification-preferences.tsx"), "utf8").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");

describe("the notification preferences screen", () => {
  it("offers no switch the server does not honour", () => {
    /* Unconditional on purpose. A first draft only asserted while the server
       mentioned each column three times or fewer, and one server line holds
       weekly_summary twice, so it asserted nothing and passed against the
       code it was written to catch. When the server gains a job that sends a
       weekly summary, or alerts.list starts reading spending_alerts, delete
       the matching line here in the same commit. */
    expect(SRC).not.toContain("weeklySummary");
    expect(SRC).not.toContain("spendingAlerts");
  });

  it("draws an off switch that shows", () => {
    // The switch tokens and why they hold their values: theme-contrast.test.js.
    expect(SRC).toMatch(/const track = \{ false: c\.switchOff, true: c\.switchOn \}/);
    expect(SRC).not.toMatch(/false: c\.border/);
  });

  it("chooses the lead time in an ink segmented control", () => {
    expect(SRC).toMatch(/segmentOn: \{ backgroundColor: c\.text \}/);
    expect(SRC).toContain('accessibilityRole="radiogroup"');
    expect(SRC).not.toContain("dayChipActive");
  });

  it("carries no lock emoji and writes the preview date in the reader's order", () => {
    expect(SRC).not.toContain("🔒");
    expect(SRC).toMatch(/fmtD\(new Date\(s\.emailMs\), dayMonthPattern\(i18n\.language\)\)/);
  });

  it("sets every text on the type scale, no uppercase labels", () => {
    const styles = SRC.slice(SRC.indexOf("function makeStyles"));
    expect(styles).not.toMatch(/fontSize: \d+|fontWeight|textTransform/);
  });
});
