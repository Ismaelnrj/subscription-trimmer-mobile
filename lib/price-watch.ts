import { ServiceTemplate, isPriceFresh } from "./service-templates";

/* THE PRICE RISE CARD, added 2026-11-14 at the owner's request.

   WHAT IT CAN HONESTLY SAY. Trimio cannot see a bill, so it cannot know what
   somebody was actually charged. What it does know is a service's public
   price, checked by a person on a date (`verified` in lib/service-templates.ts).
   When a tracked row is priced BELOW that, the provider has most likely
   raised the price since the row was entered, which is the moment this app
   exists for: before the higher amount is taken. The card says exactly that,
   with the date of the check, and offers to update the row or keep it.

   THE PRICES COME FROM THE SERVER, laid over the bundled catalogue, so a
   price rise reaches phones with a backend deploy rather than an app update.
   backend/catalogue-prices.json is that list; a row there replaces the
   bundled price only when it was checked on the same day or later, so an old
   server can never undo a newer figure that shipped in the app.

   ONLY LIKE FOR LIKE. Same service name (exactly, as the market price tip
   does), the row's own currency and the same billing cycle. A euro row is
   never measured against a dollar price, and no exchange rate is involved
   anywhere, because a converted figure would name an amount that appears on
   nobody's statement. */

export type CataloguePrice = {
  id: string;
  price: number;
  currency: string;
  billingCycle: string;
  verified: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isCataloguePrice(p: any): p is CataloguePrice {
  return !!p && typeof p.id === "string"
    && typeof p.price === "number" && Number.isFinite(p.price) && p.price > 0
    && typeof p.currency === "string" && typeof p.billingCycle === "string"
    && typeof p.verified === "string" && DAY.test(p.verified);
}

/** The catalogue with the server's newer figures laid over it. Anything the
    server sends that is malformed, names an unknown row, or disagrees with
    the row about currency or cycle is ignored rather than trusted. */
export function withServerPrices(templates: ServiceTemplate[], server: unknown): ServiceTemplate[] {
  if (!Array.isArray(server)) return templates;
  const byId = new Map<string, CataloguePrice>();
  for (const p of server) if (isCataloguePrice(p)) byId.set(p.id, p);
  if (byId.size === 0) return templates;
  return templates.map((t) => {
    const p = byId.get(t.id);
    if (!p || p.currency !== t.currency || p.billingCycle !== t.billingCycle) return t;
    // ISO days compare correctly as strings. A bundled check that is newer wins.
    if (t.verified && p.verified < t.verified) return t;
    return { ...t, defaultPrice: p.price, verified: p.verified };
  });
}

export type TrackedRow = {
  id: number;
  name: string;
  price: number;
  currency?: string | null;
  billingCycle: string;
  isActive?: boolean;
  cancelledAt?: string | null;
  pending?: boolean;
};

export type PriceRise = {
  subscriptionId: number;
  name: string;
  from: number;
  to: number;
  currency: string;
  billingCycle: string;
  verified: string;
  /** Changes when the listed price does, so keeping a price is remembered
      for THAT figure only and a later rise is shown again. */
  key: string;
};

const CENT = 0.005;

export function findPriceRises(
  rows: TrackedRow[],
  templates: ServiceTemplate[],
  baseCurrencyCode: string,
  now: Date = new Date()
): PriceRise[] {
  const rises: PriceRise[] = [];
  for (const row of rows) {
    // Paused, cancelled and not yet saved rows are not being charged.
    if (row.isActive === false || row.cancelledAt || row.pending || row.id < 0) continue;
    if (typeof row.price !== "number" || !Number.isFinite(row.price)) continue;
    const currency = row.currency || baseCurrencyCode;
    const name = String(row.name ?? "").trim().toLowerCase();
    const match = templates.find((t) =>
      t.name.toLowerCase() === name
      && t.currency === currency
      && t.billingCycle === row.billingCycle
      && isPriceFresh(t, now));
    if (!match || !match.verified) continue;
    if (match.defaultPrice - row.price <= CENT) continue;
    rises.push({
      subscriptionId: row.id,
      name: row.name,
      from: row.price,
      to: match.defaultPrice,
      currency,
      billingCycle: row.billingCycle,
      verified: match.verified,
      key: `${match.id}:${match.defaultPrice}:${match.verified}`,
    });
  }
  return rises;
}

/** Rises the person has not already answered, given what they kept. */
export function unanswered(rises: PriceRise[], kept: Record<string, string>): PriceRise[] {
  return rises.filter((r) => kept[String(r.subscriptionId)] !== r.key);
}
