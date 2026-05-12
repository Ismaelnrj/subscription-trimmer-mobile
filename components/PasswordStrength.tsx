import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export interface PasswordScore {
  score: 0 | 1 | 2 | 3; // 0=empty 1=weak 2=fair 3=strong
  label: string;
  color: string;
  hasLength: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
}

export function getPasswordScore(password: string): PasswordScore {
  if (!password) return { score: 0, label: "", color: "#E5E7EB", hasLength: false, hasUpper: false, hasNumber: false };
  const hasLength = password.length >= 8;
  const hasUpper  = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const met = [hasLength, hasUpper, hasNumber].filter(Boolean).length;
  if (met === 3) return { score: 3, label: "Strong",  color: "#10B981", hasLength, hasUpper, hasNumber };
  if (met === 2) return { score: 2, label: "Fair",    color: "#F59E0B", hasLength, hasUpper, hasNumber };
  return          { score: 1, label: "Weak",    color: "#EF4444", hasLength, hasUpper, hasNumber };
}

export function isPasswordValid(password: string): boolean {
  const s = getPasswordScore(password);
  return s.hasLength && s.hasUpper && s.hasNumber;
}

type Props = { password: string };

export function PasswordStrengthMeter({ password }: Props) {
  const s = getPasswordScore(password);
  if (!password) return null;

  return (
    <View style={styles.container}>
      {/* Strength bars */}
      <View style={styles.bars}>
        {[1, 2, 3].map((level) => (
          <View
            key={level}
            style={[styles.bar, { backgroundColor: s.score >= level ? s.color : "#E5E7EB" }]}
          />
        ))}
        <Text style={[styles.label, { color: s.color }]}>{s.label}</Text>
      </View>

      {/* Requirements */}
      <View style={styles.reqs}>
        <Req met={s.hasLength} text="At least 8 characters" />
        <Req met={s.hasUpper}  text="One uppercase letter" />
        <Req met={s.hasNumber} text="One number" />
      </View>
    </View>
  );
}

function Req({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={styles.req}>
      <MaterialCommunityIcons
        name={met ? "check-circle" : "circle-outline"}
        size={13}
        color={met ? "#10B981" : "#9CA3AF"}
      />
      <Text style={[styles.reqText, met && styles.reqTextMet]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  bars: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 12, fontWeight: "700", marginLeft: 4, width: 44 },
  reqs: { gap: 4 },
  req: { flexDirection: "row", alignItems: "center", gap: 6 },
  reqText: { fontSize: 12, color: "#9CA3AF" },
  reqTextMet: { color: "#10B981" },
});
