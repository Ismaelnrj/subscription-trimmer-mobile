import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  TextInput, Alert, RefreshControl, Share, ActivityIndicator, Platform, Animated, Linking,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import apiClient from "../../lib/api";
import { useState, useMemo, useEffect, useRef } from "react";
import { useFmt, useCurrencyStore } from "../../lib/currency-store";
import { useAuthStore } from "../../lib/auth-store";
import { normaliseDateInput } from "../../lib/utils";
import { parseSubscriptionEmail } from "../../lib/parse-subscription";
import { useTheme, AppColors } from "../../lib/theme";

const FREE_LIMIT = 5;
const BILLING_CYCLES = ["monthly", "yearly", "weekly"];
const DEFAULT_CATEGORIES = ["entertainment", "streaming", "software", "health", "fitness", "food", "education", "other"];

function toMonthly(price: number, cycle: string) {
  if (cycle === "weekly") return (price * 52) / 12;
  if (cycle === "yearly") return price / 12;
  return price;
}

const emptyForm = { name: "", price: "", billingCycle: "monthly", category: "other", trialEndDate: "", isFreeTrial: false };

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const fmtC = useFmt();
  const { currency, baseCurrencyCode, convert } = useCurrencyStore();
  const queryClient = useQueryClient();
  const c = useTheme();
  const styles = makeStyles(c);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<"date" | "name" | "price_desc">("date");
  const [refreshing, setRefreshing] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCatDraft, setCustomCatDraft] = useState("");
  const [showEmailPaste, setShowEmailPaste] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [savingsCard, setSavingsCard] = useState<{ name: string; yearly: number } | null>(null);

  const savingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savingsTimer.current) clearTimeout(savingsTimer.current); }, []);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 250);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  const { data: subscriptions = [], refetch } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => (await apiClient.get("/trpc/subscriptions.list")).data.result.data,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
  });

  const customCategories: string[] = settings?.customCategories ?? [];
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const total = subscriptions.length;
  const atLimit = !isPremium && total >= FREE_LIMIT;
  const limitPct = isPremium ? 0 : Math.min((total / FREE_LIMIT) * 100, 100);
  const limitColor = limitPct >= 100 ? c.danger : limitPct >= 60 ? c.warning : c.primary;

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const list = q
      ? subscriptions.filter((s: any) =>
          (s.name ?? "").toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q)
        )
      : [...subscriptions];

    if (sort === "name") list.sort((a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? ""));
    else if (sort === "price_desc") list.sort((a: any, b: any) => toMonthly(b.price ?? 0, b.billingCycle ?? "monthly") - toMonthly(a.price ?? 0, a.billingCycle ?? "monthly"));
    return list;
  }, [subscriptions, debouncedSearch, sort]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };

  const settingsMutation = useMutation({
    mutationFn: async (cats: string[]) => {
      const res = await apiClient.post("/trpc/settings.update", {
        budgetGoal: settings?.budgetGoal ?? null,
        currency: settings?.currency ?? "USD",
        currencySymbol: settings?.currencySymbol ?? "$",
        customCategories: cats,
      });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) =>
      (await apiClient.post("/trpc/subscriptions.create", data)).data.result.data,
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (err: any) => {
      if (err.response?.data?.error === "FREE_LIMIT_REACHED") {
        closeModal();
        router.push("/upgrade");
      } else {
        Alert.alert("Error", err.response?.data?.error || "Could not add subscription.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) =>
      (await apiClient.post("/trpc/subscriptions.update", data)).data.result.data,
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sub: any) =>
      (await apiClient.post("/trpc/subscriptions.delete", { id: sub.id })).data.result.data,
    onSuccess: (_data, sub) => {
      invalidate();
      const yearly = toMonthly(parseFloat(sub.price), sub.billingCycle) * 12;
      setSavingsCard({ name: sub.name, yearly });
      if (savingsTimer.current) clearTimeout(savingsTimer.current);
      savingsTimer.current = setTimeout(() => setSavingsCard(null), 3000);
    },
    onError: () => Alert.alert("Error", "Could not delete subscription. Please try again."),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openAdd = () => {
    if (atLimit) { router.push("/upgrade"); return; }
    setEditingId(null); setFormData(emptyForm);
    setShowCustomInput(false); setCustomCatDraft("");
    setShowModal(true);
  };

  const openEdit = (sub: any) => {
    setEditingId(sub.id);
    setFormData({
      name: sub.name, price: String(sub.price), billingCycle: sub.billingCycle,
      category: sub.category, trialEndDate: sub.trialEndDate ? sub.trialEndDate.slice(0, 10) : "",
      isFreeTrial: !!sub.trialEndDate,
    });
    setShowCustomInput(false); setCustomCatDraft("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false); setEditingId(null); setFormData(emptyForm);
    setShowCustomInput(false); setCustomCatDraft("");
    setShowEmailPaste(false); setEmailText("");
  };

  const addCustomCategory = () => {
    const cat = customCatDraft.trim().toLowerCase();
    if (!cat) return;
    if (allCategories.includes(cat)) {
      setFormData({ ...formData, category: cat });
      setShowCustomInput(false); setCustomCatDraft("");
      return;
    }
    const updated = [...customCategories, cat];
    settingsMutation.mutate(updated);
    setFormData({ ...formData, category: cat });
    setShowCustomInput(false); setCustomCatDraft("");
  };

  const handleSubmit = () => {
    const price = parseFloat(formData.price);
    if (!formData.name.trim() || !formData.price) {
      Alert.alert("Error", "Please enter a name and price.");
      return;
    }
    if (isNaN(price) || price <= 0) {
      Alert.alert("Error", "Please enter a valid price greater than 0.");
      return;
    }
    if (price > 99999) {
      Alert.alert("Error", "Price seems too high. Please check and try again.");
      return;
    }

    let trialEndDate: string | null = null;
    if (formData.isFreeTrial && !formData.trialEndDate.trim()) {
      Alert.alert("Trial end date required", "Please enter when the free trial ends.");
      return;
    }
    if (formData.trialEndDate.trim()) {
      trialEndDate = normaliseDateInput(formData.trialEndDate);
      if (!trialEndDate) {
        Alert.alert("Invalid date", "Please enter the trial end date as DD/MM/YYYY or YYYY-MM-DD.");
        return;
      }
    }

    const duplicate = subscriptions?.find(
      (s: any) => s.name.trim().toLowerCase() === formData.name.trim().toLowerCase() && s.id !== editingId
    );
    if (duplicate) {
      Alert.alert(
        "Duplicate subscription",
        `You already have "${duplicate.name}" in your list. Add it anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add anyway", onPress: () => submitData(price, trialEndDate) },
        ]
      );
      return;
    }
    submitData(price, trialEndDate);
  };

  const submitData = (price: number, trialEndDate: string | null) => {
    const data = {
      name: formData.name.trim(), price,
      billingCycle: formData.billingCycle, category: formData.category,
      trialEndDate,
    };
    if (editingId !== null) { updateMutation.mutate({ id: editingId, ...data }); }
    else { createMutation.mutate(data); }
  };

  const confirmDelete = (sub: any) => {
    Alert.alert("Delete Subscription", `Remove "${sub.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(sub) },
    ]);
  };

  const handleRateApp = async () => {
    const market = "market://details?id=com.trimio.app";
    const web = "https://play.google.com/store/apps/details?id=com.trimio.app";
    try {
      await Linking.openURL(market);
    } catch {
      try { await Linking.openURL(web); } catch {}
    }
  };

  const handleLoadExamples = async () => {
    setLoadingExamples(true);
    const examples = [
      { name: "Netflix", price: 15.99, billingCycle: "monthly", category: "entertainment", trialEndDate: null },
      { name: "Spotify", price: 9.99, billingCycle: "monthly", category: "entertainment", trialEndDate: null },
      { name: "iCloud+", price: 2.99, billingCycle: "monthly", category: "software", trialEndDate: null },
    ];
    try {
      for (const ex of examples) {
        await apiClient.post("/trpc/subscriptions.create", ex);
      }
      invalidate();
    } catch {
      Alert.alert("Error", "Could not load examples. Please try again.");
    } finally {
      setLoadingExamples(false);
    }
  };

  const exportReport = async () => {
    if (!isPremium) { router.push("/upgrade"); return; }
    if (subscriptions.length === 0) { Alert.alert("No data", "Add some subscriptions first."); return; }

    const monthlyTotal = subscriptions.reduce((sum: number, s: any) => sum + toMonthly(s.price, s.billingCycle), 0);
    const csvEscape = (v: string) => {
      let str = String(v);
      if (/^[=+\-@]/.test(str)) str = `'${str}`; // prevent formula injection in Excel/Sheets
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = [
      ["Name", "Price", "Billing Cycle", "Monthly Equivalent", "Category", "Next Billing Date", "Trial End Date", "Yearly Cost"].join(","),
      ...subscriptions.map((s: any) => [
        csvEscape(s.name),
        s.price.toFixed(2),
        csvEscape(s.billingCycle),
        toMonthly(s.price, s.billingCycle).toFixed(2),
        csvEscape(s.category),
        s.nextBillingDate ? new Date(s.nextBillingDate).toISOString().split("T")[0] : "",
        s.trialEndDate ? new Date(s.trialEndDate).toISOString().split("T")[0] : "",
        (toMonthly(s.price, s.billingCycle) * 12).toFixed(2),
      ].join(",")),
      "",
      `# Summary`,
      `# Monthly Total,${monthlyTotal.toFixed(2)}`,
      `# Yearly Total,${(monthlyTotal * 12).toFixed(2)}`,
      `# Subscriptions,${subscriptions.length}`,
      `# Generated,${new Date().toISOString().split("T")[0]}`,
    ].join("\n");

    try {
      const path = `${FileSystem.cacheDirectory}trimio-export.csv`;
      await FileSystem.writeAsStringAsync(path, rows, { encoding: FileSystem.EncodingType.UTF8 });
      const shareUri = Platform.OS === "android" ? await FileSystem.getContentUriAsync(path) : path;
      await Share.share({ url: shareUri, title: "Trimio Export" });
    } catch {
      // Fallback: share as plain text if file sharing fails
      await Share.share({ message: rows, title: "Trimio Export" });
    }
  };

  const isPending = createMutation.isLoading || updateMutation.isLoading;

  const monthlyEquiv = (price: number, cycle: string) => {
    if (cycle === "yearly") return `${fmtC(price / 12)}/mo`;
    if (cycle === "weekly") return `${fmtC((price * 52) / 12)}/mo`;
    return null;
  };

  return (
    <View style={styles.container}>
      {savingsCard && (
        <TouchableOpacity
          style={styles.savingsCard}
          activeOpacity={0.9}
          onPress={() => {
            if (savingsTimer.current) clearTimeout(savingsTimer.current);
            setSavingsCard(null);
          }}
        >
          <MaterialCommunityIcons name="party-popper" size={22} color="#FFFFFF" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.savingsCardText}>
              You just saved {fmtC(savingsCard.yearly)} this year by cutting {savingsCard.name}
            </Text>
            <Text style={styles.savingsCardRate} onPress={handleRateApp}>
              Rate Now ⭐
            </Text>
          </View>
        </TouchableOpacity>
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <View style={styles.scrollContent}>
          <View style={styles.topRow}>
            <TouchableOpacity
              style={[styles.addButton, atLimit && styles.addButtonLocked]}
              onPress={openAdd}
            >
              <MaterialCommunityIcons name={atLimit ? "lock" : "plus"} size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>{atLimit ? "Limit reached" : "Add"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportButton, !isPremium && styles.exportButtonLocked]}
              onPress={exportReport}
            >
              <MaterialCommunityIcons
                name={isPremium ? "file-chart" : "lock"}
                size={20}
                color={isPremium ? "#FFFFFF" : c.textMuted}
              />
            </TouchableOpacity>
          </View>

          {!isPremium && (
            <View style={styles.limitBar}>
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Free plan</Text>
                <Text style={[styles.limitCount, { color: limitColor }]}>
                  {total} / {FREE_LIMIT} subscriptions
                </Text>
              </View>
              <View style={styles.limitTrack}>
                <View style={[styles.limitFill, { width: `${limitPct}%`, backgroundColor: limitColor }]} />
              </View>
              {atLimit ? (
                <TouchableOpacity onPress={() => router.push("/upgrade")}>
                  <Text style={[styles.limitHint, { color: c.primary, fontWeight: "600" }]}>
                    Limit reached. Upgrade for unlimited →
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.limitHint}>
                  {FREE_LIMIT - total} slot{FREE_LIMIT - total !== 1 ? "s" : ""} remaining ·{" "}
                  <Text style={{ color: c.primary }} onPress={() => router.push("/upgrade")}>
                    Go unlimited
                  </Text>
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.emailHintBanner} onPress={openAdd}>
            <MaterialCommunityIcons name="email-fast-outline" size={18} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.emailHintTitle}>Paste a receipt email — it fills itself in</Text>
              <Text style={styles.emailHintSub}>Works with PayPal, Stripe, 24+ services</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={c.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.searchBar}
            placeholder="Search subscriptions..."
            placeholderTextColor={c.placeholder}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />

          {total > 0 && (
            <View style={styles.sortRow}>
              {([ ["date", "Recent"], ["name", "A–Z"], ["price_desc", "Price ↓"] ] as ["date"|"name"|"price_desc", string][]).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.sortChip, sort === key && styles.sortChipActive]}
                  onPress={() => setSort(key)}
                >
                  <Text style={[styles.sortChipText, sort === key && styles.sortChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {total > 0 && (
            <Text style={styles.countText}>
              {filtered.length} of {total} subscription{total !== 1 ? "s" : ""}
            </Text>
          )}

          {filtered.length === 0 ? (
            total === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="receipt-text-outline" size={52} color={c.border} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyStateTitle}>What are you paying for?</Text>
                <Text style={styles.emptyStateSubtext}>
                  Add your first subscription to start tracking your monthly spend.
                </Text>
                <TouchableOpacity style={styles.emptyStateButton} onPress={openAdd}>
                  <Text style={styles.emptyStateButtonText}>+ Add Subscription</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.examplesButton}
                  onPress={handleLoadExamples}
                  disabled={loadingExamples}
                >
                  {loadingExamples
                    ? <ActivityIndicator color={c.primary} size="small" />
                    : <Text style={styles.examplesButtonText}>Try with example subscriptions</Text>
                  }
                </TouchableOpacity>
                <Text style={styles.emptyStateHint}>
                  You can also paste a purchase confirmation email and we'll fill it in for you.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="inbox" size={48} color={c.border} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyStateText}>No results found</Text>
              </View>
            )
          ) : (
            filtered.map((sub: any) => {
              const equiv = monthlyEquiv(sub.price, sub.billingCycle);
              const trialDate = sub.trialEndDate ? new Date(sub.trialEndDate) : null;
              const trialDaysLeft = trialDate
                ? Math.ceil((trialDate.getTime() - Date.now()) / 86400000)
                : null;
              const isCustomCat = !DEFAULT_CATEGORIES.includes(sub.category);
              return (
                <Swipeable
                  key={sub.id}
                  friction={2}
                  rightThreshold={40}
                  renderRightActions={(progress) => {
                    const trans = progress.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
                    return (
                      <Animated.View style={[styles.swipeDeleteWrapper, { transform: [{ translateX: trans }] }]}>
                        <TouchableOpacity style={styles.swipeDelete} onPress={() => confirmDelete(sub)}>
                          <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
                          <Text style={styles.swipeDeleteText}>Delete</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  }}
                >
                <View style={styles.card}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{sub.name}</Text>
                    <Text style={styles.cardPrice}>{fmtC(sub.price)} / {sub.billingCycle}</Text>
                    {equiv && <Text style={styles.cardMonthly}>≈ {equiv}</Text>}
                    <Text style={styles.cardDate}>
                      Next: {sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString() : "—"}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      <View style={[styles.categoryBadge, isCustomCat && styles.customCategoryBadge]}>
                        <Text style={[styles.categoryBadgeText, isCustomCat && styles.customCategoryBadgeText]}>
                          {sub.category}
                        </Text>
                      </View>
                      {trialDate && trialDaysLeft !== null && trialDaysLeft >= 0 && (
                        <View style={styles.trialBadge}>
                          <Text style={styles.trialBadgeText}>
                            Trial ends {trialDaysLeft === 0 ? "today" : `in ${trialDaysLeft}d`}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => openEdit(sub)}>
                      <MaterialCommunityIcons name="pencil" size={18} color={c.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => confirmDelete(sub)}>
                      <MaterialCommunityIcons name="trash-can" size={18} color={c.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                </Swipeable>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit Subscription" : "Add Subscription"}
              </Text>

              {!editingId && (
                <TouchableOpacity
                  style={styles.emailFillButton}
                  onPress={() => setShowEmailPaste(!showEmailPaste)}
                >
                  <MaterialCommunityIcons name="email-fast-outline" size={16} color={c.primary} />
                  <Text style={styles.emailFillButtonText}>
                    {showEmailPaste ? "Hide auto-fill" : "Auto-fill from purchase email"}
                  </Text>
                  <MaterialCommunityIcons
                    name={showEmailPaste ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={c.primary}
                  />
                </TouchableOpacity>
              )}

              {showEmailPaste && (
                <View style={styles.emailPasteBox}>
                  <Text style={styles.emailPasteLabel}>
                    Paste your purchase / confirmation email below. We'll fill in the details for you.
                  </Text>
                  <TextInput
                    style={styles.emailPasteInput}
                    multiline
                    numberOfLines={5}
                    placeholder="Paste email text here..."
                    placeholderTextColor={c.placeholder}
                    value={emailText}
                    onChangeText={(t) => {
                      setEmailText(t);
                      const parsed = parseSubscriptionEmail(t);
                      setFormData((prev) => ({
                        ...prev,
                        name: parsed.name ?? "",
                        price: parsed.price ?? "",
                        billingCycle: parsed.billingCycle ?? prev.billingCycle,
                      }));
                    }}
                    textAlignVertical="top"
                  />
                  {(formData.name || formData.price) && (
                    <View style={styles.parsedPreview}>
                      <MaterialCommunityIcons name="check-circle" size={14} color={c.success} />
                      <Text style={styles.parsedPreviewText}>
                        Detected:{formData.name ? ` ${formData.name}` : ""}
                        {formData.price ? ` · ${baseCurrencyCode} ${formData.price}` : ""}
                        {formData.billingCycle ? ` · ${formData.billingCycle}` : ""}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Subscription name (e.g. Netflix)"
                placeholderTextColor={c.placeholder}
                value={formData.name}
                onChangeText={(t) => setFormData({ ...formData, name: t })}
              />
              <TextInput
                style={styles.input}
                placeholder={`Price in ${baseCurrencyCode} (e.g. 9.99)`}
                placeholderTextColor={c.placeholder}
                keyboardType="decimal-pad"
                value={formData.price}
                onChangeText={(t) => setFormData({ ...formData, price: t })}
              />
              {(() => {
                const raw = parseFloat(formData.price);
                if (!isNaN(raw) && raw > 0 && currency.code !== baseCurrencyCode) {
                  const converted = convert(raw);
                  const decimals = currency.code === "JPY" ? 0 : 2;
                  return (
                    <Text style={styles.priceHint}>
                      ≈ {currency.symbol}{converted.toFixed(decimals)} {currency.code}
                    </Text>
                  );
                }
                return null;
              })()}

              <Text style={styles.label}>Billing Cycle</Text>
              <View style={styles.chipRow}>
                {BILLING_CYCLES.map((cycle) => (
                  <TouchableOpacity
                    key={cycle}
                    style={[styles.chip, formData.billingCycle === cycle && styles.chipActive]}
                    onPress={() => setFormData({ ...formData, billingCycle: cycle })}
                  >
                    <Text style={[styles.chipText, formData.billingCycle === cycle && styles.chipTextActive]}>
                      {cycle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.chip, styles.trialToggle, formData.isFreeTrial && styles.chipActive]}
                onPress={() => setFormData({ ...formData, isFreeTrial: !formData.isFreeTrial })}
              >
                <MaterialCommunityIcons
                  name={formData.isFreeTrial ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={16}
                  color={formData.isFreeTrial ? "#FFFFFF" : c.textSecondary}
                />
                <Text style={[styles.chipText, formData.isFreeTrial && styles.chipTextActive]}>
                  This is a free trial
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>
                Category{isPremium && customCategories.length > 0 ? "  ✦ custom" : ""}
              </Text>
              <View style={styles.chipRow}>
                {allCategories.map((cat) => {
                  const isCustom = !DEFAULT_CATEGORIES.includes(cat);
                  const isActive = formData.category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.chip,
                        isActive && (isCustom ? styles.chipCustomActive : styles.chipActive),
                      ]}
                      onPress={() => setFormData({ ...formData, category: cat })}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {isPremium && !showCustomInput && (
                  <TouchableOpacity
                    style={[styles.chip, styles.chipAdd]}
                    onPress={() => setShowCustomInput(true)}
                  >
                    <Text style={[styles.chipText, { color: "#7C3AED" }]}>+ custom</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isPremium && showCustomInput && (
                <View style={styles.customCatRow}>
                  <TextInput
                    style={styles.customCatInput}
                    placeholder="e.g. hobbies, work tools..."
                    placeholderTextColor="#A78BFA"
                    autoFocus
                    value={customCatDraft}
                    onChangeText={setCustomCatDraft}
                    onSubmitEditing={addCustomCategory}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={styles.customCatConfirm} onPress={addCustomCategory}>
                    <Text style={styles.customCatConfirmText}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.label}>
                {formData.isFreeTrial ? "Trial ends on" : "Trial End Date (optional)"}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 15/06/2025 or 2025-06-15"
                placeholderTextColor={c.placeholder}
                value={formData.trialEndDate}
                onChangeText={(t) => setFormData({ ...formData, trialEndDate: t })}
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isPending}>
                {isPending
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.submitButtonText}>
                      {editingId ? "Save Changes" : "Add Subscription"}
                    </Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 16, paddingBottom: 32 },
    savingsCard: {
      position: "absolute", top: 12, left: 16, right: 16, zIndex: 50,
      backgroundColor: c.success, borderRadius: 12, padding: 14,
      flexDirection: "row", alignItems: "center",
      shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    savingsCardText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", lineHeight: 18 },
    savingsCardRate: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", marginTop: 4 },
    topRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    addButton: {
      flex: 1, backgroundColor: c.primary, borderRadius: 8, paddingVertical: 12,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    },
    addButtonLocked: { backgroundColor: c.textMuted },
    addButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
    exportButton: {
      backgroundColor: c.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14,
      justifyContent: "center", alignItems: "center",
    },
    exportButtonLocked: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    limitBar: {
      backgroundColor: c.card, borderRadius: 10, padding: 12, marginBottom: 12,
      borderWidth: 1, borderColor: c.border,
    },
    limitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    limitLabel: { fontSize: 12, color: c.textSecondary, fontWeight: "500" },
    limitCount: { fontSize: 12, fontWeight: "700" },
    limitTrack: { height: 6, backgroundColor: c.border, borderRadius: 3, overflow: "hidden" },
    limitFill: { height: "100%", borderRadius: 3 },
    limitHint: { fontSize: 11, color: c.textSecondary, marginTop: 5 },
    searchBar: {
      backgroundColor: c.inputBg, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14,
      borderWidth: 1.5, borderColor: c.textMuted, fontSize: 14, color: c.text, marginBottom: 14,
    },
    card: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: c.border, flexDirection: "row",
      justifyContent: "space-between", alignItems: "flex-start",
    },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 14, fontWeight: "600", color: c.text, marginBottom: 3 },
    cardPrice: { fontSize: 12, color: c.textSecondary, marginBottom: 2 },
    cardDate: { fontSize: 11, color: c.textMuted },
    cardMonthly: { fontSize: 11, color: c.primary, marginTop: 1 },
    categoryBadge: {
      alignSelf: "flex-start", backgroundColor: c.primaryLight, borderRadius: 4,
      paddingVertical: 2, paddingHorizontal: 6, marginTop: 4,
    },
    categoryBadgeText: { fontSize: 10, color: c.primary, fontWeight: "600", textTransform: "capitalize" },
    customCategoryBadge: { backgroundColor: "#2D1B69" },
    customCategoryBadgeText: { color: "#A78BFA" },
    trialBadge: {
      alignSelf: "flex-start", backgroundColor: c.warningLight, borderRadius: 4,
      paddingVertical: 2, paddingHorizontal: 6, marginTop: 4,
    },
    trialBadgeText: { fontSize: 10, color: c.warning, fontWeight: "600" },
    actionButtons: { flexDirection: "row", gap: 8 },
    iconButton: {
      width: 36, height: 36, borderRadius: 6, backgroundColor: c.border,
      justifyContent: "center", alignItems: "center",
    },
    emptyState: { alignItems: "center", paddingVertical: 48 },
    emptyStateText: { fontSize: 14, color: c.textSecondary, textAlign: "center" },
    emptyStateTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 8, textAlign: "center" },
    emptyStateSubtext: { fontSize: 14, color: c.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 24, marginBottom: 20 },
    emptyStateButton: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingVertical: 12, paddingHorizontal: 32, marginBottom: 16,
    },
    emptyStateButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    emptyStateHint: { fontSize: 12, color: c.textMuted, textAlign: "center", paddingHorizontal: 32, lineHeight: 18 },
    countText: { fontSize: 12, color: c.textSecondary, marginBottom: 10 },
    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
    modalContent: {
      backgroundColor: c.card, borderTopLeftRadius: 16, borderTopRightRadius: 16,
      padding: 20, paddingBottom: 32,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 20 },
    input: {
      borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 12,
      paddingHorizontal: 12, marginBottom: 12, fontSize: 14, color: c.text,
      backgroundColor: c.inputBg,
    },
    label: { fontSize: 12, fontWeight: "600", color: c.text, marginBottom: 6 },
    priceHint: { fontSize: 12, color: c.primary, marginTop: -8, marginBottom: 12, marginLeft: 2 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    chip: {
      paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
      backgroundColor: c.border, borderWidth: 1, borderColor: c.border,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    trialToggle: {
      flexDirection: "row", alignItems: "center", gap: 6,
      alignSelf: "flex-start", marginBottom: 12,
    },
    chipCustomActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
    chipAdd: { backgroundColor: c.primaryLight, borderColor: c.primary },
    chipText: { fontSize: 12, color: c.text, fontWeight: "500", textTransform: "capitalize" },
    chipTextActive: { color: "#FFFFFF" },
    customCatRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" },
    customCatInput: {
      flex: 1, borderWidth: 1, borderColor: c.primary, borderRadius: 8,
      paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, color: c.text,
      backgroundColor: c.primaryLight,
    },
    customCatConfirm: {
      backgroundColor: "#7C3AED", borderRadius: 8, paddingVertical: 8,
      paddingHorizontal: 14, justifyContent: "center",
    },
    customCatConfirmText: { color: "#fff", fontSize: 13, fontWeight: "600" },
    submitButton: {
      backgroundColor: c.primary, borderRadius: 8, paddingVertical: 12,
      alignItems: "center", marginTop: 8,
    },
    submitButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
    cancelButton: {
      backgroundColor: c.border, borderRadius: 8, paddingVertical: 12,
      alignItems: "center", marginTop: 8,
    },
    cancelButtonText: { color: c.textSecondary, fontSize: 14, fontWeight: "600" },
    emailHintBanner: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: c.primaryLight, borderRadius: 10, padding: 12, marginBottom: 12,
      borderWidth: 1, borderColor: c.primary,
    },
    emailHintTitle: { fontSize: 13, fontWeight: "700", color: c.primary },
    emailHintSub: { fontSize: 11, color: c.primary, opacity: 0.8, marginTop: 1 },
    emailFillButton: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: c.primaryLight, borderRadius: 8, padding: 12, marginBottom: 14,
      borderWidth: 1, borderColor: c.primary,
    },
    emailFillButtonText: { flex: 1, fontSize: 13, fontWeight: "600", color: c.primary },
    emailPasteBox: {
      backgroundColor: c.bg, borderRadius: 8, borderWidth: 1,
      borderColor: c.primary, padding: 12, marginBottom: 14,
    },
    emailPasteLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 8, lineHeight: 17 },
    emailPasteInput: {
      fontSize: 13, color: c.text, minHeight: 100, borderWidth: 1,
      borderColor: c.border, borderRadius: 6, padding: 10, backgroundColor: c.inputBg,
    },
    parsedPreview: {
      flexDirection: "row", alignItems: "center", gap: 6,
      marginTop: 8, backgroundColor: c.success + "18",
      borderRadius: 6, padding: 8,
    },
    parsedPreviewText: { fontSize: 12, color: c.success, flex: 1, fontWeight: "600" },
    sortRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
    sortChip: {
      paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    },
    sortChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    sortChipText: { fontSize: 12, color: c.textSecondary, fontWeight: "500" },
    sortChipTextActive: { color: "#FFFFFF", fontWeight: "700" },
    swipeDeleteWrapper: { justifyContent: "center", marginBottom: 12 },
    swipeDelete: {
      backgroundColor: c.danger, justifyContent: "center", alignItems: "center",
      width: 80, borderRadius: 12, height: "100%", gap: 2,
    },
    swipeDeleteText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    examplesButton: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingVertical: 10, paddingHorizontal: 28, marginBottom: 16,
    },
    examplesButtonText: { color: c.textSecondary, fontSize: 13 },
  });
}
