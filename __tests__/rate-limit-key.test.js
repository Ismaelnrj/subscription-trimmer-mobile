/* EVERY RATE LIMIT COUNTS AN IPv6 CLIENT BY ITS /64, 2026-11-12.

   express-rate-limit 7 keys on the full address. One subscriber is given at
   least a /64, so stepping through its addresses bought a fresh budget on
   every limiter. Measured by booting the real server, old and new, and
   registering 15 accounts from 15 addresses inside one /64: the old server
   took all 15 (and would have taken any number), the new one refused from
   #11, where authLimiter's 10 per 15 minutes is. 15 registrations from 15
   separate IPv4 addresses passed on both, and login plus refresh answered 200
   over IPv4 and IPv6 on both.

   This lifts the real key function out of server.js and pins its answers, and
   checks no limiter is built around it. */
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function lift(name) {
  const at = SRC.indexOf(`function ${name}(`);
  if (at === -1) return null;
  let depth = 0;
  let i = SRC.indexOf("{", at);
  for (; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) break;
  }
  return new Function(`${SRC.slice(at, i + 1)}; return ${name};`)();
}

const key = lift("rateLimitKey");
const k = (ip) => key({ ip });

describe("the rate limit key", () => {
  it("exists", () => {
    expect(typeof key).toBe("function");
  });

  it("leaves IPv4 alone, including IPv4 written inside IPv6", () => {
    expect(k("203.0.113.7")).toBe("203.0.113.7");
    expect(k("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("gives every address in one /64 the same key, however it is written", () => {
    const a = k("2001:db8:abcd:12:1::5");
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(k("2001:0DB8:ABCD:0012:ffff::9")).toBe(a);
    expect(k("2001:db8:abcd:12:ffff:ffff:ffff:ffff")).toBe(a);
  });

  it("keeps neighbouring /64s apart", () => {
    expect(k("2001:db8:abcd:13::1")).not.toBe(k("2001:db8:abcd:12::1"));
  });

  it("falls back to the address for anything it cannot read, and never throws", () => {
    expect(k("not:an:ip::x")).toBe("not:an:ip::x");
    expect(k("1:2::3::4")).toBe("1:2::3::4");
    expect(k("")).toBe("");
    expect(key({})).toBe("");
    expect(key(undefined)).toBe("");
  });
});

describe("every limiter is built through it", () => {
  it("routes the library through one wrapper that sets the key", () => {
    expect(SRC).toMatch(/const rateLimit = \(opts\) => expressRateLimit\(\{ keyGenerator: rateLimitKey, \.\.\.opts \}\);/);
    // The library is called in exactly one place: the wrapper.
    expect(SRC.match(/expressRateLimit\(/g)).toHaveLength(1);
  });

  it("no limiter overrides the key", () => {
    const limiters = [...SRC.matchAll(/= rateLimit\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
    expect(limiters.length).toBeGreaterThanOrEqual(8);
    for (const l of limiters) expect(l).not.toMatch(/keyGenerator/);
  });
});
