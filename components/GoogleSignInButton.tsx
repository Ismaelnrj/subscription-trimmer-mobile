import { Component, ReactNode, useEffect } from "react";
import { TouchableOpacity, Text, StyleProp, ViewStyle, TextStyle } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { useGoogleAuth, isGoogleAuthConfigured } from "../lib/google-auth";

// expo-auth-session's Google provider can throw synchronously from inside its
// own useMemo when the OAuth client config doesn't validate against Google
// Cloud Console (e.g. a package name or SHA-1 signing-certificate mismatch).
// That's a throw from within a hook's internals, so a try/catch around the
// call site can't safely recover — it leaves React's hook bookkeeping for
// whichever component called it corrupted for that render, which is its own
// fatal crash. Isolating the hook in this leaf component means only this
// component's instance is affected, and this local boundary lets it
// disappear instead of taking the whole screen (email/password fields, main
// sign-in button) down with it.
class GoogleButtonBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

type Props = {
  label: string;
  onIdToken: (idToken: string) => void;
  disabled?: boolean;
  buttonStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconColor: string;
};

function GoogleSignInButtonInner({ label, onIdToken, disabled, buttonStyle, textStyle, iconColor }: Props) {
  const [googleRequest, googleResponse, promptGoogleAuth] = useGoogleAuth();

  useEffect(() => {
    if (googleResponse?.type === "success") {
      onIdToken(googleResponse.params.id_token);
    }
  }, [googleResponse]);

  return (
    <TouchableOpacity style={buttonStyle} onPress={() => promptGoogleAuth()} disabled={!googleRequest || disabled}>
      <AntDesign name="google" size={18} color={iconColor} />
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}

export function GoogleSignInButton(props: Props) {
  if (!isGoogleAuthConfigured()) return null;
  return (
    <GoogleButtonBoundary>
      <GoogleSignInButtonInner {...props} />
    </GoogleButtonBoundary>
  );
}
