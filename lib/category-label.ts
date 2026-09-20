import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CATEGORY_ICON } from "./categories";

/* Category names are stored as the raw lowercase strings the API uses, and
   every surface that shows one renders it straight through a
   `textTransform: "capitalize"`. In English that reads acceptably by accident,
   which is why it survived: "streaming", "software" and "fitness" are the same
   word in both languages, so the ones that are NOT ("entertainment",
   "insurance", "memberships", "utilities") sit in a German UI looking like an
   oversight rather than a bug.

   The calendar legend is the first surface where the name carries the whole
   meaning rather than labelling something already identifiable, so it is the
   first place the gap actually costs something: a dot with an English word
   beside it in a German app says the colour is a guess.

   A record of literal keys rather than a `categoryNames.${cat}` template, for
   the same reason lib/cycle-label.ts uses one: a key built by interpolation is
   invisible to a grep for t("..."), which is how this project checks that both
   locale files carry every key a screen asks for. */
const KEYS: Record<string, string> = {
  entertainment: "categoryNames.entertainment",
  streaming: "categoryNames.streaming",
  software: "categoryNames.software",
  health: "categoryNames.health",
  fitness: "categoryNames.fitness",
  food: "categoryNames.food",
  education: "categoryNames.education",
  utilities: "categoryNames.utilities",
  insurance: "categoryNames.insurance",
  memberships: "categoryNames.memberships",
  other: "categoryNames.other",
};

/* useCallback, unlike the sibling helpers, because the calendar screen builds
   its legend inside a useMemo and lists this function in the deps. An identity
   that changed every render would recompute the legend every render, which is
   not expensive here but makes the memo a lie. Keyed on `t`, so switching
   language still re-derives the names. */
export function useCategoryLabel() {
  const { t } = useTranslation();
  return useCallback((category?: string | null) => {
    if (!category) return "";
    const raw = String(category);
    /* Custom categories are typed by the user and come back exactly as typed.
       Only the built-ins have a translation, and an unrecognised one falls
       back to the raw value rather than rendering an empty string, so a
       category added server side degrades to the old behaviour instead of
       blanking the row. */
    const key = KEYS[raw];
    return key ? t(key) : raw;
  }, [t]);
}

/* The category whose COLOUR a subscription actually draws.

   getCategoryIcon falls back to `other` for anything it does not recognise, so
   every custom category shares one grey. A legend built from raw category
   names would list "gaming" and "books" as two entries against a single grey
   dot, claiming a distinction the calendar does not draw. Same shape as the
   markedDates/renewalCounts split already in the calendar screen: derive from
   what is DRAWN, never from what the data happens to say. */
export function canonicalCategory(category?: string | null) {
  const raw = category ? String(category) : "other";
  return CATEGORY_ICON[raw] ? raw : "other";
}
