/**
 * No credential is committed to this repository. Added 2026-11-18 after the
 * owner asked for a check against "hardcoded credentials" and the history
 * turned out to carry one: `android/app/release.keystore` (alias `subtrimmer`)
 * was committed on 2026-04-02 in 16cabf6f and deleted a day later. Its
 * password never was, but the file stays readable in the public history for
 * good. A deletion cannot take a pushed secret back, so this test exists to
 * stop the next one before it is pushed.
 *
 * It reads every TRACKED file (`git ls-files`), so ignored local files such as
 * `google-play-service-account.json` or a real `.env` never reach it.
 *
 * PUBLIC BY DESIGN, and therefore allowed: the PostHog project key (`phc_`,
 * write only), the RevenueCat public SDK key (`goog_`), the Firebase Android
 * key in google-services.json (restricted to the package and signing
 * certificate) and the Sentry DSN (can only submit events). The old JWT
 * default in server.js is there to be REFUSED by value.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const BINARY = /\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|mp4|mov|onnx|zip|gz)$/i;

// Files that must never be tracked at all, whatever they contain.
const FORBIDDEN_FILES = [
  { why: "a signing keystore", test: (f) => /\.(jks|keystore|p12|pfx)$/i.test(f) },
  { why: "a private key or certificate bundle", test: (f) => /\.(pem|key)$/i.test(f) },
  { why: "an env file", test: (f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".env.example") },
  { why: "the Play service account", test: (f) => /google-play-service-account\.json$/.test(f) },
  { why: "a credentials file", test: (f) => /(^|\/)(credentials|service-account)[^/]*\.json$/i.test(f) },
];

// Shapes of live credentials. Each one names a real provider format, so a
// match is worth stopping a push for.
const SECRET_SHAPES = [
  { name: "private key block", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Brevo API key", re: /\bxkeysib-[a-f0-9]{32,}/ },
  { name: "Brevo SMTP key", re: /\bxsmtpsib-[a-f0-9]{32,}/ },
  { name: "RevenueCat secret key", re: /\bsk_[A-Za-z0-9]{24,}\b/ },
  { name: "PostHog personal key", re: /\bphx_[A-Za-z0-9]{24,}\b/ },
  { name: "GitHub token", re: /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{40,}/ },
  { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: "Expo access token", re: /\bEXPO_TOKEN\s*[=:]\s*["']?[A-Za-z0-9_-]{20,}/ },
  {
    name: "database URL with a password",
    re: /\bpostgres(?:ql)?:\/\/[^:\s/@"'`]+:[^@\s"'`]{6,}@(?!localhost\b|127\.0\.0\.1\b)[^\s"'`]+/,
  },
];

function readText(rel) {
  if (BINARY.test(rel)) return null;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null; // deleted in the working tree
  return fs.readFileSync(abs, "utf8");
}

describe("no credential is committed", () => {
  it("tracks some files at all", () => {
    // Guards the scan below against passing because it read nothing.
    expect(tracked.length).toBeGreaterThan(100);
    expect(tracked).toContain("backend/server.js");
  });

  it("tracks no keystore, key, env or service account file", () => {
    const found = [];
    for (const f of tracked) {
      for (const rule of FORBIDDEN_FILES) if (rule.test(f)) found.push(`${f}: ${rule.why}`);
    }
    expect(found).toEqual([]);
  });

  it("carries no live credential shape in any tracked text file", () => {
    const found = [];
    for (const f of tracked) {
      const text = readText(f);
      if (!text) continue;
      for (const shape of SECRET_SHAPES) {
        const m = text.match(shape.re);
        if (m) found.push(`${f}: ${shape.name} (${m[0].slice(0, 12)}…)`);
      }
    }
    expect(found).toEqual([]);
  });

  it("keeps the public keys where they belong, and nowhere else", () => {
    // The Firebase Android key is public by design, but only in
    // google-services.json, where Google restricts it to com.trimio.app.
    const firebase = tracked.filter((f) => /AIza[0-9A-Za-z_-]{35}/.test(readText(f) || ""));
    expect(firebase).toEqual(["google-services.json"]);
  });

  it("keeps the leaked JWT default only as a value to refuse", () => {
    const server = readText("backend/server.js");
    expect(server).toMatch(/const LEAKED_DEV_SECRET = 'subtrimmer-dev-secret-change-in-production';/);
    expect(server).toMatch(/JWT_SECRET\s*===\s*LEAKED_DEV_SECRET/);
  });
});
