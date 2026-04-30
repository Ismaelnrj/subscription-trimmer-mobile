import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useAuthStore } from "../lib/auth-store";
import apiClient from "../lib/api";

export default function VerifyEmailScreen() {
  const { user, setUser } = useAuthStore();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/verify-email", { code });
      setUser(res.data.user);
      Alert.alert("Verified!", "Your email has been confirmed.", [
        { text: "Continue", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error || "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await apiClient.post("/auth/resend-verification");
      setResent(true);
      Alert.alert("Sent!", "A new verification code has been sent to your email.");
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unknown error";
      Alert.alert("Error", `Could not resend code: ${msg}`);
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Verify Email", headerShown: true }} />
      <View style={styles.container}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="email-check-outline" size={56} color="#4F46E5" />
        </View>
        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{"\n"}
          <Text style={styles.email}>{user?.email}</Text>
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

        <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading || code.length !== 6}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Verify Email</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={resending}>
          <Text style={styles.resendText}>
            {resending ? "Sending..." : resent ? "Code resent ✓" : "Didn't receive it? Resend code"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center", padding: 32 },
  icon: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "800", color: "#1F2937", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22, marginBottom: 32 },
  email: { fontWeight: "700", color: "#4F46E5" },
  codeInput: {
    width: 200, fontSize: 36, fontWeight: "800", letterSpacing: 12, color: "#1F2937",
    borderWidth: 2, borderColor: "#4F46E5", borderRadius: 12, paddingVertical: 16, marginBottom: 24,
  },
  button: {
    backgroundColor: "#4F46E5", borderRadius: 10, paddingVertical: 14,
    paddingHorizontal: 48, alignItems: "center", marginBottom: 16, width: "100%",
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  resendButton: { marginBottom: 16 },
  resendText: { color: "#4F46E5", fontSize: 14, fontWeight: "500" },
  skipButton: { marginTop: 8 },
  skipText: { color: "#9CA3AF", fontSize: 13 },
});
