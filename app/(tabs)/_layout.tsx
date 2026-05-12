import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";

export default function TabLayout() {
  const c = useTheme();
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
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home" size={24} color={color} />
          ),
          headerTitle: "Trimio",
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: "Subscriptions",
          tabBarLabel: "Subscriptions",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="credit-card" size={24} color={color} />
          ),
          headerTitle: "My Subscriptions",
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarLabel: "Analytics",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="chart-bar" size={24} color={color} />
          ),
          headerTitle: "Spending Analytics",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={24} color={color} />
          ),
          headerTitle: "My Profile",
        }}
      />
    </Tabs>
  );
}
