import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import apiClient from "../lib/api";
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
  generateButton: {
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
  generateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  insightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  insightContent: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  recommendationItem: {
    backgroundColor: "#F0F9FF",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#4F46E5",
  },
  recommendationText: {
    fontSize: 13,
    color: "#1F2937",
    lineHeight: 18,
  },
  savingsHighlight: {
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
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
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
});

export default function InsightsScreen() {
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: insights, isLoading, refetch } = useQuery({
    queryKey: ["insights", "recommendations"],
    queryFn: async () => {
      const response = await apiClient.get("/trpc/insights.getRecommendations");
      return response.data.result.data;
    },
    enabled: false,
  });

  const handleGenerateInsights = async () => {
    setIsGenerating(true);
    try {
      await refetch();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "AI Insights" }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scrollContent}>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateInsights}
            disabled={isGenerating || isLoading}
          >
            {isGenerating || isLoading ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.generateButtonText}>Analyzing...</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="sparkles" size={18} color="#FFFFFF" />
                <Text style={styles.generateButtonText}>Generate AI Insights</Text>
              </>
            )}
          </TouchableOpacity>

          {!insights ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="lightbulb-outline"
                size={48}
                color="#D1D5DB"
                style={styles.emptyStateIcon}
              />
              <Text style={styles.emptyStateText}>
                Click the button above to get personalized AI recommendations
              </Text>
            </View>
          ) : (
            <>
              {/* Key Insights */}
              <View style={styles.insightCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <MaterialCommunityIcons name="lightbulb" size={20} color="#F59E0B" />
                  <Text style={styles.insightTitle}>Key Insights</Text>
                </View>
                <Text style={styles.insightContent}>{insights.keyInsights}</Text>
              </View>

              {/* Top Recommendations */}
              <View style={styles.insightCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <MaterialCommunityIcons name="target" size={20} color="#4F46E5" />
                  <Text style={styles.insightTitle}>Top Recommendations</Text>
                </View>
                {insights.topRecommendations?.map((rec: string, idx: number) => (
                  <View key={idx} style={styles.recommendationItem}>
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>

              {/* Potential Savings */}
              <View style={styles.insightCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <MaterialCommunityIcons name="cash-multiple" size={20} color="#10B981" />
                  <Text style={styles.insightTitle}>Potential Savings</Text>
                </View>
                <View style={styles.savingsHighlight}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#059669" />
                  <Text style={styles.savingsText}>
                    Save up to ${insights.estimatedSavings?.toFixed(2) ?? "0"}/month
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}
