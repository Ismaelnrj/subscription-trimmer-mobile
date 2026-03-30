import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../lib/api";
import { useState } from "react";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  addButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  subscriptionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  subscriptionPrice: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  subscriptionDate: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyStateIcon: {
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 14,
    color: "#1F2937",
  },
  submitButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  cancelButtonText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default function SubscriptionsScreen() {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    billingCycle: "monthly",
    category: "other",
  });

  const queryClient = useQueryClient();

  const { data: subscriptions = [], isLoading } = useQuery({
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
      setShowModal(false);
      setFormData({ name: "", price: "", billingCycle: "monthly", category: "other" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post("/trpc/subscriptions.delete", { id });
      return response.data.result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });

  const handleAddSubscription = () => {
    if (formData.name && formData.price) {
      createMutation.mutate({
        name: formData.name,
        price: parseFloat(formData.price),
        billingCycle: formData.billingCycle,
        category: formData.category,
      });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add Subscription</Text>
          </TouchableOpacity>

          {subscriptions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="inbox"
                size={48}
                color="#D1D5DB"
                style={styles.emptyStateIcon}
              />
              <Text style={styles.emptyStateText}>No subscriptions yet</Text>
            </View>
          ) : (
            subscriptions.map((sub: any) => (
              <View key={sub.id} style={styles.subscriptionCard}>
                <View style={styles.subscriptionInfo}>
                  <Text style={styles.subscriptionName}>{sub.name}</Text>
                  <Text style={styles.subscriptionPrice}>
                    ${sub.price} / {sub.billingCycle}
                  </Text>
                  <Text style={styles.subscriptionDate}>
                    Next: {new Date(sub.nextBillingDate).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.iconButton}>
                    <MaterialCommunityIcons name="pencil" size={18} color="#4F46E5" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => deleteMutation.mutate(sub.id)}
                  >
                    <MaterialCommunityIcons name="trash-can" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Subscription Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Subscription</Text>

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

            <TouchableOpacity style={styles.submitButton} onPress={handleAddSubscription}>
              <Text style={styles.submitButtonText}>
                {createMutation.isPending ? "Adding..." : "Add Subscription"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
