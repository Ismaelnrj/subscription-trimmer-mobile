/**
 * Tip jar fallback prices only, shown before RevenueCat's localized
 * `priceString` loads or when IAP is unavailable. Keep them in step with the
 * Play product prices.
 *
 * PREMIUM HAS NO FALLBACK HERE ON PURPOSE. `PREMIUM_PRICES` lived in this file
 * as hardcoded USD and was removed 2026-11-07, unused: the purchase screen
 * names only a price Google Play gave it (app/upgrade.tsx), and the banners
 * name no price at all (2026-09-20). A constant nothing reads still told the
 * next reader the price was 2.99 after it had changed. The real Premium price
 * lives in Play Console, base plans `monthly-2-99` and `yearly`; the id keeps
 * its old number because a base plan id cannot be renamed, and the app finds
 * the plan by that id (PRODUCT_IDS in lib/iap.ts).
 */

export const TIP_PRICES = {
  coffee: "$0.99",
  lunch: "$2.99",
  dinner: "$4.99",
};
