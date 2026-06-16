/**
 * IAP via RevenueCat (react-native-purchases).
 *
 * SETUP CHECKLIST (do this once before releasing):
 * 1. Create a free RevenueCat account at https://app.revenuecat.com
 * 2. Add your app and get the Google API key — paste it into REVENUECAT_API_KEY below
 * 3. In Google Play Console create these in-app products:
 *      Subscriptions : trimio_premium_monthly  ($2.99/mo)
 *                      trimio_premium_yearly   ($19.99/yr)
 *      One-time      : trimio_premium_lifetime ($29.99)
 *      Consumables   : trimio_tip_coffee ($0.99)
 *                      trimio_tip_lunch  ($2.99)
 *                      trimio_tip_dinner ($4.99)
 * 4. In RevenueCat create an Entitlement called "premium" and attach the
 *    monthly + yearly + lifetime products to it.
 * 5. Create an Offering called "default" with those packages.
 */

import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";
import * as SecureStore from "expo-secure-store";
import apiClient from "./api";

const REVENUECAT_API_KEY = "goog_gYpoGpYivXBffoumboUaOWdeOuG";

const ENTITLEMENT_ID = "Trimio Premium";

export const PRODUCT_IDS = {
  monthly:  "trimio_premium_monthly:monthly-2-99",
  yearly:   "trimio_premium_yearly:yearly",
  lifetime: "trimio_premium_lifetime",
};

export const TIP_IDS = {
  coffee: "trimio_tip_coffee",
  lunch:  "trimio_tip_lunch",
  dinner: "trimio_tip_dinner",
};

let _configured = false;

/**
 * Configure RevenueCat. Pass the user's `openId` so RevenueCat's `app_user_id`
 * matches `users.open_id` in our database — this is how the webhook
 * (/api/webhooks/revenuecat) maps purchases back to a Trimio account.
 */
export async function setupIAP(appUserID?: string): Promise<boolean> {
  try {
    if (!_configured) {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID });
      _configured = true;
    } else if (appUserID) {
      const currentId = await Purchases.getAppUserID();
      if (currentId !== appUserID) {
        await Purchases.logIn(appUserID);
      }
    }
    return true;
  } catch (e) {
    console.warn("[IAP] setup failed:", e);
    return false;
  }
}

const PENDING_PREMIUM_SYNC_KEY = "pending_premium_sync";

/**
 * Sync premium status to our backend, retrying with backoff. If every attempt
 * fails (e.g. app killed, no network), persist the desired state so it can be
 * retried on next app launch via retryPendingPremiumSync(). The RevenueCat
 * webhook is also a fallback source of truth if this never succeeds.
 */
export async function syncPremiumWithBackend(isPremium: boolean, retries = 3): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await apiClient.post("/auth/verify-premium", { isPremium });
      await SecureStore.deleteItemAsync(PENDING_PREMIUM_SYNC_KEY);
      return;
    } catch (e) {
      if (attempt < retries - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      } else {
        console.warn("[IAP] backend sync failed after retries, will retry on next launch:", e);
        await SecureStore.setItemAsync(PENDING_PREMIUM_SYNC_KEY, isPremium ? "true" : "false");
      }
    }
  }
}

/** Call on app launch (once authenticated) to flush any sync that failed last time. */
export async function retryPendingPremiumSync(): Promise<void> {
  const pending = await SecureStore.getItemAsync(PENDING_PREMIUM_SYNC_KEY);
  if (pending === null) return;
  await syncPremiumWithBackend(pending === "true");
}

export async function checkIsPremium(): Promise<boolean> {
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

/** Returns the current offering packages, or [] on failure. */
export async function getOfferings(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

/** Purchase a specific package. Throws on failure / user cancel. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<void> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  const active = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

  // Sync premium status to our backend so it reflects instantly everywhere
  await syncPremiumWithBackend(active);

  if (!active) throw new Error("Purchase completed but entitlement not active.");
}

/** Legacy helper used by the buy button when the package is already known. */
export async function buyPremium(): Promise<void> {
  const pkgs = await getOfferings();
  const lifetime = pkgs.find((p) => p.product.identifier === PRODUCT_IDS.lifetime);
  const yearly   = pkgs.find((p) => p.product.identifier === PRODUCT_IDS.yearly);
  const monthly  = pkgs.find((p) => p.product.identifier === PRODUCT_IDS.monthly);
  const target = lifetime ?? yearly ?? monthly;
  if (!target) throw new Error("No available packages found.");
  await purchasePackage(target);
}

export async function sendTip(productId: string): Promise<void> {
  // Tips may live in a separate "tips" offering or in the default one — check both.
  const offerings = await Purchases.getOfferings();
  const allPackages = [
    ...(offerings.all["tips"]?.availablePackages ?? []),
    ...(offerings.current?.availablePackages ?? []),
  ];
  const tip = allPackages.find((p) => p.product.identifier === productId);
  if (!tip) throw new Error("Tip product not found.");
  await Purchases.purchasePackage(tip);
}

export async function restorePremium(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    const active = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    if (active) {
      await syncPremiumWithBackend(true);
    }
    return active;
  } catch {
    return false;
  }
}
