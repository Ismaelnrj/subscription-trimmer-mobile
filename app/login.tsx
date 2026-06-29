import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons, AntDesign } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../lib/auth-store";
import apiClient from "../lib/api";
import { useTheme, AppColors } from "../lib/theme";
import { useGoogleAuth, isGoogleAuthConfigured } from "../lib/google-auth";

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const c = useTheme();
  const styles = makeStyles(c);
  const [googleRequest, googleResponse, promptGoogleAuth] = useGoogleAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/login", { email: email.trim().toLowerCase(), password });
      const { token, refreshToken, user } = res.data;
      await SecureStore.setItemAsync("auth_token", token);
      await SecureStore.setItemAsync("refresh_token", refreshToken);
      setUser(user);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Login failed", err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (googleResponse?.type === "success") {
      const idToken = googleResponse.params.id_token;
      (async () => {
        setLoading(true);
        try {
          const res = await apiClient.post("/auth/google", { idToken });
          const { token, refreshToken, user } = res.data;
          await SecureStore.setItemAsync("auth_token", token);
          await SecureStore.setItemAsync("refresh_token", refreshToken);
          setUser(user);
          router.replace("/(tabs)");
        } catch (err: any) {
          Alert.alert("Google sign-in failed", err.response?.data?.error || "Something went wrong.");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [googleResponse]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trimio</Text>
        <Text style={styles.subtitle}>Sign in to manage your subscriptions</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={c.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor={c.placeholder}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={20} color={c.placeholder} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>

        {isGoogleAuthConfigured() ? (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => promptGoogleAuth()}
              disabled={!googleRequest || loading}
            >
              <AntDesign name="google" size={18} color={c.text} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </>
        ) : null}

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

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, justifyContent: "center", padding: 24 },
    header: { alignItems: "center", marginBottom: 40 },
    title: { fontSize: 32, fontWeight: "800", color: c.primary, marginBottom: 8 },
    subtitle: { fontSize: 14, color: c.textSecondary, textAlign: "center" },
    form: { gap: 12 },
    input: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: c.text,
    },
    passwordWrapper: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 10,
    },
    passwordInput: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: c.text },
    eyeButton: { paddingHorizontal: 14 },
    button: {
      backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8,
    },
    buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    divider: { flexDirection: "row", alignItems: "center", marginTop: 8 },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerText: { color: c.textSecondary, fontSize: 12, marginHorizontal: 10 },
    googleButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingVertical: 14,
    },
    googleButtonText: { color: c.text, fontSize: 15, fontWeight: "600" },
    forgotLink: { alignItems: "center", marginTop: 4, marginBottom: 8 },
    forgotText: { color: c.primary, fontSize: 13, fontWeight: "500" },
    link: { alignItems: "center", marginTop: 8 },
    linkText: { color: c.textSecondary, fontSize: 14 },
    linkBold: { color: c.primary, fontWeight: "700" },
  });
}
