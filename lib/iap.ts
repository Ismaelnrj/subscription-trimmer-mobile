// IAP stub — real react-native-iap will be wired up after Play Store publishing.
// All purchase functions return false/throw so the UI shows "not available" alerts.

export const PREMIUM_ID = "trimio_premium_v1";
export const TIP_IDS = {
  coffee: "trimio_tip_coffee",
  lunch:  "trimio_tip_lunch",
  dinner: "trimio_tip_dinner",
};

export async function setupIAP(): Promise<boolean> {
  return false;
}

export async function checkIsPremium(): Promise<boolean> {
  return false;
}

export async function buyPremium(): Promise<void> {
  throw new Error("IAP not yet available");
}

export async function sendTip(_productId: string): Promise<void> {
  throw new Error("IAP not yet available");
}

export async function restorePremium(): Promise<boolean> {
  return false;
}
