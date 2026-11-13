/*
 * A free trial is a "Testphase" in German Trimio copy, never a "Probeabo" or a
 * "Probe-Abo". CLAUDE.md records the rule (Localization) and every surface
 * follows it, which is why one exception reads as a different product.
 *
 * WHY A SCAN: notification-localization.test.js already says "never Probeabo",
 * but only for the reminder strings and only for the unhyphenated spelling.
 * The Spotify cancel guide said "Ein kostenloses Probe-Abo" in the app AND on
 * the public page generated from it (/de/kuendigen/spotify) until 2026-11-13,
 * and nothing looked there.
 *
 * DELIBERATELY NOT SCANNED: store-listing-de.md, which uses "Probeabo" once on
 * purpose as a search term (the decision is recorded at the top of that file),
 * and the `_note` of tools/landing-de.json, which names the rule itself.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const WRONG = /probe-?\s?abo/i;

function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) if (k !== "_note") strings(v, out);
  }
  return out;
}

describe("German copy says Testphase, never Probeabo", () => {
  it("catches both spellings (guards the guard)", () => {
    expect("Ein kostenloses Probe-Abo").toMatch(WRONG);
    expect("dein Probeabo").toMatch(WRONG);
    expect("Eine kostenlose Testphase").not.toMatch(WRONG);
  });

  it("in the app's German locale", () => {
    const hits = strings(JSON.parse(read("locales/de.json"))).filter((s) => WRONG.test(s));
    expect(hits).toEqual([]);
  });

  it("in the cancellation guides the app and the site both read", () => {
    const hits = read("lib/cancellation-guides.ts").split("\n").filter((l) => WRONG.test(l));
    expect(hits).toEqual([]);
  });

  it("on the generated German guide pages", () => {
    const dir = path.join(root, "backend/guides/de");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html"));
    expect(files.length).toBeGreaterThan(0);
    const hits = files.filter((f) => WRONG.test(fs.readFileSync(path.join(dir, f), "utf8")));
    expect(hits).toEqual([]);
  });

  it("in the German legal documents, the landing copy and the server's emails", () => {
    const hits = [
      ...strings(JSON.parse(read("backend/legal-de.json"))),
      ...strings(JSON.parse(read("tools/landing-de.json"))),
      read("backend/landing-de.html"),
      read("backend/server.js"),
    ].filter((s) => WRONG.test(s));
    expect(hits).toEqual([]);
  });
});
