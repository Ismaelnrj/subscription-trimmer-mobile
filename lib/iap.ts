import {
  initConnection,
  getProducts,
  requestPurchase,
  getPurchaseHistory,
  finishTransaction,
  type ProductPurchase,
  type Product,
} from "react-native-iap";
import * as SecureStore from "expo-secure-store";

export const PREMIUM_ID = "subtrimmer_premium_v1";
export const TIP_IDS = {
  coffee: "subtrimmer_tip_coffee",   // $0.99
  lunch:  "subtrimmer_tip_lunch",    // $2.99
  dinner: "subtrimmer_tip_dinner",   // $4.99
};

const PREMIUM_KEY = "subtrimmer_is_premium";

export async function setupIAP(): Promise<boolean> {
  try {
    await initConnection();
    return true;
  } catch {
    return false;
  }
}

export async function getIAPProducts(ids: string[]): Promise<Product[]> {
  try {
    return await getProducts({ skus: ids });
  } catch {
    return [];
  }
}

export async function checkIsPremium(): Promise<boolean> {
  const cached = await SecureStore.getItemAsync(PREMIUM_KEY);
  if (cached === "true") return true;
  try {
    const history = await getPurchaseHistory();
    const has = history.some((p) => p.productId === PREMIUM_ID);
    if (has) await SecureStore.setItemAsync(PREMIUM_KEY, "true");
    return has;
  } catch {
    return false;
  }
}

export async function buyPremium(): Promise<void> {
  const purchase = await requestPurchase({ skus: [PREMIUM_ID] });
  await SecureStore.setItemAsync(PREMIUM_KEY, "true");
}

export async function sendTip(productId: string): Promise<void> {
  const purchase = await requestPurchase({ skus: [productId] });
  if (purchase) {
    await finishTransaction({ purchase: purchase as ProductPurchase, isConsumable: true });
  }
}

export async function restorePremium(): Promise<boolean> {
  try {
    const history = await getPurchaseHistory();
    const has = history.some((p) => p.productId === PREMIUM_ID);
    if (has) await SecureStore.setItemAsync(PREMIUM_KEY, "true");
    return has;
  } catch {
    return false;
  }
}
