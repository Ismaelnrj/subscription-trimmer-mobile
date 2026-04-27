import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../lib/auth-store";
import apiClient from "../lib/api";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 12, fontWeight: "600", color: "#6B7280", textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, paddingVertical: 12,
    paddingHorizontal: 12, fontSize: 14, color: "#1F2937", marginBottom: 12, backgroundColor: "#FAFAFA",
  },
  saveButton: { backgroundColor: "#4F46E5", borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  saveButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  infoText: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
});

export default function AccountSettingsScreen() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const profileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.patch("/auth/profile", data);
      return response.data;
    },
    onSuccess: (data) => {
      setUser(data);
      Alert.alert("Success", "Profile updated successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.response?.data?.error || "Failed to update profile.");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.patch("/auth/profile", data);
      return response.data;
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Success", "Password changed successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.response?.data?.error || "Failed to change password.");
    },
  });

  const handleSaveName = () => {
    profileMutation.mutate({ name: name.trim() });
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters.");
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <>
      <Stack.Screen options={{ title: "Account Settings" }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, { color: "#9CA3AF" }]}
              value={user?.email || ""}
              editable={false}
            />
            <Text style={styles.infoText}>Email cannot be changed.</Text>
            <TouchableOpacity style={[styles.saveButton, { marginTop: 12 }]} onPress={handleSaveName} disabled={profileMutation.isPending}>
              {profileMutation.isPending
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.saveButtonText}>Save Name</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Change Password</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
            />
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password (min 6 chars)"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
            />
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={passwordMutation.isPending}>
              {passwordMutation.isPending
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.saveButtonText}>Change Password</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
