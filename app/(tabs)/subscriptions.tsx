import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  TextInput, Alert, RefreshControl, Share, ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import apiClient from "../../lib/api";
import { useState, useMemo } from "react";
import { useCurrencyStore, fmt } from "../../lib/currency-store";
import { useAuthStore } from "../../lib/auth-store";

const FREE_LIMIT = 7;
const BILLING_CYCLES = ["monthly", "yearly", "weekly"];
const CATEGORIES = ["entertainment", "streaming", "software", "health", "fitness", "food", "education", "other"];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  topRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  addButton: {
    flex: 1, backgroundColor: "#4F46E5", borderRadius: 8, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  addButtonLocked: { backgroundColor: "#9CA3AF" },
  addButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  exportButton: {
    backgroundColor: "#ECFDF5", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#6EE7B7", justifyContent: "center", alignItems: "center",
  },
  exportButtonLocked: {
    backgroundColor: "#F3F4F6", borderColor: "#E5E7EB",
  },
  limitBar: {
    backgroundColor: "#FFFFFF", borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  limitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  limitLabel: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  limitCount: { fontSize: 12, fontWeight: "700" },
  limitTrack: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" },
  limitFill: { height: "100%", borderRadius: 3 },
  limitHint: { fontSize: 11, color: "#6B7280", marginTop: 5 },
  searchBar: {
    backgroundColor: "#FFFFFF", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#E5E7EB", fontSize: 14, color: "#1F2937", marginBottom: 14,
  },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: "600", color: "#1F2937", marginBottom: 3 },
  cardPrice: { fontSize: 12, color: "#6B7280", marginBottom: 2 },
  cardDate: { fontSize: 11, color: "#9CA3AF" },
  cardMonthly: { fontSize: 11, color: "#4F46E5", marginTop: 1 },
  categoryBadge: {
    alignSelf: "flex-start", backgroundColor: "#EEF2FF", borderRadius: 4,
    paddingVertical: 2, paddingHorizontal: 6, marginTop: 4,
  },
  categoryBadgeText: { fontSize: 10, color: "#4F46E5", fontWeight: "600", textTransform: "capitalize" },
  trialBadge: {
    alignSelf: "flex-start", backgroundColor: "#FEF3C7", borderRadius: 4,
    paddingVertical: 2, paddingHorizontal: 6, marginTop: 4,
  },
  trialBadgeText: { fontSize: 10, color: "#D97706", fontWeight: "600" },
  actionButtons: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 36, height: 36, borderRadius: 6, backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
  },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyStateText: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  countText: { fontSize: 12, color: "#6B7280", marginBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937", marginBottom: 20 },
  input: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, paddingVertical: 12,
    paddingHorizontal: 12, marginBottom: 12, fontSize: 14, color: "#1F2937",
  },
  label: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  chipText: { fontSize: 12, color: "#374151", fontWeight: "500", textTransform: "capitalize" },
  chipTextActive: { color: "#FFFFFF" },
  submitButton: { backgroundColor: "#4F46E5", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  submitButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  cancelButton: { backgroundColor: "#F3F4F6", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  cancelButtonText: { color: "#6B7280", fontSize: 14, fontWeight: "600" },
  upgradeNudge: {
    backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: "#FCD34D", flexDirection: "row", alignItems: "center", gap: 10,
  },
  upgradeNudgeText: { flex: 1, fontSize: 13, color: "#92400E" },
  upgradeNudgeLink: { fontSize: 13, fontWeight: "700", color: "#4F46E5" },
});

const emptyForm = { name: "", price: "", billingCycle: "monthly", category: "other", trialEndDate: "" };

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isPremium = user?.isPaid ?? false;
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { currency } = useCurrencyStore();

  const { data: subscriptions = [], refetch } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => (await apiClient.get("/trpc/subscriptions.list")).data.result.data,
  });

  const total = subscriptions.length;
  const atLimit = !isPremium && total >= FREE_LIMIT;
  const limitPct = isPremium ? 0 : Math.min((total / FREE_LIMIT) * 100, 100);
  const limitColor = limitPct >= 100 ? "#EF4444" : limitPct >= 71 ? "#F59E0B" : "#4F46E5";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? subscriptions.filter((s: any) =>
      s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    ) : subscriptions;
  }, [subscriptions, search]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await apiClient.post("/trpc/subscriptions.create", data)).data.result.data,
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
    mutationFn: async (data: any) => (await apiClient.post("/trpc/subscriptions.update", data)).data.result.data,
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiClient.post("/trpc/subscriptions.delete", { id })).data.result.data,
    onSuccess: invalidate,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openAdd = () => {
    if (atLimit) { router.push("/upgrade"); return; }
    setEditingId(null); setFormData(emptyForm); setShowModal(true);
  };
  const openEdit = (sub: any) => {
    setEditingId(sub.id);
    setFormData({
      name: sub.name, price: String(sub.price), billingCycle: sub.billingCycle,
      category: sub.category, trialEndDate: sub.trialEndDate ? sub.trialEndDate.slice(0, 10) : "",
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingId(null); setFormData(emptyForm); };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.price) {
      Alert.alert("Error", "Please enter a name and price.");
      return;
    }
    const data = {
      name: formData.name.trim(), price: parseFloat(formData.price),
      billingCycle: formData.billingCycle, category: formData.category,
      trialEndDate: formData.trialEndDate || null,
    };
    if (editingId !== null) { updateMutation.mutate({ id: editingId, ...data }); }
    else { createMutation.mutate(data); }
  };

  const confirmDelete = (id: number, name: string) => {
    Alert.alert("Delete Subscription", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const exportCSV = async () => {
    if (!isPremium) { router.push("/upgrade"); return; }
    if (subscriptions.length === 0) { Alert.alert("No data", "Add some subscriptions first."); return; }
    const header = "Name,Price,Billing Cycle,Category,Next Billing Date,Trial End Date\n";
    const rows = subscriptions.map((s: any) => [
      `"${s.name}"`, s.price, s.billingCycle, s.category,
      s.nextBillingDate ? new Date(s.nextBillingDate).toLocaleDateString() : "",
      s.trialEndDate ? new Date(s.trialEndDate).toLocaleDateString() : "",
    ].join(",")).join("\n");
    await Share.share({ message: header + rows, title: "My Subscriptions" });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const monthlyEquiv = (price: number, cycle: string) => {
    if (cycle === "yearly") return fmt(price / 12, currency.symbol) + "/mo";
    if (cycle === "weekly") return fmt((price * 52) / 12, currency.symbol) + "/mo";
    return null;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}
      >
        <View style={styles.scrollContent}>

          <View style={styles.topRow}>
            <TouchableOpacity style={[styles.addButton, atLimit && styles.addButtonLocked]} onPress={openAdd}>
              <MaterialCommunityIcons name={atLimit ? "lock" : "plus"} size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>{atLimit ? "Limit reached" : "Add"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportButton, !isPremium && styles.exportButtonLocked]}
              onPress={exportCSV}
            >
              <MaterialCommunityIcons
                name={isPremium ? "file-export" : "lock"}
                size={22}
                color={isPremium ? "#059669" : "#9CA3AF"}
              />
            </TouchableOpacity>
          </View>

          {/* Free tier usage bar */}
          {!isPremium && (
            <View style={styles.limitBar}>
              <View style={styles.limitRow}>
                <Text style={styles.limitLabel}>Free plan</Text>
                <Text style={[styles.limitCount, { color: limitColor }]}>{total} / {FREE_LIMIT} subscriptions</Text>
              </View>
              <View style={styles.limitTrack}>
                <View style={[styles.limitFill, { width: `${limitPct}%`, backgroundColor: limitColor }]} />
              </View>
              {atLimit ? (
                <TouchableOpacity onPress={() => router.push("/upgrade")}>
                  <Text style={[styles.limitHint, { color: "#4F46E5", fontWeight: "600" }]}>
                    You've reached the limit — Upgrade for unlimited →
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.limitHint}>
                  {FREE_LIMIT - total} slot{FREE_LIMIT - total !== 1 ? "s" : ""} remaining · <Text style={{ color: "#4F46E5" }} onPress={() => router.push("/upgrade")}>Go unlimited</Text>
                </Text>
              )}
            </View>
          )}

          <TextInput
            style={styles.searchBar}
            placeholder="Search subscriptions..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />

          {total > 0 && (
            <Text style={styles.countText}>
              {filtered.length} of {total} subscription{total !== 1 ? "s" : ""}
            </Text>
          )}

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="inbox" size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyStateText}>
                {search ? "No results found" : "No subscriptions yet.\nTap Add to get started."}
              </Text>
            </View>
          ) : (
            filtered.map((sub: any) => {
              const equiv = monthlyEquiv(sub.price, sub.billingCycle);
              const trialDate = sub.trialEndDate ? new Date(sub.trialEndDate) : null;
              const trialDaysLeft = trialDate ? Math.ceil((trialDate.getTime() - Date.now()) / 86400000) : null;
              return (
                <View key={sub.id} style={styles.card}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{sub.name}</Text>
                    <Text style={styles.cardPrice}>{fmt(sub.price, currency.symbol)} / {sub.billingCycle}</Text>
                    {equiv && <Text style={styles.cardMonthly}>≈ {equiv}</Text>}
                    <Text style={styles.cardDate}>Next: {new Date(sub.nextBillingDate).toLocaleDateString()}</Text>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{sub.category}</Text>
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
                      <MaterialCommunityIcons name="pencil" size={18} color="#4F46E5" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => confirmDelete(sub.id, sub.name)}>
                      <MaterialCommunityIcons name="trash-can" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingId ? "Edit Subscription" : "Add Subscription"}</Text>
              <TextInput
                style={styles.input} placeholder="Subscription name (e.g. Netflix)"
                placeholderTextColor="#9CA3AF" value={formData.name}
                onChangeText={(t) => setFormData({ ...formData, name: t })}
              />
              <TextInput
                style={styles.input} placeholder="Price (e.g. 9.99)"
                placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" value={formData.price}
                onChangeText={(t) => setFormData({ ...formData, price: t })}
              />
              <Text style={styles.label}>Billing Cycle</Text>
              <View style={styles.chipRow}>
                {BILLING_CYCLES.map((c) => (
                  <TouchableOpacity key={c} style={[styles.chip, formData.billingCycle === c && styles.chipActive]}
                    onPress={() => setFormData({ ...formData, billingCycle: c })}>
                    <Text style={[styles.chipText, formData.billingCycle === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Category</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[styles.chip, formData.category === c && styles.chipActive]}
                    onPress={() => setFormData({ ...formData, category: c })}>
                    <Text style={[styles.chipText, formData.category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Trial End Date (optional)</Text>
              <TextInput
                style={styles.input} placeholder="YYYY-MM-DD  e.g. 2025-06-15"
                placeholderTextColor="#9CA3AF" value={formData.trialEndDate}
                onChangeText={(t) => setFormData({ ...formData, trialEndDate: t })}
              />
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isPending}>
                {isPending ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.submitButtonText}>{editingId ? "Save Changes" : "Add Subscription"}</Text>}
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
