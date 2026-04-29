import { BottomTabNavigationOptions, createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { PixelRatio } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const Tab = createBottomTabNavigator();

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4F46E5",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        },
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
        },
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
