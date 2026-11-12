/* THE CREATE ROUTE AND THE APP'S OFFLINE QUEUE SHARE A CONTRACT, written down
   2026-11-12 after the account ceiling broke it on the day it was added.

   lib/pending-subscriptions.ts sends entries saved offline. A 401, or a 403
   whose error is not FREE_LIMIT_REACHED, it reads as a SESSION problem: it
   stops the pass and keeps the entry waiting, retried every 30 seconds, with
   every entry queued behind it held back too. Any other 4xx is a refusal the
   person sees and decides on. So a create refusal that is about the ENTRY
   must never be a 403, or one entry wedges the whole queue on every installed
   build. The ceiling was answered 403 ACCOUNT_LIMIT_REACHED for half a day.

   Both add paths also show the answer's `error` to the person verbatim, so a
   refusal states a sentence there (translated by ERROR_TEXT_DE) and keeps any
   machine code in its own field. */
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");
const QUEUE = fs.readFileSync(path.join(__dirname, "..", "lib", "pending-subscriptions.ts"), "utf8");

function route(method, url) {
  const at = SRC.indexOf(`app.${method}('${url}'`);
  if (at === -1) return "";
  const next = SRC.indexOf("\napp.", at + 1);
  return SRC.slice(at, next === -1 ? undefined : next);
}

const create = route("post", "/api/trpc/subscriptions.create");

describe("the create route answers in the shape the offline queue expects", () => {
  it("finds the route and the queue rule it is written against", () => {
    expect(create.length).toBeGreaterThan(500);
    expect(QUEUE).toMatch(/status === 403 && body\.error !== "FREE_LIMIT_REACHED"\)\) break;/);
  });

  it("refuses with 403 only for the free limit", () => {
    const codes = [];
    for (const m of create.matchAll(/status:\s*403\s*,\s*body:\s*\{\s*error:\s*'([^']+)'/g)) codes.push(m[1]);
    for (const m of create.matchAll(/res\.status\(403\)\.json\(\{\s*error:\s*'([^']+)'/g)) codes.push(m[1]);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.filter((c) => c !== "FREE_LIMIT_REACHED")).toEqual([]);
  });

  it("answers the account ceiling 409 with a translated sentence and the code beside it", () => {
    const m = create.match(/status:\s*(\d+)\s*,\s*body:\s*\{\s*error:\s*'([^']+)',\s*code:\s*'ACCOUNT_LIMIT_REACHED'/);
    expect(m).toBeTruthy();
    expect(m[1]).toBe("409");
    expect(m[2]).toMatch(/\s/); // a sentence, not a code
    const dict = SRC.slice(SRC.indexOf("const ERROR_TEXT_DE = {"), SRC.indexOf("};", SRC.indexOf("const ERROR_TEXT_DE = {")));
    expect(dict).toContain(`'${m[2]}':`);
  });
});
