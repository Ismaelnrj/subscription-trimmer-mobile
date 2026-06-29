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

// Retry a request up to maxRetries times for network errors or 5xx responses
async function retryRequest(error: any, retries = 2): Promise<any> {
  const isNetworkError = !error.response;
  const isServerError = error.response?.status >= 500;
  if ((isNetworkError || isServerError) && retries > 0 && error.config) {
    await new Promise((r) => setTimeout(r, (3 - retries) * 1000));
    return apiClient({ ...error.config }).catch((e) => retryRequest(e, retries - 1));
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
