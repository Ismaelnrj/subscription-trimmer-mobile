import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../lib/auth-store";
import apiClient from "../lib/api";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";

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
      // The server's text arrives in the reader's language. An axios message
      // ("Network Error") or an English placeholder does not, so with no
      // server text the localised sentence stands alone.
      const msg = err.response?.data?.error;
      Alert.alert(t("common.error"), msg ? `${t("verifyEmail.errResend")}: ${msg}` : t("verifyEmail.errResend"));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("screenTitles.verifyEmail"), headerShown: true }} />
      <View style={styles.container}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="email-check-outline" size={48} color={c.textSecondary} />
        </View>
        <Text style={styles.title}>{t("verifyEmail.checkInbox")}</Text>
        <Text style={styles.subtitle}>
          {t("verifyEmail.sentCodeTo")}{"\n"}
          <Text style={styles.email}>{user?.email}</Text>
        </Text>

        <TextInput
          style={styles.codeInput}
          autoComplete="one-time-code"
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
            ? <ActivityIndicator color={c.bg} />
            : <Text style={styles.buttonText}>{t("verifyEmail.verifyBtn")}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={handleResend} disabled={resending}>
          <Text style={styles.resendText}>
            {resending ? t("verifyEmail.sending") : resent ? `${t("verifyEmail.codeSent")} ✓` : t("verifyEmail.resendCode")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.skipText}>{t("verifyEmail.skipForNow")}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
    icon: { marginBottom: space.xl },
    title: { ...typeScale.title, color: c.text, marginBottom: space.s, textAlign: "center" },
    subtitle: { ...typeScale.body, color: c.textSecondary, textAlign: "center", marginBottom: space.xl },
    email: { fontFamily: "Montserrat-SemiBold", color: c.text },
    codeInput: {
      /* The one place outside the scale: six digits read at arm's length. */
      backgroundColor: c.inputBg, borderWidth: 1.5, borderColor: c.text, borderRadius: radius.m,
      minHeight: 64, fontFamily: "Montserrat-SemiBold", fontSize: 32, letterSpacing: 10,
      color: c.text, textAlign: "center", width: 220, marginBottom: space.xl,
    },
    button: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 52,
      alignItems: "center", justifyContent: "center", width: "100%", marginBottom: space.m,
    },
    buttonText: { ...typeScale.bodyStrong, color: c.bg },
    resendButton: { alignItems: "center", justifyContent: "center", minHeight: 48, marginBottom: space.s },
    resendText: { ...typeScale.label, color: c.text },
    skipButton: { alignItems: "center", justifyContent: "center", minHeight: 48 },
    skipText: { ...typeScale.label, color: c.textSecondary },
  });
}
