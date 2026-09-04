import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme, AppColors } from "../lib/theme";

export interface PasswordScore {
  score: 0 | 1 | 2 | 3;
  hasLength: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
}

// Kept free of colour and copy so it stays usable as a pure validity check.
// The meter maps the score to a themed colour and a translated label.
export function getPasswordScore(password: string): PasswordScore {
  const hasLength = password.length >= 8;
  const hasUpper  = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!password) return { score: 0, hasLength: false, hasUpper: false, hasNumber: false };
  const met = [hasLength, hasUpper, hasNumber].filter(Boolean).length;
  return { score: (met === 3 ? 3 : met === 2 ? 2 : 1) as 1 | 2 | 3, hasLength, hasUpper, hasNumber };
}

function scoreColor(score: number, c: AppColors): string {
  if (score >= 3) return c.success;
  if (score === 2) return c.warning;
  if (score === 1) return c.danger;
  return c.border;
}

export function isPasswordValid(password: string): boolean {
  const s = getPasswordScore(password);
  return s.hasLength && s.hasUpper && s.hasNumber;
}

type Props = { password: string };

export function PasswordStrengthMeter({ password }: Props) {
  const s = getPasswordScore(password);
  const c = useTheme();
  const { t } = useTranslation();
  if (!password) return null;
  const color = scoreColor(s.score, c);
  const label = s.score >= 3 ? t("passwordStrength.strong")
              : s.score === 2 ? t("passwordStrength.fair")
              : t("passwordStrength.weak");

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {[1, 2, 3].map((level) => (
          <View
            key={level}
            style={[styles.bar, { backgroundColor: s.score >= level ? color : c.border }]}
          />
        ))}
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
      <View style={styles.reqs}>
        <Req met={s.hasLength} text={t("passwordStrength.reqLength")} />
        <Req met={s.hasUpper}  text={t("passwordStrength.reqUpper")} />
        <Req met={s.hasNumber} text={t("passwordStrength.reqNumber")} />
      </View>
    </View>
  );
}

function Req({ met, text }: { met: boolean; text: string }) {
  const c = useTheme();
  return (
    <View style={styles.req}>
      <MaterialCommunityIcons
        name={met ? "check-circle" : "circle-outline"}
        size={13}
        color={met ? c.success : c.textMuted}
      />
      <Text style={[styles.reqText, { color: met ? c.success : c.textMuted }]}>{text}</Text>
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
  reqText: { fontSize: 12 },
});
