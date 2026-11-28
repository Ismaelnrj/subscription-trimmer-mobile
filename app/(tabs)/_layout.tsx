import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { CustomTabBar } from "../../components/CustomTabBar";
import { GlobalFab } from "../../components/GlobalFab";

export default function TabLayout() {
  const { t } = useTranslation();
  return (
    <>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        /* No title bar: every tab opens on its navy stage, which carries the
           screen's name (components/ScreenStage.tsx). */
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("tabs.dashboard"),
            tabBarLabel: t("tabs.dashboard"),
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="home" size={24} color={color} />
            ),
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
          }}
        />
        <Tabs.Screen
          name="subscriptions"
          options={{
            title: t("tabs.subscriptions"),
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
          }}
        />
      </Tabs>
      <GlobalFab />
    </>
  );
}
