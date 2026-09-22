import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SecureStore from "expo-secure-store";
import * as Sentry from "@sentry/react-native";
import { useFonts } from "expo-font";
import { useEffect, useState, Component, ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/query-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "../lib/auth-store";
import { useCurrencyStore } from "../lib/currency-store";
import { useThemeStore } from "../lib/theme-store";
import { requestNotificationPermission } from "../lib/notification-scheduler";
import { retryPendingPremiumSync } from "../lib/iap";
import { initAnalytics, track } from "../lib/analytics";
import { useTheme } from "../lib/theme";
import { useLanguageStore } from "../lib/language-store";
import { useTranslation } from "react-i18next";
import { AnimatedSplash } from "../components/AnimatedSplash";
import { UpdateAvailableModal } from "../components/UpdateAvailableModal";
import i18n from "../lib/i18n";

// Sentry DSNs are write-only ingest endpoints, not secrets — anyone with it
// can only submit error events, not read project data. Safe to ship in client code.
Sentry.init({
  dsn: "https://5b30942b14811df56225d1264a1841be@o4511377765367808.ingest.de.sentry.io/4511377795907664",
  debug: false,
});

initAnalytics();

/* The error boundary is the last thing standing when everything else has
   failed, so it must never throw itself. It cannot use useTranslation (it is a
   class component) and it cannot assume i18n survived whatever crashed, so it
   reads the instance directly inside a try and falls back to English. An
   untranslated fallback is a small cost; a boundary that throws while
   rendering the crash screen leaves a white screen and no Sentry event. */
function safeT(key: string, fallback: string): string {
  try {
    const s = i18n.t(key);
    return typeof s === "string" && s && s !== key ? s : fallback;
  } catch {
    return fallback;
  }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errStyles.container}>
          <Text style={errStyles.title}>{safeT("common.somethingWentWrong", "Something went wrong")}</Text>
          <Text style={errStyles.message}>{this.state.error}</Text>
          <TouchableOpacity style={errStyles.button} onPress={() => this.setState({ hasError: false, error: "" })}>
            <Text style={errStyles.buttonText}>{safeT("common.tryAgain", "Try again")}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#F7F6F1" },
  title: { fontSize: 20, fontWeight: "700", color: "#142B3A", marginBottom: 12 },
  message: { fontSize: 13, color: "#52616B", textAlign: "center", marginBottom: 24 },
  button: { backgroundColor: "#142B3A", paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated, isLoading, restoreToken } = useAuthStore();
  const { loadCurrency, fetchRates } = useCurrencyStore();
  const { loadMode } = useThemeStore();
  const { loadLanguage } = useLanguageStore();
  const router = useRouter();
  const segments = useSegments();
  // Subscribes to language changes, so headers repaint on the toggle
  // rather than waiting for a remount.
  const { t } = useTranslation();
  const c = useTheme();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [fontsLoaded] = useFonts({
    "Montserrat-Regular": require("../assets/fonts/Montserrat-Regular.ttf"),
    "Montserrat-Medium": require("../assets/fonts/Montserrat-Medium.ttf"),
    "Montserrat-SemiBold": require("../assets/fonts/Montserrat-SemiBold.ttf"),
    "Montserrat-Bold": require("../assets/fonts/Montserrat-Bold.ttf"),
    "Montserrat-ExtraBold": require("../assets/fonts/Montserrat-ExtraBold.ttf"),
  });

  useEffect(() => {
    const init = async () => {
      try {
        const [, , done] = await Promise.all([
          restoreToken(),
          loadCurrency(),
          SecureStore.getItemAsync("onboarding_done"),
          loadMode(),
        ]);
        await loadLanguage();
        fetchRates();
        setOnboardingDone(done === "true");
        requestNotificationPermission();
        if (useAuthStore.getState().isAuthenticated) {
          retryPendingPremiumSync();
        }
      } catch {
        setOnboardingDone(false);
      } finally {
        /* THE RETENTION EVENT, and the only one this app has. Nothing else
           fires on a plain launch, so without it acquisition and conversion are
           measurable and coming BACK is not, which for a renewal reminder app
           is the half that matters.
           IN `finally` ON PURPOSE: the app opened whether or not the restore
           above threw, and a failed restore is exactly the session worth
           seeing.
           AFTER the awaits rather than at the top of the effect, because
           `restoreToken` is what calls `identifyUser`, so firing earlier would
           attribute a returning user's launch to an anonymous device id.
           IT COUNTS COLD STARTS, not resumes: this effect runs once per JS
           context, and a warm resume from the background does not remount. That
           is the honest definition, and it is the one to remember before
           reading these numbers as "opens". */
        track("app_opened", { authenticated: useAuthStore.getState().isAuthenticated });
      }
    };
    init();
  }, []);

  // Hide the native (OS-level, icon-only) splash as soon as this tree has
  // mounted, rather than waiting on auth/data restoration — that network
  // call can take much longer than a splash screen should, especially on a
  // cold backend start. AnimatedSplash (rendered below) takes over
  // immediately underneath and owns its own "hold until ready" behavior, so
  // the user sees the fully-branded illustration for the actual wait
  // instead of the bare OS icon.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (isLoading || onboardingDone === null) return;

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
    <SafeAreaProvider>
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
          <Stack.Screen name="notification-preferences" options={{ headerShown: true, title: t("screenTitles.notificationPreferences") }} />
          <Stack.Screen name="account-settings" options={{ headerShown: true, title: t("screenTitles.accountSettings") }} />
          <Stack.Screen name="help-support" options={{ headerShown: true, title: t("screenTitles.helpSupport") }} />
          <Stack.Screen name="upgrade" options={{ headerShown: true, title: t("screenTitles.upgrade") }} />
          <Stack.Screen name="tip-jar" options={{ headerShown: true, title: t("screenTitles.tipJar") }} />
          <Stack.Screen name="refer-a-friend" options={{ headerShown: true, title: t("screenTitles.referAFriend") }} />
          <Stack.Screen name="verify-email" options={{ headerShown: true, title: t("screenTitles.verifyEmail") }} />
          <Stack.Screen name="insights" options={{ headerShown: true, title: t("screenTitles.insights") }} />
          <Stack.Screen name="cancelled" options={{ headerShown: true, title: t("screenTitles.cancelled") }} />
          <Stack.Screen name="terms-of-service" options={{ headerShown: true, title: t("screenTitles.termsOfService") }} />
          <Stack.Screen name="privacy-policy" options={{ headerShown: true, title: t("screenTitles.privacyPolicy") }} />
          <Stack.Screen name="alerts" options={{ headerShown: true, title: t("screenTitles.alerts") }} />
          <Stack.Screen name="notifications" options={{ headerShown: true, title: t("screenTitles.notifications") }} />
          <Stack.Screen name="cancel-guide" options={{ headerShown: true, title: t("screenTitles.cancelGuide") }} />
          <Stack.Screen name="subscription-details" options={{ headerShown: true, title: t("screenTitles.subscriptionDetails") }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        {showAnimatedSplash ? (
          <AnimatedSplash
            ready={!isLoading && onboardingDone !== null && fontsLoaded}
            onFinish={() => setShowAnimatedSplash(false)}
          />
        ) : null}
        <UpdateAvailableModal />
      </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
