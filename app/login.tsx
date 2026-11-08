import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
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
import { track } from "../lib/analytics";

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trimio</Text>
        <Text style={styles.subtitle}>{t("login.subtitle")}</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          autoComplete="email"
          placeholder={t("login.emailPlaceholder")}
          placeholderTextColor={c.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            autoComplete="current-password"
            placeholder={t("login.passwordPlaceholder")}
            placeholderTextColor={c.placeholder}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={t(showPassword ? "common.a11yHidePassword" : "common.a11yShowPassword")} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color={c.placeholder} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>{t("login.signIn")}</Text>}
        </TouchableOpacity>

        {isGoogleAuthConfigured() ? (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t("login.or")}</Text>
              <View style={styles.dividerLine} />
            </View>
            <GoogleSignInButton
              label={t("login.continueGoogle")}
              onIdToken={handleGoogleIdToken}
              disabled={loading}
              buttonStyle={styles.googleButton}
              textStyle={styles.googleButtonText}
              iconColor={c.text}
            />
          </>
        ) : null}

        <TouchableOpacity style={styles.forgotLink} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => router.push("/forgot-password")}>
          <Text style={styles.forgotText}>{t("login.forgotPassword")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => router.push("/register")}>
          <Text style={styles.linkText}>{t("login.noAccount")} <Text style={styles.linkBold}>{t("login.signUp")}</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, justifyContent: "center", paddingHorizontal: space.xl },
    header: { alignItems: "center", marginBottom: space.xxl },
    title: { ...typeScale.display, color: c.text, textAlign: "center" },
    subtitle: { ...typeScale.body, color: c.textSecondary, textAlign: "center", marginTop: space.s },
    form: { gap: space.m },
    input: {
      ...typeScale.body, backgroundColor: c.inputBg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      borderRadius: radius.m, minHeight: 52, paddingHorizontal: space.l, color: c.text,
    },
    passwordWrapper: {
      flexDirection: "row", alignItems: "center", minHeight: 52,
      backgroundColor: c.inputBg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: radius.m,
    },
    passwordInput: { ...typeScale.body, flex: 1, minHeight: 52, paddingHorizontal: space.l, color: c.text },
    eyeButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
    button: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 52,
      alignItems: "center", justifyContent: "center", marginTop: space.s,
    },
    buttonText: { ...typeScale.bodyStrong, color: c.bg },
    divider: { flexDirection: "row", alignItems: "center", marginTop: space.s },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    dividerText: { ...typeScale.caption, color: c.textSecondary, marginHorizontal: space.m },
    googleButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s,
      minHeight: 52, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: radius.m,
    },
    googleButtonText: { ...typeScale.bodyStrong, color: c.text },
    forgotLink: { alignItems: "center", justifyContent: "center", minHeight: 48 },
    forgotText: { ...typeScale.label, color: c.text },
    link: { alignItems: "center", justifyContent: "center", minHeight: 48 },
    linkText: { ...typeScale.body, color: c.textSecondary },
    linkBold: { fontFamily: "Montserrat-SemiBold", color: c.text },
  });
}
