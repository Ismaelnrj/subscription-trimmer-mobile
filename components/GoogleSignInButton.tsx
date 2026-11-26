import { useState } from "react";
import { TouchableOpacity, Text, Image, StyleProp, ViewStyle, TextStyle } from "react-native";
import { isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import { isGoogleAuthConfigured, signInWithGoogle } from "../lib/google-auth";

type Props = {
  label: string;
  onIdToken: (idToken: string) => void;
  disabled?: boolean;
  buttonStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

// Google's own sign in G, never redrawn or recoloured: its branding rules
// forbid both. The four files are googleg_standard_color_18.png from
// play-services-base 18.11.1 (Google's Maven), the image Android's own
// SignInButton draws, copied byte for byte at mdpi, hdpi, xhdpi and xxhdpi,
// which React Native reads as 1x, 1.5x, 2x and 3x. It keeps its colours on
// both themes, as Google's dark button does.
const GOOGLE_G = require("../assets/google/google-g.png");

export function GoogleSignInButton({ label, onIdToken, disabled, buttonStyle, textStyle }: Props) {
  const [loading, setLoading] = useState(false);

  if (!isGoogleAuthConfigured()) return null;

  const handlePress = async () => {
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      if (idToken) onIdToken(idToken);
    } catch (e) {
      // User cancelling the sign-in sheet isn't an error worth surfacing.
      if (!isErrorWithCode(e) || e.code !== statusCodes.SIGN_IN_CANCELLED) {
        console.warn("[GoogleSignIn] failed:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity style={buttonStyle} onPress={handlePress} disabled={disabled || loading}>
      <Image source={GOOGLE_G} style={{ width: 18, height: 18 }} accessibilityIgnoresInvertColors />
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}
