import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Modal, FlatList,
} from "react-native";
import { Stack } from "expo-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "../lib/auth-store";
import { useCurrencyStore, CURRENCIES, fmt } from "../lib/currency-store";
import { PremiumGate } from "../components/PremiumGate";
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
  currencyRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  currencyName: { fontSize: 14, color: "#1F2937" },
  currencyCode: { fontSize: 12, color: "#6B7280" },
  selectedMark: { marginLeft: 8 },
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, maxHeight: "70%",
  },
  pickerTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937", marginBottom: 16 },
  currencyButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 14, marginBottom: 4,
  },
  currencyButtonLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  currencySymbol: { fontSize: 18, fontWeight: "700", color: "#4F46E5", width: 28 },
  budgetRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  budgetInput: { flex: 1 },
  clearButton: {
    backgroundColor: "#FEE2E2", borderRadius: 8, paddingVertical: 13, paddingHorizontal: 16,
    alignItems: "center", marginTop: 4,
  },
  clearButtonText: { color: "#DC2626", fontSize: 14, fontWeight: "600" },
  deleteSection: { marginTop: 24, marginBottom: 8 },
  deleteSectionTitle: {
    fontSize: 12, fontWeight: "600", color: "#DC2626", textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 8,
  },
  deleteCard: {
    backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1,
    borderColor: "#FECACA", padding: 16,
  },
  deleteDesc: { fontSize: 13, color: "#6B7280", lineHeight: 20, marginBottom: 14 },
  deleteButton: {
    backgroundColor: "#FEE2E2", borderRadius: 8, paddingVertical: 13,
    alignItems: "center", borderWidth: 1, borderColor: "#FECACA",
  },
  deleteButtonText: { color: "#DC2626", fontSize: 14, fontWeight: "700" },
});

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const { currency, setCurrency } = useCurrencyStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
    onSuccess: (data: any) => {
      if (data.budgetGoal != null) setBudgetInput(String(data.budgetGoal));
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: any) => (await apiClient.patch("/auth/profile", data)).data,
    onSuccess: (data) => { setUser(data); Alert.alert("Saved", "Display name updated."); },
    onError: (err: any) => Alert.alert("Error", err.response?.data?.error || "Failed to update."),
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: any) => (await apiClient.patch("/auth/profile", data)).data,
    onSuccess: () => {
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      Alert.alert("Done", "Password changed successfully.");
    },
    onError: (err: any) => Alert.alert("Error", err.response?.data?.error || "Failed to change password."),
  });

  const settingsMutation = useMutation({
    mutationFn: async (data: any) => (await apiClient.post("/trpc/settings.update", data)).data.result.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      Alert.alert("Saved", "Settings updated.");
    },
    onError: () => Alert.alert("Error", "Failed to save settings."),
  });

  const handleSaveName = () => profileMutation.mutate({ name: name.trim() });

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your subscription data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.delete("/auth/account");
              await logout();
              router.replace("/login");
            } catch {
              Alert.alert("Error", "Could not delete account. Please try again or contact support.");
            }
          },
        },
      ]
    );
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) { Alert.alert("Error", "New passwords do not match."); return; }
    if (newPassword.length < 6) { Alert.alert("Error", "New password must be at least 6 characters."); return; }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const handleSaveBudget = () => {
    const goal = budgetInput ? parseFloat(budgetInput) : null;
    if (budgetInput && isNaN(goal!)) { Alert.alert("Error", "Please enter a valid number."); return; }
    settingsMutation.mutate({ budgetGoal: goal, currency: currency.code, currencySymbol: currency.symbol });
  };

  const handleSelectCurrency = (c: typeof CURRENCIES[0]) => {
    setCurrency(c);
    setShowCurrencyPicker(false);
    settingsMutation.mutate({ budgetGoal: settings?.budgetGoal ?? null, currency: c.code, currencySymbol: c.symbol });
  };

  return (
    <>
      <Stack.Screen options={{ title: "Account Settings" }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>

          {/* Currency */}
          <Text style={styles.sectionTitle}>Currency</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Display Currency</Text>
            <TouchableOpacity style={styles.currencyButton} onPress={() => setShowCurrencyPicker(true)}>
              <View style={styles.currencyButtonLeft}>
                <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                <View>
                  <Text style={styles.currencyName}>{currency.name}</Text>
                  <Text style={styles.currencyCode}>{currency.code}</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            <Text style={styles.infoText}>Changes how prices are displayed throughout the app.</Text>
          </View>

          {/* Budget Goal — premium */}
          <Text style={styles.sectionTitle}>Budget Goal</Text>
          {!isPremium ? (
            <PremiumGate
              title="Monthly Budget Goal"
              description="Set a spending limit and track progress directly on your dashboard."
            />
          ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Monthly Spending Limit ({currency.symbol})</Text>
            <TextInput
              style={styles.input}
              value={budgetInput}
              onChangeText={setBudgetInput}
              placeholder={`e.g. 50.00`}
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
            <Text style={styles.infoText}>
              A warning appears on your dashboard when you reach 80% of this limit.
              {settings?.budgetGoal != null ? `\nCurrent goal: ${fmt(settings.budgetGoal, currency.symbol)}/mo` : ""}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[styles.saveButton, { flex: 1 }]} onPress={handleSaveBudget} disabled={settingsMutation.isLoading}>
                {settingsMutation.isLoading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.saveButtonText}>Save Goal</Text>
                }
              </TouchableOpacity>
              {settings?.budgetGoal != null && (
                <TouchableOpacity style={styles.clearButton} onPress={() => { setBudgetInput(""); settingsMutation.mutate({ budgetGoal: null, currency: currency.code, currencySymbol: currency.symbol }); }}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          )}

          {/* Profile */}
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
            <TouchableOpacity style={[styles.saveButton, { marginTop: 12 }]} onPress={handleSaveName} disabled={profileMutation.isLoading}>
              {profileMutation.isLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.saveButtonText}>Save Name</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Password */}
          <Text style={styles.sectionTitle}>Change Password</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword}
              placeholder="Enter current password" placeholderTextColor="#9CA3AF" secureTextEntry />
            <Text style={styles.label}>New Password</Text>
            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword}
              placeholder="Enter new password (min 6 chars)" placeholderTextColor="#9CA3AF" secureTextEntry />
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Confirm new password" placeholderTextColor="#9CA3AF" secureTextEntry />
            <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={passwordMutation.isLoading}>
              {passwordMutation.isLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.saveButtonText}>Change Password</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Delete Account */}
          <View style={styles.deleteSection}>
            <Text style={styles.deleteSectionTitle}>Danger Zone</Text>
            <View style={styles.deleteCard}>
              <Text style={styles.deleteDesc}>
                Permanently delete your account and all associated subscription data. This action cannot be undone.
              </Text>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                <Text style={styles.deleteButtonText}>Delete My Account</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Currency picker */}
      <Modal visible={showCurrencyPicker} transparent animationType="slide" onRequestClose={() => setShowCurrencyPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Select Currency</Text>
            <FlatList
              data={CURRENCIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.currencyRow} onPress={() => handleSelectCurrency(item)}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={styles.currencySymbol}>{item.symbol}</Text>
                    <View>
                      <Text style={styles.currencyName}>{item.name}</Text>
                      <Text style={styles.currencyCode}>{item.code}</Text>
                    </View>
                  </View>
                  {currency.code === item.code && (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#4F46E5" style={styles.selectedMark} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
