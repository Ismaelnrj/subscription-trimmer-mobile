/* The CI configuration must never manufacture or print signing material.
 *
 * WHAT WAS WRONG. codemagic.yaml's release signing step, when CM_KEYSTORE was
 * absent but CM_KEYSTORE_PASSWORD was set, generated a brand new release
 * keystore with keytool and then ran `base64 $KEYSTORE_PATH`, printing the
 * private key into the build log under a heading instructing whoever read it to
 * save that value as CM_KEYSTORE for future builds.
 *
 * Two separate problems, and the lasting one is the second. A build signed with
 * a fresh key can never be uploaded to Play, which only accepts the upload key
 * it already knows, so that path could not produce a usable artifact under any
 * circumstances. But following its instruction would adopt as Trimio's
 * permanent signing key one whose private half is in a CI log, for as long as
 * that log is retained and for everyone who can read it.
 *
 * These are config files with no test of their own, no compiler and no type
 * checker, so text assertions are the only guard available. They are cheap and
 * the property is absolute: nothing in CI generates a keystore, and nothing
 * prints one.
 */

const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const CODEMAGIC = read("codemagic.yaml");
const CHECKS = read(".github/workflows/checks.yml");
const ANDROID = read(".github/workflows/build-android.yml");
const GITIGNORE = read(".gitignore");
const PKG = JSON.parse(read("package.json"));

// Comments quote the defect they describe, including the words "base64" and
// "generate", so asserting against the raw text would fail on the explanation
// rather than on the configuration.
const code = (s) => s.replace(/^\s*#.*$/gm, "");

describe("no CI step can create a signing key", () => {
  it("codemagic never generates a keystore", () => {
    expect(code(CODEMAGIC)).not.toMatch(/keytool\s+-genkey/);
  });

  it("codemagic never prints a keystore, in any encoding", () => {
    /* THE assertion in this file. base64 must only ever appear as a DECODE of
       the secret, never as an encode of the file on disk. */
    const c = code(CODEMAGIC);
    expect(c).not.toMatch(/base64\s+\$KEYSTORE_PATH/);
    expect(c).not.toMatch(/base64\s+[^\s|]*\.keystore/);
    expect(c).not.toMatch(/cat\s+\$KEYSTORE_PATH/);
    for (const m of c.match(/base64[^\n]*/g) || []) {
      expect(m).toMatch(/--decode|-d\b/);
    }
  });

  it("does not tell anyone to copy a key out of a build log", () => {
    expect(code(CODEMAGIC)).not.toMatch(/COPY THIS/i);
  });

  it("never echoes a secret's value, only whether it is set", () => {
    /* `echo "$CM_KEYSTORE"` or `echo $CM_KEYSTORE_PASSWORD` would put the
       secret in the log. The presence checks are `[ -n "$X" ] && echo yes`,
       which mention the variable inside a test rather than printing it. */
    for (const line of code(CODEMAGIC).split("\n")) {
      const m = /^\s*echo\s+"?\$(CM_KEYSTORE|CM_KEYSTORE_PASSWORD|CM_KEY_PASSWORD)\b/.exec(line);
      expect(m).toBe(null);
    }
  });
});

describe("release signing fails closed", () => {
  const signingSteps = code(CODEMAGIC)
    .split(/- name: /)
    .filter((s) => s.startsWith("Set up Android signing"));

  it("there are two of them, one per workflow", () => {
    expect(signingSteps.length).toBe(2);
  });

  it("each one requires the keystore and both passwords before doing anything", () => {
    for (const step of signingSteps) {
      for (const v of ["CM_KEYSTORE", "CM_KEYSTORE_PASSWORD", "CM_KEY_PASSWORD"]) {
        expect(step).toMatch(new RegExp(`\\[ -n "\\$${v}" \\] \\|\\| missing=`));
      }
      expect(step).toMatch(/exit 1/);
    }
  });

  it("each one stops if the decode produced nothing", () => {
    for (const step of signingSteps) {
      expect(step).toMatch(/! -s \$KEYSTORE_PATH/);
    }
  });

  it("keeps the secret based decode flow that works today", () => {
    for (const step of signingSteps) {
      expect(step).toMatch(/printf '%s' "\$CM_KEYSTORE" \| tr -d[^\n]*base64 --decode/);
    }
  });

  it("an alias mismatch now fails the build instead of warning", () => {
    // It used to `echo "WARNING: alias mismatch or wrong password"` and carry
    // on to a Gradle failure with a less obvious cause.
    expect(code(CODEMAGIC)).not.toMatch(/WARNING: alias mismatch/);
  });

  it("the GitHub android workflow still fails closed on its own secret", () => {
    // This one was already correct. Asserted so it stays that way.
    expect(ANDROID).toMatch(/KEYSTORE_BASE64[\s\S]{0,400}exit 1/);
    expect(code(ANDROID)).not.toMatch(/keytool\s+-genkey/);
  });
});

describe("CI uses the package manager and runtime the repo declares", () => {
  it("packageManager is still pnpm 9", () => {
    expect(PKG.packageManager).toMatch(/^pnpm@9\./);
  });

  it("the checks workflow installs with pnpm and a frozen lockfile", () => {
    /* It ran `npm install --legacy-peer-deps`, which ignores pnpm-lock.yaml
       entirely and re-resolves every range, so CI tested a dependency tree
       nobody had locally. */
    expect(CHECKS).toMatch(/pnpm\/action-setup/);
    expect(CHECKS).toMatch(/pnpm install --frozen-lockfile/);
    /* (?<![a-z]) because "pnpm install" contains "npm install", so a bare
       /npm install/ flags the very line that fixes this. */
    expect(code(CHECKS)).not.toMatch(/(?<![a-z])npm install/);
  });

  it("the checks workflow typechecks through the guarded script", () => {
    /* A bare `npx tsc --noEmit` falls through to whatever compiler is on PATH
       when the local one is missing, and a version that rejects this tsconfig
       exits before reading a file, which reads as a clean run. */
    expect(CHECKS).toMatch(/python3 tools\/typecheck\.py/);
    expect(code(CHECKS)).not.toMatch(/npx tsc/);
  });

  it("the checks workflow runs lint and tests through pnpm", () => {
    expect(CHECKS).toMatch(/run: pnpm lint/);
    expect(CHECKS).toMatch(/run: pnpm test/);
  });

  it("the checks workflow runs the two guards CLAUDE.md calls pre-ship", () => {
    // Both catch a defect that breaks no build and fails no existing test.
    expect(CHECKS).toMatch(/tools\/check-legal-sync\.py/);
    expect(CHECKS).toMatch(/tools\/check-language-store\.py/);
  });

  it("no workflow or CI file still pins an end of life Node", () => {
    /* Node 18 went end of life in April 2025 and 20 in 2026, so neither gets
       runtime or OpenSSL patches. */
    for (const [name, src] of [["checks", CHECKS], ["android", ANDROID], ["codemagic", CODEMAGIC]]) {
      const versions = [...code(src).matchAll(/node(?:-version)?:\s*'?(\d+)'?/g)].map((m) => Number(m[1]));
      expect(versions.length).toBeGreaterThan(0);
      for (const v of versions) {
        expect(v >= 22 ? name : `${name} pins Node ${v}`).toBe(name);
      }
    }
  });

  it("the backend image and engines agree on Node 22", () => {
    expect(read("backend/Dockerfile")).toMatch(/^FROM node:22-slim$/m);
    expect(JSON.parse(read("backend/package.json")).engines.node).toBe(">=22");
  });

  it("the backend image sets NODE_ENV, as defence in depth only", () => {
    /* It must be set, because libraries read it, and it must NOT be what makes
       the JWT check fire. jwt-secret-required.test.js pins the second half. */
    expect(read("backend/Dockerfile")).toMatch(/^ENV NODE_ENV=production$/m);
  });
});

describe("environment files cannot be committed by accident", () => {
  it("gitignore covers .env and its variants", () => {
    expect(GITIGNORE).toMatch(/^\.env$/m);
    expect(GITIGNORE).toMatch(/^\.env\.\*$/m);
  });

  it("still allows a checked in .env.example", () => {
    expect(GITIGNORE).toMatch(/^!\.env\.example$/m);
    // Order matters: a negation before the pattern it negates does nothing.
    expect(GITIGNORE.indexOf("\n.env.*")).toBeLessThan(GITIGNORE.indexOf("\n!.env.example"));
  });

  it("keeps the signing material patterns that were already there", () => {
    for (const p of ["*.jks", "*.keystore", "*.pem", "*.p12", "google-play-service-account.json"]) {
      expect(GITIGNORE).toContain(p);
    }
  });
});
