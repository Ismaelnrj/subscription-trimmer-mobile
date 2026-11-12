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
import { isPasswordValid, isPasswordTooLong } from "../components/PasswordStrength";
import apiClient from "../lib/api";
import { useTheme, AppColors, space, radius, type as typeScale } from "../lib/theme";
import { sanitiseAmountInput } from "../lib/utils";
import { signInWithGoogle } from "../lib/google-auth";
import * as SecureStore from "expo-secure-store";

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

  /* isError matters here more than on most screens, because a failed load is
     INDISTINGUISHABLE from having nothing saved. The budget field stays empty,
     the "current goal" line is hidden because it is conditional on the value,
     and the clear button disappears with it. Somebody with a 50 euro budget on
     a dropped connection sees exactly what somebody with no budget sees.

     Same shape as the subscriptions.tsx defect from the 2026-09-12 review,
     which fell through to the empty state and told people on a bad connection
     that they had no subscriptions. */
  const { data: settings, isError: settingsError } = useQuery({
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
    onSuccess: async (data: any) => {
      /* A password change ends every other session on the server and hands
         this device a fresh pair. Without storing it, this device's next
         refresh would be refused and sign the person out too. */
      if (data?.session?.token && data?.session?.refreshToken) {
        await SecureStore.setItemAsync("auth_token", data.session.token).catch(() => {});
        await SecureStore.setItemAsync("refresh_token", data.session.refreshToken).catch(() => {});
      }
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
    if (isPasswordTooLong(newPassword)) {
      Alert.alert(t("common.error"), t("common.errPasswordTooLong"));
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const handleSaveBudget = () => {
    const goal = budgetInput ? parseFloat(budgetInput) : null;
    if (budgetInput && (isNaN(goal!) || goal! <= 0)) { Alert.alert(t("common.error"), t("accountSettings.errInvalidNumber")); return; }
    settingsMutation.mutate({ budgetGoal: goal, currency: currency.code, currencySymbol: currency.symbol });
  };

  /* Neither of these sends budgetGoal, and that is the fix rather than an
     omission. They used to pass `settings?.budgetGoal ?? null` purely to stop
     the endpoint nulling a field they were not editing, which meant they sent
     null whenever the settings query had not resolved yet. Changing your
     currency before that first load landed wiped your budget goal, silently,
     because the write itself succeeded.

     settings.update now treats an absent key as "leave this alone" and only an
     explicit null as "clear it", so saying nothing is the correct way to not
     touch a field. Do not reintroduce budgetGoal here to be helpful. */
  const handleSaveAlertThreshold = () => {
    const threshold = alertThresholdInput ? parseFloat(alertThresholdInput) : 50;
    if (isNaN(threshold) || threshold <= 0) { Alert.alert(t("common.error"), t("accountSettings.errInvalidNumber")); return; }
    settingsMutation.mutate({ alertThreshold: threshold, currency: currency.code, currencySymbol: currency.symbol });
  };

  const handleSelectCurrency = (cur: typeof CURRENCIES[0]) => {
    setCurrency(cur);
    setShowCurrencyPicker(false);
    settingsMutation.mutate({ currency: cur.code, currencySymbol: cur.symbol });
  };

  return (
    <>
      <Stack.Screen options={{ title: t("profile.accountSettings") }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>

          {settingsError && (
            <View style={styles.loadErrorRow} accessibilityRole="alert">
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={c.danger} />
              <Text style={styles.loadErrorText}>{t("accountSettings.couldntLoad")}</Text>
            </View>
          )}

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
                onChangeText={(v) => { setBudgetDirty(true); setBudgetInput(sanitiseAmountInput(v)); }}
                placeholder={t("accountSettings.limitPlaceholder")}
                placeholderTextColor={c.placeholder}
                keyboardType="decimal-pad"
              />
              <Text style={styles.infoText}>
                {t("accountSettings.budgetHint")}
                {settings?.budgetGoal != null ? `\n${t("accountSettings.currentGoal", { amount: `${fmtC(settings.budgetGoal)}` })}` : ""}
              </Text>
              <View style={{ flexDirection: "row", gap: space.s, marginTop: space.m }}>
                <TouchableOpacity style={[styles.saveButton, { flex: 1 }]} onPress={handleSaveBudget} disabled={settingsMutation.isLoading}>
                  {settingsMutation.isLoading
                    ? <ActivityIndicator color={c.bg} />
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
                  onChangeText={(v) => { setThresholdDirty(true); setAlertThresholdInput(sanitiseAmountInput(v)); }}
                  placeholder={t("accountSettings.thresholdPlaceholder")}
                  placeholderTextColor={c.placeholder}
                  keyboardType="decimal-pad"
                />
              </View>
              <Text style={styles.infoText}>{t("accountSettings.thresholdHint", { amount: fmtC(50, currency.code) })}</Text>
              <TouchableOpacity style={[styles.saveButton, { marginTop: space.m }]} onPress={handleSaveAlertThreshold} disabled={settingsMutation.isLoading}>
                {settingsMutation.isLoading
                  ? <ActivityIndicator color={c.bg} />
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
              style={[styles.input, styles.inputReadOnly]}
              value={user?.email || ""}
              editable={false}
            />
            <Text style={styles.infoText}>{t("accountSettings.emailCannotChange")}</Text>
            <TouchableOpacity style={[styles.saveButton, { marginTop: space.m }]} onPress={handleSaveName} disabled={profileMutation.isLoading}>
              {profileMutation.isLoading
                ? <ActivityIndicator color={c.bg} />
                : <Text style={styles.saveButtonText}>{t("accountSettings.saveName")}</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>{t("accountSettings.changePassword")}</Text>
          {user?.hasPassword === false ? (
            <View style={styles.card}>
              <Text style={styles.note}>
                {t("accountSettings.googleAccountNote")}
              </Text>
            </View>
          ) : (
          <View style={styles.card}>
            <Text style={styles.label}>{t("accountSettings.currentPassword")}</Text>
            <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword}
              placeholder={t("accountSettings.currentPasswordPlaceholder")} placeholderTextColor={c.placeholder} secureTextEntry autoComplete="current-password" />
            <Text style={styles.label}>{t("accountSettings.newPassword")}</Text>
            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword}
              placeholder={t("accountSettings.newPasswordPlaceholder")} placeholderTextColor={c.placeholder} secureTextEntry autoComplete="new-password" />
            <Text style={styles.label}>{t("accountSettings.confirmPassword")}</Text>
            <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder={t("accountSettings.confirmPasswordPlaceholder")} placeholderTextColor={c.placeholder} secureTextEntry autoComplete="new-password" />
            <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={passwordMutation.isLoading}>
              {passwordMutation.isLoading
                ? <ActivityIndicator color={c.bg} />
                : <Text style={styles.saveButtonText}>{t("accountSettings.changePasswordBtn")}</Text>
              }
            </TouchableOpacity>
          </View>
          )}

          {/* No "Danger Zone" heading: one plainly worded card with a red
              button says the same without the borrowed developer jargon. */}
          <View style={styles.deleteSection}>
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
                    <Text style={styles.currencySymbol}>{item.symbol}</Text>
                    <View>
                      <Text style={styles.currencyName}>{item.name}</Text>
                      <Text style={styles.currencyCode}>{item.code}</Text>
                    </View>
                  </View>
                  {currency.code === item.code && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={c.text} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>{t("accountSettings.deleteModalTitle")}</Text>
            <Text style={styles.deleteDesc}>{t("accountSettings.deleteModalDesc")}</Text>
            {user?.hasPassword === false ? (
              <Text style={[styles.deleteDesc, { marginBottom: space.m }]}>
                {t("accountSettings.deleteGoogleConfirmNote")}
              </Text>
            ) : (
              <TextInput
                style={styles.input}
                autoComplete="current-password"
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder={t("accountSettings.deletePasswordPlaceholder")}
                placeholderTextColor={c.placeholder}
                secureTextEntry
                autoFocus
              />
            )}
            <View style={{ flexDirection: "row", gap: space.s }}>
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

/* Every number below comes from the scale in lib/theme.ts. */
function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: space.xxl },
    sectionTitle: { ...typeScale.heading, color: c.text, marginTop: space.xl, marginBottom: space.s },
    card: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, padding: space.l,
    },
    /* c.danger is the deepened coral, the value the palette rules require for
       coral carrying text on a light ground. */
    loadErrorRow: {
      flexDirection: "row", alignItems: "flex-start", gap: space.s,
      backgroundColor: c.dangerLight, borderRadius: radius.m, padding: space.m, marginTop: space.l,
    },
    loadErrorText: { ...typeScale.caption, flex: 1, color: c.danger },
    label: { ...typeScale.label, color: c.text, marginBottom: space.s },
    input: {
      ...typeScale.body, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: radius.s,
      minHeight: 48, paddingHorizontal: space.m, color: c.text, marginBottom: space.m, backgroundColor: c.inputBg,
    },
    inputReadOnly: { color: c.textSecondary },
    saveButton: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 48,
      alignItems: "center", justifyContent: "center", marginTop: space.xs,
    },
    saveButtonText: { ...typeScale.bodyStrong, color: c.bg },
    infoText: { ...typeScale.caption, color: c.textSecondary, marginTop: space.xs },
    note: { ...typeScale.body, color: c.textSecondary },
    currencyRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    currencyName: { ...typeScale.body, color: c.text },
    currencyCode: { ...typeScale.caption, color: c.textSecondary },
    pickerOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
    pickerSheet: {
      backgroundColor: c.card, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l,
      padding: space.xl, maxHeight: "70%",
    },
    pickerTitle: { ...typeScale.title, color: c.text, marginBottom: space.l },
    currencyButton: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 56,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: radius.s,
      paddingHorizontal: space.m, marginBottom: space.xs,
    },
    currencyButtonLeft: { flexDirection: "row", alignItems: "center", gap: space.m },
    currencySymbol: { ...typeScale.heading, color: c.text, width: 28 },
    budgetInput: { flex: 1 },
    prefixInputRow: {
      flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      borderRadius: radius.s, backgroundColor: c.inputBg, marginBottom: space.xs,
    },
    prefixSymbol: { ...typeScale.bodyStrong, color: c.textSecondary, paddingLeft: space.m },
    prefixInput: { flex: 1, borderWidth: 0, marginBottom: 0, backgroundColor: "transparent" },
    clearButton: {
      borderRadius: radius.m, minHeight: 48, paddingHorizontal: space.l, alignItems: "center", justifyContent: "center",
      marginTop: space.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.card,
    },
    clearButtonText: { ...typeScale.bodyStrong, color: c.text },
    deleteSection: { marginTop: space.xxl, marginBottom: space.s },
    deleteCard: {
      backgroundColor: c.card, borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, padding: space.l,
    },
    deleteDesc: { ...typeScale.body, color: c.textSecondary, marginBottom: space.l },
    deleteButton: {
      backgroundColor: c.dangerLight, borderRadius: radius.m, minHeight: 48,
      alignItems: "center", justifyContent: "center",
    },
    deleteButtonText: { ...typeScale.bodyStrong, color: c.danger },
  });
}
