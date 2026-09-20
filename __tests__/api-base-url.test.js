/* The client cannot silently fall back to cleartext HTTP.
 *
 * WHAT WAS WRONG, and how much. lib/api.ts read
 * `Constants.expoConfig?.extra?.apiUrl || "http://localhost:3000"`. app.json does
 * set extra.apiUrl to the HTTPS Railway host, so this was never live: the
 * fallback fires only if that key goes missing. It is worth closing anyway
 * because of how it would fail. A release build with no apiUrl would point every
 * request at plain HTTP on the phone itself, and the symptom is requests that
 * fail, which looks like a network problem rather than a broken build.
 *
 * THE REAL GUARD IS THE CONFIG ASSERTION, not the runtime branch. A test over
 * app.json fails in CI before a build exists, which is the only place this can
 * be caught for free. The runtime branch decides what an already-shipped build
 * does, and there the choice is between failing every request with a named cause
 * and crashing at launch. Failing the requests is the smaller harm for a
 * mistake in one string.
 *
 * The resolution itself is MIRRORED below rather than executed: lib/api.ts
 * imports axios, expo-secure-store and react-native at module scope, so it
 * cannot be loaded here. The source assertions are what tie the mirror to the
 * shipped branch.
 */

const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const API = read("lib/api.ts");
/* Block comments, then only the lines that ARE comments. A blanket
   `//[^\n]*` strip deletes from the `//` in "http://localhost" to end of line,
   which silently removed the very strings these assertions look for and
   reported working code as broken. */
const CODE = API.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !/^\s*\/\//.test(line))
  .join("\n");
const APP_JSON = JSON.parse(read("app.json"));

describe("the shipped configuration is correct right now", () => {
  it("app.json sets an apiUrl at all", () => {
    expect(typeof APP_JSON.expo.extra.apiUrl).toBe("string");
    expect(APP_JSON.expo.extra.apiUrl.length).toBeGreaterThan(0);
  });

  it("and it is HTTPS", () => {
    // THE assertion in this file. Everything else decides how gracefully a
    // broken config fails; this one stops it existing.
    expect(APP_JSON.expo.extra.apiUrl).toMatch(/^https:\/\//);
  });

  it("and it is not a development host", () => {
    expect(APP_JSON.expo.extra.apiUrl).not.toMatch(/localhost|127\.0\.0\.1|^http:\/\/192\.168/);
  });
});

describe("the runtime branch", () => {
  it("no longer has an unconditional localhost fallback", () => {
    expect(CODE).not.toMatch(/apiUrl\s*\|\|\s*"http:\/\/localhost/);
  });

  it("keeps localhost reachable in development", () => {
    // Development is the only reason a fallback should exist at all.
    expect(CODE).toMatch(/__DEV__/);
    expect(CODE).toMatch(/http:\/\/localhost:3000/);
  });

  it("requires HTTPS before accepting the configured value", () => {
    expect(CODE).toMatch(/\/\^https:\\\/\\\/\/\.test\(configuredApiUrl\)/);
  });

  it("says so loudly when there is nothing usable", () => {
    expect(CODE).toMatch(/console\.error/);
    expect(CODE).toMatch(/FATAL CONFIG/);
  });

  it("fails the request rather than sending it somewhere else", () => {
    const interceptor = CODE.slice(CODE.indexOf("interceptors.request.use"));
    expect(interceptor).toMatch(/if \(!API_URL\)/);
    expect(interceptor.slice(0, interceptor.indexOf("SecureStore"))).toMatch(/throw new Error/);
  });

  it("does not crash the app at launch over it", () => {
    /* A throw at module scope would replace the app with the crash screen for
       every user on a one string mistake, and cannot be recovered from on the
       device. The config test above is what prevents it shipping. */
    const beforeClient = CODE.slice(0, CODE.indexOf("axios.create"));
    expect(beforeClient).not.toMatch(/throw /);
  });
});

describe("the resolution rule, mirrored", () => {
  /* Mirror of the ternary in lib/api.ts. Runs for real, so the rule is checked
     even though the module cannot be imported. */
  const resolve = (configured, isDev) =>
    configured && /^https:\/\//.test(configured)
      ? configured
      : isDev
        ? configured || "http://localhost:3000"
        : "";

  const PROD = false, DEV = true;

  it("uses an HTTPS endpoint in both environments", () => {
    expect(resolve("https://api.example.com", PROD)).toBe("https://api.example.com");
    expect(resolve("https://api.example.com", DEV)).toBe("https://api.example.com");
  });

  it("uses the real app.json value", () => {
    expect(resolve(APP_JSON.expo.extra.apiUrl, PROD)).toBe(APP_JSON.expo.extra.apiUrl);
  });

  it("refuses cleartext and refuses absent, in a release build", () => {
    expect(resolve(undefined, PROD)).toBe("");
    expect(resolve("", PROD)).toBe("");
    expect(resolve("http://localhost:3000", PROD)).toBe("");
    expect(resolve("http://192.168.1.10:3000", PROD)).toBe("");
    expect(resolve("ws://api.example.com", PROD)).toBe("");
  });

  it("still allows a LAN address in development, which is how a phone reaches a laptop", () => {
    expect(resolve("http://192.168.1.10:3000", DEV)).toBe("http://192.168.1.10:3000");
    expect(resolve(undefined, DEV)).toBe("http://localhost:3000");
  });

  it("is not fooled by https appearing later in the string", () => {
    expect(resolve("http://evil.test/?u=https://api.example.com", PROD)).toBe("");
  });

  it("the previous rule, for comparison", () => {
    // What it did instead: cleartext localhost, in production, silently.
    const old = (configured) => configured || "http://localhost:3000";
    expect(old(undefined)).toBe("http://localhost:3000");
    expect(resolve(undefined, PROD)).toBe("");
  });
});
