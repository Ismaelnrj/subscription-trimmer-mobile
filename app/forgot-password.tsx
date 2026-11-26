import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { PasswordStrengthMeter, isPasswordValid, isPasswordTooLong } from "../components/PasswordStrength";
import { AuthHeader, AuthFooter } from "../components/AuthHeader";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState<"email" | "password" | null>(null);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const handleSendCode = async () => {
    if (!email.trim()) { Alert.alert(t("common.error"), t("forgotPassword.errEmail")); return; }
    setLoading(true);
    try {
      await apiClient.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setStep(2);
    } catch {
      Alert.alert(t("common.error"), t("forgotPassword.errGeneric"));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (code.length !== 6) { Alert.alert(t("common.error"), t("forgotPassword.errCode")); return; }
    if (!isPasswordValid(newPassword)) {
      Alert.alert(t("common.error"), t("forgotPassword.errWeakPassword"));
      return;
    }
    if (isPasswordTooLong(newPassword)) {
      Alert.alert(t("common.error"), t("common.errPasswordTooLong"));
      return;
    }
    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", { email: email.trim().toLowerCase(), code, newPassword });
      Alert.alert(t("forgotPassword.doneTitle"), t("forgotPassword.doneMsg"), [
        { text: t("forgotPassword.signInBtn"), onPress: () => router.replace("/login") },
      ]);
    } catch (err: any) {
      Alert.alert(t("common.error"), err.response?.data?.error || t("forgotPassword.errInvalidCode"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.back} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel={t("common.a11yBack")} onPress={() => step === 2 ? setStep(1) : router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={c.text} />
      </TouchableOpacity>

      {step === 1 ? (
        <>
          <AuthHeader title={t("forgotPassword.step1Title")} subtitle={t("forgotPassword.step1Subtitle")} />
          <View style={styles.form}>
            <View>
              <Text style={styles.label}>{t("forgotPassword.emailPlaceholder")}</Text>
              <TextInput
                style={[styles.input, focus === "email" && styles.inputFocused]}
                autoComplete="email"
                accessibilityLabel={t("forgotPassword.emailPlaceholder")}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="send"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={handleSendCode}
                onFocus={() => setFocus("email")}
                onBlur={() => setFocus(null)}
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleSendCode} disabled={loading} accessibilityRole="button">
              {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>{t("forgotPassword.sendCode")}</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <AuthHeader
            title={t("forgotPassword.step2Title")}
            subtitle={<>{t("forgotPassword.step2SubtitlePre")}<Text style={styles.emailHighlight}>{email}</Text>{t("forgotPassword.step2SubtitlePost")}</>}
          />
          <View style={styles.form}>
            <View>
              <Text style={styles.label}>{t("forgotPassword.codeLabel")}</Text>
              <TextInput
                style={styles.codeInput}
                autoComplete="one-time-code"
                accessibilityLabel={t("forgotPassword.codeLabel")}
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder={t("forgotPassword.codePlaceholder")}
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
            </View>

            <View>
              <Text style={styles.label}>{t("forgotPassword.newPasswordPlaceholder")}</Text>
              <View style={[styles.passwordWrapper, focus === "password" && styles.inputFocused]}>
                <TextInput
                  style={styles.passwordInput}
                  autoComplete="new-password"
                  accessibilityLabel={t("forgotPassword.newPasswordPlaceholder")}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  onSubmitEditing={handleReset}
                  onFocus={() => setFocus("password")}
                  onBlur={() => setFocus(null)}
                />
                <TouchableOpacity style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={t(showPassword ? "common.a11yHidePassword" : "common.a11yShowPassword")} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color={c.textSecondary} />
                </TouchableOpacity>
              </View>
              <PasswordStrengthMeter password={newPassword} />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading} accessibilityRole="button">
              {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>{t("forgotPassword.resetPassword")}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resend} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={handleSendCode} disabled={loading}>
              <Text style={styles.resendText}>{t("forgotPassword.resendCode")}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <AuthFooter>
        <TouchableOpacity style={styles.backToLogin} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => router.replace("/login")}>
          <Text style={styles.backToLoginText}>{t("forgotPassword.backToSignIn")}</Text>
        </TouchableOpacity>
      </AuthFooter>
    </ScrollView>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    scroll: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.l, paddingBottom: space.l },
    back: { marginBottom: space.l, minHeight: 48, minWidth: 48, justifyContent: "center", alignSelf: "flex-start" },
    form: { gap: space.l },
    label: { ...typeScale.label, color: c.textSecondary, marginBottom: space.s },
    emailHighlight: { fontFamily: "Montserrat-SemiBold", color: c.text },
    input: {
      ...typeScale.body, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border,
      borderRadius: radius.l, minHeight: 56, paddingHorizontal: space.l, color: c.text,
    },
    inputFocused: { borderColor: c.text },
    codeInput: {
      /* The one place outside the scale: six digits read at arm's length. */
      backgroundColor: c.inputBg, borderWidth: 1.5, borderColor: c.text, borderRadius: radius.l,
      minHeight: 64, fontFamily: "Montserrat-SemiBold", fontSize: 32, letterSpacing: 10,
      color: c.text, textAlign: "center",
    },
    passwordWrapper: {
      flexDirection: "row", alignItems: "center", minHeight: 56,
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: radius.l,
    },
    passwordInput: { ...typeScale.body, flex: 1, minHeight: 56, paddingHorizontal: space.l, color: c.text },
    eyeButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
    button: {
      backgroundColor: c.text, borderRadius: radius.l, minHeight: 56,
      alignItems: "center", justifyContent: "center",
    },
    buttonText: { ...typeScale.bodyStrong, color: c.bg },
    resend: { alignItems: "center", justifyContent: "center", minHeight: 48 },
    resendText: { ...typeScale.label, color: c.text },
    backToLogin: { alignItems: "center", justifyContent: "center", minHeight: 48 },
    backToLoginText: { ...typeScale.label, color: c.textSecondary },
  });
}
