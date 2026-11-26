import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../lib/auth-store";
import apiClient from "../lib/api";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
import { isGoogleAuthConfigured } from "../lib/google-auth";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { AuthHeader, AuthFooter } from "../components/AuthHeader";
import { track } from "../lib/analytics";

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState<"email" | "password" | null>(null);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t("common.error"), t("login.errEmptyFields"));
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/login", { email: email.trim().toLowerCase(), password });
      const { token, refreshToken, user } = res.data;
      await SecureStore.setItemAsync("auth_token", token);
      await SecureStore.setItemAsync("refresh_token", refreshToken);
      setUser(user);
      track("login_completed", { method: "email" });
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert(t("common.error"), err.response?.data?.error || t("login.errLoginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleIdToken = async (idToken: string) => {
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/google", { idToken });
      const { token, refreshToken, user } = res.data;
      await SecureStore.setItemAsync("auth_token", token);
      await SecureStore.setItemAsync("refresh_token", refreshToken);
      setUser(user);
      track("google_auth_completed", { screen: "login" });
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert(t("common.error"), err.response?.data?.error || t("login.errGoogleFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <AuthHeader brand title={t("auth.headline")} subtitle={t("auth.lead")} />

      <View style={styles.form}>
        {isGoogleAuthConfigured() ? (
          <>
            <GoogleSignInButton
              label={t("login.continueGoogle")}
              onIdToken={handleGoogleIdToken}
              disabled={loading}
              buttonStyle={styles.googleButton}
              textStyle={styles.googleButtonText}
            />
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t("login.or")}</Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        ) : null}

        {/* Each field names itself twice: an icon that stays while somebody
            types, and the placeholder until they do. The accessibility label
            carries the name for a screen reader throughout. */}
        <View style={[styles.field, focus === "email" && styles.fieldFocused]}>
          <MaterialCommunityIcons name="email-outline" size={20} color={focus === "email" ? c.text : c.textSecondary} style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder={t("login.emailPlaceholder")}
            placeholderTextColor={c.placeholder}
            autoComplete="email"
            accessibilityLabel={t("login.emailPlaceholder")}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocus("email")}
            onBlur={() => setFocus(null)}
          />
        </View>

        <View>
          <View style={[styles.field, focus === "password" && styles.fieldFocused]}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={focus === "password" ? c.text : c.textSecondary} style={styles.fieldIcon} />
            <TextInput
              style={styles.fieldInput}
              placeholder={t("login.passwordPlaceholder")}
              placeholderTextColor={c.placeholder}
              autoComplete="current-password"
              accessibilityLabel={t("login.passwordPlaceholder")}
              secureTextEntry={!showPassword}
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              onFocus={() => setFocus("password")}
              onBlur={() => setFocus(null)}
            />
            <TouchableOpacity style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={t(showPassword ? "common.a11yHidePassword" : "common.a11yShowPassword")} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={c.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.forgotLink} accessibilityRole="link" hitSlop={{ top: 4, bottom: 8, left: 12, right: 12 }} onPress={() => router.push("/forgot-password")}>
            <Text style={styles.forgotText}>{t("login.forgotPassword")}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} accessibilityRole="button">
          {loading ? <ActivityIndicator color={c.bg} /> : (
            <>
              <Text style={styles.buttonText}>{t("login.signIn")}</Text>
              <MaterialCommunityIcons name="arrow-right" size={22} color={c.bg} style={styles.buttonArrow} />
            </>
          )}
        </TouchableOpacity>
      </View>

      <AuthFooter features>
        <TouchableOpacity style={styles.link} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => router.push("/register")}>
          <Text style={styles.linkText}>{t("login.noAccount")} <Text style={styles.linkBold}>{t("login.signUp")}</Text></Text>
        </TouchableOpacity>
      </AuthFooter>
    </ScrollView>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    // Top anchored, the switch to sign up and the waves at the foot; scrolls
    // when the keyboard is up so the button is never hidden behind it.
    scroll: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.l, paddingBottom: space.l },
    form: { gap: space.m },
    field: {
      flexDirection: "row", alignItems: "center", minHeight: 56,
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: radius.l,
    },
    // The field being typed in says so: an ink edge and an ink icon.
    fieldFocused: { borderColor: c.text },
    fieldIcon: { marginLeft: space.l },
    // minWidth 0 lets the field give way to the eye button on a narrow phone.
    fieldInput: { ...typeScale.body, flex: 1, minWidth: 0, minHeight: 56, paddingHorizontal: space.m, color: c.text },
    eyeButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
    // Short, with the touch area made up by hitSlop (44 dp in all).
    forgotLink: { alignSelf: "flex-end", minHeight: 32, justifyContent: "center" },
    forgotText: { ...typeScale.label, color: c.text },
    button: {
      backgroundColor: c.text, borderRadius: radius.l, minHeight: 56,
      alignItems: "center", justifyContent: "center",
    },
    buttonText: { ...typeScale.heading, color: c.bg },
    buttonArrow: { position: "absolute", right: space.l + space.xs },
    divider: { flexDirection: "row", alignItems: "center" },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    dividerText: { ...typeScale.caption, color: c.textSecondary, marginHorizontal: space.m },
    // Lifted off the ground by a soft shadow rather than ruled in: the one
    // raised surface on the screen. Dark mode has no shadow to speak of, so
    // there it keeps its edge.
    googleButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.m,
      minHeight: 56, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: radius.l,
      shadowColor: "#000000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    googleButtonText: { ...typeScale.heading, color: c.text },
    link: { alignItems: "center", justifyContent: "center", minHeight: 40 },
    linkText: { ...typeScale.body, color: c.textSecondary },
    linkBold: { fontFamily: "Montserrat-SemiBold", color: c.text },
  });
}
