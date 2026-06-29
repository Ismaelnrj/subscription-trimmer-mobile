import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

// Client IDs come from app.json's extra block (set GOOGLE_ANDROID/IOS/WEB_CLIENT_ID
// there from Google Cloud Console — see https://console.cloud.google.com/apis/credentials).
// Until those are filled in, useAuthRequest() returns a null request and the
// "Continue with Google" button stays disabled.
//
// expo-auth-session's Google provider throws synchronously (from inside its
// own useMemo) on Android when androidClientId is missing, instead of
// returning a null request — wrap it so the unconfigured state degrades to
// "disabled button" as intended rather than crashing login/register.
export function useGoogleAuth() {
  const extra = Constants.expoConfig?.extra || {};
  try {
    return Google.useAuthRequest({
      androidClientId: extra.googleAndroidClientId || undefined,
      iosClientId: extra.googleIosClientId || undefined,
      webClientId: extra.googleWebClientId || undefined,
      responseType: "id_token",
    });
  } catch {
    return [null, null, async () => {}] as const;
  }
}

export function isGoogleAuthConfigured() {
  const extra = Constants.expoConfig?.extra || {};
  return !!(extra.googleAndroidClientId || extra.googleIosClientId || extra.googleWebClientId);
}
