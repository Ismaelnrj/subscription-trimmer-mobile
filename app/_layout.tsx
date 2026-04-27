import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Alert } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";

if (typeof global !== "undefined" && (global as any).ErrorUtils) {
  (global as any).ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    Alert.alert(
      isFatal ? "Fatal JS Error" : "JS Error",
      (error?.message || String(error)) + "\n\n" + (error?.stack?.slice(0, 400) || "")
    );
  });
}

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
