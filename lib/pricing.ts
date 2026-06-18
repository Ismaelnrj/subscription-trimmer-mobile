/**
 * Single source of truth for displayed prices. These are fallback strings
 * shown before RevenueCat's localized `priceString` loads (or if IAP is
 * unavailable) — keep in sync with the actual Google Play product prices.
 */

export const PREMIUM_PRICES = {
  monthly: "$2.99",
  yearly: "$19.99",
  lifetime: "$29.99",
};

export const TIP_PRICES = {
  coffee: "$0.99",
  lunch: "$2.99",
  dinner: "$4.99",
};
