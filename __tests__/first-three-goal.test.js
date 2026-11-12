/* THE FIRST THREE, 2026-11-12: after the first subscription the dashboard
   shows "1 of 3 added" with the next step on it, until there are three or the
   person dismisses it for good. 20 of the first 30 accounts never added one
   subscription, so the first session is where Trimio loses people. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const DASH = read("app/(tabs)/index.tsx");
const EN = JSON.parse(read("locales/en.json")).dashboard;
const DE = JSON.parse(read("locales/de.json")).dashboard;

describe("the first three goal", () => {
  it("shows from the first subscription until the third, and not once dismissed", () => {
    expect(DASH).toMatch(/const FIRST_GOAL = 3;/);
    expect(DASH).toMatch(/const showGoal = !goalDismissed && subscriptions\.length >= 1 && subscriptions\.length < FIRST_GOAL;/);
    expect(DASH).toMatch(/\{showGoal && \(/);
  });

  it("starts hidden and stays dismissed across launches", () => {
    // Hidden until storage answers, so it never flashes for somebody who said no.
    expect(DASH).toMatch(/const \[goalDismissed, setGoalDismissed\] = useState\(true\);/);
    expect(DASH).toMatch(/setItemAsync\(FIRST_GOAL_DISMISSED_KEY, "true"\)/);
    expect(DASH).toMatch(/getItemAsync\(FIRST_GOAL_DISMISSED_KEY\)/);
  });

  it("its next step opens the add form, and analytics records the action only", () => {
    const card = DASH.slice(DASH.indexOf("{showGoal && ("), DASH.indexOf("{estimateBanner && ("));
    expect(card).toMatch(/track\("first_run_action", \{ action: "another" \}\)/);
    expect(card).toMatch(/params: \{ from: "fab" \}/);
    expect(card).toMatch(/accessibilityLabel=\{t\("common\.a11yDismiss"\)\}/);
  });

  it("progress is ink, never mint: mint is kept for money kept", () => {
    const card = DASH.slice(DASH.indexOf("{showGoal && ("), DASH.indexOf("{estimateBanner && ("));
    expect(card).toMatch(/i < subscriptions\.length \? c\.text : c\.border/);
    expect(card).not.toMatch(/c\.(success|accent)/);
  });

  it("says the same thing in both languages", () => {
    for (const L of [EN, DE]) {
      expect(L.goalProgress).toMatch(/\{\{count\}\}/);
      expect(L.goalProgress).toMatch(/\{\{total\}\}/);
      expect(L.goalBody.length).toBeGreaterThan(20);
      expect(L.goalAdd.length).toBeGreaterThan(3);
    }
    expect(DE.goalProgress).toBe("{{count}} von {{total}} hinzugefügt");
  });
});
