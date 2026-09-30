/* The payment pair from the 2026-09-29 review: the client discarded the
   server's premium verdict, and a restore FAILURE was reported as an absent
   purchase.

   SOURCE-READING, AND IT SAYS SO. lib/iap.ts imports react-native-purchases
   and expo-secure-store, so driving it needs an OS and a store; the same
   reason __tests__/language-reminders.test.js is source-reading.

   THE BEHAVIOUR WAS MEASURED SEPARATELY, and that is where the confidence
   comes from rather than from these strings. The real module, with ONLY its
   three import specifiers rewritten to local stubs, was executed against both
   this code and origin/master's across seventeen outcomes, with the two
   screen handlers' branch logic transcribed so the branch a USER sees is what
   was compared. Seven of eight shared scenarios behave differently on master:
   "SDK says active, server says isPaid false" produced a PREMIUM WELCOME, as
   did a response carrying a different account's user and a 200 carrying no
   user at all; an offline restore, a cancelled restore and a referral-premium
   user with no Play purchase were all told "No purchase found"; and a failed
   entitlement lookup read as false. The ordinary successful purchase is the
   one that does NOT differ, which is the property that made this safe to
   ship. */

const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

/* An assertion that a string must NOT appear necessarily sits beside a comment
   explaining that string, so the comment satisfies the search and the test
   passes having checked nothing. Six recorded failures in this repo. */
const codeOf = (p) => {
  const raw = read(p);
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  expect(stripped.length).toBeLessThan(raw.length);
  return stripped;
};

describe("the server's verdict is what decides premium", () => {
  it("syncPremiumWithBackend returns the server's answer, not a boolean", () => {
    const code = codeOf("lib/iap.ts");
    /* `await apiClient.post(...)` with the response DISCARDED, returning true
       for any 2xx, is the defect: the POST succeeding and the account being
       paid are different facts. */
    expect(code).toMatch(/Promise<PremiumSync>/);
    expect(code).toMatch(/const res = await apiClient\.post\("\/auth\/verify-premium"/);
    expect(code).toMatch(/status: "verified", user:/);
  });

  it("a 200 carrying no usable user is not a verdict", () => {
    const code = codeOf("lib/iap.ts");
    expect(code).toMatch(/typeof user\.id === "number"/);
    expect(code).toMatch(/typeof user\.isPaid === "boolean"/);
  });

  it("the purchase screen never manufactures a paid user", () => {
    /* `setUser({ ...user, isPaid: true })` spreads the old user and flips one
       field, so the screen asserts premium the server may have denied. */
    const code = codeOf("app/upgrade.tsx");
    expect(code).not.toMatch(/setUser\(\s*\{\s*\.\.\.user\s*,\s*isPaid:\s*true\s*\}\s*\)/);
    expect(code).toMatch(/setUser\(sync\.user/);
  });

  it("it refuses a user that is not the authenticated account", () => {
    const code = codeOf("app/upgrade.tsx");
    expect(code).toMatch(/sync\.user\.id !== user\.id/);
  });

  it("a charge the server has not confirmed is pending, never failed", () => {
    const code = codeOf("app/upgrade.tsx");
    /* The money has already moved. Reporting a failure is how somebody buys
       the same thing twice. */
    const buy = code.slice(code.indexOf("const handleBuy"), code.indexOf("const handleRestore"));
    expect(buy).toContain("upgrade.purchaseReceivedTitle");
    // the welcome is reachable ONLY through the server saying isPaid
    const welcomeAt = buy.indexOf("upgrade.welcomeTitle");
    expect(welcomeAt).toBeGreaterThan(-1);
    expect(buy.slice(0, welcomeAt)).toMatch(/applyServerVerdict\(sync\) === true/);
  });

  it("the launch-time retry applies what it recovers", () => {
    /* This path exists for a purchase charged on a previous run that never
       reached the account, so dropping the verdict wastes the recovery. */
    const code = codeOf("app/_layout.tsx");
    expect(code).toMatch(/retryPendingPremiumSync\(\)/);
    expect(code).toMatch(/sync\.status !== "verified"/);
    expect(code).toMatch(/current\.id !== sync\.user\.id/);
  });

  it("referral premium is never derived from the SDK", () => {
    /* formatUser computes `isPaid: is_paid || hasBonusPremium(u)`, so the
       server already folds a free referral month in. Deriving entitlement from
       the SDK's answer instead strips premium from every referral user. */
    const server = read("backend/server.js");
    expect(server).toMatch(/isPaid: u\.is_paid \|\| hasBonusPremium\(u\)/);
    const code = codeOf("app/upgrade.tsx");
    expect(code).toMatch(/setIsPremium\(sync\.user\.isPaid\)/);
  });
});

describe("a failed lookup is not an absent purchase", () => {
  it("restore reports four outcomes rather than one", () => {
    const code = codeOf("lib/iap.ts");
    for (const s of ['"restored"', '"none"', '"cancelled"', '"error"']) {
      expect(code).toContain(s);
    }
    /* The old shape. `{ active: false, synced: false }` for a caught error is
       the SAME value as an account with nothing to restore, which is how an
       offline paying customer was told they had never bought anything. */
    expect(code).not.toMatch(/return \{ active: false, synced: false \}/);
  });

  it("a restore error posts nothing to the backend", () => {
    /* Syncing `false` here would take premium away from a paying customer
       because their connection dropped. */
    const code = codeOf("lib/iap.ts");
    const restore = code.slice(code.indexOf("export async function restorePremium"));
    const errBranch = restore.slice(0, restore.indexOf("const active"));
    expect(errBranch).toContain('status: "error"');
    expect(errBranch).not.toContain("syncPremiumWithBackend");
  });

  it("an EMPTY restore still syncs, so a wrong client is corrected upward", () => {
    /* The server does not trust the posted value, it asks RevenueCat with this
       user's open_id. Skipping the call would remove the one path that fixes a
       client which is wrong about having no purchase. */
    const code = codeOf("lib/iap.ts");
    const restore = code.slice(code.indexOf("export async function restorePremium"));
    expect(restore).toMatch(/const sync = await syncPremiumWithBackend\(active\)/);
  });

  it("checkIsPremium says unknown rather than no", () => {
    const code = codeOf("lib/iap.ts");
    expect(code).toMatch(/Promise<boolean \| null>/);
    const screen = codeOf("app/upgrade.tsx");
    // and the screen must not overwrite a known-good value with a failure
    expect(screen).toMatch(/if \(premium !== null\) setIsPremium\(premium\)/);
  });

  it("cancellation is read from the typed flag, not a string search", () => {
    /* `e.message.toLowerCase().includes("cancel")` is a search over text the
       SDK may localise or reword, and the day it does, a cancellation starts
       showing a "purchase failed" alert. */
    const code = codeOf("lib/iap.ts");
    expect(code).toMatch(/typeof e\?\.userCancelled === "boolean"\) return e\?*\.userCancelled/);
    const screen = codeOf("app/upgrade.tsx");
    expect(screen).toContain("isUserCancelled(e)");
    expect(screen).not.toMatch(/message\?\.toLowerCase\(\)\.includes\("cancel"\)/);
  });

  it("buy and restore cannot run at the same time", () => {
    const code = codeOf("app/upgrade.tsx");
    const guards = code.match(/if \(loading \|\| restoring\) return;/g) || [];
    expect(guards.length).toBe(2);
  });
});
