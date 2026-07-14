import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  TextInput, Alert, RefreshControl, Share, ActivityIndicator, Platform, Animated, Linking,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as StoreReview from "expo-store-review";
import { useTranslation } from "react-i18next";
import apiClient from "../../lib/api";
import { useState, useMemo, useEffect, useRef } from "react";
import { useFmt, useCurrencyStore } from "../../lib/currency-store";
import { useAuthStore } from "../../lib/auth-store";
import { normaliseDateInput } from "../../lib/utils";
import { parseSubscriptionEmail } from "../../lib/parse-subscription";
import { useTheme, AppColors } from "../../lib/theme";
import { DEFAULT_CATEGORIES, guessCategory } from "../../lib/categories";
import { sendLocalNotification } from "../../lib/notifications";
import { ServiceTemplate, searchTemplates, formatTemplatePrice } from "../../lib/service-templates";
import * as SecureStore from "expo-secure-store";

const FREE_LIMIT = 5;
const BILLING_CYCLES = ["monthly", "yearly", "weekly"];

function toMonthly(price: number, cycle: string) {
  if (cycle === "weekly") return (price * 52) / 12;
  if (cycle === "yearly") return price / 12;
  return price;
}

const emptyForm = { name: "", price: "", billingCycle: "monthly", category: "other", trialEndDate: "", isFreeTrial: false };

const REVIEW_KEY = "review_renewal_state";
const REVIEW_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const REVIEW_MAX_ATTEMPTS = 3;

async function reviewEligible(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(REVIEW_KEY).catch(() => null);
  const state: { lastShown: number; count: number; happy?: boolean } = raw
    ? JSON.parse(raw)
    : { lastShown: 0, count: 0 };
  if (state.happy) return false;
  if (state.count >= REVIEW_MAX_ATTEMPTS) return false;
  if (state.lastShown && Date.now() - state.lastShown < REVIEW_COOLDOWN_MS) return false;
  return true;
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const fmtC = useFmt();
  const { currency, baseCurrencyCode, convert } = useCurrencyStore();
  const queryClient = useQueryClient();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t } = useTranslation();

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
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const savingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savingsTimer.current) clearTimeout(savingsTimer.current); }, []);

  const maybeShowReview = async (delayMs: number) => {
    if (!(await reviewEligible())) return;
    await new Promise((r) => setTimeout(r, delayMs));
    if (await reviewEligible()) setShowReviewPrompt(true);
  };

  const handleReviewHappy = async () => {
    setShowReviewPrompt(false);
    const raw = await SecureStore.getItemAsync(REVIEW_KEY).catch(() => null);
    const state = raw ? JSON.parse(raw) : { lastShown: 0, count: 0 };
    await SecureStore.setItemAsync(
      REVIEW_KEY,
      JSON.stringify({ lastShown: Date.now(), count: state.count + 1, happy: true })
    ).catch(() => {});
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
    }
  };

  const handleReviewUnhappy = async () => {
    setShowReviewPrompt(false);
    const raw = await SecureStore.getItemAsync(REVIEW_KEY).catch(() => null);
    const state = raw ? JSON.parse(raw) : { lastShown: 0, count: 0 };
    await SecureStore.setItemAsync(
      REVIEW_KEY,
      JSON.stringify({ lastShown: Date.now(), count: state.count + 1, happy: false })
    ).catch(() => {});
    Linking.openURL("mailto:Trimio@subtrimio.com?subject=Trimio%20Feedback").catch(() => {});
  };

  const handleReviewLater = async () => {
    setShowReviewPrompt(false);
    const raw = await SecureStore.getItemAsync(REVIEW_KEY).catch(() => null);
    const state = raw ? JSON.parse(raw) : { lastShown: 0, count: 0 };
    // Don't count a "maybe later" against the lifetime attempt cap, only
    // record lastShown so the cooldown still prevents asking again right away.
    await SecureStore.setItemAsync(
      REVIEW_KEY,
      JSON.stringify({ ...state, lastShown: Date.now() })
    ).catch(() => {});
  };

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 250);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  const { data: subscriptions = [], refetch } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => {
      const data = (await apiClient.get("/trpc/subscriptions.list")).data.result.data;
      // Fire a local push for any subscription whose price increased in the last 30 days.
      // We only want to notify once per change, so we key by subscription id + changedAt.
      const notifiedKey = "price_increase_notified";
      const raw = await SecureStore.getItemAsync(notifiedKey).catch(() => null);
      const seen: string[] = raw ? JSON.parse(raw) : [];
      const newSeen = [...seen];
      for (const sub of data) {
        if (!sub.priceIncrease) continue;
        const key = `${sub.id}:${sub.priceIncrease.changedAt}`;
        if (!seen.includes(key)) {
          const diff = (sub.priceIncrease.to - sub.priceIncrease.from).toFixed(2);
          sendLocalNotification(
            `${sub.name} price went up`,
            `Your subscription increased from ${fmtC(sub.priceIncrease.from)} to ${fmtC(sub.priceIncrease.to)} per ${sub.billingCycle}.`
          );
          newSeen.push(key);
        }
      }
      if (newSeen.length !== seen.length) {
        SecureStore.setItemAsync(notifiedKey, JSON.stringify(newSeen.slice(-50))).catch(() => {});
      }
      return data;
    },
  });

  useEffect(() => {
    if (from === "renewal_reminder") {
      maybeShowReview(8000);
      return;
    }
    // General fallback: once someone is tracking a meaningful number of
    // subscriptions they've had real hands-on time with the app, so it's a
    // reasonable moment to ask even if they never came from the reminder email.
    if (subscriptions.length >= 3) {
      maybeShowReview(8000);
    }
  }, [from, subscriptions.length]);

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
      return res.data.result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) =>
      (await apiClient.post("/trpc/subscriptions.create", data)).data.result.data,
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (err: any, variables: any) => {
      const code = err.response?.data?.error;
      if (code === "FREE_LIMIT_REACHED") {
        closeModal();
        router.push("/upgrade");
      } else if (code === "DUPLICATE_SUBSCRIPTION") {
        Alert.alert(
          "Duplicate subscription",
          `You already have "${err.response.data.existingName}" in your list. Add it anyway?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Add anyway", onPress: () => createMutation.mutate({ ...variables, force: true }) },
          ]
        );
      } else {
        Alert.alert("Error", code || "Could not add subscription.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) =>
      (await apiClient.post("/trpc/subscriptions.update", data)).data.result.data,
    onSuccess: () => { invalidate(); closeModal(); },
    onError: () => Alert.alert("Error", "Could not save changes. Please try again."),
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
      // Cancelling a subscription is the clearest "this app just saved me
      // money" moment there is, ask for a review right after the savings
      // toast has had a chance to be seen.
      maybeShowReview(3500);
    },
    onError: () => Alert.alert("Error", "Could not delete subscription. Please try again."),
  });

  const setActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      (await apiClient.post("/trpc/subscriptions.setActive", { id, isActive })).data.result.data,
    onSuccess: invalidate,
    onError: () => Alert.alert("Error", "Could not update subscription. Please try again."),
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
    setShowTemplatePicker(false); setTemplateSearch("");
  };

  const filteredTemplates = useMemo(() => searchTemplates(templateSearch), [templateSearch]);

  const applyTemplate = (tpl: ServiceTemplate) => {
    const guessed = guessCategory(tpl.name);
    setFormData((prev) => ({
      ...prev,
      name: tpl.name,
      price: String(tpl.defaultPrice),
      billingCycle: tpl.billingCycle,
      category: guessed !== "other" ? guessed : tpl.category,
    }));
    setShowTemplatePicker(false);
    setTemplateSearch("");
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
    if (formData.isFreeTrial && formData.trialEndDate.trim()) {
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
          { text: "Add anyway", onPress: () => submitData(price, trialEndDate, true) },
        ]
      );
      return;
    }
    submitData(price, trialEndDate);
  };

  const submitData = (price: number, trialEndDate: string | null, force = false) => {
    const data = {
      name: formData.name.trim(), price,
      billingCycle: formData.billingCycle, category: formData.category,
      trialEndDate, force,
    };
    if (editingId !== null) { updateMutation.mutate({ id: editingId, ...data }); }
    else { createMutation.mutate(data); }
  };

  const confirmDelete = (sub: any) => {
    Alert.alert(t("subscriptions.deleteTitle"), t("subscriptions.deleteConfirm", { name: sub.name }), [
      { text: t("subscriptions.cancel"), style: "cancel" },
      { text: t("subscriptions.delete"), style: "destructive", onPress: () => deleteMutation.mutate(sub) },
    ]);
  };

  const handleRateApp = async () => {
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
      return;
    }
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
        const res = await apiClient.post("/trpc/subscriptions.create", ex).catch((e: any) => e.response);
        if (res?.data?.error === "FREE_LIMIT_REACHED") break;
      }
      invalidate();
    } catch {
      Alert.alert("Error", "Could not load examples. Please try again.");
    } finally {
      setLoadingExamples(false);
    }
  };

  const exportCalendar = async () => {
    if (!isPremium) { router.push("/upgrade"); return; }
    const subsWithDates = subscriptions.filter((s: any) => s.nextBillingDate);
    if (subsWithDates.length === 0) {
      Alert.alert("No billing dates", "None of your subscriptions have billing dates yet.");
      return;
    }

    const fmtIcsDate = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
    const nextDay = (iso: string) => {
      const d = new Date(iso);
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10).replace(/-/g, "");
    };
    const icsEscape = (s: string) =>
      s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

    const events = subsWithDates.map((s: any) => [
      "BEGIN:VEVENT",
      `UID:trimio-${s.id}-${fmtIcsDate(s.nextBillingDate)}@trimio.app`,
      `DTSTART;VALUE=DATE:${fmtIcsDate(s.nextBillingDate)}`,
      `DTEND;VALUE=DATE:${nextDay(s.nextBillingDate)}`,
      `SUMMARY:${icsEscape(s.name)} billing`,
      `DESCRIPTION:${icsEscape(`${fmtC(s.price)} ${s.billingCycle}`)}`,
      "END:VEVENT",
    ].join("\r\n")).join("\r\n");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Trimio//Subscription Tracker//EN",
      "CALSCALE:GREGORIAN",
      events,
      "END:VCALENDAR",
    ].join("\r\n");

    try {
      const path = `${FileSystem.cacheDirectory}trimio-billing.ics`;
      await FileSystem.writeAsStringAsync(path, ics, { encoding: FileSystem.EncodingType.UTF8 });
      const shareUri = Platform.OS === "android" ? await FileSystem.getContentUriAsync(path) : path;
      await Share.share({ url: shareUri, title: "Trimio Calendar Export" });
    } catch {
      await Share.share({ message: ics, title: "Trimio Calendar Export" });
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
              {t("subscriptions.savedThisYear", { amount: fmtC(savingsCard.yearly), name: savingsCard.name })}
            </Text>
            <Text style={styles.savingsCardRate} onPress={handleRateApp}>
              {t("subscriptions.rateNow")} ⭐
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
              <Text style={styles.addButtonText}>{atLimit ? t("subscriptions.limitReached") : t("subscriptions.add")}</Text>
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
            <TouchableOpacity
              style={[styles.exportButton, !isPremium && styles.exportButtonLocked]}
              onPress={exportCalendar}
            >
              <MaterialCommunityIcons
                name={isPremium ? "calendar-export" : "lock"}
                size={20}
                color={isPremium ? "#FFFFFF" : c.textMuted}
              />
            </TouchableOpacity>
          </View>

          {!isPremium && (
            <View style={styles.limitBar}>
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>{t("subscriptions.freePlan")}</Text>
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
                    {t("subscriptions.upgradeUnlimited")} →
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.limitHint}>
                  {t("subscriptions.slot", { count: FREE_LIMIT - total })} ·{" "}
                  <Text style={{ color: c.primary }} onPress={() => router.push("/upgrade")}>
                    {t("subscriptions.goUnlimited")}
                  </Text>
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.emailHintBanner} onPress={openAdd}>
            <MaterialCommunityIcons name="email-fast-outline" size={18} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.emailHintTitle}>{t("subscriptions.emailHintTitle")}</Text>
              <Text style={styles.emailHintSub}>{t("subscriptions.emailHintSub")}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={c.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.searchBar}
            placeholder={t("subscriptions.search")}
            placeholderTextColor={c.placeholder}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />

          {total > 0 && (
            <View style={styles.sortRow}>
              {([ ["date", t("subscriptions.recent")], ["name", "A-Z"], ["price_desc", `${t("subscriptions.priceDesc")} ↓`] ] as ["date"|"name"|"price_desc", string][]).map(([key, label]) => (
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
              {t("subscriptions.countOf", { count: total, filtered: filtered.length, total })}
            </Text>
          )}

          {filtered.length === 0 ? (
            total === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="receipt" size={52} color={c.border} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyStateTitle}>{t("subscriptions.emptyTitle")}</Text>
                <Text style={styles.emptyStateSubtext}>{t("subscriptions.emptySubtext")}</Text>
                <TouchableOpacity style={styles.emptyStateButton} onPress={openAdd}>
                  <Text style={styles.emptyStateButtonText}>{t("subscriptions.addExpense")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.examplesButton}
                  onPress={handleLoadExamples}
                  disabled={loadingExamples}
                >
                  {loadingExamples
                    ? <ActivityIndicator color={c.primary} size="small" />
                    : <Text style={styles.examplesButtonText}>{t("subscriptions.tryExamples")}</Text>
                  }
                </TouchableOpacity>
                <Text style={styles.emptyStateHint}>{t("subscriptions.pasteEmailHint")}</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="inbox" size={48} color={c.border} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyStateText}>{t("subscriptions.noResults")}</Text>
              </View>
            )
          ) : (
            filtered.map((sub: any) => {
              const equiv = monthlyEquiv(sub.price, sub.billingCycle);
              const trialDate = sub.trialEndDate ? new Date(sub.trialEndDate) : null;
              const trialDaysLeft = trialDate
                ? Math.ceil((trialDate.getTime() - Date.now()) / 86400000)
                : null;
              const isCustomCat = !(DEFAULT_CATEGORIES as readonly string[]).includes(sub.category);
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
                <View style={[styles.card, sub.isActive === false && styles.cardPaused]}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{sub.name}</Text>
                    <Text style={styles.cardPrice}>{fmtC(sub.price)} / {sub.billingCycle}</Text>
                    {equiv && <Text style={styles.cardMonthly}>≈ {equiv}</Text>}
                    <Text style={styles.cardDate}>
                      {sub.nextBillingDate
                        ? t("subscriptions.next", { date: new Date(sub.nextBillingDate).toLocaleDateString() })
                        : t("subscriptions.noDate")}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      <View style={[styles.categoryBadge, isCustomCat && styles.customCategoryBadge]}>
                        <Text style={[styles.categoryBadgeText, isCustomCat && styles.customCategoryBadgeText]}>
                          {sub.category}
                        </Text>
                      </View>
                      {sub.isActive === false && (
                        <View style={styles.pausedBadge}>
                          <Text style={styles.pausedBadgeText}>{t("subscriptions.paused")}</Text>
                        </View>
                      )}
                      {trialDate && trialDaysLeft !== null && trialDaysLeft >= 0 && (
                        <View style={styles.trialBadge}>
                          <Text style={styles.trialBadgeText}>
                            {trialDaysLeft === 0
                              ? t("subscriptions.trialEndsSoon_today")
                              : t("subscriptions.trialEndsSoon_days", { days: trialDaysLeft })}
                          </Text>
                        </View>
                      )}
                      {sub.priceIncrease && (
                        <View style={styles.priceIncreaseBadge}>
                          <MaterialCommunityIcons name="trending-up" size={10} color="#fff" />
                          <Text style={styles.priceIncreaseBadgeText}>
                            {t("subscriptions.priceUp", { amount: fmtC(sub.priceIncrease.to - sub.priceIncrease.from) })}
                          </Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.cancelGuideLink}
                      onPress={() => router.push(`/cancel-guide?name=${encodeURIComponent(sub.name)}`)}
                    >
                      <MaterialCommunityIcons name="format-list-numbered" size={11} color={c.textMuted} />
                      <Text style={styles.cancelGuideLinkText}>{t("subscriptions.howToCancel")}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => setActiveMutation.mutate({ id: sub.id, isActive: sub.isActive === false })}
                    >
                      <MaterialCommunityIcons
                        name={sub.isActive === false ? "play-circle-outline" : "pause-circle-outline"}
                        size={18}
                        color={c.textSecondary}
                      />
                    </TouchableOpacity>
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

      <Modal visible={showReviewPrompt} animationType="fade" transparent onRequestClose={handleReviewLater}>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewEmoji}>⭐</Text>
            <Text style={styles.reviewTitle}>{t("review.title")}</Text>
            <Text style={styles.reviewSubtitle}>{t("review.subtitle")}</Text>
            <TouchableOpacity style={styles.reviewHappyButton} onPress={handleReviewHappy}>
              <Text style={styles.reviewHappyText}>❤️  {t("review.happy")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reviewUnhappyButton} onPress={handleReviewUnhappy}>
              <Text style={styles.reviewUnhappyText}>{t("review.unhappy")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReviewLater} style={{ marginTop: 12 }}>
              <Text style={styles.reviewDismissText}>{t("review.later")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingId ? t("subscriptions.editExpenseTitle") : t("subscriptions.addExpenseTitle")}
              </Text>

              {!editingId && (
                <TouchableOpacity
                  style={styles.templatePickerButton}
                  onPress={() => { setShowTemplatePicker(!showTemplatePicker); if (showTemplatePicker) setTemplateSearch(""); }}
                >
                  <MaterialCommunityIcons name="apps" size={16} color={c.primary} />
                  <Text style={styles.templatePickerButtonText}>
                    {showTemplatePicker ? t("subscriptions.hideServices") : t("subscriptions.browseServices")}
                  </Text>
                  <MaterialCommunityIcons name={showTemplatePicker ? "chevron-up" : "chevron-down"} size={16} color={c.primary} />
                </TouchableOpacity>
              )}

              {!editingId && showTemplatePicker && (
                <View style={styles.templatePickerBox}>
                  <TextInput
                    style={styles.templateSearchInput}
                    placeholder={t("subscriptions.searchServices")}
                    placeholderTextColor={c.placeholder}
                    value={templateSearch}
                    onChangeText={setTemplateSearch}
                    clearButtonMode="while-editing"
                  />
                  {!templateSearch && (
                    <Text style={styles.templateSectionLabel}>{t("subscriptions.popularServices")}</Text>
                  )}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll} contentContainerStyle={styles.templateScrollContent}>
                    {filteredTemplates.map((tpl) => (
                      <TouchableOpacity key={tpl.id} style={styles.templateChip} onPress={() => applyTemplate(tpl)}>
                        <Text style={styles.templateChipName} numberOfLines={1}>{tpl.name}</Text>
                        <Text style={styles.templateChipPrice}>{formatTemplatePrice(tpl)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {!editingId && (
                <TouchableOpacity
                  style={styles.emailFillButton}
                  onPress={() => setShowEmailPaste(!showEmailPaste)}
                >
                  <MaterialCommunityIcons name="email-fast-outline" size={16} color={c.primary} />
                  <Text style={styles.emailFillButtonText}>
                    {showEmailPaste ? t("subscriptions.hideAutoFill") : t("subscriptions.autoFillEmail")}
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
                  <Text style={styles.emailPasteLabel}>{t("subscriptions.emailPasteLabel")}</Text>
                  <TextInput
                    style={styles.emailPasteInput}
                    multiline
                    numberOfLines={5}
                    placeholder={t("subscriptions.emailPastePlaceholder")}
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
                        {t("subscriptions.detected")}{formData.name ? ` ${formData.name}` : ""}
                        {formData.price ? ` · ${baseCurrencyCode} ${formData.price}` : ""}
                        {formData.billingCycle ? ` · ${formData.billingCycle}` : ""}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder={t("subscriptions.namePlaceholder")}
                placeholderTextColor={c.placeholder}
                value={formData.name}
                onChangeText={(t) => {
                  const guessed = guessCategory(t);
                  setFormData((prev) => ({
                    ...prev,
                    name: t,
                    category: prev.category === "other" && guessed !== "other" ? guessed : prev.category,
                  }));
                }}
              />
              <TextInput
                style={styles.input}
                placeholder={t("subscriptions.pricePlaceholder", { currency: baseCurrencyCode })}
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

              <Text style={styles.label}>{t("subscriptions.billingCycle")}</Text>
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
                  {t("subscriptions.isFreeTrialLabel")}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>
                {t("subscriptions.category")}{isPremium && customCategories.length > 0 ? `  ✦ ${t("subscriptions.customCategory")}` : ""}
              </Text>
              <View style={styles.chipRow}>
                {allCategories.map((cat) => {
                  const isCustom = !(DEFAULT_CATEGORIES as readonly string[]).includes(cat);
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
                    <Text style={[styles.chipText, { color: "#7C3AED" }]}>+ {t("subscriptions.customCategory")}</Text>
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
                {formData.isFreeTrial ? t("subscriptions.trialEndsOn") : t("subscriptions.trialEndDate")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("subscriptions.datePlaceholder")}
                placeholderTextColor={c.placeholder}
                value={formData.trialEndDate}
                onChangeText={(t) => setFormData({ ...formData, trialEndDate: t })}
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isPending}>
                {isPending
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.submitButtonText}>
                      {editingId ? t("subscriptions.saveChanges") : t("subscriptions.addExpense")}
                    </Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                <Text style={styles.cancelButtonText}>{t("subscriptions.cancel")}</Text>
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
    cardPaused: { opacity: 0.6 },
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
    pausedBadge: {
      alignSelf: "flex-start", backgroundColor: c.border, borderRadius: 4,
      paddingVertical: 2, paddingHorizontal: 6, marginTop: 4,
    },
    pausedBadgeText: { fontSize: 10, color: c.textSecondary, fontWeight: "600" },
    priceIncreaseBadge: {
      alignSelf: "flex-start", backgroundColor: c.danger, borderRadius: 4,
      paddingVertical: 2, paddingHorizontal: 6, marginTop: 4,
      flexDirection: "row", alignItems: "center", gap: 3,
    },
    priceIncreaseBadgeText: { fontSize: 10, color: "#fff", fontWeight: "700" },
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
    cancelGuideLink: {
      flexDirection: "row", alignItems: "center", gap: 4,
      marginTop: 8, alignSelf: "flex-start",
    },
    cancelGuideLinkText: { fontSize: 11, color: c.textMuted, fontWeight: "500" },
    reviewOverlay: {
      flex: 1, backgroundColor: c.overlay,
      justifyContent: "center", alignItems: "center", padding: 32,
    },
    reviewCard: {
      backgroundColor: c.card, borderRadius: 20, padding: 28,
      alignItems: "center", width: "100%",
      shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 }, elevation: 10,
      borderWidth: 1, borderColor: c.border,
    },
    reviewEmoji: { fontSize: 40, marginBottom: 12 },
    reviewTitle: {
      fontSize: 20, fontWeight: "700", color: c.text,
      textAlign: "center", marginBottom: 8,
    },
    reviewSubtitle: {
      fontSize: 14, color: c.textSecondary, textAlign: "center",
      lineHeight: 20, marginBottom: 24,
    },
    reviewHappyButton: {
      width: "100%", backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 14, alignItems: "center", marginBottom: 10,
    },
    reviewHappyText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    reviewUnhappyButton: {
      width: "100%", backgroundColor: c.card, borderRadius: 12,
      paddingVertical: 14, alignItems: "center",
      borderWidth: 1, borderColor: c.border,
    },
    reviewUnhappyText: { color: c.textSecondary, fontSize: 14, fontWeight: "600" },
    reviewDismissText: { fontSize: 13, color: c.textMuted },
    templatePickerButton: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: c.primaryLight, borderRadius: 8, padding: 12, marginBottom: 14,
      borderWidth: 1, borderColor: c.primary,
    },
    templatePickerButtonText: { flex: 1, fontSize: 13, fontWeight: "600", color: c.primary },
    templatePickerBox: {
      backgroundColor: c.bg, borderRadius: 8, borderWidth: 1,
      borderColor: c.primary, padding: 12, marginBottom: 14,
    },
    templateSearchInput: {
      borderWidth: 1, borderColor: c.border, borderRadius: 8,
      paddingVertical: 8, paddingHorizontal: 12, fontSize: 13,
      color: c.text, backgroundColor: c.inputBg, marginBottom: 10,
    },
    templateSectionLabel: {
      fontSize: 11, fontWeight: "700", color: c.textMuted, textTransform: "uppercase",
      letterSpacing: 0.5, marginBottom: 8,
    },
    templateScroll: { flexGrow: 0 },
    templateScrollContent: { gap: 8, paddingBottom: 4 },
    templateChip: {
      backgroundColor: c.card, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
      borderWidth: 1, borderColor: c.border, minWidth: 100, maxWidth: 150,
    },
    templateChipName: { fontSize: 12, fontWeight: "600", color: c.text, marginBottom: 2 },
    templateChipPrice: { fontSize: 11, color: c.primary, fontWeight: "500" },
  });
}
