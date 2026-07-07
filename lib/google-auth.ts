import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import Constants from "expo-constants";

let _configured = false;

// The native Google Sign-In SDK needs the *Web* client ID (not Android) —
// it becomes the `aud` claim on the returned ID token, which the backend
// verifies. The Android client ID isn't passed here at all: Play Services
// verifies the calling app's identity itself, via its package name and
// signing certificate matched against the Android OAuth client already
// registered in Google Cloud Console.
function configure() {
  if (_configured) return;
  const extra = Constants.expoConfig?.extra || {};
  if (!extra.googleWebClientId) return;
  GoogleSignin.configure({ webClientId: extra.googleWebClientId });
  _configured = true;
}

export function isGoogleAuthConfigured() {
  const extra = Constants.expoConfig?.extra || {};
  return !!extra.googleWebClientId;
}

// Returns the ID token on success, or null if the user cancelled or the
// client isn't configured. Throws for actual errors (e.g. Play Services
// unavailable) — the caller is expected to handle those.
export async function signInWithGoogle(): Promise<string | null> {
  configure();
  if (!_configured) return null;
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  return isSuccessResponse(response) ? response.data.idToken : null;
}
