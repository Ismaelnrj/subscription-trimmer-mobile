/* Guards the shape of /api/auth/verify-premium against the fail-open it used
   to have.

   Booting the whole Express app needs a database, so this reads the handler's
   source and asserts on its structure. That is a weaker test than exercising
   the route and it is deliberate: the property worth pinning is "there exists
   no path from an unset key to a granted entitlement", and that is a statement
   about the code, not about one request. A behavioural test would pass just as
   happily with the old branch present but untaken. */

const fs = require("fs");
const path = require("path");

const SERVER = fs.readFileSync(path.join(__dirname, "..", "backend", "server.js"), "utf8");

function handlerSource(route) {
  const start = SERVER.indexOf(`app.post('${route}'`);
  if (start === -1) throw new Error(`route ${route} not found`);
  // to the next top-level route registration
  const rest = SERVER.slice(start + 1);
  const next = rest.search(/\napp\.(get|post|put|delete|use)\(/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("verify-premium never grants on a client claim", () => {
  const src = handlerSource("/api/auth/verify-premium");

  it("does not read isPremium from the request body", () => {
    /* The removed branch:
         } else {
           // Degraded mode: no way to verify server-side, so trust the client.
           isPremium = req.body.isPremium === true;
         }
       Any authenticated user could POST {"isPremium": true} and take the paid
       tier with one request whenever REVENUECAT_SECRET_API_KEY was unset. */
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");   // strip comments
    expect(code).not.toMatch(/req\.body\.isPremium/);
  });

  it("refuses with 503 when the verification key is absent", () => {
    expect(src).toMatch(/if\s*\(!REVENUECAT_SECRET_API_KEY\)/);
    expect(src).toMatch(/503/);
    expect(src).toMatch(/PREMIUM_VERIFICATION_UNAVAILABLE/);
  });

  it("returns before any write when it cannot verify", () => {
    const guard = src.indexOf("PREMIUM_VERIFICATION_UNAVAILABLE");
    const write = src.indexOf("UPDATE users SET is_paid");
    expect(guard).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    // The refusal has to come first, or entitlement changes before the check.
    expect(guard).toBeLessThan(write);
  });

  it("gets its verdict from RevenueCat", () => {
    expect(src).toMatch(/fetchPremiumEntitlementFromRevenueCat/);
  });
});

describe("startup warning describes what actually happens", () => {
  it("no longer claims the client is trusted", () => {
    const warning = SERVER.slice(
      SERVER.indexOf("REVENUECAT_SECRET_API_KEY is not set"),
      SERVER.indexOf("REVENUECAT_SECRET_API_KEY is not set") + 400
    );
    expect(warning).not.toMatch(/trust the client-reported/);
    expect(warning).toMatch(/REFUSE/);
  });
});
