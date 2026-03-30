import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "subtrimmer_cache_";
const CACHE_EXPIRY_PREFIX = "subtrimmer_expiry_";

export async function cacheData(key: string, data: any, expiryMinutes: number = 60) {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const expiryKey = `${CACHE_EXPIRY_PREFIX}${key}`;

    await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    const expiryTime = Date.now() + expiryMinutes * 60 * 1000;
    await AsyncStorage.setItem(expiryKey, expiryTime.toString());
  } catch (error) {
    console.error("Error caching data:", error);
  }
}

export async function getCachedData(key: string) {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const expiryKey = `${CACHE_EXPIRY_PREFIX}${key}`;

    const expiryTime = await AsyncStorage.getItem(expiryKey);
    if (!expiryTime || Date.now() > parseInt(expiryTime)) {
      // Cache expired
      await AsyncStorage.removeItem(cacheKey);
      await AsyncStorage.removeItem(expiryKey);
      return null;
    }

    const cachedData = await AsyncStorage.getItem(cacheKey);
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (error) {
    console.error("Error retrieving cached data:", error);
    return null;
  }
}

export async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(
      (key) => key.startsWith(CACHE_PREFIX) || key.startsWith(CACHE_EXPIRY_PREFIX)
    );
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
}

export async function saveSubscriptions(subscriptions: any[]) {
  await cacheData("subscriptions", subscriptions, 120);
}

export async function getSubscriptions() {
  return getCachedData("subscriptions");
}

export async function saveAnalytics(analytics: any) {
  await cacheData("analytics", analytics, 120);
}

export async function getAnalytics() {
  return getCachedData("analytics");
}
