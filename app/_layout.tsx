import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Alert } from "react-native";

// Catch JS errors in release builds and show them on screen before crashing
if (typeof global !== "undefined" && (global as any).ErrorUtils) {
  const orig = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    Alert.alert(
      isFatal ? "Fatal JS Error" : "JS Error",
      (error?.message || String(error)) + "\n\n" + (error?.stack?.slice(0, 400) || "")
    );
    orig?.(error, isFatal);
  });
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
