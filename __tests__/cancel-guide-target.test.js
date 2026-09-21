/* The "How to cancel" link is the ONLY entry point to the 41 cancellation
 * guides, and it used to fail three ways at once. Each one is pinned here.
 *
 * TOUCH TARGET. It was an 11px icon beside 11px text with no padding and no
 * hitSlop, so the tappable strip was roughly 14dp against Android's 48dp
 * minimum, nested inside the card's own TouchableOpacity. A tap that missed
 * opened subscription details instead, so the failure read as the button
 * doing nothing rather than as a mis-hit. That is why it went unnoticed: a
 * screen opened either way.
 *
 * CONTRAST. textMuted #8B949C on the light card measures 2.98:1, under the
 * 4.5:1 floor for text at this size, and the dark theme's #6E7E88 is 3.77:1.
 *
 * AFFORDANCE. Nothing about it said it was pressable.
 *
 * Like calendar-grid-geometry, this READS THE NUMBERS OUT OF THE SOURCE
 * rather than restating them, so the arithmetic survives a resize and what is
 * pinned is the relationship, not the constants.
 */

const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(
  path.join(__dirname, "..", "app", "(tabs)", "subscriptions.tsx"), "utf8");

/** One brace-matched block. Not a regex: this file is full of template
 *  literals and nested objects, and a negated character class stops at the
 *  first inner `}`. That trap is on record in CLAUDE.md five times over. */
function block(startToken) {
  const start = SRC.indexOf(startToken);
  // Empty rather than a throw: a missing block IS the regression, and
  // throwing at module load replaces the failing assertion's name with a
  // stack trace.
  if (start === -1) return "";
  const open = SRC.indexOf("{", start);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) return SRC.slice(start, i + 1);
  }
  return "";
}

/** A numeric style or prop value, or null when absent. */
function num(source, key) {
  const m = source.match(new RegExp(`\\b${key}:\\s*(\\d+(?:\\.\\d+)?)`));
  return m ? parseFloat(m[1]) : null;
}

/** The opening tag that carries a given prop marker, from its `<` to the `>`
 *  that closes it, counting braces so a `>` inside an arrow function body
 *  does not end the tag early.
 *
 *  SCOPING THIS IS THE WHOLE POINT, and the first draft of this file got it
 *  wrong. It searched the file for `hitSlop={{` and found the one on a
 *  DIFFERENT touchable forty lines below, so the 48dp assertion was measuring
 *  a control it was not testing. It still failed against the old code, by
 *  luck rather than by correctness, which is the worst way for a guard to
 *  look like it works. */
function openingTag(marker) {
  const at = SRC.indexOf(marker);
  if (at === -1) return "";
  const start = SRC.lastIndexOf("<", at);
  if (start === -1) return "";
  let depth = 0;
  for (let i = start; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}") depth--;
    else if (SRC[i] === ">" && depth === 0 && i > start) return SRC.slice(start, i + 1);
  }
  return "";
}

const linkStyle = block("cancelGuideLink: {");
const linkText = block("cancelGuideLinkText: {");
const linkTag = openingTag("style={styles.cancelGuideLink}");
const hitSlop = /hitSlop=\{\{[^}]*\}\}/.test(linkTag) ? linkTag.match(/hitSlop=\{\{[^}]*\}\}/)[0] : "";

const ANDROID_MIN_TARGET = 48;

describe("the cancel guide link is a control, not a caption", () => {
  it("declares an explicit minHeight rather than relying on line height", () => {
    // Padding alone makes the height depend on the font's metrics, which no
    // test can read. minHeight is what makes the arithmetic below provable.
    expect(num(linkStyle, "minHeight")).not.toBeNull();
  });

  it("clears Android's 48dp touch target once hitSlop is counted", () => {
    const minHeight = num(linkStyle, "minHeight") || 0;
    const top = num(hitSlop, "top") || 0;
    const bottom = num(hitSlop, "bottom") || 0;
    expect(minHeight + top + bottom).toBeGreaterThanOrEqual(ANDROID_MIN_TARGET);
  });

  it("carries hitSlop on THIS touchable, since the pill alone is under 48dp", () => {
    // Scoped to this tag. Another touchable in the same file carries its own
    // hitSlop, and reading that one is how the first draft of this test
    // reported a control it had never looked at.
    expect(hitSlop).not.toBe("");
  });

  it("does not use textMuted, which is for metadata rather than controls", () => {
    // THIS ASSERTION'S REASON CHANGED and the wording follows it. textMuted was
    // #8B949C, 2.98:1 on the light card, so this began as a contrast guard. The
    // token is now #67717A at 4.81:1 and passes, so what is pinned here is the
    // hierarchy instead: a control's label outranks the muted text beside it.
    // theme-contrast.test.js owns the contrast floors now.
    expect(linkText).not.toMatch(/c\.textMuted/);
    expect(SRC).not.toMatch(/format-list-numbered"\s+size=\{\d+\}\s+color=\{c\.textMuted\}/);
  });

  it("does not use the primary token either, which fails in dark mode", () => {
    // The obvious choice for something that should read as a link, and wrong:
    // dark primary #2F8E71 on the dark card is 3.94:1. This assertion exists
    // because it is the change a future reader would make as an improvement.
    expect(linkText).not.toMatch(/c\.primary/);
  });

  it("sets type large enough to read as a label", () => {
    expect(num(linkText, "fontSize")).toBeGreaterThanOrEqual(12);
  });

  it("looks pressable, by carrying a visible boundary", () => {
    expect(num(linkStyle, "borderWidth")).toBeGreaterThan(0);
  });

  it("announces itself to a screen reader as a button", () => {
    expect(linkTag).toMatch(/accessibilityRole="button"/);
  });
});
