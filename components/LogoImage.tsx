import { View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { brandMarkFor } from "../lib/brand-marks";
import { getCategoryIcon } from "../lib/categories";
import { useTheme } from "../lib/theme";

interface Props {
  name: string;
  category: string;
  size?: number;
}

/* The service's own mark, drawn from data bundled in the app
   (lib/brand-mark-data.ts), or its category icon when there is none.

   THIS USED TO LOAD logo.clearbit.com, which HubSpot shut down in December
   2025. Every request failed, so every row in the app showed a category icon
   and nothing said so. Bundled marks cannot go dark that way, and no third
   party learns which services somebody pays for.

   The ground behind each mark is white or Ink Navy, whichever the brand colour
   reaches 3:1 against (measured by the generator), so Spotify green sits on
   navy rather than vanishing into white. */
export function LogoImage({ name, category, size = 36 }: Props) {
  const c = useTheme();
  const mark = brandMarkFor(name);
  const wrapStyle = { width: size, height: size, borderRadius: size / 2 };

  if (!mark) {
    const { icon, color } = getCategoryIcon(category);
    return (
      <View style={[styles.wrap, wrapStyle, { backgroundColor: color + "22" }]}>
        <MaterialCommunityIcons name={icon as any} size={size * 0.5} color={color} />
      </View>
    );
  }

  const glyph = Math.round(size * 0.56);
  return (
    <View style={[styles.wrap, wrapStyle, styles.ring, { backgroundColor: mark.ground, borderColor: c.border }]}>
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
        <Path d={mark.path} fill={mark.hex} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ring: { borderWidth: StyleSheet.hairlineWidth },
});
