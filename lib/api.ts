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

// Handle responses
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync("auth_token");
      const { useAuthStore } = await import("./auth-store");
      const wasAuthenticated = useAuthStore.getState().isAuthenticated;
      useAuthStore.getState().setUser(null);
      if (wasAuthenticated) {
        Alert.alert("Session expired", "You have been signed out. Please log in again.");
      }
      return Promise.reject(error);
    }
    return retryRequest(error);
  }
);

export default apiClient;
