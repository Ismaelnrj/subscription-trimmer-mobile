/* backend/catalogue-prices.json, the checked prices the server hands the
 * price rise card, stays in step with the catalogue the app bundles.
 *
 * The server's list exists so a price change reaches phones without an app
 * update, so it is allowed to be NEWER than the bundle and never older or
 * different about what a row is. A row the app does not bundle would be
 * ignored by the app (lib/price-watch.ts), so it is refused here instead of
 * sitting there looking like it works. */
const fs = require("fs");
const path = require("path");
const { SERVICE_TEMPLATES } = require("../lib/service-templates");

const file = require("../backend/catalogue-prices.json");
const server = fs.readFileSync(path.join(__dirname, "../backend/server.js"), "utf8");

describe("backend/catalogue-prices.json", () => {
  it("is a list of well formed rows", () => {
    expect(Array.isArray(file.prices)).toBe(true);
    expect(file.prices.length).toBeGreaterThanOrEqual(10);
    for (const p of file.prices) {
      expect(typeof p.id).toBe("string");
      expect(Number.isFinite(p.price) && p.price > 0).toBe(true);
      expect(Math.round(p.price * 100) / 100).toBe(p.price);
      expect(p.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(isNaN(Date.parse(p.verified))).toBe(false);
    }
    expect(new Set(file.prices.map((p) => p.id)).size).toBe(file.prices.length);
  });

  it("names only rows the app bundles, and agrees with them about what they are", () => {
    for (const p of file.prices) {
      const t = SERVICE_TEMPLATES.find((x) => x.id === p.id);
      expect(t).toBeDefined();
      expect({ id: p.id, name: p.name, currency: p.currency, billingCycle: p.billingCycle })
        .toEqual({ id: t.id, name: t.name, currency: t.currency, billingCycle: t.billingCycle });
    }
  });

  it("is never older than the bundle, and on the same day says the same price", () => {
    for (const p of file.prices) {
      const t = SERVICE_TEMPLATES.find((x) => x.id === p.id);
      if (!t.verified) continue;
      expect(p.verified >= t.verified).toBe(true);
      if (p.verified === t.verified) expect(p.price).toBe(t.defaultPrice);
    }
  });

  it("covers every checked row the app bundles", () => {
    const listed = new Set(file.prices.map((p) => p.id));
    const missing = SERVICE_TEMPLATES.filter((t) => t.verified && !listed.has(t.id)).map((t) => t.id);
    expect(missing).toEqual([]);
  });
});

describe("GET /api/trpc/catalogue.prices", () => {
  const start = server.indexOf("app.get('/api/trpc/catalogue.prices'");
  const block = server.slice(start, server.indexOf("\n});", start));

  it("is behind authMiddleware and wrapped in trpc()", () => {
    expect(start).toBeGreaterThan(0);
    expect(block).toMatch(/app\.get\('\/api\/trpc\/catalogue\.prices', authMiddleware,/);
    expect(block).toMatch(/res\.json\(trpc\(\{ prices: CATALOGUE_PRICES \}\)\)/);
  });

  it("serves the file, and an unreadable file costs the list, not the server", () => {
    expect(server).toMatch(/require\('\.\/catalogue-prices\.json'\)\.prices/);
    const loader = server.slice(server.indexOf("const CATALOGUE_PRICES"), start);
    expect(loader).toMatch(/try \{/);
    expect(loader).toMatch(/catch \(err\)/);
  });
});
