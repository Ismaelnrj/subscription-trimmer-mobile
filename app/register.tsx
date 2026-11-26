import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, BackHandler } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../lib/auth-store";
import apiClient from "../lib/api";
import { PasswordStrengthMeter, isPasswordValid, isPasswordTooLong } from "../components/PasswordStrength";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
import { isGoogleAuthConfigured } from "../lib/google-auth";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { AuthStage } from "../components/AuthHeader";
import { track } from "../lib/analytics";

export default function RegisterScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [focus, setFocus] = useState<"name" | "email" | "password" | null>(null);
  // Two buttons first; the form only once somebody chooses email. Without
  // Google there is nothing to choose between, so the form shows at once.
  const google = isGoogleAuthConfigured();
  const [mode, setMode] = useState<"choose" | "email">(google ? "choose" : "email");
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const handleGoogleIdToken = async (idToken: string) => {
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/google", { idToken });
      const { token, refreshToken, user } = res.data;
      await SecureStore.setItemAsync("auth_token", token);
      await SecureStore.setItemAsync("refresh_token", refreshToken);
      setUser(user);
      // The backend doesn't tell us here whether this was a new account or
      // an existing one signing in, so this can't be split into
      // sign_up/login the way the email/password flows below are.
      track("google_auth_completed", { screen: "register" });
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert(t("common.error"), err.response?.data?.error || t("register.errGoogleFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert(t("common.error"), t("register.errEmptyFields"));
      return;
    }
    if (!isPasswordValid(password)) {
      Alert.alert(t("common.error"), t("register.errWeakPassword"));
      return;
    }
    if (isPasswordTooLong(password)) {
      Alert.alert(t("common.error"), t("common.errPasswordTooLong"));
      return;
    }
    setEmailError("");
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/register", { name, email: email.trim().toLowerCase(), password });
      const { token, refreshToken, user } = res.data;
      await SecureStore.setItemAsync("auth_token", token);
      await SecureStore.setItemAsync("refresh_token", refreshToken);
      setUser(user);
      track("sign_up_completed", { method: "email" });
      router.replace("/(tabs)");
    } catch (err: any) {
      // Empty rather than an English sentence, so the localised fallback below
      // is what a German reader sees when the server sent no text at all.
      const msg: string = err.response?.data?.error || "";
      if (msg.toLowerCase().includes("already")) {
        setEmailError(t("register.emailAlreadyRegistered"));
      } else {
        Alert.alert(t("common.error"), msg || t("register.errRegistrationFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  // Android's back button folds the form away before it leaves the screen.
  useEffect(() => {
    if (mode !== "email" || !google) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setMode("choose");
      return true;
    });
    return () => sub.remove();
  }, [mode, google]);

  const choosing = mode === "choose";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <AuthStage
        title={choosing ? t("auth.headline") : t("register.subtitle")}
        lead={choosing ? t("auth.stageLead") : undefined}
        compact={!choosing}
        onBack={!choosing && google ? () => setMode("choose") : undefined}
      />

      <View style={styles.body}>
        {choosing ? (
          <>
            <GoogleSignInButton
              label={t("register.continueGoogle")}
              onIdToken={handleGoogleIdToken}
              disabled={loading}
              buttonStyle={styles.googleButton}
              textStyle={styles.googleButtonText}
            />
            <TouchableOpacity style={styles.button} onPress={() => setMode("email")} disabled={loading} accessibilityRole="button">
              <MaterialCommunityIcons name="email-outline" size={20} color={c.bg} />
              <Text style={styles.buttonText}>{t("auth.continueEmail")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.link} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => router.push("/login")}>
              <Text style={styles.linkText}>{t("register.alreadyHaveAccount")} <Text style={styles.linkBold}>{t("register.signIn")}</Text></Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.field, focus === "name" && styles.fieldFocused]}>
              <MaterialCommunityIcons name="account-outline" size={20} color={focus === "name" ? c.text : c.textSecondary} style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                placeholder={t("register.namePlaceholder")}
                placeholderTextColor={c.placeholder}
                autoComplete="name"
                autoFocus={google}
                accessibilityLabel={t("register.namePlaceholder")}
                returnKeyType="next"
                value={name}
                onChangeText={setName}
                onFocus={() => setFocus("name")}
                onBlur={() => setFocus(null)}
              />
            </View>

            <View>
              <View style={[styles.field, focus === "email" && styles.fieldFocused, emailError ? styles.fieldError : null]}>
                <MaterialCommunityIcons name="email-outline" size={20} color={focus === "email" ? c.text : c.textSecondary} style={styles.fieldIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder={t("register.emailPlaceholder")}
                  placeholderTextColor={c.placeholder}
                  autoComplete="email"
                  accessibilityLabel={t("register.emailPlaceholder")}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setEmailError(""); }}
                  onFocus={() => setFocus("email")}
                  onBlur={() => setFocus(null)}
                />
              </View>
              {emailError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{emailError}</Text>
                  <TouchableOpacity onPress={() => router.push("/login")}>
                    <Text style={styles.errorLink}>{t("register.signInLink")}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <View>
              <View style={[styles.field, focus === "password" && styles.fieldFocused]}>
                <MaterialCommunityIcons name="lock-outline" size={20} color={focus === "password" ? c.text : c.textSecondary} style={styles.fieldIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder={t("register.passwordPlaceholder")}
                  placeholderTextColor={c.placeholder}
                  autoComplete="new-password"
                  accessibilityLabel={t("register.passwordPlaceholder")}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleRegister}
                  onFocus={() => setFocus("password")}
                  onBlur={() => setFocus(null)}
                />
                <TouchableOpacity style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={t(showPassword ? "common.a11yHidePassword" : "common.a11yShowPassword")} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <MaterialCommunityIcons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={c.textSecondary} />
                </TouchableOpacity>
              </View>
              <PasswordStrengthMeter password={password} />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading} accessibilityRole="button">
              {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>{t("register.createAccount")}</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    // The stage runs edge to edge; everything under it pads 24 at the sides.
    scroll: { flexGrow: 1, paddingBottom: space.xl },
    body: { paddingHorizontal: space.xl, paddingTop: space.xxl, gap: space.m },
    // An icon that stays while somebody types, the placeholder until they do,
    // and the accessibility label throughout: the same field as sign in.
    field: {
      flexDirection: "row", alignItems: "center", minHeight: 56,
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: radius.l,
    },
    fieldFocused: { borderColor: c.text },
    fieldIcon: { marginLeft: space.l },
    // minWidth 0 lets the field give way to the eye button on a narrow phone.
    fieldInput: { ...typeScale.body, flex: 1, minWidth: 0, minHeight: 56, paddingHorizontal: space.m, color: c.text },
    eyeButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
    button: {
      backgroundColor: c.text, borderRadius: radius.l, minHeight: 56,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.m,
    },
    buttonText: { ...typeScale.heading, color: c.bg },
    googleButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.m,
      minHeight: 56, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.l,
    },
    googleButtonText: { ...typeScale.heading, color: c.text },
    fieldError: { borderColor: c.danger },
    errorBox: {
      backgroundColor: c.dangerLight, borderRadius: radius.m, padding: space.m, marginTop: space.s,
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    },
    errorText: { ...typeScale.caption, color: c.danger, flex: 1 },
    errorLink: { ...typeScale.label, color: c.text, marginLeft: space.s },
    link: { alignItems: "center", justifyContent: "center", minHeight: 44 },
    linkText: { ...typeScale.body, color: c.textSecondary },
    linkBold: { fontFamily: "Montserrat-SemiBold", color: c.text },
  });
}
