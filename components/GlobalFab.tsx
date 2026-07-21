import { StyleSheet, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useTheme } from "../lib/theme";

// Roughly matches CustomTabBar's rendered height (paddingTop 8 + icon 24 +
// gap 2 + label ~14 + its own paddingBottom), plus a bit of breathing room.
const TAB_BAR_CONTENT_HEIGHT = 48;
const FAB_GAP_ABOVE_BAR = 12;

export function GlobalFab() {
  const router = useRouter();
  const pathname = usePathname();
  const c = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1);
  };
  const handlePress = () => {
    router.push("/(tabs)/subscriptions?from=fab");
  };

  // Subscriptions already has its own persistent add button, so the
  // floating one would just duplicate it (and could sit over the last row
  // of a long list) — skip rendering it there.
  if (pathname === "/subscriptions") return null;

  const bottomOffset = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8) + FAB_GAP_ABOVE_BAR;

  return (
    <Animated.View style={[styles.wrap, { bottom: bottomOffset }, animatedStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={t("fab.addSubscription")}
        style={[styles.button, { backgroundColor: c.primary }]}
      >
        <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 20 },
  button: {
    width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
