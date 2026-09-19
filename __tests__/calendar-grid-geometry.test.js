/* The month grid's cells must all be the same height.
 *
 * The dot row and the day amount used to be rendered only when a day had
 * renewals, so a busy cell was 23dp taller than an empty one and week rows
 * changed height according to their contents. The grid visibly wobbled from
 * one row to the next, which is the kind of thing nobody names and everybody
 * notices.
 *
 * The less visible half is worse. An empty cell measured 4 + 32 + 4 = 40dp,
 * under Android's 48dp minimum touch target, while a busy one cleared it at
 * 63dp. The days that were hardest to hit were the EMPTY ones, which are
 * exactly the days somebody taps to ask whether anything is due.
 *
 * This reads the geometry out of the stylesheet rather than asserting numbers
 * from memory, so the arithmetic stays true if the type or the dots are
 * resized. What it pins is the relationship: the reserved slot equals what it
 * reserves, and every cell clears the touch target.
 */

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(
  path.join(__dirname, "..", "components", "MonthCalendarGrid.tsx"), "utf8");

/** One style block, matched by braces.
 *
 *  Not a regex. `cell` contains `width: `${100 / 7}%``, and a lazy `[^}]*`
 *  stops dead at the template literal's closing brace, silently truncating the
 *  block before `paddingVertical` and reporting a cell 8dp shorter than it is.
 *  That happened on the first attempt at this measurement. */
function block(name) {
  const start = SRC.indexOf(`${name}: {`);
  // Returns empty rather than throwing. A missing style IS the regression this
  // file exists to catch, and throwing at module load takes the whole suite
  // down with a stack trace instead of naming the assertion that failed.
  if (start === -1) return "";
  let depth = 0;
  for (let i = start; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) return SRC.slice(start, i + 1);
  }
  return "";
}

const num = (b, prop) => {
  const m = new RegExp(`\\b${prop}: (\\d+)`).exec(b);
  return m ? Number(m[1]) : 0;
};

const PAD = num(block("cell"), "paddingVertical");
const CIRCLE = num(block("dayCircle"), "height");
const META = num(block("dayMeta"), "height");
const DOTS = num(block("dotRow"), "marginTop") + num(block("dotRow"), "height");
const AMOUNT = num(block("dayTotal"), "marginTop") + num(block("dayTotal"), "lineHeight");

// Comments quote the old conditional render, and a test that matches its own
// explanation is a test that passes while checking nothing.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

describe("every day cell is the same height", () => {
  it("reserves a slot for the dots and the amount", () => {
    expect(META).toBeGreaterThan(0);
  });

  it("reserves exactly what it holds, no more and no less", () => {
    // Too small and the amount is clipped. Too large and the grid grows for
    // nothing. Derived from the parts so it survives a type size change.
    expect(META).toBe(DOTS + AMOUNT);
  });

  it("no longer renders the dot row only when there are dots", () => {
    /* The defect exactly. `dotColors.length > 0 && <View style={styles.dotRow}>`
       is what made the cell height depend on its contents. */
    expect(/dotColors\.length\s*>\s*0\s*&&\s*\(?\s*<View style=\{styles\.dotRow\}/.test(CODE)).toBe(false);
    expect(CODE).toMatch(/<View style=\{styles\.dayMeta\}>/);
  });

  it("clears the Android minimum touch target on every day, busy or empty", () => {
    /* 48dp is the floor, and an empty cell used to be 40. A calendar you tap
       to ask "is anything due here?" must be tappable on the days where the
       answer is no. */
    const cell = PAD + CIRCLE + META + PAD;
    expect(cell).toBeGreaterThanOrEqual(48);
  });

  it("the old geometry, mirrored, so the regression is legible", () => {
    const before = { empty: PAD + CIRCLE + PAD, busy: PAD + CIRCLE + DOTS + AMOUNT + PAD };
    const after = PAD + CIRCLE + META + PAD;
    expect(before.busy - before.empty).toBe(META);   // the wobble, in dp
    expect(after).toBe(before.busy);                 // nothing grew, the empties caught up
    expect(before.empty).toBeLessThan(48);           // and why it mattered
  });
});
