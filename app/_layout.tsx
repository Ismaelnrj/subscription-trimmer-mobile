import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SecureStore from "expo-secure-store";
import * as Sentry from "sentry-expo";
import { useEffect, useState, Component, ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "../lib/auth-store";
import { useCurrencyStore } from "../lib/currency-store";
import { requestNotificationPermission } from "../lib/notification-scheduler";
import { retryPendingPremiumSync } from "../lib/iap";
import { useTheme } from "../lib/theme";

// Sentry DSNs are write-only ingest endpoints, not secrets — anyone with it
// can only submit error events, not read project data. Safe to ship in client code.
Sentry.init({
  dsn: "https://5b30942b14811df56225d1264a1841be@o4511377765367808.ingest.de.sentry.io/4511377795907664",
  enableInExpoDevelopment: true,
  debug: false,
});

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    Sentry.Native.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errStyles.container}>
          <Text style={errStyles.title}>Something went wrong</Text>
          <Text style={errStyles.message}>{this.state.error}</Text>
          <TouchableOpacity style={errStyles.button} onPress={() => this.setState({ hasError: false, error: "" })}>
            <Text style={errStyles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#F9FAFB" },
  title: { fontSize: 20, fontWeight: "700", color: "#1F2937", marginBottom: 12 },
  message: { fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 24 },
  button: { backgroundColor: "#4F46E5", paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated, isLoading, restoreToken } = useAuthStore();
  const { loadCurrency, fetchRates } = useCurrencyStore();
  const router = useRouter();
  const segments = useSegments();
  const c = useTheme();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [, , done] = await Promise.all([
          restoreToken(),
          loadCurrency(),
          SecureStore.getItemAsync("onboarding_done"),
        ]);
        fetchRates();
        setOnboardingDone(done === "true");
        requestNotificationPermission();
        if (useAuthStore.getState().isAuthenticated) {
          retryPendingPremiumSync();
        }
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
      <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: c.card },
          headerTitleStyle: { color: c.text },
          headerTintColor: c.primary,
          contentStyle: { backgroundColor: c.bg },
        }}>
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
          <Stack.Screen name="refer-a-friend" options={{ headerShown: true, title: "Refer a Friend" }} />
          <Stack.Screen name="verify-email" options={{ headerShown: true, title: "Verify Email" }} />
          <Stack.Screen name="insights" options={{ headerShown: true, title: "Recommendations" }} />
          <Stack.Screen name="terms-of-service" options={{ headerShown: true, title: "Terms of Service" }} />
          <Stack.Screen name="privacy-policy" options={{ headerShown: true, title: "Privacy Policy" }} />
          <Stack.Screen name="alerts" options={{ headerShown: true, title: "Alerts" }} />
          <Stack.Screen name="notifications" options={{ headerShown: true, title: "Notifications" }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
