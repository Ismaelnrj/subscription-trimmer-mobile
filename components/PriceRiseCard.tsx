import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import apiClient from "../lib/api";
import { SERVICE_TEMPLATES } from "../lib/service-templates";
import { withServerPrices, findPriceRises, unanswered, PriceRise, TrackedRow } from "../lib/price-watch";
import { useCurrencyStore, useFmt } from "../lib/currency-store";
import { useCycleLabel } from "../lib/cycle-label";
import { useDateFormat } from "../lib/date-locale";
import { parseApiDate } from "../lib/utils";
import { track } from "../lib/analytics";
import { useTheme, AppColors, space, radius, type as typeScale, tabular } from "../lib/theme";

/* "Netflix costs more now": one card on the dashboard when a tracked row is
   priced below its service's checked public price. The logic and what it may
   honestly claim are in lib/price-watch.ts; this is the screen half.

   ONE AT A TIME. A second rise shows once the first is answered, so the
   dashboard never stacks warnings above the money.

   KEEPING A PRICE IS REMEMBERED ON THIS PHONE, per row and per listed price,
   so the same figure is not raised again and a later rise is. It is a
   per-device convenience, like the dashboard's other dismissals. */

const KEPT_KEY = "price_rise_kept_v1";

async function readKept(): Promise<Record<string, string>> {
  try {
    const raw = await SecureStore.getItemAsync(KEPT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

type Row = TrackedRow & { category?: string; trialEndDate?: string | null };

export function PriceRiseCard({ subscriptions }: { subscriptions: Row[] }) {
  const { t } = useTranslation();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const fmtC = useFmt();
  const fmtD = useDateFormat();
  const cycleLabel = useCycleLabel();
  const { baseCurrencyCode } = useCurrencyStore();
  const queryClient = useQueryClient();
  const [kept, setKept] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { readKept().then(setKept); }, []);

  /* The server's figures, laid over the bundled ones. Until they arrive, or
     if they never do (offline, an older server), the bundled checks speak,
     which is the same data the app shipped with. */
  const { data: serverPrices } = useQuery({
    queryKey: ["catalogue", "prices"],
    queryFn: async () => (await apiClient.get("/trpc/catalogue.prices")).data.result.data.prices,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  const rise: PriceRise | undefined = useMemo(() => {
    if (!kept) return undefined;
    const catalogue = withServerPrices(SERVICE_TEMPLATES, serverPrices);
    return unanswered(findPriceRises(subscriptions, catalogue, baseCurrencyCode), kept)[0];
  }, [kept, serverPrices, subscriptions, baseCurrencyCode]);

  if (!rise) return null;
  const sub = subscriptions.find((s) => s.id === rise.subscriptionId);
  if (!sub) return null;

  const keepPrice = async () => {
    const next = { ...(kept ?? {}), [String(rise.subscriptionId)]: rise.key };
    // Forget rows that are gone, so the stored map cannot grow without bound.
    const live = new Set(subscriptions.map((s) => String(s.id)));
    for (const id of Object.keys(next)) if (!live.has(id)) delete next[id];
    setKept(next);
    track("price_rise", { action: "kept" });
    await SecureStore.setItemAsync(KEPT_KEY, JSON.stringify(next)).catch(() => {});
  };

  /* subscriptions.update is a full update: every field is sent back as the
     list has it, exactly as the edit form does, so the trial date and the
     category survive. The row's own currency goes with the new price, which
     is the currency the listed price is in. */
  const updatePrice = async () => {
    if (saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await apiClient.post("/trpc/subscriptions.update", {
        id: sub.id,
        name: sub.name,
        price: rise.to,
        billingCycle: sub.billingCycle,
        category: sub.category ?? "other",
        trialEndDate: sub.trialEndDate ? String(sub.trialEndDate).slice(0, 10) : null,
        currency: rise.currency,
      });
      track("price_rise", { action: "updated" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
      ]);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const to = fmtC(rise.to, rise.currency);
  const from = fmtC(rise.from, rise.currency);
  const checked = parseApiDate(rise.verified);

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.head}>
        <MaterialCommunityIcons name="trending-up" size={22} color={c.warning} />
        <Text style={styles.title}>{t("priceRise.title", { name: rise.name })}</Text>
      </View>
      <Text style={styles.body}>
        {t("priceRise.body", {
          to,
          cycle: cycleLabel(rise.billingCycle),
          date: checked ? fmtD(checked, "PP") : rise.verified,
          from,
        })}
      </Text>
      {failed && <Text style={styles.error}>{t("priceRise.failed")}</Text>}
      <TouchableOpacity
        style={styles.primary}
        onPress={updatePrice}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ busy: saving }}
      >
        {saving
          ? <ActivityIndicator color={c.bg} />
          : <Text style={[styles.primaryText, tabular]}>{t("priceRise.update", { to })}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={keepPrice} disabled={saving} accessibilityRole="button">
        <Text style={styles.secondaryText}>{t("priceRise.keep")}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card, borderRadius: radius.l, borderWidth: 1, borderColor: c.cardBorder,
      padding: space.l, marginTop: space.l,
    },
    head: { flexDirection: "row", alignItems: "center", gap: space.s, marginBottom: space.s },
    title: { ...typeScale.heading, color: c.text, flex: 1 },
    body: { ...typeScale.body, color: c.textSecondary, marginBottom: space.l },
    error: { ...typeScale.caption, color: c.danger, marginBottom: space.s },
    primary: {
      minHeight: 48, borderRadius: radius.m, backgroundColor: c.text,
      justifyContent: "center", alignItems: "center", paddingHorizontal: space.l,
    },
    primaryText: { ...typeScale.bodyStrong, color: c.bg },
    secondary: { minHeight: 48, justifyContent: "center", alignItems: "center", marginTop: space.xs },
    secondaryText: { ...typeScale.bodyStrong, color: c.textSecondary },
  });
}
