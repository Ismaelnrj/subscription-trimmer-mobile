/**
 * BUILD 42'S AGE SIGNALS MODULE AND THE JAVASCRIPT THAT CALLS IT.
 *
 * Build 42 added a native module and KEPT runtimeVersion 1.0.1, so every
 * update published afterwards also reaches builds 40 and 41, which do not
 * contain it. That is safe for one reason only: lib/age-signals.ts loads the
 * module with requireOptionalNativeModule, which answers null where it is
 * missing. requireNativeModule would throw at import on those phones, and the
 * screen importing it would fail to open. This pins that, plus the contract
 * between the Kotlin and the TypeScript, which nothing else checks until a
 * phone calls a function that is not there.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const MOD = "modules/trimio-age-signals";
const js = read("lib/age-signals.ts");
const ktPath = `${MOD}/android/src/main/java/expo/modules/trimioagesignals/TrimioAgeSignalsModule.kt`;
const kt = read(ktPath);
const gradle = read(`${MOD}/android/build.gradle`);
const config = JSON.parse(read(`${MOD}/expo-module.config.json`));

const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("Play Age Signals module", () => {
  test("JavaScript loads it optionally, never with requireNativeModule", () => {
    expect(code(js)).toMatch(/requireOptionalNativeModule<[^>]+>\("TrimioAgeSignals"\)/);
    expect(code(js)).not.toMatch(/\brequireNativeModule\b/);
  });

  test("the name and the functions match on both sides", () => {
    const name = kt.match(/Name\("(\w+)"\)/)[1];
    expect(js).toContain(`("${name}")`);
    const nativeFns = [...kt.matchAll(/AsyncFunction\("(\w+)"\)/g)].map((m) => m[1]).sort();
    const typeBody = js.slice(js.indexOf("type AgeSignalsNative"), js.indexOf("};", js.indexOf("type AgeSignalsNative")));
    const jsFns = [...typeBody.matchAll(/^\s+(\w+)\(\): Promise/gm)].map((m) => m[1]).sort();
    expect(nativeFns.length).toBe(3);
    expect(jsFns).toEqual(nativeFns);
  });

  test("the config names the class the Kotlin file declares", () => {
    const pkg = kt.match(/^package ([\w.]+)/m)[1];
    const cls = kt.match(/class (\w+) : Module\(\)/)[1];
    expect(config.android.modules).toEqual([`${pkg}.${cls}`]);
    expect(config.platforms).toEqual(["android"]);
  });

  test("the library is 0.0.6 or later, the first read with getApplicableAgeFeatures", () => {
    const v = gradle.match(/com\.google\.android\.play:age-signals:(\d+)\.(\d+)\.(\d+)/);
    expect(v).not.toBeNull();
    const [, a, b, c] = v.map(Number);
    expect(a * 1e6 + b * 1e3 + c).toBeGreaterThanOrEqual(6);
    expect(kt).toContain("getApplicableAgeFeatures");
  });

  test("the age data goes nowhere: no analytics, crash reporting or network near it", () => {
    for (const src of [code(js), code(kt)]) {
      expect(src).not.toMatch(/posthog|analytics|sentry|apiClient|fetch\(|axios|Log\.[dviwe]\(/i);
    }
  });

  test("only requestAccess can show anything: it is the one call given an Activity", () => {
    const bodies = kt.split(/AsyncFunction\("/).slice(1);
    const withActivity = bodies.filter((b) => b.includes("currentActivity")).map((b) => b.slice(0, b.indexOf('"')));
    expect(withActivity).toEqual(["requestAccess"]);
  });
});
