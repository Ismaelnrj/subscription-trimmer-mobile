import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "../lib/auth-store";

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated, isLoading, restoreToken } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    restoreToken();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    SplashScreen.hideAsync();

    const inAuthScreen = segments[0] === "login" || segments[0] === "register";
    if (!isAuthenticated && !inAuthScreen) {
      router.replace("/login");
    } else if (isAuthenticated && inAuthScreen) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="notification-preferences" options={{ headerShown: true, title: "Notification Preferences" }} />
          <Stack.Screen name="account-settings" options={{ headerShown: true, title: "Account Settings" }} />
          <Stack.Screen name="help-support" options={{ headerShown: true, title: "Help & Support" }} />
          <Stack.Screen name="upgrade" options={{ headerShown: true, title: "Upgrade to Premium" }} />
          <Stack.Screen name="tip-jar" options={{ headerShown: true, title: "Tip Jar" }} />
          <Stack.Screen name="deals" options={{ headerShown: true, title: "Deals & Partnerships" }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
