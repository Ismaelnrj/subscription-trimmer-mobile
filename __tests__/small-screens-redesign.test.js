/* Cancel guide, tip jar, referral and help, redone 2026-11-07. Two of these
   carried defects worth pinning on their own:
   - the cancel guide's one button was white on c.danger, which in dark mode
     is #F0857A: 2.52:1, under even the large text floor, on the feature the
     product leads with;
   - the tip jar showed TIP_PRICES, hardcoded USD, until RevenueCat answered
     and forever if it never did, the defect the purchase screen was fixed
     for on 2026-09-20. Only Play's own priceString may look like money.
   And the referral screen's Apply button ran off the right edge, because the
   text field beside it would not shrink. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const code = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const GUIDE = code("app/cancel-guide.tsx");
const TIP = code("app/tip-jar.tsx");
const REFER = code("app/refer-a-friend.tsx");
const HELP = code("app/help-support.tsx");
const stylesOf = (src) => src.slice(src.indexOf("function makeStyles"));

describe("the cancel guide", () => {
  it("opens the page with an ink button, never white on danger", () => {
    expect(stylesOf(GUIDE)).toMatch(/linkButton: \{[^}]*backgroundColor: c\.text/);
    expect(GUIDE).not.toMatch(/backgroundColor: c\.danger/);
    expect(GUIDE).not.toContain('color="#FFFFFF"');
  });
});

describe("the tip jar", () => {
  it("names no price Play did not supply", () => {
    expect(TIP).not.toContain("TIP_PRICES");
    expect(TIP).toMatch(/offeringsLoaded \? \{ kind: "unavailable" \} : \{ kind: "loading" \}/);
    expect(TIP).toMatch(/disabled=\{loadingId !== null \|\| price\.kind !== "real"\}/);
  });

  it("uses icons, not emoji", () => {
    expect(TIP).not.toMatch(/[\u{1F300}-\u{1FAFF}☕]/u);
  });
});

describe("the referral screen", () => {
  it("lets the code field shrink so Apply stays on screen", () => {
    expect(stylesOf(REFER)).toMatch(/redeemInput: \{[^}]*minWidth: 0/);
  });

  it("has no emoji header and ink buttons", () => {
    expect(REFER).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(REFER).not.toContain('color="#FFFFFF"');
  });
});

describe("all four", () => {
  it.each([["cancel-guide", GUIDE], ["tip-jar", TIP], ["refer-a-friend", REFER], ["help-support", HELP]])(
    "%s sets text on the type scale with no uppercase labels",
    (_, src) => {
      const s = stylesOf(src).replace(/debugText: \{[^}]*\}/, "");
      expect(s).not.toMatch(/fontSize: \d+|fontWeight|textTransform/);
    }
  );
});
