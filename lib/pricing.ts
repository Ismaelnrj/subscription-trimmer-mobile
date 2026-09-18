/**
 * FALLBACK prices only. The real figure is RevenueCat's localized
 * `priceString`, which is what Google Play actually charges, and these are what
 * shows before the offerings resolve or when IAP is unavailable. Keep them in
 * step with the Play product prices.
 *
 * This comment used to describe that as already true everywhere, and it was
 * true only of the tip jar. `app/upgrade.tsx` fetched the offerings, used them
 * to make the purchase, and displayed these hardcoded USD strings instead, so
 * a subscriber in Austria read "$2.99" on the screen where they decide to pay
 * and was then charged in euros. Fixed 2026-09-18.
 *
 * They are still USD, so anywhere that shows a fallback shows dollars to a euro
 * user for a moment. That is the cost of having no price until the offerings
 * load, and it is the reason these should never be the ONLY price a screen can
 * show. `components/PremiumGate.tsx` and `app/(tabs)/profile.tsx` still show
 * only the fallback, deliberately: they are banners, not purchase screens, and
 * fetching offerings from each would be four extra round trips for a line of
 * marketing copy.
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
