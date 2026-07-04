import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { PasswordStrengthMeter, isPasswordValid } from "../components/PasswordStrength";
import { useTheme, AppColors } from "../lib/theme";

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
      <TouchableOpacity style={styles.back} onPress={() => step === 2 ? setStep(1) : router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={c.primary} />
      </TouchableOpacity>

      <View style={styles.icon}>
        <MaterialCommunityIcons
          name={step === 1 ? "lock-question" : "lock-reset"}
          size={56} color={c.primary}
        />
      </View>

      {step === 1 ? (
        <>
          <Text style={styles.title}>{t("forgotPassword.step1Title")}</Text>
          <Text style={styles.subtitle}>{t("forgotPassword.step1Subtitle")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("forgotPassword.emailPlaceholder")}
            placeholderTextColor={c.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TouchableOpacity style={styles.button} onPress={handleSendCode} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("forgotPassword.sendCode")}</Text>}
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
              placeholder={t("forgotPassword.newPasswordPlaceholder")}
              placeholderTextColor={c.placeholder}
              secureTextEntry={!showPassword}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color={c.placeholder} />
            </TouchableOpacity>
          </View>
          <PasswordStrengthMeter password={newPassword} />

          <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("forgotPassword.resetPassword")}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resend} onPress={handleSendCode} disabled={loading}>
            <Text style={styles.resendText}>{t("forgotPassword.resendCode")}</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.backToLogin} onPress={() => router.replace("/login")}>
        <Text style={styles.backToLoginText}>{t("forgotPassword.backToSignIn")}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 28, paddingTop: 60 },
    back: { marginBottom: 16 },
    icon: { alignItems: "center", marginBottom: 24 },
    title: { fontSize: 24, fontWeight: "800", color: c.text, marginBottom: 10, textAlign: "center" },
    subtitle: { fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 28 },
    emailHighlight: { fontWeight: "700", color: c.primary },
    input: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: c.text, marginBottom: 14,
    },
    codeInput: {
      backgroundColor: c.inputBg, borderWidth: 2, borderColor: c.primary, borderRadius: 12,
      paddingVertical: 16, fontSize: 36, fontWeight: "800", letterSpacing: 12,
      color: c.text, marginBottom: 14, textAlign: "center",
    },
    passwordWrapper: {
      flexDirection: "row", alignItems: "center", backgroundColor: c.inputBg,
      borderWidth: 1, borderColor: c.border, borderRadius: 10, marginBottom: 14,
    },
    passwordInput: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: c.text },
    eyeButton: { paddingHorizontal: 14 },
    button: {
      backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14,
      alignItems: "center", marginBottom: 14,
    },
    buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    resend: { alignItems: "center", marginBottom: 16 },
    resendText: { color: c.primary, fontSize: 14, fontWeight: "500" },
    backToLogin: { alignItems: "center", marginTop: 8 },
    backToLoginText: { color: c.textMuted, fontSize: 13 },
  });
}
