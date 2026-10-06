import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { brandMarkFor, monogramFor } from "../lib/brand-marks";
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
   navy rather than vanishing into white.

   A SERVICE WITH NO MARK GETS ITS FIRST LETTER, not its category icon. Beside
   five real logos a category icon read as a logo that failed to load (the
   owner's reading of Disney+ on the first-run card, 2026-10-06), while a
   letter on the same white circle reads as deliberate. Ink Navy on white is
   14.6:1. The category icon remains only for a name with nothing in it. */
export function LogoImage({ name, category, size = 36 }: Props) {
  const c = useTheme();
  const mark = brandMarkFor(name);
  const wrapStyle = { width: size, height: size, borderRadius: size / 2 };

  if (!mark) {
    const letter = monogramFor(name);
    if (letter) {
      return (
        <View style={[styles.wrap, wrapStyle, styles.ring, styles.monogramGround, { borderColor: c.border }]}>
          {/* Fixed size inside a fixed circle: system font scaling would push
              the letter out of it, and the name beside it already scales. */}
          <Text allowFontScaling={false} style={[styles.monogram, { fontSize: Math.round(size * 0.44) }]}>
            {letter}
          </Text>
        </View>
      );
    }
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
  // Ink Navy on white in both themes, matching the white ground the marks use.
  monogramGround: { backgroundColor: "#FFFFFF" },
  monogram: { color: "#142B3A", fontFamily: "Montserrat-Bold", fontWeight: "700", textAlign: "center", includeFontPadding: false },
});
