import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../lib/api";
import { useState } from "react";

const BILLING_CYCLES = ["monthly", "yearly", "weekly"];
const CATEGORIES = ["entertainment", "streaming", "software", "health", "fitness", "food", "education", "other"];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 32 },
  addButton: {
    backgroundColor: "#4F46E5", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16,
    marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  addButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  subscriptionCard: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  subscriptionInfo: { flex: 1 },
  subscriptionName: { fontSize: 14, fontWeight: "600", color: "#1F2937", marginBottom: 4 },
  subscriptionPrice: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  subscriptionDate: { fontSize: 11, color: "#9CA3AF" },
  categoryBadge: {
    alignSelf: "flex-start", backgroundColor: "#EEF2FF", borderRadius: 4,
    paddingVertical: 2, paddingHorizontal: 6, marginTop: 4,
  },
  categoryBadgeText: { fontSize: 10, color: "#4F46E5", fontWeight: "600", textTransform: "capitalize" },
  actionButtons: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 36, height: 36, borderRadius: 6, backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
  },
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyStateIcon: { marginBottom: 12 },
  emptyStateText: { fontSize: 14, color: "#6B7280", textAlign: "center" },
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
});

const emptyForm = { name: "", price: "", billingCycle: "monthly", category: "other" };

export default function SubscriptionsScreen() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions", "list"],
    queryFn: async () => {
      const response = await apiClient.get("/trpc/subscriptions.list");
      return response.data.result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post("/trpc/subscriptions.create", data);
      return response.data.result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post("/trpc/subscriptions.update", data);
      return response.data.result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post("/trpc/subscriptions.delete", { id });
      return response.data.result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  const openAdd = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (sub: any) => {
    setEditingId(sub.id);
    setFormData({ name: sub.name, price: String(sub.price), billingCycle: sub.billingCycle, category: sub.category });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.price) {
      Alert.alert("Error", "Please enter a name and price.");
      return;
    }
    const data = { name: formData.name.trim(), price: parseFloat(formData.price), billingCycle: formData.billingCycle, category: formData.category };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const confirmDelete = (id: number, name: string) => {
    Alert.alert("Delete Subscription", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <TouchableOpacity style={styles.addButton} onPress={openAdd}>
            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add Subscription</Text>
          </TouchableOpacity>

          {subscriptions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="inbox" size={48} color="#D1D5DB" style={styles.emptyStateIcon} />
              <Text style={styles.emptyStateText}>No subscriptions yet</Text>
            </View>
          ) : (
            subscriptions.map((sub: any) => (
              <View key={sub.id} style={styles.subscriptionCard}>
                <View style={styles.subscriptionInfo}>
                  <Text style={styles.subscriptionName}>{sub.name}</Text>
                  <Text style={styles.subscriptionPrice}>${sub.price} / {sub.billingCycle}</Text>
                  <Text style={styles.subscriptionDate}>
                    Next: {new Date(sub.nextBillingDate).toLocaleDateString()}
                  </Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{sub.category}</Text>
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
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingId ? "Edit Subscription" : "Add Subscription"}</Text>

              <TextInput
                style={styles.input}
                placeholder="Subscription name (e.g., Netflix)"
                placeholderTextColor="#9CA3AF"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Price (e.g., 9.99)"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
              />

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

              <Text style={styles.label}>Category</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, formData.category === cat && styles.chipActive]}
                    onPress={() => setFormData({ ...formData, category: cat })}
                  >
                    <Text style={[styles.chipText, formData.category === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isPending}>
                <Text style={styles.submitButtonText}>
                  {isPending ? "Saving..." : editingId ? "Save Changes" : "Add Subscription"}
                </Text>
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
