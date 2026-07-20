import { StyleSheet, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useTheme } from "../lib/theme";

// Temporary placement: mounted only on the Dashboard for now. Its real home
// is the custom bottom tab bar being built in a later phase, which will
// render this once for every tab instead of duplicating it per screen.
export function GlobalFab() {
  const router = useRouter();
  const c = useTheme();
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

  return (
    <Animated.View style={[styles.wrap, animatedStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[styles.button, { backgroundColor: c.primary }]}
      >
        <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 20, bottom: 90 },
  button: {
    width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
