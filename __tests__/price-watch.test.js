/* The price rise card: which tracked rows it speaks about, and from which
 * figures. Behavioural, on the real lib/price-watch.ts and the real bundled
 * catalogue. See that file's header for what the card may honestly claim. */
const { withServerPrices, findPriceRises, unanswered } = require("../lib/price-watch");
const { SERVICE_TEMPLATES } = require("../lib/service-templates");

const NOW = new Date("2026-11-14T10:00:00Z");
const netflixDe = SERVICE_TEMPLATES.find((t) => t.id === "netflix-de-standard"); // 15.99 EUR, checked 2026-09-05
const row = (over) => ({ id: 7, name: "Netflix Standard", price: 13.99, currency: "EUR", billingCycle: "monthly", isActive: true, ...over });

describe("withServerPrices", () => {
  it("takes a newer server check over the bundled one", () => {
    const out = withServerPrices(SERVICE_TEMPLATES, [
      { id: "netflix-de-standard", price: 17.99, currency: "EUR", billingCycle: "monthly", verified: "2026-11-10" },
    ]);
    const t = out.find((x) => x.id === "netflix-de-standard");
    expect(t.defaultPrice).toBe(17.99);
    expect(t.verified).toBe("2026-11-10");
    // Nothing else moves.
    expect(out.find((x) => x.id === "spotify-de")).toBe(SERVICE_TEMPLATES.find((x) => x.id === "spotify-de"));
  });

  it("never lets an older server check undo a newer bundled one", () => {
    const out = withServerPrices(SERVICE_TEMPLATES, [
      { id: "netflix-de-standard", price: 9.99, currency: "EUR", billingCycle: "monthly", verified: "2026-01-01" },
    ]);
    expect(out.find((x) => x.id === "netflix-de-standard").defaultPrice).toBe(netflixDe.defaultPrice);
  });

  it("ignores rows it cannot trust", () => {
    const bad = [
      { id: "netflix-de-standard", price: 17.99, currency: "USD", billingCycle: "monthly", verified: "2026-11-10" }, // other currency
      { id: "netflix-de-standard", price: 17.99, currency: "EUR", billingCycle: "yearly", verified: "2026-11-10" },  // other cycle
      { id: "netflix-de-standard", price: "17.99", currency: "EUR", billingCycle: "monthly", verified: "2026-11-10" },
      { id: "netflix-de-standard", price: -1, currency: "EUR", billingCycle: "monthly", verified: "2026-11-10" },
      { id: "netflix-de-standard", price: 17.99, currency: "EUR", billingCycle: "monthly", verified: "10.11.2026" },
      { id: "no-such-row", price: 1, currency: "EUR", billingCycle: "monthly", verified: "2026-11-10" },
      null,
    ];
    for (const b of bad) {
      expect(withServerPrices(SERVICE_TEMPLATES, [b]).find((x) => x.id === "netflix-de-standard").defaultPrice)
        .toBe(netflixDe.defaultPrice);
    }
    expect(withServerPrices(SERVICE_TEMPLATES, undefined)).toBe(SERVICE_TEMPLATES);
    expect(withServerPrices(SERVICE_TEMPLATES, { prices: [] })).toBe(SERVICE_TEMPLATES);
  });
});

describe("findPriceRises", () => {
  it("speaks when a row is below the checked price, in the row's own currency", () => {
    const [r] = findPriceRises([row()], SERVICE_TEMPLATES, "EUR", NOW);
    expect(r).toMatchObject({ subscriptionId: 7, from: 13.99, to: 15.99, currency: "EUR", billingCycle: "monthly", verified: "2026-09-05" });
    expect(r.key).toBe("netflix-de-standard:15.99:2026-09-05");
  });

  it("matches the name as the market price tip does: exact, ignoring case and spaces", () => {
    expect(findPriceRises([row({ name: "  netflix standard " })], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(1);
    expect(findPriceRises([row({ name: "Netflix" })], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(0);
  });

  it("never compares across currencies or cycles", () => {
    // A franc row: no CHF Netflix Standard row exists, so nothing is said.
    expect(findPriceRises([row({ currency: "CHF" })], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(0);
    expect(findPriceRises([row({ billingCycle: "yearly" })], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(0);
    // A dollar row is measured against the US price, 19.99, never 15.99 converted.
    const [us] = findPriceRises([row({ currency: "USD", price: 15.49 })], SERVICE_TEMPLATES, "EUR", NOW);
    expect(us.to).toBe(19.99);
  });

  it("reads a row with no currency as the account's", () => {
    expect(findPriceRises([row({ currency: null })], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(1);
    expect(findPriceRises([row({ currency: null })], SERVICE_TEMPLATES, "USD", NOW)[0].to).toBe(19.99);
  });

  it("says nothing at or above the checked price", () => {
    expect(findPriceRises([row({ price: 15.99 })], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(0);
    expect(findPriceRises([row({ price: 15.995 })], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(0);
    // Rows written before prices were rounded can hold sub-cent figures; under a cent is not a rise.
    expect(findPriceRises([row({ price: 15.986 })], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(0);
    expect(findPriceRises([row({ price: 18.99 })], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(0);
  });

  it("skips rows nobody is charged for", () => {
    for (const over of [{ isActive: false }, { cancelledAt: "2026-11-01T00:00:00Z" }, { pending: true }, { id: -3 }]) {
      expect(findPriceRises([row(over)], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(0);
    }
  });

  it("only speaks for a fresh check", () => {
    // Six months after the 2026-09-05 check, the figure is no longer stood behind.
    expect(findPriceRises([row()], SERVICE_TEMPLATES, "EUR", new Date("2027-04-01T00:00:00Z"))).toHaveLength(0);
    // A row never checked says nothing, whatever its price (DAZN is unverified on purpose).
    expect(findPriceRises([row({ name: "DAZN", price: 1 })], SERVICE_TEMPLATES, "EUR", NOW)).toHaveLength(0);
  });

  it("follows the server's figure once it is laid over", () => {
    const catalogue = withServerPrices(SERVICE_TEMPLATES, [
      { id: "netflix-de-standard", price: 17.99, currency: "EUR", billingCycle: "monthly", verified: "2026-11-10" },
    ]);
    const [r] = findPriceRises([row({ price: 15.99 })], catalogue, "EUR", NOW);
    expect(r.to).toBe(17.99);
    expect(r.key).toBe("netflix-de-standard:17.99:2026-11-10");
  });
});

describe("unanswered", () => {
  it("hides a figure the person kept, and shows a later one", () => {
    const [r] = findPriceRises([row()], SERVICE_TEMPLATES, "EUR", NOW);
    expect(unanswered([r], { 7: r.key })).toHaveLength(0);
    expect(unanswered([r], { 7: "netflix-de-standard:14.99:2026-01-01" })).toHaveLength(1);
    expect(unanswered([r], {})).toHaveLength(1);
  });
});
