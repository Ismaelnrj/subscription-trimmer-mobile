import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Alert } from "react-native";
import i18n from "./i18n";

/* The API base URL, and what happens when it is not configured.
 *
 * This used to be `extra?.apiUrl || "http://localhost:3000"`, which meant a
 * release build that had somehow lost `extra.apiUrl` would quietly point every
 * request at cleartext HTTP on the device itself. Nothing would warn: requests
 * would simply fail, and the app would look like a network problem.
 *
 * localhost stays available in development, where it is the whole point of
 * having a fallback. In a release build a missing or non-HTTPS endpoint is a
 * configuration error, so it is loud instead: every request fails immediately
 * with a message naming the cause, rather than a plain HTTP request being made.
 *
 * A thrown error at import was the other option and is worse. It would replace
 * the app with a crash screen at launch for a mistake in one string, and the
 * thing that actually prevents this shipping is the assertion over app.json in
 * __tests__/api-base-url.test.js, which fails in CI before a build exists. */
const configuredApiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
const API_URL =
  configuredApiUrl && /^https:\/\//.test(configuredApiUrl)
    ? configuredApiUrl
    : __DEV__
      ? configuredApiUrl || "http://localhost:3000"
      : "";

if (!API_URL) {
  console.error(
    "FATAL CONFIG: expo.extra.apiUrl is missing or is not HTTPS in a release build. " +
      `Got ${JSON.stringify(configuredApiUrl)}. Every request will fail rather than ` +
      "fall back to cleartext HTTP."
  );
}

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
apiClient.interceptors.request.use(async (config) => {
  /* With no base URL, axios would resolve "/api/..." against whatever origin it
     thinks it has and produce an error that looks like the server is down. This
     says what is actually wrong, once, at the point of use. */
  if (!API_URL) {
    throw new Error(
      "Trimio is not configured with an API endpoint. This build is missing expo.extra.apiUrl."
    );
  }

  /* Accept-Language is the ONLY language signal the backend has. There is no
     language column on the user, and anything the server sends by email or
     renders as a page would otherwise be English for everyone, including the
     German half of the audience. The account deletion email is the first thing
     to depend on it.

     Its own try/catch, deliberately: i18n is not worth failing a request over,
     and an English email is a far smaller problem than a request that never
     leaves. Normalised to a bare "de" or "en" because the server tests the
     FIRST tag, so a regional form like de-AT must still read as German. */
  try {
    config.headers["Accept-Language"] = i18n.language?.startsWith("de") ? "de" : "en";
  } catch {
    // leave the header off, the server falls back to English
  }

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
