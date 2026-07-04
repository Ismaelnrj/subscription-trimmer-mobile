import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../lib/theme";

export default function TabLayout() {
  const c = useTheme();
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.tabBarActive,
        tabBarInactiveTintColor: c.tabBarInactive,
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
          borderTopWidth: 1,
          borderTopColor: c.tabBarBorder,
          backgroundColor: c.tabBar,
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: c.card,
        },
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
          color: c.text,
        },
        headerTintColor: c.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.dashboard"),
          tabBarLabel: t("tabs.dashboard"),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home" size={24} color={color} />
          ),
          headerTitle: "Trimio",
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: t("tabs.subscriptions"),
          tabBarLabel: t("tabs.subscriptions"),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="credit-card" size={24} color={color} />
          ),
          headerTitle: t("tabs.headerSubscriptions"),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t("tabs.analytics"),
          tabBarLabel: t("tabs.analytics"),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="chart-bar" size={24} color={color} />
          ),
          headerTitle: t("tabs.headerAnalytics"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarLabel: t("tabs.profile"),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={24} color={color} />
          ),
          headerTitle: t("tabs.headerProfile"),
        }}
      />
    </Tabs>
  );
}
