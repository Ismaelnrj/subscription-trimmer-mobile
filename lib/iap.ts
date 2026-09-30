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

// RevenueCat public SDK key (Google platform) — safe to ship in client code,
// it only authorizes this app to talk to RevenueCat and carries no secret
// permissions. Server-side operations use a separate secret key.
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
let _configuring: Promise<boolean> | null = null;

/**
 * Configure RevenueCat. Pass the user's `openId` so RevenueCat's `app_user_id`
 * matches `users.open_id` in our database — this is how the webhook
 * (/api/webhooks/revenuecat) maps purchases back to a Trimio account.
 */
export function setupIAP(appUserID?: string): Promise<boolean> {
  if (_configuring) return _configuring;
  _configuring = _setupIAP(appUserID).finally(() => { _configuring = null; });
  return _configuring;
}

async function _setupIAP(appUserID?: string): Promise<boolean> {
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

/** The shape `formatUser` returns from the backend. Only the fields this file
 *  reasons about are named; the rest ride along to the auth store untouched. */
export interface VerifiedUser {
  id: number;
  isPaid: boolean;
  [key: string]: unknown;
}

/** THE SERVER'S VERDICT, WHICH IS THE ONLY ONE THAT COUNTS.
 *
 *  `/auth/verify-premium` deliberately IGNORES the `isPremium` it is posted.
 *  It asks RevenueCat itself with the secret key, writes what comes back, and
 *  returns the updated user. So the POST succeeding and the user being paid
 *  are DIFFERENT FACTS, and this used to return a bare boolean that conflated
 *  them: any 2xx read as success, the response body was discarded, and the
 *  purchase screen then wrote `isPaid: true` locally. A server that answered
 *  200 with `isPaid: false` produced a Premium welcome and a user who lost
 *  Premium the next time the app loaded them from the server. */
export type PremiumSync =
  | { status: "verified"; user: VerifiedUser }
  /** Reached the server or did not, but no verdict was obtained. The desired
   *  state is persisted and retried at next launch, and the RevenueCat webhook
   *  remains the other way in, so this is "not yet known" rather than "no". */
  | { status: "unverified"; reason: "unavailable" | "network" };

/**
 * Sync premium status to our backend, retrying with backoff, and RETURN WHAT
 * THE SERVER SAID. If every attempt fails (app killed, no network, or the
 * server refusing with 503 because REVENUECAT_SECRET_API_KEY is unset),
 * persist the desired state so retryPendingPremiumSync() can try again on the
 * next launch.
 */
export async function syncPremiumWithBackend(isPremium: boolean, retries = 3): Promise<PremiumSync> {
  let reason: "unavailable" | "network" = "network";
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await apiClient.post("/auth/verify-premium", { isPremium });
      await SecureStore.deleteItemAsync(PENDING_PREMIUM_SYNC_KEY);
      const user = res?.data?.user;
      /* A 200 with no usable user is not a verdict. Treating it as one would
         reinstate the exact bug this type exists to prevent, one level down. */
      if (user && typeof user.id === "number" && typeof user.isPaid === "boolean") {
        return { status: "verified", user: user as VerifiedUser };
      }
      console.warn("[IAP] verify-premium returned no usable user; treating as unverified");
      return { status: "unverified", reason: "network" };
    } catch (e: any) {
      /* 503 is the server REFUSING to verify (no RevenueCat secret key in
         Railway), which is not transient in the way a dropped connection is,
         but it is still "not known" rather than "not premium", and it starts
         working the moment the variable is set, so it is retried the same way
         and reported distinctly. */
      if (e?.response?.status === 503) reason = "unavailable";
      if (attempt < retries - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      } else {
        console.warn("[IAP] backend sync failed after retries, will retry on next launch:", e);
        await SecureStore.setItemAsync(PENDING_PREMIUM_SYNC_KEY, isPremium ? "true" : "false");
      }
    }
  }
  return { status: "unverified", reason };
}

/** Call on app launch (once authenticated) to flush any sync that failed last
 *  time. Returns the server's verdict so the caller can apply it: a purchase
 *  confirmed here is one that was charged on a previous run and never reached
 *  the account, which is the case this whole path exists for. */
export async function retryPendingPremiumSync(): Promise<PremiumSync | null> {
  const pending = await SecureStore.getItemAsync(PENDING_PREMIUM_SYNC_KEY);
  if (pending === null) return null;
  return syncPremiumWithBackend(pending === "true");
}

/** `null` means the lookup FAILED, which is not the same as "not premium".
 *  Returning false for both is what let an offline phone tell a paying
 *  customer they had no subscription. Every caller must treat null as
 *  "unchanged" rather than as "no". */
export async function checkIsPremium(): Promise<boolean | null> {
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (e) {
    console.warn("[IAP] entitlement lookup failed; status unknown rather than false:", e);
    return null;
  }
}

/** Did the PERSON cancel, as opposed to something going wrong?
 *
 *  This used to be `e.message.toLowerCase().includes("cancel")` at the call
 *  site, which is a string search over text the SDK is free to localise or
 *  reword: the day it does, a cancelled purchase starts showing a "purchase
 *  failed" alert. react-native-purchases carries a typed `userCancelled` flag,
 *  which is read FIRST. The string check is kept underneath purely so that
 *  behaviour cannot get WORSE than it is today if that field is ever absent. */
export function isUserCancelled(e: any): boolean {
  if (typeof e?.userCancelled === "boolean") return e.userCancelled;
  return typeof e?.message === "string" && e.message.toLowerCase().includes("cancel");
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

/**
 * Purchase a specific package. Only throws on a real RevenueCat failure or
 * user cancellation — once the SDK call itself succeeds the user has been
 * charged, so we never report that as a "failed" purchase. The entitlement
 * can lag a few seconds behind the charge, so it's re-checked with backoff
 * before giving up on confirming it as active.
 *
 * Returns `active` (whether the SDK confirmed the entitlement) and `sync`
 * (WHAT THE SERVER SAID) separately. `sync` used to be a bare `synced`
 * boolean, which is why a server verdict of `isPaid: false` could be shown as
 * a Premium welcome: a 2xx and a paid account were the same value.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<{ active: boolean; sync: PremiumSync }> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  let active = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

  for (let attempt = 0; !active && attempt < 3; attempt++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    try {
      const info = await Purchases.getCustomerInfo();
      active = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (e) {
      console.warn("[IAP] entitlement re-check failed, will retry:", e);
    }
  }

  const sync = await syncPremiumWithBackend(active);
  return { active, sync };
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

/** FOUR OUTCOMES, BECAUSE THREE OF THEM USED TO LOOK IDENTICAL.
 *
 *  This returned `{ active: false, synced: false }` for a caught error, which
 *  is the same value as an account that genuinely has nothing to restore. So
 *  "you never bought this", "your phone is offline" and "RevenueCat is down"
 *  all produced the same "No purchase found" alert, and a paying customer with
 *  no signal was told they had no subscription. The screen already had a
 *  separate retry message; it was simply unreachable.
 *
 *  `cancelled` is its own outcome so the caller stays quiet rather than
 *  reporting a failure the person chose. */
export type RestoreResult =
  | { status: "restored"; sync: PremiumSync }
  | { status: "none"; sync: PremiumSync }
  | { status: "cancelled" }
  | { status: "error" };

export async function restorePremium(): Promise<RestoreResult> {
  let info: CustomerInfo;
  try {
    info = await Purchases.restorePurchases();
  } catch (e) {
    if (isUserCancelled(e)) return { status: "cancelled" };
    /* THE LOOKUP FAILED, so nothing is known. Deliberately NOT reported as an
       absent purchase, and deliberately not synced: telling the backend
       `false` here would take Premium away from a paying customer because
       their train went into a tunnel. */
    console.warn("[IAP] restore failed; entitlement unknown rather than absent:", e);
    return { status: "error" };
  }

  const active = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  /* SYNCED IN BOTH DIRECTIONS, as before. It is tempting to skip the call when
     the SDK found nothing, and that would be a mistake: the server does not
     trust the posted value, it asks RevenueCat itself with this user's
     open_id. So posting `false` is how a client that is WRONG about having no
     purchase gets corrected UPWARD by the authoritative source. The lookup
     ERROR above is the only path that must not sync, because there the client
     knows nothing at all. */
  const sync = await syncPremiumWithBackend(active);
  return active ? { status: "restored", sync } : { status: "none", sync };
}
