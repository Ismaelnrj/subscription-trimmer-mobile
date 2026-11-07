/* Three claims on the purchase screen were false, found 2026-11-07 by checking
   each one against the code before redesigning it. This is the one screen
   where a wrong claim costs somebody money, so each is pinned on its own and
   holds whatever the layout looks like:
   - trial tracking was sold as Premium and is FREE: nothing gates the trial
     switch or its reminder, on the phone or the server;
   - "Priority support" named a queue that does not exist: one support
     address, the same for everybody;
   - the terms said "cancelled 24h before the renewal date", which is Apple's
     rule. A Google Play subscription can be cancelled any time and runs to
     the end of the period paid for (support.google.com/googleplay/answer/7018481).
   And "It pays for itself on day one" could not be backed, so it is gone. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "app", "upgrade.tsx"), "utf8")
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
const locale = (l) => JSON.parse(fs.readFileSync(path.join(ROOT, "locales", `${l}.json`), "utf8")).upgrade;
const en = locale("en");
const de = locale("de");

describe("the purchase screen's claims", () => {
  it("lists trial tracking as free, because it is", () => {
    expect(SRC).toMatch(/label: t\("upgrade\.feat_trial"\),\s*free: (true|"✓")/);
  });

  it("promises no priority support", () => {
    expect(SRC).not.toContain("feat_support");
    for (const l of [en, de]) expect(l.feat_support).toBeUndefined();
  });

  it("states Google Play's cancellation terms, not Apple's", () => {
    for (const l of [en, de]) {
      expect(l.legalNote).not.toMatch(/24/);
      expect(l.legalNote).toMatch(/Google Play/);
    }
    expect(en.legalNote).toMatch(/until the end of the period you paid for/);
    expect(de.legalNote).toMatch(/bis zum Ende des bezahlten Zeitraums/);
  });

  it("does not claim Premium pays for itself", () => {
    for (const l of [en, de]) {
      const all = Object.values(l).join(" ");
      expect(all).not.toMatch(/pays for itself|rechnet sich/i);
    }
  });
});
