import { useTranslation } from "react-i18next";
import { de, enUS } from "date-fns/locale";
import { format as dfFormat } from "date-fns";

/* date-fns formats month and weekday names in English unless you hand it a
   locale, and nothing in this app was handing it one. So the calendar headed
   itself "September 2026" and labelled days "Saturday" even with the app set
   to German, which is the one screen where the language mattered most.

   Pattern strings that contain only digits and separators (the "yyyy-MM-dd"
   keys this app builds its day maps from) must NOT go through here: they are
   identifiers, not display text, and a locale cannot change them but the
   intent should stay obvious at the call site. Use plain `format` for those. */

export function dateLocaleFor(language: string) {
  return language?.startsWith("de") ? de : enUS;
}

/** `const fmtD = useDateFormat()` then `fmtD(date, "EEEE, MMMM d")`. */
export function useDateFormat() {
  const { i18n } = useTranslation();
  const locale = dateLocaleFor(i18n.language);
  return (date: Date | number, pattern: string) =>
    dfFormat(date, pattern, { locale });
}

/** Which day the week starts on in the app's language: 0 Sunday, 1 Monday.

    Germany and Austria start the week on Monday, universally and by ISO 8601,
    and date-fns already knows this. The calendar grid was built with a bare
    `startOfWeek()`, which defaults to Sunday, so a German user got an American
    week. It was not a misalignment (the labels were generated Sunday-first to
    match) but it read as foreign on the app's most locale-sensitive screen. */
export function weekStartsOnFor(language: string): 0 | 1 {
  return (dateLocaleFor(language).options?.weekStartsOn ?? 0) as 0 | 1;
}

/** The seven weekday initials, in the app's language, in the locale's own order.

    Hardcoding ["S","M","T","W","T","F","S"] is wrong in German twice over:
    the letters differ and two of them collide differently, so it is not a
    translation anyone can do by swapping a string. Deriving them from the
    locale keeps them correct for any language added later, and starting from
    the locale's own first weekday keeps them lined up with a grid that does
    the same. English stays S M T W T F S; German becomes M D M D F S S. */
export function weekdayInitials(language: string): string[] {
  const locale = dateLocaleFor(language);
  const start = weekStartsOnFor(language);
  // 2026-09-06 is a Sunday, so adding `start` lands on the locale's day one.
  const sunday = new Date(2026, 8, 6);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + start + i);
    return dfFormat(d, "EEEEE", { locale });
  });
}
