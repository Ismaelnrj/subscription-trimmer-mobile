import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../lib/auth-store";
import apiClient from "../lib/api";
import { useTheme, AppColors } from "../lib/theme";

export default function VerifyEmailScreen() {
  const { user, setUser } = useAuthStore();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert(t("common.error"), t("verifyEmail.errEnterCode"));
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/verify-email", { code });
      setUser(res.data.user);
      Alert.alert(t("verifyEmail.verifiedTitle"), t("verifyEmail.verifiedMsg"), [
        { text: t("verifyEmail.continueBtn"), onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (err: any) {
      Alert.alert(t("common.error"), err.response?.data?.error || t("verifyEmail.errInvalidCode"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await apiClient.post("/auth/resend-verification");
      if (res.data?.alreadyVerified) {
        Alert.alert(t("verifyEmail.alreadyVerifiedTitle"), t("verifyEmail.alreadyVerifiedMsg"), [
          { text: t("verifyEmail.continueBtn"), onPress: () => router.replace("/(tabs)") },
        ]);
        return;
      }
      setResent(true);
      Alert.alert(t("verifyEmail.codeSentTitle"), t("verifyEmail.codeSentMsg"));
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      Alert.alert(t("common.error"), `${t("verifyEmail.errResend")}: ${msg}`);
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Verify Email", headerShown: true }} />
      <View style={styles.container}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="email-check-outline" size={56} color={c.primary} />
        </View>
        <Text style={styles.title}>{t("verifyEmail.checkInbox")}</Text>
        <Text style={styles.subtitle}>
          {t("verifyEmail.sentCodeTo")}{"\n"}
          <Text style={styles.email}>{user?.email}</Text>
        </Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder={t("verifyEmail.codePlaceholder")}
          placeholderTextColor={c.textMuted}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
        />

        <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading || code.length !== 6}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{t("verifyEmail.verifyBtn")}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={resending}>
          <Text style={styles.resendText}>
            {resending ? t("verifyEmail.sending") : resent ? `${t("verifyEmail.codeSent")} ✓` : t("verifyEmail.resendCode")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.skipText}>{t("verifyEmail.skipForNow")}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", padding: 32 },
    icon: { marginBottom: 20 },
    title: { fontSize: 24, fontWeight: "800", color: c.text, marginBottom: 10, textAlign: "center" },
    subtitle: { fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 32 },
    email: { fontWeight: "700", color: c.primary },
    codeInput: {
      width: 200, fontSize: 36, fontWeight: "800", letterSpacing: 12, color: c.text,
      borderWidth: 2, borderColor: c.primary, borderRadius: 12, paddingVertical: 16, marginBottom: 24,
      backgroundColor: c.inputBg,
    },
    button: {
      backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14,
      paddingHorizontal: 48, alignItems: "center", marginBottom: 16, width: "100%",
    },
    buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    resendButton: { marginBottom: 16 },
    resendText: { color: c.primary, fontSize: 14, fontWeight: "500" },
    skipButton: { marginTop: 8 },
    skipText: { color: c.textMuted, fontSize: 13 },
  });
}
