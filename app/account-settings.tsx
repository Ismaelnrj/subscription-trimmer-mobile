import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Modal, FlatList,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../lib/auth-store";
import { useCurrencyStore, CURRENCIES, useFmt } from "../lib/currency-store";
import { PremiumGate } from "../components/PremiumGate";
import { isPasswordValid } from "../components/PasswordStrength";
import apiClient from "../lib/api";
import { useTheme, AppColors } from "../lib/theme";
import { signInWithGoogle } from "../lib/google-auth";

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const { currency, setCurrency } = useCurrencyStore();
  const fmtC = useFmt();
  const queryClient = useQueryClient();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [alertThresholdInput, setAlertThresholdInput] = useState("");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [budgetDirty, setBudgetDirty] = useState(false);
  const [thresholdDirty, setThresholdDirty] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
  });

  useEffect(() => {
    if (!budgetDirty && settings?.budgetGoal != null) setBudgetInput(String(settings.budgetGoal));
  }, [settings?.budgetGoal]);

  useEffect(() => {
    if (!thresholdDirty && settings?.alertThreshold != null) setAlertThresholdInput(String(settings.alertThreshold));
  }, [settings?.alertThreshold]);

  const profileMutation = useMutation({
    mutationFn: async (data: any) => (await apiClient.patch("/auth/profile", data)).data,
    onSuccess: (data) => { setUser(data); Alert.alert(t("accountSettings.saved"), t("accountSettings.savedName")); },
    onError: (err: any) => Alert.alert(t("common.error"), err.response?.data?.error || t("accountSettings.errUpdate")),
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: any) => (await apiClient.patch("/auth/profile", data)).data,
    onSuccess: () => {
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      Alert.alert(t("accountSettings.done"), t("accountSettings.passwordChanged"));
    },
    onError: (err: any) => Alert.alert(t("common.error"), err.response?.data?.error || t("accountSettings.errPassword")),
  });

  const settingsMutation = useMutation({
    mutationFn: async (data: any) => (await apiClient.post("/trpc/settings.update", data)).data.result.data,
    onSuccess: () => {
      setBudgetDirty(false);
      setThresholdDirty(false);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      Alert.alert(t("accountSettings.saved"), t("accountSettings.settingsSaved"));
    },
    onError: () => Alert.alert(t("common.error"), t("accountSettings.errSettings")),
  });

  const handleSaveName = () => profileMutation.mutate({ name: name.trim() });

  const handleDeleteAccount = () => {
    setDeletePassword("");
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (user?.hasPassword === false) {
      setDeleting(true);
      try {
        const idToken = await signInWithGoogle();
        if (!idToken) { setDeleting(false); return; } // user cancelled the Google sheet
        await apiClient.delete("/auth/account", { data: { idToken } });
        setShowDeleteModal(false);
        await logout();
        router.replace("/login");
      } catch (err: any) {
        Alert.alert(t("common.error"), err.response?.data?.error || t("accountSettings.errDeleteAccount"));
      } finally {
        setDeleting(false);
      }
      return;
    }

    if (!deletePassword) {
      Alert.alert(t("common.error"), t("accountSettings.errPasswordRequired"));
      return;
    }
    setDeleting(true);
    try {
      await apiClient.delete("/auth/account", { data: { password: deletePassword } });
      setShowDeleteModal(false);
      await logout();
      router.replace("/login");
    } catch (err: any) {
      Alert.alert(t("common.error"), err.response?.data?.error || t("accountSettings.errDeleteAccount"));
    } finally {
      setDeleting(false);
    }
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t("common.error"), t("accountSettings.errPasswordFields"));
      return;
    }
    if (newPassword !== confirmPassword) { Alert.alert(t("common.error"), t("accountSettings.errPasswordMatch")); return; }
    if (!isPasswordValid(newPassword)) {
      Alert.alert(t("common.error"), t("accountSettings.errWeakPassword"));
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const handleSaveBudget = () => {
    const goal = budgetInput ? parseFloat(budgetInput) : null;
    if (budgetInput && (isNaN(goal!) || goal! <= 0)) { Alert.alert(t("common.error"), t("accountSettings.errInvalidNumber")); return; }
    settingsMutation.mutate({ budgetGoal: goal, currency: currency.code, currencySymbol: currency.symbol });
  };

  const handleSaveAlertThreshold = () => {
    const threshold = alertThresholdInput ? parseFloat(alertThresholdInput) : 50;
    if (isNaN(threshold) || threshold <= 0) { Alert.alert(t("common.error"), t("accountSettings.errInvalidNumber")); return; }
    settingsMutation.mutate({ alertThreshold: threshold, budgetGoal: settings?.budgetGoal ?? null, currency: currency.code, currencySymbol: currency.symbol });
  };

  const handleSelectCurrency = (cur: typeof CURRENCIES[0]) => {
    setCurrency(cur);
    setShowCurrencyPicker(false);
    settingsMutation.mutate({ budgetGoal: settings?.budgetGoal ?? null, currency: cur.code, currencySymbol: cur.symbol });
  };

  return (
    <>
      <Stack.Screen options={{ title: t("profile.accountSettings") }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>

          <Text style={styles.sectionTitle}>{t("accountSettings.currency")}</Text>
          <View style={styles.card}>
            <Text style={styles.label}>{t("accountSettings.displayCurrency")}</Text>
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
            <Text style={styles.infoText}>{t("accountSettings.currencyInfo")}</Text>
          </View>

          <Text style={styles.sectionTitle}>{t("accountSettings.budgetGoal")}</Text>
          {!isPremium ? (
            <PremiumGate
              title={t("accountSettings.premiumBudgetTitle")}
              description={t("accountSettings.premiumBudgetDesc")}
            />
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>{t("accountSettings.monthlyLimit", { symbol: currency.symbol })}</Text>
              <TextInput
                style={styles.input}
                value={budgetInput}
                onChangeText={(v) => { setBudgetDirty(true); setBudgetInput(v); }}
                placeholder={t("accountSettings.limitPlaceholder")}
                placeholderTextColor={c.placeholder}
                keyboardType="decimal-pad"
              />
              <Text style={styles.infoText}>
                {t("accountSettings.budgetHint")}
                {settings?.budgetGoal != null ? `\n${t("accountSettings.currentGoal", { amount: `${fmtC(settings.budgetGoal)}` })}` : ""}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <TouchableOpacity style={[styles.saveButton, { flex: 1 }]} onPress={handleSaveBudget} disabled={settingsMutation.isLoading}>
                  {settingsMutation.isLoading
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.saveButtonText}>{t("accountSettings.saveGoal")}</Text>
                  }
                </TouchableOpacity>
                {settings?.budgetGoal != null && (
                  <TouchableOpacity style={styles.clearButton} onPress={() => { setBudgetInput(""); settingsMutation.mutate({ budgetGoal: null, currency: currency.code, currencySymbol: currency.symbol }); }}>
                    <Text style={styles.clearButtonText}>{t("accountSettings.clear")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>{t("accountSettings.alertThreshold")}</Text>
          {!isPremium ? (
            <PremiumGate
              title={t("accountSettings.premiumThresholdTitle")}
              description={t("accountSettings.premiumThresholdDesc")}
            />
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>{t("accountSettings.alertWhen")}</Text>
              <View style={styles.prefixInputRow}>
                <Text style={styles.prefixSymbol}>{currency.symbol}</Text>
                <TextInput
                  style={[styles.input, styles.prefixInput]}
                  value={alertThresholdInput}
                  onChangeText={(v) => { setThresholdDirty(true); setAlertThresholdInput(v); }}
                  placeholder={t("accountSettings.thresholdPlaceholder")}
                  placeholderTextColor={c.placeholder}
                  keyboardType="decimal-pad"
                />
              </View>
              <Text style={styles.infoText}>{t("accountSettings.thresholdHint", { symbol: currency.symbol })}</Text>
              <TouchableOpacity style={[styles.saveButton, { marginTop: 12 }]} onPress={handleSaveAlertThreshold} disabled={settingsMutation.isLoading}>
                {settingsMutation.isLoading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.saveButtonText}>{t("accountSettings.saveThreshold")}</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.sectionTitle}>{t("accountSettings.profileSection")}</Text>
          <View style={styles.card}>
            <Text style={styles.label}>{t("accountSettings.displayName")}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t("accountSettings.namePlaceholder")}
              placeholderTextColor={c.placeholder}
            />
            <Text style={styles.label}>{t("accountSettings.email")}</Text>
            <TextInput
              style={[styles.input, { color: c.textMuted }]}
              value={user?.email || ""}
              editable={false}
            />
            <Text style={styles.infoText}>{t("accountSettings.emailCannotChange")}</Text>
            <TouchableOpacity style={[styles.saveButton, { marginTop: 12 }]} onPress={handleSaveName} disabled={profileMutation.isLoading}>
              {profileMutation.isLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.saveButtonText}>{t("accountSettings.saveName")}</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>{t("accountSettings.changePassword")}</Text>
          {user?.hasPassword === false ? (
            <View style={styles.card}>
              <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>
                {t("accountSettings.googleAccountNote")}
              </Text>
            </View>
          ) : (
          <View style={styles.card}>
            <Text style={styles.label}>{t("accountSettings.currentPassword")}</Text>
            <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword}
              placeholder={t("accountSettings.currentPasswordPlaceholder")} placeholderTextColor={c.placeholder} secureTextEntry />
            <Text style={styles.label}>{t("accountSettings.newPassword")}</Text>
            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword}
              placeholder={t("accountSettings.newPasswordPlaceholder")} placeholderTextColor={c.placeholder} secureTextEntry />
            <Text style={styles.label}>{t("accountSettings.confirmPassword")}</Text>
            <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder={t("accountSettings.confirmPasswordPlaceholder")} placeholderTextColor={c.placeholder} secureTextEntry />
            <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={passwordMutation.isLoading}>
              {passwordMutation.isLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.saveButtonText}>{t("accountSettings.changePasswordBtn")}</Text>
              }
            </TouchableOpacity>
          </View>
          )}

          <View style={styles.deleteSection}>
            <Text style={styles.deleteSectionTitle}>{t("accountSettings.dangerZone")}</Text>
            <View style={styles.deleteCard}>
              <Text style={styles.deleteDesc}>{t("accountSettings.deleteDesc")}</Text>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                <Text style={styles.deleteButtonText}>{t("accountSettings.deleteBtn")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showCurrencyPicker} transparent animationType="slide" onRequestClose={() => setShowCurrencyPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>{t("accountSettings.selectCurrency")}</Text>
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

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}>
            <Text style={styles.pickerTitle}>{t("accountSettings.deleteModalTitle")}</Text>
            <Text style={styles.deleteDesc}>{t("accountSettings.deleteModalDesc")}</Text>
            {user?.hasPassword === false ? (
              <Text style={[styles.deleteDesc, { marginBottom: 12 }]}>
                {t("accountSettings.deleteGoogleConfirmNote")}
              </Text>
            ) : (
              <TextInput
                style={styles.input}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder={t("accountSettings.deletePasswordPlaceholder")}
                placeholderTextColor={c.placeholder}
                secureTextEntry
                autoFocus
              />
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[styles.clearButton, { flex: 1, backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={[styles.clearButtonText, { color: c.text }]}>{t("accountSettings.deleteCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteButton, { flex: 1 }]} onPress={handleConfirmDelete} disabled={deleting}>
                {deleting
                  ? <ActivityIndicator color={c.danger} />
                  : <Text style={styles.deleteButtonText}>
                      {user?.hasPassword === false ? t("accountSettings.deleteConfirmWithGoogle") : t("accountSettings.deletePermanently")}
                    </Text>
                }
              </TouchableOpacity>
            </View>
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
