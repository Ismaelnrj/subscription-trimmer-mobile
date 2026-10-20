/* Every call the backend makes to a third party carries a timeout.
   Without one Node's fetch waits up to five minutes for headers, so a hung
   Brevo, RevenueCat or PostHog holds the request (and, in the daily email job,
   every recipient after it) for that long. A scan rather than a list, so a
   sixth fetch added later is covered too. */
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function callAt(i) {
  // Count brackets from the opening one; an argument list nests.
  const open = SRC.indexOf("(", i);
  let depth = 0;
  for (let j = open; j < SRC.length; j++) {
    if (SRC[j] === "(") depth++;
    else if (SRC[j] === ")" && --depth === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced call at " + i);
}

describe("outbound calls time out", () => {
  const calls = [];
  for (let i = SRC.indexOf("await fetch("); i !== -1; i = SRC.indexOf("await fetch(", i + 1)) calls.push(callAt(i));

  it("finds the calls it is checking", () => {
    expect(calls.length).toBeGreaterThanOrEqual(5);
  });

  it("every one passes a timeout signal", () => {
    const missing = calls.filter((c) => !/signal:\s*AbortSignal\.timeout\(OUTBOUND_TIMEOUT_MS\)/.test(c));
    expect(missing).toEqual([]);
  });

  it("the timeout is a few seconds, not minutes", () => {
    const m = SRC.match(/const OUTBOUND_TIMEOUT_MS = (\d+);/);
    expect(m).not.toBeNull();
    const ms = Number(m[1]);
    expect(ms).toBeGreaterThanOrEqual(3000);
    expect(ms).toBeLessThanOrEqual(30000);
  });
});
