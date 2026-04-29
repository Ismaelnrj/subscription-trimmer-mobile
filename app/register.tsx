import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../lib/auth-store";
import apiClient from "../lib/api";

export default function RegisterScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    setEmailError("");
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/register", { name, email, password });
      const { token, user } = res.data;
      await SecureStore.setItemAsync("auth_token", token);
      setUser(user);
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg = err.response?.data?.error || "Something went wrong.";
      if (msg.toLowerCase().includes("already")) {
        setEmailError("This email is already registered. Try signing in instead.");
      } else {
        Alert.alert("Registration failed", msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SubTrimmer</Text>
        <Text style={styles.subtitle}>Create your account</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Name (optional)"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, emailError ? styles.inputError : null]}
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(t) => { setEmail(t); setEmailError(""); }}
        />
        {emailError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{emailError}</Text>
            <TouchableOpacity onPress={() => router.push("/login")}>
              <Text style={styles.errorLink}>Sign in →</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password (min 6 characters)"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.link} onPress={() => router.push("/login")}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
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
  inputError: { borderColor: "#EF4444" },
  errorBox: {
    backgroundColor: "#FEF2F2", borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: "#FECACA", flexDirection: "row",
    justifyContent: "space-between", alignItems: "center",
  },
  errorText: { fontSize: 13, color: "#B91C1C", flex: 1 },
  errorLink: { fontSize: 13, fontWeight: "700", color: "#4F46E5", marginLeft: 8 },
  link: { alignItems: "center", marginTop: 16 },
  linkText: { color: "#6B7280", fontSize: 14 },
  linkBold: { color: "#4F46E5", fontWeight: "700" },
});
