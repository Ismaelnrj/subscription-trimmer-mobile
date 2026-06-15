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
import { useCurrencyStore, CURRENCIES, useFmt } from "../lib/currency-store";
import { PremiumGate } from "../components/PremiumGate";
import { isPasswordValid } from "../components/PasswordStrength";
import apiClient from "../lib/api";
import { useTheme, AppColors } from "../lib/theme";

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const { currency, setCurrency } = useCurrencyStore();
  const fmtC = useFmt();
  const queryClient = useQueryClient();
  const c = useTheme();
  const styles = makeStyles(c);

  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [alertThresholdInput, setAlertThresholdInput] = useState("");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
    onSuccess: (data: any) => {
      if (data.budgetGoal != null) setBudgetInput(String(data.budgetGoal));
      if (data.alertThreshold != null) setAlertThresholdInput(String(data.alertThreshold));
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
    if (!isPasswordValid(newPassword)) {
      Alert.alert("Weak password", "New password must be at least 8 characters with one uppercase letter and one number.");
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const handleSaveBudget = () => {
    const goal = budgetInput ? parseFloat(budgetInput) : null;
    if (budgetInput && isNaN(goal!)) { Alert.alert("Error", "Please enter a valid number."); return; }
    settingsMutation.mutate({ budgetGoal: goal, currency: currency.code, currencySymbol: currency.symbol });
  };

  const handleSaveAlertThreshold = () => {
    const threshold = alertThresholdInput ? parseFloat(alertThresholdInput) : 50;
    if (isNaN(threshold)) { Alert.alert("Error", "Please enter a valid number."); return; }
    settingsMutation.mutate({ alertThreshold: threshold, budgetGoal: settings?.budgetGoal ?? null, currency: currency.code, currencySymbol: currency.symbol });
  };

  const handleSelectCurrency = (cur: typeof CURRENCIES[0]) => {
    setCurrency(cur);
    setShowCurrencyPicker(false);
    settingsMutation.mutate({ budgetGoal: settings?.budgetGoal ?? null, currency: cur.code, currencySymbol: cur.symbol });
  };

  return (
    <>
      <Stack.Screen options={{ title: "Account Settings" }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>

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
              <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
            </TouchableOpacity>
            <Text style={styles.infoText}>Changes how prices are displayed throughout the app.</Text>
          </View>

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
                placeholder="e.g. 50.00"
                placeholderTextColor={c.placeholder}
                keyboardType="decimal-pad"
              />
              <Text style={styles.infoText}>
                A warning appears on your dashboard when you reach 80% of this limit.
                {settings?.budgetGoal != null ? `\nCurrent goal: ${fmtC(settings.budgetGoal)}/mo` : ""}
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

          <Text style={styles.sectionTitle}>Spending Alert Threshold</Text>
          {!isPremium ? (
            <PremiumGate
              title="Custom Alert Threshold"
              description="Choose your own limit for the 'expensive subscription' alert instead of the default."
            />
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>Alert me when a subscription exceeds</Text>
              <View style={styles.prefixInputRow}>
                <Text style={styles.prefixSymbol}>{currency.symbol}</Text>
                <TextInput
                  style={[styles.input, styles.prefixInput]}
                  value={alertThresholdInput}
                  onChangeText={setAlertThresholdInput}
                  placeholder="e.g. 50"
                  placeholderTextColor={c.placeholder}
                  keyboardType="decimal-pad"
                />
              </View>
              <Text style={styles.infoText}>
                Subscriptions costing more than this per month will be flagged in Recommendations. Default: {currency.symbol}50/mo.
              </Text>
              <TouchableOpacity style={[styles.saveButton, { marginTop: 12 }]} onPress={handleSaveAlertThreshold} disabled={settingsMutation.isLoading}>
                {settingsMutation.isLoading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.saveButtonText}>Save Threshold</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={c.placeholder}
            />
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, { color: c.textMuted }]}
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

          <Text style={styles.sectionTitle}>Change Password</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword}
              placeholder="Enter current password" placeholderTextColor={c.placeholder} secureTextEntry />
            <Text style={styles.label}>New Password</Text>
            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword}
              placeholder="Min 8 chars, 1 uppercase, 1 number" placeholderTextColor={c.placeholder} secureTextEntry />
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Confirm new password" placeholderTextColor={c.placeholder} secureTextEntry />
            <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={passwordMutation.isLoading}>
              {passwordMutation.isLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.saveButtonText}>Change Password</Text>
              }
            </TouchableOpacity>
          </View>

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
                    <MaterialCommunityIcons name="check-circle" size={20} color={c.primary} />
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

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: 32 },
    sectionTitle: {
      fontSize: 12, fontWeight: "600", color: c.textSecondary, textTransform: "uppercase",
      letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
    },
    card: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 8 },
    label: { fontSize: 12, fontWeight: "600", color: c.text, marginBottom: 6 },
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 12,
      paddingHorizontal: 12, fontSize: 14, color: c.text, marginBottom: 12, backgroundColor: c.inputBg,
    },
    saveButton: { backgroundColor: c.primary, borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 4 },
    saveButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
    infoText: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    currencyRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    currencyName: { fontSize: 14, color: c.text },
    currencyCode: { fontSize: 12, color: c.textSecondary },
    pickerOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
    pickerSheet: {
      backgroundColor: c.card, borderTopLeftRadius: 16, borderTopRightRadius: 16,
      padding: 20, maxHeight: "70%",
    },
    pickerTitle: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 16 },
    currencyButton: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 14, marginBottom: 4,
    },
    currencyButtonLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    currencySymbol: { fontSize: 18, fontWeight: "700", color: c.primary, width: 28 },
    budgetInput: { flex: 1 },
    prefixInputRow: {
      flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: c.border,
      borderRadius: 8, backgroundColor: c.inputBg, marginBottom: 4,
    },
    prefixSymbol: { fontSize: 16, fontWeight: "700", color: c.primary, paddingLeft: 12 },
    prefixInput: { flex: 1, borderWidth: 0, marginBottom: 0, backgroundColor: "transparent" },
    clearButton: {
      backgroundColor: c.dangerLight, borderRadius: 8, paddingVertical: 13, paddingHorizontal: 16,
      alignItems: "center", marginTop: 4, borderWidth: 1, borderColor: c.dangerBorder,
    },
    clearButtonText: { color: c.danger, fontSize: 14, fontWeight: "600" },
    deleteSection: { marginTop: 24, marginBottom: 8 },
    deleteSectionTitle: {
      fontSize: 12, fontWeight: "600", color: c.danger, textTransform: "uppercase",
      letterSpacing: 0.5, marginBottom: 8,
    },
    deleteCard: {
      backgroundColor: c.card, borderRadius: 12, borderWidth: 1,
      borderColor: c.dangerBorder, padding: 16,
    },
    deleteDesc: { fontSize: 13, color: c.textSecondary, lineHeight: 20, marginBottom: 14 },
    deleteButton: {
      backgroundColor: c.dangerLight, borderRadius: 8, paddingVertical: 13,
      alignItems: "center", borderWidth: 1, borderColor: c.dangerBorder,
    },
    deleteButtonText: { color: c.danger, fontSize: 14, fontWeight: "700" },
  });
}
