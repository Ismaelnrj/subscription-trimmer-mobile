import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

// Google's OAuth server only allows custom-URI-scheme redirects for
// Android/iOS-type clients under the *reversed client ID* scheme
// (com.googleusercontent.apps.<client-id>:/...) — expo-auth-session's
// default redirectUri uses this app's own package name instead
// (com.trimio.app:/oauthredirect), which Google rejects with
// "Custom URI scheme is not enabled for your Android client."
function reversedClientIdRedirectUri(clientId?: string): string | undefined {
  if (!clientId) return undefined;
  const prefix = clientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${prefix}:/oauthredirect`;
}

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
  const androidClientId = extra.googleAndroidClientId || undefined;
  const iosClientId = extra.googleIosClientId || undefined;
  const webClientId = extra.googleWebClientId || undefined;
  const nativeClientId = Platform.select({ android: androidClientId, ios: iosClientId, default: undefined });
  const redirectUri = reversedClientIdRedirectUri(nativeClientId);

  return Google.useAuthRequest({
    androidClientId,
    iosClientId,
    webClientId,
    // No explicit responseType: on native platforms expo-auth-session
    // defaults to the authorization-code flow (with PKCE), which is what
    // Google's server expects for "Android"/"iOS" type OAuth clients.
    // Forcing responseType: "id_token" here used the implicit flow instead,
    // which Google's server rejects for this client type with a generic
    // "Error 400: invalid_request" / "Trimio's request is invalid" — the
    // code flow still yields an id_token via the library's automatic code
    // exchange (see GoogleSignInButton.tsx's use of googleResponse.params.id_token).
    ...(redirectUri ? { redirectUri } : {}),
  });
}

export function isGoogleAuthConfigured() {
  const extra = Constants.expoConfig?.extra || {};
  return !!(extra.googleAndroidClientId || extra.googleIosClientId || extra.googleWebClientId);
}
