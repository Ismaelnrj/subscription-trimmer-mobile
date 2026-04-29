import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "../lib/auth-store";
import { useCurrencyStore } from "../lib/currency-store";

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated, isLoading, restoreToken } = useAuthStore();
  const { loadCurrency } = useCurrencyStore();
  const router = useRouter();
  const segments = useSegments();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [, , done] = await Promise.all([
          restoreToken(),
          loadCurrency(),
          SecureStore.getItemAsync("onboarding_done"),
        ]);
        setOnboardingDone(done === "true");
      } catch {
        setOnboardingDone(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isLoading || onboardingDone === null) return;
    SplashScreen.hideAsync();

    const inAuthGroup = ["login", "register", "onboarding", "forgot-password"].includes(segments[0]);

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        router.replace(onboardingDone ? "/login" : "/onboarding");
      }
    } else {
      if (inAuthGroup) router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, onboardingDone, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="notification-preferences" options={{ headerShown: true, title: "Notification Preferences" }} />
          <Stack.Screen name="account-settings" options={{ headerShown: true, title: "Account Settings" }} />
          <Stack.Screen name="help-support" options={{ headerShown: true, title: "Help & Support" }} />
          <Stack.Screen name="upgrade" options={{ headerShown: true, title: "Upgrade to Premium" }} />
          <Stack.Screen name="tip-jar" options={{ headerShown: true, title: "Tip Jar" }} />
          <Stack.Screen name="deals" options={{ headerShown: true, title: "Deals & Partnerships" }} />
          <Stack.Screen name="verify-email" options={{ headerShown: true, title: "Verify Email" }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
