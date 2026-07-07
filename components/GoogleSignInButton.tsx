import { useState } from "react";
import { TouchableOpacity, Text, StyleProp, ViewStyle, TextStyle } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import { isGoogleAuthConfigured, signInWithGoogle } from "../lib/google-auth";

type Props = {
  label: string;
  onIdToken: (idToken: string) => void;
  disabled?: boolean;
  buttonStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconColor: string;
};

export function GoogleSignInButton({ label, onIdToken, disabled, buttonStyle, textStyle, iconColor }: Props) {
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
      <AntDesign name="google" size={18} color={iconColor} />
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}
