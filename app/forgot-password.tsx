import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import apiClient from "../lib/api";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) { Alert.alert("Error", "Please enter your email address."); return; }
    setLoading(true);
    try {
      await apiClient.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setStep(2);
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (code.length !== 6) { Alert.alert("Error", "Please enter the 6-digit code."); return; }
    if (newPassword.length < 6) { Alert.alert("Error", "Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", { email: email.trim().toLowerCase(), code, newPassword });
      Alert.alert("Done!", "Your password has been reset. You can now sign in.", [
        { text: "Sign In", onPress: () => router.replace("/login") },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => step === 2 ? setStep(1) : router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={24} color="#4F46E5" />
      </TouchableOpacity>

      <View style={styles.icon}>
        <MaterialCommunityIcons
          name={step === 1 ? "lock-question" : "lock-reset"}
          size={56} color="#4F46E5"
        />
      </View>

      {step === 1 ? (
        <>
          <Text style={styles.title}>Forgot your password?</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a 6-digit code to reset your password.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Your email address"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TouchableOpacity style={styles.button} onPress={handleSendCode} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{" "}
            <Text style={styles.emailHighlight}>{email}</Text>.
            Enter it below along with your new password.
          </Text>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="000000"
            placeholderTextColor="#D1D5DB"
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />

          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="New password (min 6 characters)"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
              <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset Password</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resend} onPress={handleSendCode} disabled={loading}>
            <Text style={styles.resendText}>Didn't receive it? Send again</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.backToLogin} onPress={() => router.replace("/login")}>
        <Text style={styles.backToLoginText}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", padding: 28, paddingTop: 60 },
  back: { marginBottom: 16 },
  icon: { alignItems: "center", marginBottom: 24 },
  title: { fontSize: 24, fontWeight: "800", color: "#1F2937", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  emailHighlight: { fontWeight: "700", color: "#4F46E5" },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: "#1F2937", marginBottom: 14,
  },
  codeInput: {
    backgroundColor: "#fff", borderWidth: 2, borderColor: "#4F46E5", borderRadius: 12,
    paddingVertical: 16, fontSize: 36, fontWeight: "800", letterSpacing: 12,
    color: "#1F2937", marginBottom: 14, textAlign: "center",
  },
  passwordWrapper: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, marginBottom: 14,
  },
  passwordInput: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: "#1F2937" },
  eyeButton: { paddingHorizontal: 14 },
  button: {
    backgroundColor: "#4F46E5", borderRadius: 10, paddingVertical: 14,
    alignItems: "center", marginBottom: 14,
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  resend: { alignItems: "center", marginBottom: 16 },
  resendText: { color: "#4F46E5", fontSize: 14, fontWeight: "500" },
  backToLogin: { alignItems: "center", marginTop: 8 },
  backToLoginText: { color: "#9CA3AF", fontSize: 13 },
});
