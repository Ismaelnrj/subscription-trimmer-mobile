/* Guards the two events added so the ad spend measures something.

   The funnel already ran from landing_play_store_click through to
   upgrade_completed. What it could not see was whether anyone came BACK, and
   whether anyone opened a cancellation guide, which for a renewal reminder app
   is the half that decides whether an install was worth buying.

   Mostly source-reading, because the properties of an event are a statement
   about what leaves the device and that is a claim about the code rather than
   about one call. The one behavioural block needs real jest to transform the
   TypeScript, so it is required lazily and is expected to be skipped by the
   sandbox shim. */

const fs = require("fs");
const path = require("path");

const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");
const LAYOUT = read("app", "_layout.tsx");
const GUIDE_SCREEN = read("app", "cancel-guide.tsx");
const GUIDES = read("lib", "cancellation-guides.ts");

/* Takes the whole call by counting brackets to its closing paren, rather than
   matching a pattern: the argument list nests, and a negated character class
   stops at the first inner `)`. This file's own repo has recorded that mistake
   five times. */
function callSource(src, marker) {
  const start = src.indexOf(marker);
  /* Returns "" rather than throwing when the event is absent, so a missing
     event FAILS with the assertion that names it instead of crashing the file
     with a stack trace. A guard that cannot say what is wrong is most of the
     way to a guard nobody reads. */
  if (start === -1) return "";
  let depth = 0;
  let i = start + marker.length - 1;
  for (; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

describe("cancel_guide_viewed answers the question without leaking the answer", () => {
  const call = callSource(GUIDE_SCREEN, 'track("cancel_guide_viewed"');

  it("is fired at all", () => {
    expect(call).not.toBe("");
  });

  it("reports whether a real guide was shown or the generic fallback", () => {
    expect(call).toMatch(/matched\s*:/);
    expect(call).toMatch(/hasCancellationGuide/);
  });

  it("sends NO service name, which is the whole point", () => {
    /* `subscription_added` set this rule: billing cycle, category and
       is_first_subscription, never the name or the price. A subscription name
       is the user's own data and this product's claim is that we do not see it,
       so "viewed the Netflix guide" cannot go to PostHog either.
       Adding a name here would be the obvious "improvement" and it is the one
       thing that must not happen, which is why it gets its own assertion. */
    expect(call).not.toMatch(/name\s*:/);
    expect(call).not.toMatch(/service\s*:/);
    expect(call).not.toMatch(/subscription\s*:/);
  });

  it("does not quietly grow a name later, anywhere in the screen", () => {
    const tracks = GUIDE_SCREEN.split("track(").length - 1;
    expect(tracks).toBe(1);
  });
});

describe("app_opened is the retention event and has to fire on every launch", () => {
  const call = callSource(LAYOUT, 'track("app_opened"');

  it("is fired at all", () => {
    expect(call).not.toBe("");
  });

  it("records whether the launch belongs to a signed in person", () => {
    expect(call).toMatch(/authenticated\s*:/);
  });

  it("fires from a finally, so a failed restore still reports the launch", () => {
    /* A session where restoreToken threw is exactly the one worth seeing, and
       in the catch alone it would only fire on failure. */
    const effect = LAYOUT.slice(LAYOUT.indexOf("const init = async"), LAYOUT.indexOf('track("app_opened"'));
    expect(effect).toMatch(/\}\s*finally\s*\{/);
  });

  it("fires AFTER restoreToken, so a returning user is not anonymous", () => {
    /* restoreToken is what calls identifyUser. Firing earlier attributes a
       returning user's launch to an anonymous device id, which is precisely
       the attribution retention depends on. */
    expect(LAYOUT.indexOf("restoreToken()")).toBeLessThan(LAYOUT.indexOf('track("app_opened"'));
  });
});

describe("the guide matcher cannot drift from the guide lookup", () => {
  it("has exactly one place that decides whether a name matches", () => {
    /* getCancellationGuide and hasCancellationGuide both delegate to
       matchGuideKey. Two copies of a match rule is how one of them quietly
       stops agreeing with the other, and here that would report a guide as
       shown when the generic fallback was. */
    expect(GUIDES).toMatch(/function matchGuideKey/);
    const loops = GUIDES.split("of Object.keys(GUIDES)").length - 1
      + (GUIDES.split("of Object.entries(GUIDES)").length - 1);
    expect(loops).toBe(1);
  });

  it("agrees with itself on real names", () => {
    /* Needs real jest to transform the TypeScript. Verified outside jest too,
       7 of 7 cases, including an empty name and two services with no guide. */
    const m = require("../lib/cancellation-guides");
    const generic = JSON.stringify(m.getCancellationGuide("zzz-no-such-service", "en").steps);
    for (const [name, expected] of [["Netflix", true], ["Spotify Family", true], ["My Local Gym", false], ["", false]]) {
      expect(m.hasCancellationGuide(name)).toBe(expected);
      const isGeneric = JSON.stringify(m.getCancellationGuide(name, "en").steps) === generic;
      expect(isGeneric).toBe(!expected);
    }
  });
});
