/* The manual update check in the Build Info panel, and the field labels around
   it that must NOT be localised.

   SOURCE READING, deliberately. jest cannot mount this screen (expo-updates is
   a native module), so these assertions read the file. That is enough for what
   they guard: the call sequence existing, the strings coming from t(), and the
   English field labels surviving a future localisation sweep. It cannot prove
   the update actually applies, which only a device can. */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

/* An assertion that a string must appear is weakened by a comment containing
   it, and this file's comments quote the API they describe. Strip block
   comments first, and prove the strip did something so it cannot pass
   vacuously. This repo has paid for that lesson more than once. */
function codeOf(p) {
  const raw = read(p);
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  if (stripped.length === raw.length) {
    throw new Error(`${p}: expected block comments to strip, found none`);
  }
  return stripped;
}

const en = JSON.parse(read("locales/en.json"));
const de = JSON.parse(read("locales/de.json"));

describe("Build Info can fetch an update without two cold launches", () => {
  const code = codeOf("app/help-support.tsx");

  it("runs the full check, fetch and reload sequence", () => {
    /* All three are needed. checkForUpdateAsync alone reports availability and
       downloads nothing; fetchUpdateAsync alone downloads and still waits for
       the next launch, which is the exact problem this exists to remove. */
    expect(code).toContain("Updates.checkForUpdateAsync(");
    expect(code).toContain("Updates.fetchUpdateAsync(");
    expect(code).toContain("Updates.reloadAsync(");
  });

  it("does not offer the button when updates are disabled", () => {
    /* In a dev client expo-updates is off and every call throws. A disabled
       button would read as a broken feature rather than an absent one. */
    expect(code).toContain("Updates.isEnabled");
    expect(code).toContain("helpSupport.updatesDisabled");
  });

  it("reports the failure rather than swallowing it", () => {
    /* A silent catch here is the worst outcome: the panel exists to be read,
       and "nothing happened" is indistinguishable from "up to date". */
    expect(code).toMatch(/catch\s*\(\s*e\s*\)\s*\{[\s\S]*?setUpdateState\(\{\s*kind:\s*"error"/);
    expect(code).toContain("helpSupport.updateCheckFailed");
  });

  it("keeps checking, up to date and failed as separate answers", () => {
    for (const kind of ["checking", "downloading", "uptodate", "error"]) {
      expect(code).toContain(`"${kind}"`);
    }
  });

  it("clears Android's 48dp touch target floor", () => {
    const m = code.match(/updateButton:\s*\{([\s\S]*?)\n\s{4}\}/);
    expect(m).toBeTruthy();
    const minHeight = Number((m[1].match(/minHeight:\s*(\d+)/) || [])[1]);
    expect(minHeight).toBeGreaterThanOrEqual(48);
  });

  it("takes every user facing string from t(), in both languages", () => {
    const keys = [
      "checkForUpdates", "checkingForUpdates", "downloadingUpdate",
      "upToDate", "updateCheckFailed", "updatesDisabled",
    ];
    for (const k of keys) {
      expect(code).toContain(`helpSupport.${k}`);
      expect(typeof en.helpSupport[k]).toBe("string");
      expect(typeof de.helpSupport[k]).toBe("string");
      expect(de.helpSupport[k]).not.toBe(en.helpSupport[k]);
    }
  });

  it("carries the error message through to the screen in both languages", () => {
    /* A failure line that names no cause is a worse diagnostic than none,
       because it looks like one. */
    expect(en.helpSupport.updateCheckFailed).toContain("{{message}}");
    expect(de.helpSupport.updateCheckFailed).toContain("{{message}}");
  });
});

describe("the Build Info field labels stay English on purpose", () => {
  const code = codeOf("app/help-support.tsx");

  /* NOT AN OVERSIGHT, and this test is here so the next localisation sweep
     does not "fix" it. CLAUDE.md quotes these labels verbatim as the procedure
     for confirming a publish, and the values beside them are EAS's own field
     names. Translating them would break a documented check to gain nothing: a
     German reader confirming an OTA is reading a machine identifier either
     way. The BUTTON is different and is localised, because that is an action
     somebody takes rather than a field name. */
  it("still prints the exact labels the publish procedure reads", () => {
    for (const label of [
      "Channel:",
      "Runtime version:",
      "Embedded launch (no OTA applied):",
      "Update ID:",
      "Update published:",
    ]) {
      expect(code).toContain(label);
    }
  });
});
