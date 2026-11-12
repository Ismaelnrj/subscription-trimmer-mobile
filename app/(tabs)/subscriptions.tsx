import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Switch,
  TextInput, Alert, RefreshControl, Share, ActivityIndicator, Platform, Animated, Linking,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";
import { useTranslation } from "react-i18next";
import { OfflineNotice } from "../../components/OfflineNotice";
import apiClient from "../../lib/api";
import { fetchSubscriptionList } from "../../lib/subscription-list";
import { addPending, removePending, retryPending, newClientRef, isPendingRow } from "../../lib/pending-subscriptions";
import { rescheduleRemindersFromCache } from "../../lib/reminders-from-cache";
import { isTransientFailure } from "../../lib/session-errors";
import { PendingNotice } from "../../components/PendingNotice";
import { useState, useMemo, useEffect, useRef } from "react";
import { useFmt, useCurrencyStore } from "../../lib/currency-store";
import { useCycleLabel, useCycleAdjective } from "../../lib/cycle-label";
import { useCategoryLabel } from "../../lib/category-label";
import { formatMoney } from "../../lib/currencies";
import { useAuthStore } from "../../lib/auth-store";
import { useLanguageStore } from "../../lib/language-store";
import { normaliseDateInput, sanitiseAmountInput, amountForDisplay, daysUntil, parseApiDate } from "../../lib/utils";
import { parseSubscriptionEmail } from "../../lib/parse-subscription";
import { useTheme, AppColors, space, radius, type as typeScale, tabular } from "../../lib/theme";
import { useDateFormat } from "../../lib/date-locale";
import { DEFAULT_CATEGORIES, guessCategory } from "../../lib/categories";
import { sendLocalNotification } from "../../lib/notifications";
import { track } from "../../lib/analytics";
import { ServiceTemplate, SERVICE_TEMPLATES, searchTemplates, formatTemplatePrice, getRegionalPopularTemplates, findTemplateByExactName, prefersDachCatalogue } from "../../lib/service-templates";
import { SkeletonCard } from "../../components/SkeletonCard";
import { LogoImage } from "../../components/LogoImage";
import { marksFirst } from "../../lib/brand-marks";
import { ReminderPrimer } from "../../components/ReminderPrimer";
import { shouldOfferReminderPrimer, rememberPrimerDeclined, acceptReminderPrimer } from "../../lib/reminder-primer";
import * as SecureStore from "expo-secure-store";

/* THE FALLBACK ONLY, NOT THE SOURCE. The server owns this number and sends it
   on settings.get; this is what the meter reads for the one render before that
   query resolves, and if it never resolves.
   IT USED TO BE THE SOURCE, and CLAUDE.md claimed the opposite, that the cap
   lived server side and was not duplicated here. It was duplicated here, in six
   places, so raising the limit in Railway would have moved the server's gate
   while every phone went on drawing "5 / 5, limit reached". A configurable limit
   with a stale client copy is worse than a constant, because the two disagree
   and only one of them is visible.
   KEEP IT EQUAL TO THE SERVER'S OWN DEFAULT. A test asserts they match, since a
   fallback that differs from the default silently changes behaviour for exactly
   the users whose settings query failed. */
const FREE_LIMIT_FALLBACK = 5;
const BILLING_CYCLES = ["monthly", "yearly", "weekly"];

function toMonthly(price: number, cycle: string) {
  if (cycle === "weekly") return (price * 52) / 12;
  if (cycle === "yearly") return price / 12;
  return price;
}

const emptyForm = { name: "", price: "", billingCycle: "monthly", category: "other", nextBillingDate: "", trialEndDate: "", isFreeTrial: false };

// v2: bumped to invalidate stale "happy" flags set while the star tap
// silently no-op'd (before it reliably opened the Play Store), which had
// permanently locked users out of ever seeing this prompt again.
const REVIEW_KEY = "review_renewal_state_v2";
const REVIEW_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const REVIEW_MAX_ATTEMPTS = 3;

type ReviewState = { lastShown: number; count: number; happy?: boolean };

/* A corrupt stored value must not throw out of a tap handler. */
function readReviewState(raw: string | null): ReviewState {
  try {
    const s = raw ? JSON.parse(raw) : null;
    if (s && typeof s === "object" && typeof s.count === "number") return s;
  } catch {
    // Fall through to a fresh state.
  }
  return { lastShown: 0, count: 0 };
}

async function reviewEligible(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(REVIEW_KEY).catch(() => null);
  const state = readReviewState(raw);
  if (state.happy) return false;
  if (state.count >= REVIEW_MAX_ATTEMPTS) return false;
  if (state.lastShown && Date.now() - state.lastShown < REVIEW_COOLDOWN_MS) return false;
  return true;
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { from, editId, templateId } = useLocalSearchParams<{ from?: string; editId?: string; templateId?: string }>();
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const isPremium = user?.isPaid ?? false;
  const fmtC = useFmt();
  const cycleLabel = useCycleLabel();
  const cycleAdjective = useCycleAdjective();
  const categoryLabel = useCategoryLabel();
  const { currency, baseCurrencyCode, convert } = useCurrencyStore();
  const queryClient = useQueryClient();
  const c = useTheme();
  const styles = makeStyles(c);
  const { t, i18n } = useTranslation();
  const fmtD = useDateFormat();

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
  // The one row whose actions are open, so the list stays a list of rows.
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [emailText, setEmailText] = useState("");
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [removedCard, setRemovedCard] = useState<{ name: string; yearly: number; currency?: string } | null>(null);
  const [currencyNotice, setCurrencyNotice] = useState<{ receipt: string; account: string } | null>(null);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [primerName, setPrimerName] = useState<string | null>(null);

  const removedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewDeadline = useRef(0);
  useEffect(() => () => {
    if (removedTimer.current) clearTimeout(removedTimer.current);
    if (reviewTimer.current) clearTimeout(reviewTimer.current);
  }, []);

  // Only ever one pending request, and the latest deadline wins.
  //
  // Marking a subscription cancelled asks for the prompt at 5.5s so the savings toast
  // (which clears at 5s) is read first, but cancelling also changes the list
  // length, which re-runs the effect below and asks again at 4s. Racing them
  // meant the shorter one won and the prompt covered the toast it was
  // deliberately scheduled to follow.
  const maybeShowReview = async (delayMs: number) => {
    if (!(await reviewEligible())) return;
    const deadline = Date.now() + delayMs;
    if (reviewTimer.current && deadline <= reviewDeadline.current) return;
    if (reviewTimer.current) clearTimeout(reviewTimer.current);
    reviewDeadline.current = deadline;
    reviewTimer.current = setTimeout(async () => {
      reviewTimer.current = null;
      if (await reviewEligible()) setShowReviewPrompt(true);
    }, delayMs);
  };

  const handleStarTap = async () => {
    setShowReviewPrompt(false);
    const raw = await SecureStore.getItemAsync(REVIEW_KEY).catch(() => null);
    const state = readReviewState(raw);
    await SecureStore.setItemAsync(
      REVIEW_KEY,
      JSON.stringify({ lastShown: Date.now(), count: state.count + 1, happy: true })
    ).catch(() => {});
    await handleRateApp();
  };

  const handleReviewLater = async () => {
    setShowReviewPrompt(false);
    const raw = await SecureStore.getItemAsync(REVIEW_KEY).catch(() => null);
    const state = readReviewState(raw);
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

  const {
    data: subscriptions = [],
    refetch,
    isLoading: subscriptionsLoading,
    // Without this a failed request fell through to the empty state, so
    // someone on a dropped connection was told they had no subscriptions and
    // invited to load examples, which is the opposite of reassuring on the
    // screen that holds their money. Calendar already had this branch.
    // isLoadingError rather than isError: a failed REFETCH keeps the list it
    // had, the saved offline copy included, and the list should stay.
    isLoadingError: subscriptionsError,
    isRefetchError: subscriptionsStale,
  } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => {
      const data = await fetchSubscriptionList();
      // Fire a local push for any subscription whose price increased in the last 30 days.
      // We only want to notify once per change, so we key by subscription id + changedAt.
      /* Everything below is a side effect of the LIST fetch, so none of it may
         be able to fail the list. A corrupt stored value used to throw out of
         JSON.parse here, and the subscriptions screen then showed its load
         error on every open, for good, with nothing wrong on the server. */
      const notifiedKey = "price_increase_notified";
      const raw = await SecureStore.getItemAsync(notifiedKey).catch(() => null);
      let seen: string[] = [];
      try {
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) seen = parsed.filter((x) => typeof x === "string");
      } catch {
        // Start over: at worst one price change is announced a second time.
      }
      /* The push switch applies here too. This notification ignored it, so
         somebody who had turned push notifications OFF still got one. Not
         loaded yet means wait, and nothing is marked seen, so the next fetch
         with preferences in hand decides. Off means mark it seen and stay
         quiet. Same rule as the reminder scheduler's callers. */
      const prefs: any = queryClient.getQueryData(["notifications", "preferences"]);
      if (!prefs) return data;
      const pushOn = prefs.pushEnabled !== false;
      const newSeen = [...seen];
      for (const sub of data) {
        if (!sub.priceIncrease) continue;
        const key = `${sub.id}:${sub.priceIncrease.changedAt}`;
        if (!seen.includes(key)) {
          if (pushOn) {
            sendLocalNotification(
              t("notifications.priceUpTitle", { name: sub.name }),
              t("notifications.priceUpBody", {
                from: fmtC(sub.priceIncrease.from, sub.currency),
                to: fmtC(sub.priceIncrease.to, sub.currency),
                cycle: cycleLabel(sub.billingCycle),
              })
            ).catch(() => {});
          }
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
      maybeShowReview(4000);
      return;
    }
    // General fallback: once someone is tracking a meaningful number of
    // subscriptions they've had real hands-on time with the app, so it's a
    // reasonable moment to ask even if they never came from the reminder email.
    if (subscriptions.length >= 3) {
      maybeShowReview(4000);
    }
  }, [from, subscriptions.length]);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await apiClient.get("/trpc/settings.get")).data.result.data,
  });

  const customCategories: string[] = settings?.customCategories ?? [];
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const total = subscriptions.length;
  /* Number(...) rather than `?? FREE_LIMIT_FALLBACK` alone: the fallback has to
     catch a value that is present but unusable, not only an absent one. `?? `
     passes 0 and NaN straight through, and a limit of 0 locks the add button
     for everybody while a NaN makes every comparison false and removes the gate
     entirely. That is the `?? 1` lesson from the exchange rates, in a place
     where one direction hides the button and the other hides the paywall. */
  const serverLimit = Number(settings?.freeSubscriptionLimit);
  const freeLimit = Number.isFinite(serverLimit) && serverLimit >= 1 ? serverLimit : FREE_LIMIT_FALLBACK;
  const atLimit = !isPremium && total >= freeLimit;
  const limitPct = isPremium ? 0 : Math.min((total / freeLimit) * 100, 100);
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

  /* Sends ONLY the categories, which is the whole point of this mutation.

     It used to resend budgetGoal, currency and currencySymbol as well, each
     falling back to a hardcoded default when `settings` had not loaded. Saving
     a custom category before that first query resolved therefore cleared the
     person's budget goal AND reset a euro subscriber to USD, which also changes
     what every stored price is interpreted as. Nothing errored: the write
     succeeded, it just wrote the defaults.

     settings.update now preserves any field whose key is absent, so omitting
     them is how you leave them alone. */
  const settingsMutation = useMutation({
    mutationFn: async (cats: string[]) => {
      const res = await apiClient.post("/trpc/settings.update", { customCategories: cats });
      return res.data.result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) =>
      (await apiClient.post("/trpc/subscriptions.create", data)).data.result.data,
    onSuccess: (data: any) => {
      // Never send the subscription name or price -- just enough to see the
      // activation funnel, not what someone is personally paying for.
      track("subscription_added", {
        billing_cycle: data?.billingCycle,
        category: data?.category,
        is_first_subscription: (subscriptions?.length ?? 0) === 0,
      });
      invalidate();
      closeModal();
      // The moment a reminder has an obvious meaning, so the moment to ask.
      const addedName = typeof data?.name === "string" ? data.name : "";
      shouldOfferReminderPrimer().then((offer) => { if (offer) setPrimerName(addedName); });
    },
    onError: (err: any, variables: any) => {
      /* NO CONNECTION IS NOT A REFUSAL. The entry is kept on this phone and
         sent when the connection is back (lib/pending-subscriptions.ts), so it
         shows in the list, the calendar and the free limit count at once, and
         gets its reminder now. The clientRef it already carries is what stops
         the later send adding it twice if this request did reach the server. */
      if (isTransientFailure(err) && user?.id != null && variables?.clientRef) {
        addPending(user.id, variables);
        closeModal();
        rescheduleRemindersFromCache();
        Alert.alert(t("subscriptions.savedOfflineTitle"), t("subscriptions.savedOfflineBody", { name: variables.name }));
        return;
      }
      const code = err.response?.data?.error;
      if (code === "FREE_LIMIT_REACHED") {
        closeModal();
        router.push("/upgrade");
      } else if (code === "DUPLICATE_SUBSCRIPTION") {
        Alert.alert(
          t("subscriptions.duplicateTitle"),
          t("subscriptions.duplicateMsg", { name: err.response.data.existingName }),
          [
            { text: t("subscriptions.cancel"), style: "cancel" },
            { text: t("subscriptions.addAnyway"), onPress: () => createMutation.mutate({ ...variables, force: true }) },
          ]
        );
      } else {
        Alert.alert(t("common.error"), code || t("subscriptions.errAddSub"));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) =>
      (await apiClient.post("/trpc/subscriptions.update", data)).data.result.data,
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (err: any) => Alert.alert(t("common.error"), isTransientFailure(err) ? t("subscriptions.noConnection") : t("subscriptions.errSaveChanges")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (sub: any) =>
      (await apiClient.post("/trpc/subscriptions.delete", { id: sub.id })).data.result.data,
    /* Deleting is quiet on purpose. It is how somebody removes a row they added
       by mistake, so "you saved X a year" there congratulates them on money that
       was never being spent. The savings toast belongs to "I cancelled it". */
    onSuccess: invalidate,
    onError: (err: any) => Alert.alert(t("common.error"), isTransientFailure(err) ? t("subscriptions.noConnection") : t("subscriptions.errDeleteSub")),
  });

  const setActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      (await apiClient.post("/trpc/subscriptions.setActive", { id, isActive })).data.result.data,
    onSuccess: invalidate,
    onError: (err: any) => Alert.alert(t("common.error"), isTransientFailure(err) ? t("subscriptions.noConnection") : t("subscriptions.errUpdateSub")),
  });

  /* Marking something cancelled is NOT deleting it. The row leaves every total
     and gives its free tier slot back, and it stays as history so the app can
     say what stopping was worth. */
  const setCancelledMutation = useMutation({
    mutationFn: async (sub: any) =>
      (await apiClient.post("/trpc/subscriptions.setCancelled", { id: sub.id, cancelled: true })).data.result.data,
    onSuccess: (_data, sub) => {
      invalidate();
      // A row shows its own currency, so the yearly figure carries it too.
      const yearly = toMonthly(parseFloat(sub.price), sub.billingCycle) * 12;
      setRemovedCard({ name: sub.name, yearly, currency: sub.currency });
      if (removedTimer.current) clearTimeout(removedTimer.current);
      // Long enough to read the savings and tap the invite link before it goes away.
      removedTimer.current = setTimeout(() => setRemovedCard(null), 5000);
      // Cancelling a subscription is the clearest "this app just saved me
      // money" moment there is, ask for a review right after the savings
      // toast has had a chance to be seen.
      maybeShowReview(5500);
      /* The cancelled list is a separate query, so invalidating the main list
         alone would leave the new entry missing until a cold start. */
      queryClient.invalidateQueries({ queryKey: ["cancelledSubscriptions"] });
    },
    onError: (err: any) => Alert.alert(t("common.error"), isTransientFailure(err) ? t("subscriptions.noConnection") : t("subscriptions.errUpdateSub")),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openAdd = () => {
    if (atLimit) { router.push("/upgrade"); return; }
    setEditingId(null); setFormData(emptyForm);
    setShowCustomInput(false); setCustomCatDraft(""); setShowAdvanced(false);
    setShowModal(true);
  };
  // The add form with the email box already open, as the dashboard's tile does.
  const openPaste = () => {
    if (atLimit) { router.push("/upgrade"); return; }
    openAdd();
    setShowEmailPaste(true);
  };

  /* Three ways in from elsewhere, all opening the add form: "fab" plain,
     "template" prefilled from a catalogue row (the first-run tiles on the
     dashboard), and "paste" with the email box already open. */
  useEffect(() => {
    if (!from || subscriptionsLoading) return;
    if (from !== "fab" && from !== "template" && from !== "paste") return;
    openAdd();
    if (from === "template") {
      const tpl = SERVICE_TEMPLATES.find((x) => x.id === templateId);
      if (tpl) applyTemplate(tpl);
    } else if (from === "paste") {
      setShowEmailPaste(true);
    }
    // Clear the params once consumed so the next tap (which sets the same
    // value again) is seen as a fresh change and re-triggers this effect.
    router.setParams({ from: undefined, templateId: undefined });
  }, [from, templateId, subscriptionsLoading]);

  const openEdit = (sub: any) => {
    setEditingId(sub.id);
    setFormData({
      name: sub.name, price: String(sub.price), billingCycle: sub.billingCycle,
      category: sub.category,
      nextBillingDate: sub.nextBillingDate ? sub.nextBillingDate.slice(0, 10) : "",
      trialEndDate: sub.trialEndDate ? sub.trialEndDate.slice(0, 10) : "",
      isFreeTrial: !!sub.trialEndDate,
    });
    setShowCustomInput(false); setCustomCatDraft(""); setShowAdvanced(false);
    setShowModal(true);
  };

  useEffect(() => {
    if (!editId || subscriptionsLoading) return;
    const sub = subscriptions.find((s: any) => String(s.id) === editId);
    if (sub) openEdit(sub);
    // Clear the param once consumed, same reason as the FAB's "from" param.
    router.setParams({ editId: undefined });
  }, [editId, subscriptionsLoading, subscriptions]);

  const closeModal = () => {
    setShowModal(false); setEditingId(null); setFormData(emptyForm);
    setShowCustomInput(false); setCustomCatDraft("");
    setShowEmailPaste(false); setEmailText("");
    setShowTemplatePicker(false); setTemplateSearch("");
  };

  /* Which regional price applies, decided by the currency first.

     This keyed off the display language alone, which is wrong: plenty of
     people in Austria and Germany run their phone in English while paying in
     euros, and they were served the US catalogue. Because base and display
     currency are now the same, nothing converted it either, so a dollar figure
     was simply relabelled. Disney+ came out at 13.99 euros against a real
     Austrian price of 8.99.

     The currency is an explicit statement about money, which is what is
     actually being chosen here, so it decides. Language stays as a fallback
     for anyone still on the USD default. */
  const preferDach = prefersDachCatalogue(currency.code, language);
  const filteredTemplates = useMemo(
    () => searchTemplates(templateSearch, preferDach),
    [templateSearch, preferDach]
  );
  const quickPickTemplates = useMemo(
    () => marksFirst(getRegionalPopularTemplates(preferDach)).slice(0, 6),
    [preferDach]
  );

  /* THE PRICE IS ONLY FILLED IN WHEN IT IS IN THE CURRENCY IT WILL BE SAVED IN.
     submitData sends `currency: baseCurrencyCode` with whatever number is in
     the field, so a catalogue row in another currency used to be relabelled
     rather than converted: a Swiss or British user tapping Netflix saved 15.99
     as francs or pounds. Regional pricing is not arithmetic, so converting would
     invent a figure too. Leaving the field empty asks for the one number only
     the user knows. Name, cycle and category still fill, which is most of the
     typing. */
  const applyTemplate = (tpl: ServiceTemplate) => {
    const guessed = guessCategory(tpl.name);
    setFormData((prev) => ({
      ...prev,
      name: tpl.name,
      price: tpl.currency === baseCurrencyCode ? String(tpl.defaultPrice) : "",
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
      Alert.alert(t("common.error"), t("subscriptions.errNamePrice"));
      return;
    }
    if (isNaN(price) || price <= 0) {
      Alert.alert(t("common.error"), t("subscriptions.errPricePositive"));
      return;
    }
    if (price > 99999) {
      Alert.alert(t("common.error"), t("subscriptions.errPriceTooHigh"));
      return;
    }

    let trialEndDate: string | null = null;
    if (formData.isFreeTrial && !formData.trialEndDate.trim()) {
      Alert.alert(t("subscriptions.errTrialDateTitle"), t("subscriptions.errTrialDateBody"));
      return;
    }
    if (formData.isFreeTrial && formData.trialEndDate.trim()) {
      trialEndDate = normaliseDateInput(formData.trialEndDate);
      if (!trialEndDate) {
        Alert.alert(t("subscriptions.errInvalidDateTitle"), t("subscriptions.errTrialFormat"));
        return;
      }
    }

    let nextBillingDate: string | null = null;
    if (formData.nextBillingDate.trim()) {
      nextBillingDate = normaliseDateInput(formData.nextBillingDate);
      if (!nextBillingDate) {
        Alert.alert(t("subscriptions.errInvalidDateTitle"), t("subscriptions.errBillingFormat"));
        return;
      }
    }

    const duplicate = subscriptions?.find(
      (s: any) => s.name.trim().toLowerCase() === formData.name.trim().toLowerCase() && s.id !== editingId
    );
    if (duplicate) {
      Alert.alert(
        t("subscriptions.duplicateTitle"),
        t("subscriptions.duplicateMsg", { name: duplicate.name }),
        [
          { text: t("subscriptions.cancel"), style: "cancel" },
          { text: t("subscriptions.addAnyway"), onPress: () => submitData(price, trialEndDate, nextBillingDate, true) },
        ]
      );
      return;
    }
    submitData(price, trialEndDate, nextBillingDate);
  };

  const submitData = (price: number, trialEndDate: string | null, nextBillingDate: string | null, force = false) => {
    /* THE CURRENCY THE PRICE WAS TYPED IN, sent so the server can record it on
       the row. Without it `price` is a number with no unit, and the only thing
       describing it was ONE global baseCurrencyCode in SecureStore that
       follows whatever currency was last picked. Measured against the real
       store: a 15.99 EUR subscription reads as 15.99 USD after a switch, where
       the true conversion is 17.38, and two rows entered in different
       currencies cannot both be right.
       The SERVER decides what to do with it: it only moves an existing row's
       currency when the price actually changed, so editing a name cannot
       relabel a euro price as dollars. */
    const data = {
      name: formData.name.trim(), price, nextBillingDate: nextBillingDate || undefined,
      billingCycle: formData.billingCycle, category: formData.category,
      trialEndDate, force, currency: baseCurrencyCode,
    };
    if (editingId !== null) { updateMutation.mutate({ id: editingId, ...data }); }
    // One ref per submission: it is what lets the server recognise a retry of
    // this same entry, whether that is the offline queue or "Add anyway".
    else { createMutation.mutate({ ...data, clientRef: newClientRef() }); }
  };

  /* THE MOMENT SOMEBODY REACHES FOR DELETE IS USUALLY THE MOMENT THEY CANCELLED
     THE SERVICE, and until now the only thing on offer threw the row away, and
     with it any record of what they had been paying. So this asks which of the
     two actually happened instead of assuming the destructive one.
     It is deliberately NOT a fourth icon on the card. That row already carries
     three unlabelled icon buttons, one of which destroys data, and adding a
     fourth makes a known accessibility problem worse. Both entry points, the
     trash icon and the swipe, already route here, so one dialog covers both.
     ORDER IS DELIBERATE ON ANDROID, where a three button Alert maps the array to
     neutral, negative, positive in order. Keeping is LAST so it lands in the
     positive slot: the non destructive answer should be the easy one to hit. */
  /* A ROW STILL WAITING TO BE SAVED has no server id yet, so nothing that
     talks to the server about a row (edit, pause, cancel, delete) applies to
     it. Removing it is local, and the only other thing to say is where it
     stands: waiting for a connection, or refused, with the reason. */
  const showPending = (sub: any) => {
    const remove = { text: t("subscriptions.pendingRemove"), style: "destructive" as const, onPress: () => { removePending(sub.clientRef); rescheduleRemindersFromCache(); } };
    const r = sub.refusal;
    if (!r) {
      Alert.alert(t("subscriptions.pendingTitle"), t("subscriptions.pendingBody", { name: sub.name }), [
        remove,
        { text: t("common.tryAgain"), onPress: () => retryPending(sub.clientRef) },
        { text: t("common.close"), style: "cancel" },
      ]);
    } else if (r.code === "DUPLICATE_SUBSCRIPTION") {
      Alert.alert(t("subscriptions.duplicateTitle"), t("subscriptions.duplicateMsg", { name: r.existingName ?? sub.name }), [
        remove,
        { text: t("subscriptions.addAnyway"), onPress: () => retryPending(sub.clientRef, { force: true }) },
      ]);
    } else if (r.code === "FREE_LIMIT_REACHED") {
      Alert.alert(t("subscriptions.refusedTitle", { name: sub.name }), t("subscriptions.refusedLimit", { limit: r.limit ?? freeLimit }), [
        remove,
        { text: t("common.upgrade"), onPress: () => router.push("/upgrade") },
      ]);
    } else {
      Alert.alert(t("subscriptions.refusedTitle", { name: sub.name }), t("subscriptions.refusedOther", { reason: r.code }), [
        remove,
        { text: t("common.tryAgain"), onPress: () => retryPending(sub.clientRef) },
      ]);
    }
  };

  const confirmDelete = (sub: any) => {
    if (isPendingRow(sub)) { showPending(sub); return; }
    Alert.alert(t("subscriptions.removeTitle"), t("subscriptions.removeConfirm", { name: sub.name }), [
      { text: t("subscriptions.cancel"), style: "cancel" },
      { text: t("subscriptions.deleteForever"), style: "destructive", onPress: () => deleteMutation.mutate(sub) },
      { text: t("subscriptions.iCancelledIt"), onPress: () => setCancelledMutation.mutate(sub) },
    ]);
  };

  const handleRateApp = async () => {
    // Android's native in-app review dialog silently no-ops once Google's
    // per-app quota is hit, with no way to detect it — so we go straight to
    // the Play Store listing instead, which reliably does something every tap.
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
    /* THESE COME FROM THE CATALOGUE NOW, looked up at the user's own currency.
       They used to be three hardcoded rows tagged USD, and that was wrong two
       ways at once.
       The currency: this is the EMPTY STATE button, so for any non-USD user it
       made their very first screen a mix of USD rows against a EUR base, and
       every total on it an unlabelled sum of two currencies. The default first
       run of the app demonstrated the one error the currency column exists to
       prevent.
       And the prices: the old comment claimed "these three prices are the US
       figures". 15.99 is the DACH Netflix price. The US price is 19.99, and the
       catalogue says Spotify Premium is 12.99 rather than 9.99, so two of the
       three were stale as well as mislabelled.
       findTemplateByExactName already answers "which regional row" by currency,
       which is exactly this question, and every row named here carries a
       verified date. The hardcoded values remain as a fallback so a renamed
       template degrades to the old behaviour instead of loading nothing. */
    const seeds: Array<{ template: string; fallback: { name: string; price: number; billingCycle: string; category: string; currency: string } }> = [
      { template: "Netflix Standard", fallback: { name: "Netflix", price: 19.99, billingCycle: "monthly", category: "entertainment", currency: "USD" } },
      { template: "Spotify Premium",  fallback: { name: "Spotify", price: 12.99, billingCycle: "monthly", category: "entertainment", currency: "USD" } },
      { template: "iCloud+ 200GB",    fallback: { name: "iCloud+", price: 2.99, billingCycle: "monthly", category: "software", currency: "USD" } },
    ];
    const examples = seeds.map(({ template, fallback }) => {
      const t = findTemplateByExactName(template, baseCurrencyCode);
      return t
        ? { name: t.name, price: t.defaultPrice, billingCycle: t.billingCycle, category: t.category, trialEndDate: null, currency: t.currency }
        : { ...fallback, trialEndDate: null };
    });
    try {
      for (const ex of examples) {
        const res = await apiClient.post("/trpc/subscriptions.create", ex).catch((e: any) => e.response);
        if (res?.data?.error === "FREE_LIMIT_REACHED") break;
      }
      invalidate();
    } catch {
      Alert.alert(t("common.error"), t("subscriptions.errLoadExamples"));
    } finally {
      setLoadingExamples(false);
    }
  };

  const exportCalendar = async () => {
    if (!isPremium) { router.push("/upgrade"); return; }
    const subsWithDates = subscriptions.filter((s: any) => s.nextBillingDate);
    if (subsWithDates.length === 0) {
      Alert.alert(t("subscriptions.noBillingDatesTitle"), t("subscriptions.noBillingDatesBody"));
      return;
    }

    const fmtIcsDate = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
    /* DTEND for a VALUE=DATE event is EXCLUSIVE, so it must be strictly after
       DTSTART or the event is invalid per RFC 5545 and calendars drop it.

       This used to be `new Date(iso)` then `setDate(getDate() + 1)`, which is
       LOCAL arithmetic on an instant stored at midnight UTC. That lands on the
       right day 364 times a year and fails on the one day the local clock
       springs forward: the local day is 23 hours long, so the instant advances
       23 hours, back to 23:00 of the SAME UTC day, and DTEND comes out equal to
       DTSTART. Measured: Vienna 2026-03-29, New York and Los Angeles
       2026-03-08 all produced DTEND == DTSTART.

       Reading the YYYY-MM-DD digits and stepping them in UTC is offset-proof
       for the same reason parseApiDate is: those digits ARE the day, and no
       reader's timezone or DST rule can change what they say. */
    const nextDay = (iso: string) => {
      const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "");
    };
    const icsEscape = (s: string) =>
      s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

    const events = subsWithDates.map((s: any) => [
      "BEGIN:VEVENT",
      `UID:trimio-${s.id}-${fmtIcsDate(s.nextBillingDate)}@trimio.app`,
      `DTSTART;VALUE=DATE:${fmtIcsDate(s.nextBillingDate)}`,
      `DTEND;VALUE=DATE:${nextDay(s.nextBillingDate)}`,
      `SUMMARY:${icsEscape(s.name)} billing`,
      `DESCRIPTION:${icsEscape(`${fmtC(s.price, s.currency)} ${s.billingCycle}`)}`,
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
    if (subscriptions.length === 0) { Alert.alert(t("subscriptions.noDataTitle"), t("subscriptions.noDataBody")); return; }

    /* PAUSED SUBSCRIPTIONS ARE EXCLUDED FROM THE TOTAL, because the rest of the
       app excludes them. The dashboard reads analytics.summary, whose query
       filters is_active = TRUE, while this reduced over every row in
       subscriptions.list, which does not filter. So pausing Netflix left the
       dashboard saying one monthly total and this export saying another, for the
       same data on the same day, with nothing to explain the gap.

       The paused rows are still EXPORTED, since a record of what you have is
       the point of an export, and a Status column now says which is which.
       Including them in the sum is what was wrong, not listing them. */
    const activeSubs = subscriptions.filter((s: any) => s.isActive !== false);
    /* TOTALS PER CURRENCY, because a row keeps the currency it was entered in
       and adding 15.99 EUR to 9.99 USD gives a number that is neither. The
       export used to print one Monthly Total over raw prices, so any mixed list
       produced a figure no statement would ever show, in a file people keep.
       A row with no currency is in the base currency, the same reading the rest
       of the app gives it. */
    const rowCurrency = (s: any) => s.currency || baseCurrencyCode;
    const monthlyByCurrency = new Map<string, number>();
    for (const s of activeSubs) {
      const code = rowCurrency(s);
      monthlyByCurrency.set(code, (monthlyByCurrency.get(code) ?? 0) + toMonthly(s.price, s.billingCycle));
    }
    const csvEscape = (v: string) => {
      let str = String(v);
      if (/^[=+\-@]/.test(str)) str = `'${str}`; // prevent formula injection in Excel/Sheets
      return `"${str.replace(/"/g, '""')}"`;
    };
    /* toISOString() THROWS a RangeError on an invalid date, and this was guarded
       for truthiness only. One malformed date anywhere in the list crashed the
       whole export rather than blanking one cell. */
    const isoDay = (v: any) => {
      if (!v) return "";
      const ms = new Date(v).getTime();
      return Number.isFinite(ms) ? new Date(ms).toISOString().split("T")[0] : "";
    };

    const rows = [
      ["Name", "Price", "Currency", "Billing Cycle", "Monthly Equivalent", "Category", "Next Billing Date", "Trial End Date", "Yearly Cost", "Status"].join(","),
      ...subscriptions.map((s: any) => [
        csvEscape(s.name),
        s.price.toFixed(2),
        csvEscape(rowCurrency(s)),
        csvEscape(s.billingCycle),
        toMonthly(s.price, s.billingCycle).toFixed(2),
        csvEscape(s.category),
        isoDay(s.nextBillingDate),
        isoDay(s.trialEndDate),
        (toMonthly(s.price, s.billingCycle) * 12).toFixed(2),
        s.isActive === false ? "paused" : "active",
      ].join(",")),
      "",
      `# Summary`,
      // Both totals are active-only, so they match what the app shows. Naming
      // the counts separately is what makes the difference explicable to
      // somebody reading the file a month later.
      ...[...monthlyByCurrency].flatMap(([code, monthly]) => [
        `# Monthly Total (active ${code}),${monthly.toFixed(2)}`,
        `# Yearly Total (active ${code}),${(monthly * 12).toFixed(2)}`,
      ]),
      `# Subscriptions,${subscriptions.length}`,
      `# Active,${activeSubs.length}`,
      `# Paused,${subscriptions.length - activeSubs.length}`,
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

  return (
    <View style={styles.container}>
      {removedCard && (
        <View style={styles.removedCard}>
          <MaterialCommunityIcons name="check-circle-outline" size={22} color={c.bg} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.removedCardText}>
              {t("subscriptions.cancelledSaving", { amount: fmtC(removedCard.yearly, removedCard.currency), name: removedCard.name })}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (removedTimer.current) clearTimeout(removedTimer.current);
                setRemovedCard(null);
                track("referral_invite_tapped", { source: "savings_toast" });
                router.push("/refer-a-friend");
              }}
            >
              <Text style={styles.removedCardInvite}>
                {t("subscriptions.inviteFriendPrompt")} {t("subscriptions.inviteFriend")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <View style={styles.scrollContent}>
          {/* REDONE 2026-11-07 with the dashboard's scale. The top used to be a
              locked Add, two locked icon squares for the exports, a meter card
              and a navy banner for the paste feature, all before the first
              subscription. Now: the two ways in, a quiet meter for the free
              plan, the search. The exports moved to the end of the list. */}
          <View style={styles.topRow}>
            <TouchableOpacity
              style={[styles.addButton, atLimit && styles.addButtonLocked]}
              onPress={openAdd}
            >
              <MaterialCommunityIcons name={atLimit ? "lock" : "plus"} size={20} color={atLimit ? c.text : c.bg} />
              <Text style={[styles.addButtonText, atLimit && styles.addButtonTextLocked]}>{atLimit ? t("subscriptions.limitReached") : t("subscriptions.add")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pasteButton} onPress={openPaste}>
              <MaterialCommunityIcons name="email-fast-outline" size={20} color={c.text} />
              <Text style={styles.pasteButtonText}>{t("subscriptions.pasteEmail")}</Text>
            </TouchableOpacity>
          </View>

          {!isPremium && (
            <TouchableOpacity style={styles.limitBar} onPress={() => router.push("/upgrade")} activeOpacity={0.7}>
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>{t("subscriptions.freePlan")}</Text>
                {/* `{total} / {FREE_LIMIT} subscriptions` was a bare English
                    text node here, so a German reader got "3 / 5
                    subscriptions" on the busiest screen in the app. It is not a
                    t() call, not a locale key and not a template literal, which
                    is why every localisation sweep missed it. */}
                <Text style={[styles.limitCount, { color: limitColor }]}>
                  {t("subscriptions.limitCount", { used: total, limit: freeLimit })}
                </Text>
              </View>
              <View style={styles.limitTrack}>
                <View style={[styles.limitFill, { width: `${limitPct}%`, backgroundColor: limitColor }]} />
              </View>
              <View style={styles.limitRow}>
                <Text style={styles.limitHint}>
                  {atLimit ? t("subscriptions.upgradeUnlimited") : t("subscriptions.slot", { count: freeLimit - total })}
                </Text>
                {!atLimit && <Text style={styles.limitLink}>{t("subscriptions.goUnlimited")}</Text>}
                <MaterialCommunityIcons name="chevron-right" size={18} color={c.textMuted} />
              </View>
            </TouchableOpacity>
          )}

          {subscriptionsStale && <OfflineNotice />}
          <PendingNotice />

          {total > 0 && (
            <View style={styles.searchBox}>
              <MaterialCommunityIcons name="magnify" size={20} color={c.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={t("subscriptions.search")}
                placeholderTextColor={c.placeholder}
                value={search}
                onChangeText={setSearch}
                clearButtonMode="while-editing"
              />
            </View>
          )}

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

          {total > 0 && search.trim() !== "" && (
            <Text style={styles.countText}>
              {t("subscriptions.countOf", { count: total, filtered: filtered.length, total })}
            </Text>
          )}

          {subscriptionsLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : subscriptionsError ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="alert-circle-outline" size={52} color={c.border} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyStateSubtext}>{t("subscriptions.couldntLoad")}</Text>
              <TouchableOpacity style={styles.emptyStateButton} onPress={() => refetch()}>
                <Text style={styles.emptyStateButtonText}>{t("common.tryAgain")}</Text>
              </TouchableOpacity>
            </View>
          ) : filtered.length === 0 ? (
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
            <View style={styles.listCard}>
            {filtered.map((sub: any, i: number) => {
              /* parseApiDate, never new Date(). The API sends next_billing_date
                 as TIMESTAMPTZ at midnight UTC, so new Date() on it resolves to
                 the PREVIOUS local day at any negative offset: a 16 October
                 renewal read "15 Oct" in New York, Los Angeles, Sao Paulo and
                 Mexico City, all four of which the currency picker offers. The
                 calendar was fixed for this in September and this card was not,
                 so the same subscription named two different days on two
                 screens. It also returns null for an unreadable value, which
                 renders as "no date" rather than "Invalid Date". */
              const nextDate = parseApiDate(sub.nextBillingDate);
              const trialDate = parseApiDate(sub.trialEndDate);
              const trialDaysLeft = daysUntil(sub.trialEndDate);
              const pending = isPendingRow(sub);
              const paused = sub.isActive === false;
              /* ONE STATUS LINE, the most important thing true of the row:
                 waiting or refused, then paused, then a running trial, then the
                 next payment. These were up to four badges under each card. */
              const meta = pending
                ? { text: t(sub.refusal ? "subscriptions.refusedBadge" : "subscriptions.pendingBadge"), color: sub.refusal ? c.danger : c.textSecondary }
                : paused
                  ? { text: t("subscriptions.paused"), color: c.textSecondary }
                  : trialDate && trialDaysLeft !== null && trialDaysLeft >= 0
                    ? {
                        text: trialDaysLeft === 0
                          ? t("subscriptions.trialEndsSoon_today")
                          : t("subscriptions.trialEndsSoon_days", { days: trialDaysLeft }),
                        color: c.warning,
                      }
                    : {
                        text: nextDate ? t("subscriptions.next", { date: fmtD(nextDate, "PP") }) : t("subscriptions.noDate"),
                        color: c.textSecondary,
                      };
              const open = openRow === sub.id && !pending;
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
                          <MaterialCommunityIcons name="trash-can-outline" size={22} color={c.bg} />
                          <Text style={styles.swipeDeleteText}>{t("subscriptions.delete")}</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  }}
                >
                <View style={[styles.subItem, i > 0 && styles.subDivider]}>
                  <View style={styles.subRow}>
                    <TouchableOpacity
                      style={[styles.subMain, paused && styles.subPaused]}
                      activeOpacity={0.7}
                      onPress={() => (pending ? showPending(sub) : router.push(`/subscription-details?id=${sub.id}`))}
                    >
                      <LogoImage name={sub.name} category={sub.category} size={36} />
                      <View style={styles.subText}>
                        <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
                        <Text style={[styles.subMeta, { color: meta.color }]} numberOfLines={1}>{meta.text}</Text>
                        {sub.priceIncrease && (
                          <Text style={[styles.subMeta, { color: c.danger }]} numberOfLines={1}>
                            {t("subscriptions.priceUp", { amount: fmtC(sub.priceIncrease.to - sub.priceIncrease.from, sub.currency) })}
                          </Text>
                        )}
                      </View>
                      <View style={styles.subAmountCol}>
                        <Text style={styles.subAmount}>{fmtC(sub.price, sub.currency)}</Text>
                        <Text style={styles.subCycle}>{t("subscriptions.perCycle", { cycle: cycleLabel(sub.billingCycle) })}</Text>
                      </View>
                    </TouchableOpacity>
                    {pending ? (
                      <TouchableOpacity
                        style={styles.moreButton}
                        accessibilityRole="button"
                        accessibilityLabel={t("subscriptions.a11yPending", { name: sub.name })}
                        onPress={() => showPending(sub)}
                      >
                        <MaterialCommunityIcons
                          name={sub.refusal ? "alert-circle-outline" : "cloud-upload-outline"}
                          size={20}
                          color={sub.refusal ? c.danger : c.textSecondary}
                        />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.moreButton}
                        accessibilityRole="button"
                        accessibilityLabel={t("subscriptions.a11yActions", { name: sub.name })}
                        accessibilityState={{ expanded: open }}
                        onPress={() => setOpenRow(open ? null : sub.id)}
                      >
                        <MaterialCommunityIcons name={open ? "chevron-up" : "dots-horizontal"} size={20} color={c.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {open && (
                    /* Every action keeps a word beside its icon: these were three
                       grey icon squares per card, one of which deletes data. */
                    <View style={styles.actionBar}>
                      <TouchableOpacity
                        style={styles.cancelGuideLink}
                        accessibilityRole="button"
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        onPress={() => router.push(`/cancel-guide?name=${encodeURIComponent(sub.name)}`)}
                      >
                        <MaterialCommunityIcons name="format-list-numbered" size={18} color={c.text} />
                        <Text style={styles.cancelGuideLinkText}>{t("subscriptions.howToCancel")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionChip}
                        accessibilityRole="button"
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        accessibilityLabel={t(paused ? "subscriptions.a11yResume" : "subscriptions.a11yPause", { name: sub.name })}
                        onPress={() => { setOpenRow(null); setActiveMutation.mutate({ id: sub.id, isActive: paused }); }}
                      >
                        <MaterialCommunityIcons name={paused ? "play-circle-outline" : "pause-circle-outline"} size={18} color={c.text} />
                        <Text style={styles.actionChipText}>{t(paused ? "subscriptions.resume" : "subscriptions.pause")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionChip}
                        accessibilityRole="button"
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        accessibilityLabel={t("subscriptions.a11yEdit", { name: sub.name })}
                        onPress={() => { setOpenRow(null); openEdit(sub); }}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={18} color={c.text} />
                        <Text style={styles.actionChipText}>{t("subscriptions.edit")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionChip}
                        accessibilityRole="button"
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        accessibilityLabel={t("subscriptions.a11yDelete", { name: sub.name })}
                        onPress={() => { setOpenRow(null); confirmDelete(sub); }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={c.danger} />
                        <Text style={[styles.actionChipText, { color: c.danger }]}>{t("subscriptions.delete")}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                </Swipeable>
              );
            })}
            </View>
          )}

          {/* THE EXPORTS, as quiet rows after the list rather than two locked
              squares beside Add: they matter once there is something to export. */}
          {total > 0 && !subscriptionsLoading && (
            <View style={[styles.listCard, styles.exportCard]}>
              <TouchableOpacity
                style={styles.exportRow}
                accessibilityRole="button"
                accessibilityHint={isPremium ? undefined : t("common.a11yPremiumLocked")}
                onPress={exportReport}
              >
                <MaterialCommunityIcons name="file-chart-outline" size={22} color={c.textSecondary} />
                <Text style={styles.exportRowText}>{t("subscriptions.a11yExportReport")}</Text>
                {!isPremium && (
                  <View style={styles.premiumTag}>
                    <Text style={styles.premiumTagText}>{t("upgrade.premium")}</Text>
                  </View>
                )}
                <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportRow, styles.subDivider]}
                accessibilityRole="button"
                accessibilityHint={isPremium ? undefined : t("common.a11yPremiumLocked")}
                onPress={exportCalendar}
              >
                <MaterialCommunityIcons name="calendar-export" size={22} color={c.textSecondary} />
                <Text style={styles.exportRowText}>{t("subscriptions.a11yExportCalendar")}</Text>
                {!isPremium && (
                  <View style={styles.premiumTag}>
                    <Text style={styles.premiumTagText}>{t("upgrade.premium")}</Text>
                  </View>
                )}
                <MaterialCommunityIcons name="chevron-right" size={20} color={c.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <ReminderPrimer
        name={primerName}
        onAccept={async () => {
          setPrimerName(null);
          const granted = await acceptReminderPrimer();
          track("reminder_permission", { result: granted ? "granted" : "denied" });
          // Refetching re-runs the dashboard's scheduler, now with permission.
          if (granted) queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
        }}
        onDecline={() => {
          setPrimerName(null);
          rememberPrimerDeclined();
          track("reminder_permission", { result: "not_now" });
        }}
      />

      <Modal visible={showReviewPrompt} animationType="fade" transparent onRequestClose={handleReviewLater}>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewEmoji}>🎉</Text>
            <Text style={styles.reviewTitle}>{t("review.title")}</Text>
            <Text style={styles.reviewSubtitle}>{t("review.subtitle")}</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  testID={`review-star-${n}`}
                  accessibilityRole="button"
                  accessibilityLabel={t("subscriptions.a11yRateStars", { count: n })}
                  onPress={handleStarTap}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  {/* c.warning, not #FCD34D: that pale amber measured 1.39:1 on the
                      light card, and a star is a control, so it needs 3:1. c.warning
                      is 4.95:1 light and 8.46:1 dark. */}
                  <MaterialCommunityIcons name="star-outline" size={38} color={c.warning} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={handleReviewLater} style={styles.reviewDismiss} accessibilityRole="button">
              <Text style={styles.reviewDismissText}>{t("review.later")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {/* REDONE 2026-11-07 on the dashboard's scale. It was "Add Expense"
                over five differently styled boxes and buttons before the first
                field, fields labelled only by placeholders, and chips for the
                cycle and the trial. Same state, same handlers, same order of
                questions. */}
            <View style={styles.modalContent}>
              <View style={styles.sheetHandle} />
              <Text style={styles.modalTitle}>
                {editingId ? t("subscriptions.editExpenseTitle") : t("subscriptions.addExpenseTitle")}
              </Text>

              {!editingId && (
                <>
                  <Text style={styles.label}>{t("subscriptions.quickAdd")}</Text>
                  <View style={styles.quickPickRow}>
                    {quickPickTemplates.map((tpl) => (
                      <TouchableOpacity
                        key={tpl.id}
                        style={styles.quickPickItem}
                        onPress={() => applyTemplate(tpl)}
                        accessibilityRole="button"
                        accessibilityLabel={tpl.name}
                      >
                        <LogoImage name={tpl.name} category={tpl.category} size={36} />
                        <Text style={styles.quickPickLabel} numberOfLines={2}>{tpl.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.formCard}>
                    <TouchableOpacity
                      style={styles.formRow}
                      onPress={() => { setShowTemplatePicker(!showTemplatePicker); if (showTemplatePicker) setTemplateSearch(""); }}
                    >
                      <MaterialCommunityIcons name="magnify" size={20} color={c.textSecondary} />
                      <Text style={styles.formRowText}>
                        {showTemplatePicker ? t("subscriptions.hideServices") : t("subscriptions.browseServices")}
                      </Text>
                      <MaterialCommunityIcons name={showTemplatePicker ? "chevron-up" : "chevron-down"} size={20} color={c.textMuted} />
                    </TouchableOpacity>

                    {showTemplatePicker && (
                      <View style={styles.formPanel}>
                        <TextInput
                          style={styles.input}
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
                              <Text style={styles.templateChipPrice}>{formatTemplatePrice(tpl, i18n.language)}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.formRow, styles.formRowDivider]}
                      onPress={() => setShowEmailPaste(!showEmailPaste)}
                    >
                      <MaterialCommunityIcons name="email-fast-outline" size={20} color={c.textSecondary} />
                      <Text style={styles.formRowText}>
                        {showEmailPaste ? t("subscriptions.hideAutoFill") : t("subscriptions.autoFillEmail")}
                      </Text>
                      <MaterialCommunityIcons name={showEmailPaste ? "chevron-up" : "chevron-down"} size={20} color={c.textMuted} />
                    </TouchableOpacity>

                    {showEmailPaste && (
                      <View style={styles.formPanel}>
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
                            /* The amount is taken exactly as the receipt wrote it
                               and never converted. A rate is not known for the
                               receipt's date, so converting would invent a number,
                               and silently treating a dollar figure as euros is the
                               error this used to make. Say so instead and let the
                               person decide. */
                            setCurrencyNotice(
                              parsed.currency && parsed.currency !== currency.code
                                ? { receipt: parsed.currency, account: currency.code }
                                : null
                            );
                            setFormData((prev) => ({
                              ...prev,
                              name: parsed.name ?? "",
                              price: sanitiseAmountInput(parsed.price ?? ""),
                              billingCycle: parsed.billingCycle ?? prev.billingCycle,
                            }));
                          }}
                          textAlignVertical="top"
                        />
                        {currencyNotice && (
                          <View style={styles.currencyNotice}>
                            <MaterialCommunityIcons name="information-outline" size={16} color={c.warning} />
                            <Text style={styles.currencyNoticeText}>
                              {t("subscriptions.currencyMismatch", {
                                receipt: currencyNotice.receipt,
                                account: currencyNotice.account,
                              })}
                            </Text>
                          </View>
                        )}
                        {(formData.name || formData.price) && (
                          <View style={styles.parsedPreview}>
                            <MaterialCommunityIcons name="check-circle" size={16} color={c.success} />
                            <Text style={styles.parsedPreviewText}>
                              {t("subscriptions.detected")}{formData.name ? ` ${formData.name}` : ""}
                              {/* Commas, not middle dots, and the cycle in words: this
                                  printed the raw API value, so German read "monthly".
                                  The amount goes through fmtC like every other price,
                                  rather than "EUR 13.99" as typed. */}
                              {formData.price && !isNaN(parseFloat(formData.price)) ? `, ${fmtC(parseFloat(formData.price), baseCurrencyCode)}` : ""}
                              {formData.billingCycle ? `, ${cycleAdjective(formData.billingCycle)}` : ""}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </>
              )}

              <Text style={styles.label}>{t("subscriptions.nameLabel")}</Text>
              <TextInput
                style={styles.input}
                accessibilityLabel={t("subscriptions.nameLabel")}
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

              <Text style={styles.label}>{t("subscriptions.priceLabel")}</Text>
              <View style={styles.priceField}>
                <TextInput
                  style={styles.priceInput}
                  accessibilityLabel={t("subscriptions.priceLabel")}
                  placeholder={t("subscriptions.pricePlaceholder")}
                  placeholderTextColor={c.placeholder}
                  keyboardType="decimal-pad"
                  value={amountForDisplay(formData.price, i18n.language)}
                  onChangeText={(t) => setFormData({ ...formData, price: sanitiseAmountInput(t) })}
                />
                <Text style={styles.priceCurrency}>{baseCurrencyCode}</Text>
              </View>
              {(() => {
                const raw = parseFloat(formData.price);
                if (!isNaN(raw) && raw > 0 && currency.code !== baseCurrencyCode) {
                  const converted = convert(raw);
                  const decimals = currency.code === "JPY" ? 0 : 2;
                  return (
                    <Text style={styles.priceHint}>
                      ≈ {formatMoney(converted, currency.symbol, decimals, i18n.language)}
                    </Text>
                  );
                }
                return null;
              })()}

              <Text style={styles.label}>{t("subscriptions.billingCycle")}</Text>
              {/* A segmented control rather than chips: exactly one of three is
                  always chosen. Chosen is ink, the same rule as the category
                  chips below, never white on primary (4.02:1 in dark mode). */}
              <View style={styles.segmented} accessibilityRole="radiogroup">
                {BILLING_CYCLES.map((cycle) => {
                  const on = formData.billingCycle === cycle;
                  return (
                    <TouchableOpacity
                      key={cycle}
                      style={[styles.segment, on && styles.segmentOn]}
                      onPress={() => setFormData({ ...formData, billingCycle: cycle })}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{cycleAdjective(cycle)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("subscriptions.isFreeTrialLabel")}</Text>
                <Switch
                  value={!!formData.isFreeTrial}
                  onValueChange={(v) => setFormData({ ...formData, isFreeTrial: v })}
                  accessibilityLabel={t("subscriptions.isFreeTrialLabel")}
                  trackColor={{ false: c.switchOff, true: c.switchOn }}
                  thumbColor={c.switchThumb}
                />
              </View>

              {formData.isFreeTrial && (
                <>
                  <Text style={styles.label}>{t("subscriptions.trialEndsOn")}</Text>
                  <TextInput
                    style={styles.input}
                    accessibilityLabel={t("subscriptions.trialEndsOn")}
                    placeholder={t("subscriptions.datePlaceholder")}
                    placeholderTextColor={c.placeholder}
                    value={formData.trialEndDate}
                    onChangeText={(t) => setFormData({ ...formData, trialEndDate: t })}
                  />
                </>
              )}

              <Text style={styles.label}>{t("subscriptions.category")}</Text>
              <View style={styles.chipRow}>
                {allCategories.map((cat) => {
                  const isActive = formData.category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => setFormData({ ...formData, category: cat })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {categoryLabel(cat)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {isPremium && !showCustomInput && (
                  <TouchableOpacity
                    style={[styles.chip, styles.chipAdd]}
                    onPress={() => setShowCustomInput(true)}
                  >
                    {/* c.text, not a hardcoded navy: on the dark chip that measured 1.08:1. */}
                    <Text style={[styles.chipText, { color: c.text }]}>+ {t("subscriptions.customCategory")}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isPremium && showCustomInput && (
                <View style={styles.customCatRow}>
                  <TextInput
                    style={styles.customCatInput}
                    placeholder={t("subscriptions.customCategoryPlaceholder")}
                    maxLength={40}
                    placeholderTextColor={c.placeholder}
                    autoFocus
                    value={customCatDraft}
                    onChangeText={setCustomCatDraft}
                    onSubmitEditing={addCustomCategory}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={styles.customCatConfirm} onPress={addCustomCategory}>
                    <Text style={styles.customCatConfirmText}>{t("subscriptions.add")}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.moreOptionsButton}
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <MaterialCommunityIcons name="tune-variant" size={20} color={c.textSecondary} />
                <Text style={styles.moreOptionsButtonText}>
                  {showAdvanced ? t("subscriptions.hideMoreOptions") : t("subscriptions.moreOptions")}
                </Text>
                <MaterialCommunityIcons name={showAdvanced ? "chevron-up" : "chevron-down"} size={20} color={c.textMuted} />
              </TouchableOpacity>

              {showAdvanced && (
                <View>
                  <Text style={styles.label}>{t("subscriptions.nextBillingDate")}</Text>
                  <TextInput
                    style={styles.input}
                    accessibilityLabel={t("subscriptions.nextBillingDate")}
                    placeholder={t("subscriptions.datePlaceholder")}
                    placeholderTextColor={c.placeholder}
                    value={formData.nextBillingDate}
                    onChangeText={(t) => setFormData({ ...formData, nextBillingDate: t })}
                  />
                </View>
              )}

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isPending}>
                {isPending
                  ? <ActivityIndicator color={c.bg} />
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
    removedCard: {
      position: "absolute", top: 12, left: 16, right: 16, zIndex: 50,
      /* Text on a status fill takes c.bg, never a literal white: dark success is
         Soft Mint, and white on it measured 2.10:1. c.bg is 4.83:1 light and
         8.40:1 dark. */
      backgroundColor: c.success, borderRadius: 12, padding: 14,
      flexDirection: "row", alignItems: "center",
      shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    removedCardText: { color: c.bg, fontSize: 13, fontWeight: "600", fontFamily: "Montserrat-SemiBold", lineHeight: 18 },
    removedCardInvite: { color: c.bg, fontSize: 12, fontWeight: "600", fontFamily: "Montserrat-SemiBold", lineHeight: 17, marginTop: 6, textDecorationLine: "underline" },
    pasteButton: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s,
      minHeight: 48, paddingHorizontal: space.l, borderRadius: radius.m,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.card,
    },
    pasteButtonText: { ...typeScale.label, color: c.text },
    /* c.text, not c.primary: dark primary as text on the card is 3.94:1. */
    limitLink: { ...typeScale.label, color: c.text },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: space.s, minHeight: 48,
      paddingHorizontal: space.m, borderRadius: radius.m, marginBottom: space.m,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.inputBg,
    },
    searchInput: { flex: 1, ...typeScale.body, color: c.text, paddingVertical: space.s },
    listCard: {
      backgroundColor: c.card, borderRadius: radius.m, paddingHorizontal: space.l,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.cardBorder,
    },
    exportCard: { marginTop: space.xl },
    subItem: {},
    subDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    subRow: { flexDirection: "row", alignItems: "center" },
    subMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.m, paddingVertical: space.m, minHeight: 64 },
    subPaused: { opacity: 0.55 },
    subText: { flex: 1, minWidth: 0 },
    subName: { ...typeScale.bodyStrong, color: c.text },
    subMeta: { ...typeScale.caption, marginTop: 2 },
    subAmountCol: { alignItems: "flex-end" },
    subAmount: { ...typeScale.bodyStrong, ...tabular, color: c.text },
    subCycle: { ...typeScale.caption, color: c.textSecondary, marginTop: 2 },
    moreButton: { width: 44, minHeight: 48, alignItems: "flex-end", justifyContent: "center" },
    actionBar: { flexDirection: "row", flexWrap: "wrap", gap: space.s, paddingBottom: space.m, paddingLeft: 36 + space.m },
    // Same shape as cancelGuideLink above: 40dp plus 4dp of hitSlop each way.
    actionChip: {
      flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 12,
      borderRadius: 20, borderWidth: 1, borderColor: c.border,
    },
    actionChipText: { ...typeScale.label, color: c.text },
    exportRow: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 56 },
    exportRowText: { flex: 1, ...typeScale.body, color: c.text },
    premiumTag: { backgroundColor: c.primaryLight, borderRadius: radius.pill, paddingHorizontal: space.s, paddingVertical: 2 },
    // c.text, not c.primary: dark primary on primaryLight is 3.35:1.
    premiumTagText: { ...typeScale.caption, color: c.text },
    sheetHandle: {
      alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: space.l,
    },
    formCard: {
      borderRadius: radius.m, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      backgroundColor: c.bg, paddingHorizontal: space.m,
    },
    formRow: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 52 },
    formRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    formRowText: { flex: 1, ...typeScale.bodyStrong, color: c.text },
    formPanel: { paddingBottom: space.m },
    priceField: {
      flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: space.m,
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: radius.m,
    },
    priceInput: { flex: 1, ...typeScale.body, ...tabular, color: c.text, paddingVertical: space.s },
    priceCurrency: { ...typeScale.label, color: c.textSecondary, marginLeft: space.s },
    segmented: {
      flexDirection: "row", padding: 4, borderRadius: radius.m, gap: 4,
      backgroundColor: c.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    segment: { flex: 1, minHeight: 40, borderRadius: radius.s, alignItems: "center", justifyContent: "center" },
    segmentOn: { backgroundColor: c.text },
    segmentText: { ...typeScale.label, color: c.textSecondary },
    segmentTextOn: { color: c.bg, fontFamily: "Montserrat-SemiBold" },
    switchRow: {
      flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 56, marginTop: space.l,
      paddingHorizontal: space.m, borderRadius: radius.m, backgroundColor: c.bg,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    switchLabel: { flex: 1, ...typeScale.body, color: c.text },
    topRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    addButton: {
      flex: 1, backgroundColor: c.text, borderRadius: 8, paddingVertical: 12,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    },
    /* OUTLINED WHEN LOCKED, never white on grey: white on dark textMuted
       measured 3.08:1, under the 4.5:1 floor. Ink on the card is 12:1 or more. */
    addButtonLocked: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    addButtonTextLocked: { color: c.text },
    addButtonText: { color: c.bg, fontSize: 14, fontWeight: "600", fontFamily: "Montserrat-SemiBold" },
    limitBar: {
      backgroundColor: c.card, borderRadius: 10, padding: 12, marginBottom: 12,
      borderWidth: 1, borderColor: c.border,
    },
    limitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    limitLabel: { fontSize: 12, color: c.textSecondary, fontWeight: "500", fontFamily: "Montserrat-Medium" },
    limitCount: { fontSize: 12, fontWeight: "700", fontFamily: "Montserrat-Bold" },
    limitTrack: { height: 6, backgroundColor: c.border, borderRadius: 3, overflow: "hidden" },
    limitFill: { height: "100%", borderRadius: 3 },
    limitHint: { flex: 1, ...typeScale.caption, color: c.textSecondary, marginTop: 5 },
    emptyState: { alignItems: "center", paddingVertical: 48 },
    emptyStateText: { ...typeScale.body, color: c.textSecondary, textAlign: "center" },
    emptyStateTitle: { ...typeScale.title, color: c.text, marginBottom: space.s, textAlign: "center" },
    emptyStateSubtext: { ...typeScale.body, color: c.textSecondary, textAlign: "center", paddingHorizontal: space.xl, marginBottom: space.l },
    emptyStateButton: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 48,
      justifyContent: "center", paddingHorizontal: space.xl, marginBottom: space.m,
    },
    emptyStateButtonText: { ...typeScale.bodyStrong, color: c.bg },
    emptyStateHint: { ...typeScale.caption, color: c.textMuted, textAlign: "center", paddingHorizontal: space.xxl },
    countText: { ...typeScale.caption, color: c.textSecondary, marginBottom: 10 },
    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
    modalContent: {
      backgroundColor: c.card, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l,
      paddingHorizontal: space.xl, paddingTop: space.m, paddingBottom: space.xxl,
    },
    modalTitle: { ...typeScale.title, color: c.text, marginBottom: space.l },
    moreOptionsButton: {
      flexDirection: "row", alignItems: "center", gap: space.s, minHeight: 48, marginTop: space.l,
    },
    moreOptionsButtonText: { flex: 1, ...typeScale.bodyStrong, color: c.text },
    input: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: radius.m,
      paddingHorizontal: space.m, minHeight: 48, ...typeScale.body, color: c.text,
    },
    label: { ...typeScale.label, color: c.textSecondary, marginTop: space.l, marginBottom: space.s },
    priceHint: { ...typeScale.caption, color: c.textSecondary, marginTop: space.xs },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
    chip: {
      minHeight: 40, paddingHorizontal: space.m, borderRadius: radius.pill, justifyContent: "center",
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    },
    chipActive: { backgroundColor: c.text, borderColor: c.text },
    chipAdd: { borderStyle: "dashed", borderColor: c.textSecondary },
    chipText: { ...typeScale.label, color: c.text, textTransform: "capitalize" },
    chipTextActive: { color: c.bg },
    customCatRow: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" },
    customCatInput: {
      flex: 1, borderWidth: 1, borderColor: c.primary, borderRadius: 8,
      paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, fontFamily: "Montserrat-Regular", color: c.text,
      backgroundColor: c.primaryLight,
    },
    customCatConfirm: {
      backgroundColor: c.text, borderRadius: 8, paddingVertical: 8,
      paddingHorizontal: 14, justifyContent: "center",
    },
    customCatConfirmText: { color: c.bg, fontSize: 13, fontWeight: "600", fontFamily: "Montserrat-SemiBold" },
    submitButton: {
      backgroundColor: c.text, borderRadius: radius.m, minHeight: 52, marginTop: space.xl,
      alignItems: "center", justifyContent: "center",
    },
    submitButtonText: { ...typeScale.bodyStrong, color: c.bg },
    cancelButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: space.s },
    cancelButtonText: { ...typeScale.bodyStrong, color: c.textSecondary },
    emailPasteLabel: { ...typeScale.caption, color: c.textSecondary, marginBottom: space.s },
    emailPasteInput: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: radius.m,
      padding: space.m, minHeight: 112, ...typeScale.body, color: c.text,
    },
    currencyNotice: { flexDirection: "row", gap: space.s, alignItems: "flex-start", marginTop: space.s },
    currencyNoticeText: { flex: 1, ...typeScale.caption, color: c.warning },
    parsedPreview: { flexDirection: "row", gap: space.s, alignItems: "center", marginTop: space.s },
    parsedPreviewText: { flex: 1, ...typeScale.label, color: c.success },
    sortRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
    sortChip: {
      paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    },
    sortChipActive: { backgroundColor: c.text, borderColor: c.text },
    sortChipText: { fontSize: 12, color: c.textSecondary, fontWeight: "500", fontFamily: "Montserrat-Medium" },
    sortChipTextActive: { color: c.bg, fontWeight: "700", fontFamily: "Montserrat-Bold" },
    swipeDeleteWrapper: { justifyContent: "center", marginBottom: 12 },
    swipeDelete: {
      /* c.bg, not white: white on dark danger measured 2.52:1. */
      backgroundColor: c.danger, justifyContent: "center", alignItems: "center",
      width: 80, borderRadius: 12, height: "100%", gap: 2,
    },
    swipeDeleteText: { color: c.bg, fontSize: 12, fontFamily: "Montserrat-SemiBold" },
    examplesButton: {
      borderWidth: 1, borderColor: c.border, borderRadius: radius.m, minHeight: 48,
      justifyContent: "center", paddingHorizontal: space.xl, marginBottom: space.m,
    },
    examplesButtonText: { ...typeScale.bodyStrong, color: c.text },
    /* THIS IS A CONTROL, NOT A CAPTION, and it did not read as one. It used to
       be an 11px icon beside 11px text with NO padding and no hitSlop, so the
       tappable strip was roughly 14dp, against Android's 48dp minimum, sitting
       INSIDE the card's own TouchableOpacity. A tap that missed it by a few
       pixels opened subscription details instead, so the failure looked like
       the button doing nothing rather than like a mis-hit. Same shape as the
       2026-09-19 calendar cell: measure the smallest state.
       36dp of pill plus the 6dp of hitSlop top and bottom at the call site is
       48dp of touch target, and the hitSlop keeps the layout unchanged. It
       overlaps nothing but the card's own tap: the action buttons are top
       right (the card is a row with alignItems flex-start) and this sits
       bottom left.
       minHeight RATHER THAN PADDING ALONE, because line height varies with the
       font, so padding makes the height approximate and minHeight makes it
       provable. __tests__/cancel-guide-target.test.js reads these numbers out
       of this stylesheet rather than restating them.
       textSecondary, NOT textMuted. WHEN THIS WAS WRITTEN that was a contrast
       fix: textMuted was #8B949C, which measures 2.98:1 on the light card,
       under the 4.5:1 floor for text at this size. The TOKEN has since been
       fixed (#67717A, 4.81:1), so that argument no longer holds and the
       choice stands on a different one: a control's label should be more
       prominent than the muted metadata beside it, and textSecondary is
       6.19:1 light and 6.10:1 dark. Recorded rather than left stale, because
       a comment that still gives the old reason is how the next reader
       concludes the decision was arbitrary.
       NOT the primary token, which is the obvious choice for something that
       should read as a link and is wrong here: dark primary #2F8E71 on the
       dark card is 3.94:1 and fails the same floor. Measured, not eyeballed. */
    cancelGuideLink: {
      flexDirection: "row", alignItems: "center", gap: 6,
      minHeight: 40, paddingHorizontal: 12,
      borderWidth: 1, borderColor: c.border, borderRadius: 20,
    },
    cancelGuideLinkText: { fontSize: 13, lineHeight: 18, color: c.text, fontFamily: "Montserrat-Medium" },
    reviewOverlay: {
      flex: 1, backgroundColor: c.overlay,
      justifyContent: "center", alignItems: "center", padding: 32,
    },
    reviewCard: {
      backgroundColor: c.card, borderRadius: radius.l, padding: space.xl,
      alignItems: "center", width: "100%",
      shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 }, elevation: 10,
      borderWidth: 1, borderColor: c.border,
    },
    reviewEmoji: { fontSize: 40, marginBottom: 12 },
    reviewTitle: { ...typeScale.title, color: c.text, textAlign: "center", marginBottom: space.s },
    reviewSubtitle: { ...typeScale.body, color: c.textSecondary, textAlign: "center", marginBottom: space.xl },
    starRow: {
      flexDirection: "row", gap: 10, marginBottom: 8,
    },
    /* A control, so 48dp: it was bare 13px text with only a top margin, about
       18dp to hit. */
    reviewDismiss: { marginTop: space.s, minHeight: 48, paddingHorizontal: space.l, justifyContent: "center" },
    reviewDismissText: { ...typeScale.label, color: c.textMuted },
    quickPickRow: { flexDirection: "row", flexWrap: "wrap", gap: space.s, marginBottom: space.l },
    quickPickItem: {
      flexBasis: "30%", flexGrow: 1, minHeight: 96, alignItems: "center", justifyContent: "center", gap: space.s,
      paddingHorizontal: space.xs, paddingVertical: space.m, borderRadius: radius.m,
      backgroundColor: c.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    quickPickLabel: { ...typeScale.caption, fontFamily: "Montserrat-Medium", color: c.text, textAlign: "center" },
    templateSectionLabel: { ...typeScale.caption, color: c.textSecondary, marginTop: space.m, marginBottom: space.s },
    templateScroll: { flexGrow: 0 },
    templateScrollContent: { gap: space.s, paddingBottom: space.xs },
    templateChip: {
      backgroundColor: c.card, borderRadius: radius.m, paddingVertical: space.s, paddingHorizontal: space.m,
      minHeight: 56, justifyContent: "center", borderWidth: 1, borderColor: c.border, minWidth: 112, maxWidth: 160,
    },
    templateChipName: { ...typeScale.label, color: c.text, marginBottom: 2 },
    templateChipPrice: { ...typeScale.caption, ...tabular, color: c.textSecondary },
  });
}
