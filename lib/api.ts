import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Alert } from "react-native";

const API_URL = Constants.expoConfig?.extra?.apiUrl || "http://localhost:3000";

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error("Error getting auth token:", error);
  }
  return config;
});

const MAX_RETRIES = 2;

/* Only methods that are safe to repeat. A GET or a HEAD can be re-issued
   freely; a POST cannot, because a 5xx can arrive AFTER the server has already
   done the work, and a blind retry then creates a second subscription or a
   second account. The write paths that genuinely want retrying (the premium
   sync) do it themselves, where they know whether repeating is safe. */
const RETRYABLE_METHODS = new Set(["get", "head", "options"]);

/* The counter lives on the config, not in a parameter.

   It used to be a parameter with a default of 2, and the response interceptor
   called retryRequest(error) with no second argument. Each retry went back
   through that same interceptor, which reset the count to 2 again, so nothing
   ever decremented: a simulation of the old code ran past 40 attempts without
   settling. Offline, that is one request per second forever, and because
   logout() awaits a call through this client, it also meant logging out could
   never finish while the network was down. Carrying the count on the config
   makes it survive the trip through the interceptor, which is the whole point. */
async function retryRequest(error: any): Promise<any> {
  const config = error.config;
  if (!config) return Promise.reject(error);

  const isNetworkError = !error.response;
  const isServerError = error.response?.status >= 500;
  const method = String(config.method ?? "get").toLowerCase();
  const attempt = config._retryCount ?? 0;

  if (
    (isNetworkError || isServerError) &&
    RETRYABLE_METHODS.has(method) &&
    attempt < MAX_RETRIES
  ) {
    config._retryCount = attempt + 1;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    return apiClient(config);
  }
  return Promise.reject(error);
}

let refreshPromise: Promise<string | null> | null = null;

// Exchanges the stored refresh token for a new access token (and rotates the
// refresh token). Concurrent 401s share a single in-flight refresh call so we
// don't fire off multiple refresh requests for one expired token.
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync("refresh_token");
        if (!refreshToken) return null;
        const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
        await SecureStore.setItemAsync("auth_token", res.data.token);
        await SecureStore.setItemAsync("refresh_token", res.data.refreshToken);
        return res.data.token as string;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function clearSessionAndSignOut() {
  await SecureStore.deleteItemAsync("auth_token");
  await SecureStore.deleteItemAsync("refresh_token");
  const { useAuthStore } = await import("./auth-store");
  const wasAuthenticated = useAuthStore.getState().isAuthenticated;
  useAuthStore.getState().setUser(null);
  if (wasAuthenticated) {
    Alert.alert("Session expired", "You have been signed out. Please log in again.");
  }
}

// Handle responses
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const isRefreshCall = config?.url?.includes("/auth/refresh");
    if (error.response?.status === 401 && config && !config._retriedAfterRefresh && !isRefreshCall) {
      config._retriedAfterRefresh = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(config);
      }
      await clearSessionAndSignOut();
      return Promise.reject(error);
    }
    return retryRequest(error);
  }
);

export default apiClient;
