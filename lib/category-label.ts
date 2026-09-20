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

/* THE PLAIN FUNCTION, not a hook, because the one remaining surface that shows
   a raw category is `buildTips` in app/insights.tsx, which is an ordinary
   exported function and cannot call a hook.

   It takes `t` rather than reaching for one, and that is the whole point:
   buildTips is ALREADY handed a `t`, so localising its two category strings
   needs no new parameter. This file's own history is the reason that matters.
   buildTips gained a `t` in third position once, a second call site kept
   passing a number into that slot, and every user hit
   "TypeError: 50 is not a function" on the dashboard. A fix that changes an
   exported signature to translate two strings would be trading a cosmetic bug
   for a crash. */
export function localiseCategory(
  category: string | null | undefined,
  /* This exact signature, not a narrower one, because app/insights.tsx:82
     already declares it for buildTips and both of its call sites hand it
     i18next's own `t`. Under `strict` that assignment is the part a sandbox
     cannot verify, so reusing a shape the project has already typechecked on
     a real compiler is cheaper than inventing one and hoping. */
  t: (key: string, opts?: Record<string, unknown>) => string
) {
  if (!category) return "";
  const raw = String(category);
  /* Custom categories are typed by the user and come back exactly as typed.
     Only the built-ins have a translation, and an unrecognised one falls
     back to the raw value rather than rendering an empty string, so a
     category added server side degrades to the old behaviour instead of
     blanking the row. */
  const key = KEYS[raw];
  return key ? t(key) : raw;
}

/* useCallback, unlike the sibling helpers, because the calendar screen builds
   its legend inside a useMemo and lists this function in the deps. An identity
   that changed every render would recompute the legend every render, which is
   not expensive here but makes the memo a lie. Keyed on `t`, so switching
   language still re-derives the names.

   Delegates to localiseCategory rather than repeating the lookup, so the hook
   and the plain function cannot drift into disagreeing about one category. */
export function useCategoryLabel() {
  const { t } = useTranslation();
  return useCallback(
    (category?: string | null) => localiseCategory(category, t),
    [t]
  );
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
