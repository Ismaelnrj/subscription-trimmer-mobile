import { useTranslation } from "react-i18next";

/* The billing cycle is stored as the raw string the API uses, "monthly",
   "yearly", "weekly", and six screens rendered it straight into the UI as
   `{price} / {billingCycle}`. In English that reads acceptably by accident.
   In German it printed "9,99 € / monthly", which is neither language.

   These are the noun forms on purpose: German wants "pro Monat", not "pro
   monatlich", so reusing dashboard.monthly ("Monatlich", an adjective) would
   have produced grammatical nonsense in the one place it shows up most. */

const KEYS: Record<string, string> = {
  monthly: "common.cycleMonthly",
  yearly: "common.cycleYearly",
  annual: "common.cycleYearly",
  weekly: "common.cycleWeekly",
};

export function useCycleLabel() {
  const { t } = useTranslation();
  return (cycle?: string | null) => {
    if (!cycle) return "";
    const key = KEYS[String(cycle).toLowerCase()];
    // An unrecognised cycle falls back to whatever the API said rather than
    // rendering an empty string, so a new value added server side degrades to
    // the old behaviour instead of silently blanking the price line.
    return key ? t(key) : String(cycle);
  };
}

/* THE ADJECTIVE FORM, and it exists because the noun form above is wrong for a
   standalone label. "pro Monat" needs the noun ("Monat"); a chip in the add
   subscription form that you TAP to choose a cycle needs the adjective
   ("Monatlich"). Using either one in the other's place is the grammatical
   nonsense the comment above already warns about, in the opposite direction.

   The cycle chips rendered the raw API string, so a German user picking a
   billing cycle read "Monthly", "Yearly" and "Weekly" in the busiest form in
   the app. `textTransform: "capitalize"` on the chip made that look deliberate
   rather than untranslated. */
const ADJECTIVE_KEYS: Record<string, string> = {
  monthly: "common.cycleAdjMonthly",
  yearly: "common.cycleAdjYearly",
  annual: "common.cycleAdjYearly",
  weekly: "common.cycleAdjWeekly",
};

export function useCycleAdjective() {
  const { t } = useTranslation();
  return (cycle?: string | null) => {
    if (!cycle) return "";
    const key = ADJECTIVE_KEYS[String(cycle).toLowerCase()];
    // Same fallback rule as useCycleLabel: an unrecognised cycle degrades to
    // whatever the API said rather than rendering an empty chip.
    return key ? t(key) : String(cycle);
  };
}
