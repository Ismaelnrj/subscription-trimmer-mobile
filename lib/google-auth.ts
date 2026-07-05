import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

// Client IDs come from app.json's extra block (set GOOGLE_ANDROID/IOS/WEB_CLIENT_ID
// there from Google Cloud Console — see https://console.cloud.google.com/apis/credentials).
// Until those are filled in, useAuthRequest() returns a null request and the
// "Continue with Google" button stays disabled.
//
// expo-auth-session's Google provider can throw synchronously (from inside
// its own useMemo) on Android if the OAuth client config doesn't validate —
// e.g. a package name or SHA-1 signing-certificate mismatch with what's
// registered in Google Cloud Console. That's a throw from within a hook, so
// it can't be safely caught with try/catch around the call site (doing so
// corrupts React's hook bookkeeping for the calling component instead of
// recovering). See components/GoogleSignInButton.tsx, which isolates this
// hook in its own leaf component wrapped in a local error boundary instead.
export function useGoogleAuth() {
  const extra = Constants.expoConfig?.extra || {};
  return Google.useAuthRequest({
    androidClientId: extra.googleAndroidClientId || undefined,
    iosClientId: extra.googleIosClientId || undefined,
    webClientId: extra.googleWebClientId || undefined,
    responseType: "id_token",
  });
}

export function isGoogleAuthConfigured() {
  const extra = Constants.expoConfig?.extra || {};
  return !!(extra.googleAndroidClientId || extra.googleIosClientId || extra.googleWebClientId);
}
