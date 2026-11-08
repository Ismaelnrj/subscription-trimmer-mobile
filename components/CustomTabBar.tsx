import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme, AppColors } from "../lib/theme";

function resolveLabel(label: unknown, fallback: string): string {
  if (typeof label === "string") return label;
  return fallback;
}

// expo-router's `href: null` shortcut (used on the "subscriptions" screen)
// rewrites that screen's options to `tabBarItemStyle: { display: "none" }`
// before descriptors ever reach a tabBar — reading that here keeps `href:
// null` in _layout.tsx as the single source of truth for tab visibility,
// instead of a second hardcoded route-name list that could drift out of sync.
function isTabVisible(tabBarItemStyle: unknown): boolean {
  const flat = StyleSheet.flatten(tabBarItemStyle as any);
  return flat?.display !== "none";
}

export function CustomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const c = useTheme();
  const styles = makeStyles(c);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes
        .filter((route) => isTabVisible(descriptors[route.key].options.tabBarItemStyle))
        .map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = state.routes[state.index]?.key === route.key;
          const label = resolveLabel(options.tabBarLabel, options.title ?? route.name);
          const color = isFocused ? c.tabBarActive : c.tabBarInactive;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: 24 })}
              <Text style={[styles.label, { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      backgroundColor: c.tabBar,
      borderTopWidth: 1,
      borderTopColor: c.tabBarBorder,
      paddingTop: 8,
    },
    tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, minHeight: 48 },
    /* Montserrat, like every other word in the app; with no family it was
       Roboto. 11 and not 12 on purpose, measured: German "Einstellungen" is
       77.4 wide at 11 in Montserrat Medium and 84.5 at 12, and a tab on a
       360dp phone is 90. At 12 it breaks mid word from a system font scale of
       about 1.07; at 11 it holds to about 1.16, roughly where the Roboto
       label broke. */
    label: { fontSize: 11, fontFamily: "Montserrat-Medium" },
  });
}
