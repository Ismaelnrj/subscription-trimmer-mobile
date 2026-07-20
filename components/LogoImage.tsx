import { useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { findTemplateByExactName } from "../lib/service-templates";
import { getCategoryIcon } from "../lib/categories";

interface Props {
  name: string;
  category: string;
  size?: number;
}

export function LogoImage({ name, category, size = 36 }: Props) {
  const domain = findTemplateByExactName(name)?.domain;
  const [failed, setFailed] = useState(false);
  const { icon, color } = getCategoryIcon(category);
  const wrapStyle = { width: size, height: size, borderRadius: size / 2 };

  if (!domain || failed) {
    return (
      <View style={[styles.wrap, wrapStyle, { backgroundColor: color + "22" }]}>
        <MaterialCommunityIcons name={icon as any} size={size * 0.5} color={color} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, wrapStyle, { backgroundColor: color + "22" }]}>
      <Image
        source={{ uri: `https://logo.clearbit.com/${domain}?size=128` }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
