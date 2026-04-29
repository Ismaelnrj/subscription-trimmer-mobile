import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../lib/auth-store";
import apiClient from "../lib/api";

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/login", { email, password });
      const { token, user } = res.data;
      await SecureStore.setItemAsync("auth_token", token);
      setUser(user);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Login failed", err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SubTrimmer</Text>
        <Text style={styles.subtitle}>Sign in to manage your subscriptions</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.forgotLink} onPress={() => router.push("/forgot-password")}>
          <Text style={styles.forgotText}>Forgot your password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} onPress={() => router.push("/register")}>
          <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 40 },
  title: { fontSize: 32, fontWeight: "800", color: "#4F46E5", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  form: { gap: 12 },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: "#1F2937",
  },
  passwordWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
  },
  passwordInput: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: "#1F2937" },
  eyeButton: { paddingHorizontal: 14 },
  button: {
    backgroundColor: "#4F46E5", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  forgotLink: { alignItems: "center", marginTop: 4, marginBottom: 8 },
  forgotText: { color: "#4F46E5", fontSize: 13, fontWeight: "500" },
  link: { alignItems: "center", marginTop: 8 },
  linkText: { color: "#6B7280", fontSize: 14 },
  linkBold: { color: "#4F46E5", fontWeight: "700" },
});
