import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { PasswordStrengthMeter, isPasswordValid, isPasswordTooLong } from "../components/PasswordStrength";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel={t("common.a11yBack")} onPress={() => step === 2 ? setStep(1) : router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={c.text} />
      </TouchableOpacity>

      <View style={styles.icon}>
        <MaterialCommunityIcons
          name={step === 1 ? "lock-question" : "lock-reset"}
          size={48} color={c.textSecondary}
        />
      </View>

      {step === 1 ? (
        <>
          <Text style={styles.title}>{t("forgotPassword.step1Title")}</Text>
          <Text style={styles.subtitle}>{t("forgotPassword.step1Subtitle")}</Text>
          <TextInput
            style={styles.input}
            autoComplete="email"
            placeholder={t("forgotPassword.emailPlaceholder")}
            placeholderTextColor={c.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TouchableOpacity style={styles.button} onPress={handleSendCode} disabled={loading}>
            {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>{t("forgotPassword.sendCode")}</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.title}>{t("forgotPassword.step2Title")}</Text>
          <Text style={styles.subtitle}>
            {t("forgotPassword.step2SubtitlePre")}
            <Text style={styles.emailHighlight}>{email}</Text>
            {t("forgotPassword.step2SubtitlePost")}
          </Text>

          <TextInput
            style={styles.codeInput}
            autoComplete="one-time-code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder={t("forgotPassword.codePlaceholder")}
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />

          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              autoComplete="new-password"
              placeholder={t("forgotPassword.newPasswordPlaceholder")}
              placeholderTextColor={c.placeholder}
              secureTextEntry={!showPassword}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={t(showPassword ? "common.a11yHidePassword" : "common.a11yShowPassword")} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color={c.placeholder} />
            </TouchableOpacity>
          </View>
          <PasswordStrengthMeter password={newPassword} />

          <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
            {loading ? <ActivityIndicator color={c.bg} /> : <Text style={styles.buttonText}>{t("forgotPassword.resetPassword")}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resend} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={handleSendCode} disabled={loading}>
            <Text style={styles.resendText}>{t("forgotPassword.resendCode")}</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.backToLogin} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => router.replace("/login")}>
        <Text style={styles.backToLoginText}>{t("forgotPassword.backToSignIn")}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: space.xl, paddingTop: 60 },
    back: { marginBottom: space.l, minHeight: 48, justifyContent: "center", alignSelf: "flex-start" },
    icon: { alignItems: "center", marginBottom: space.xl },
    title: { ...typeScale.title, color: c.text, marginBottom: space.s, textAlign: "center" },
    subtitle: { ...typeScale.body, color: c.textSecondary, textAlign: "center", marginBottom: space.xl },
    emailHighlight: { fontFamily: "Montserrat-SemiBold", color: c.text },
    input: {
      ...typeScale.body, backgroundColor: c.inputBg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      borderRadius: radius.m, minHeight: 52, paddingHorizontal: space.l, color: c.text, marginBottom: space.m,
    },
    codeInput: {
      /* The one place outside the scale: six digits read at arm's length. */
      backgroundColor: c.inputBg, borderWidth: 1.5, borderColor: c.text, borderRadius: radius.m,
      minHeight: 64, fontFamily: "Montserrat-SemiBold", fontSize: 32, letterSpacing: 10,
      color: c.text, textAlign: "center", marginBottom: space.m,
    },
    passwordWrapper: {
      flexDirection: "row", alignItems: "center", minHeight: 52,
      backgroundColor: c.inputBg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: radius.m, marginBottom: space.m,
    },
    passwordInput: { ...typeScale.body, flex: 1, minHeight: 52, paddingHorizontal: space.l, color: c.text },
    eyeButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
    button: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 52,
      alignItems: "center", justifyContent: "center", marginBottom: space.m,
    },
    buttonText: { ...typeScale.bodyStrong, color: c.bg },
    resend: { alignItems: "center", justifyContent: "center", minHeight: 48, marginBottom: space.s },
    resendText: { ...typeScale.label, color: c.text },
    backToLogin: { alignItems: "center", justifyContent: "center", minHeight: 48 },
    backToLoginText: { ...typeScale.label, color: c.textSecondary },
  });
}
