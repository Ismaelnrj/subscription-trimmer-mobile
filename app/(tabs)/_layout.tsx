import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../lib/theme";
import { CustomTabBar } from "../../components/CustomTabBar";
import { GlobalFab } from "../../components/GlobalFab";

export default function TabLayout() {
  const c = useTheme();
  const { t } = useTranslation();
  return (
    <>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
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
          name="calendar"
          options={{
            title: t("tabs.calendar"),
            tabBarLabel: t("tabs.calendar"),
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="calendar-month-outline" size={24} color={color} />
            ),
            headerTitle: t("tabs.headerCalendar"),
          }}
        />
        <Tabs.Screen
          name="subscriptions"
          options={{
            title: t("tabs.subscriptions"),
            headerTitle: t("tabs.headerSubscriptions"),
            href: null,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: t("tabs.stats"),
            tabBarLabel: t("tabs.stats"),
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="chart-bar" size={24} color={color} />
            ),
            headerTitle: t("tabs.headerAnalytics"),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("tabs.settings"),
            tabBarLabel: t("tabs.settings"),
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="cog-outline" size={24} color={color} />
            ),
            headerTitle: t("tabs.headerProfile"),
          }}
        />
      </Tabs>
      <GlobalFab />
    </>
  );
}
