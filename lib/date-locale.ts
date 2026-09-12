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

/** The seven weekday initials, in the app's language, starting Sunday.

    Hardcoding ["S","M","T","W","T","F","S"] is wrong in German twice over:
    the letters differ (S M D M D F S) and two of them collide differently,
    so it is not a translation anyone can do by swapping a string. Deriving
    them from the locale keeps them correct for any language added later. */
export function weekdayInitials(language: string): string[] {
  const locale = dateLocaleFor(language);
  // 2026-09-06 is a Sunday, so this walks Sun..Sat in order.
  const sunday = new Date(2026, 8, 6);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return dfFormat(d, "EEEEE", { locale });
  });
}
