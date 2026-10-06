import { BRAND_MARKS, type BrandMark } from "./brand-mark-data";

export type { BrandMark };

/* Which brand mark, if any, belongs to a subscription with this name.

   The name must START with one of the mark's prefixes, followed by the end of
   the name or by something that is not a letter or digit. So "Netflix
   Standard", "RTL+ Basic" and "iCloud+ 50GB" match, while "Skype" does not
   match "sky". Never a substring search: the parser's history in this repo is
   what a substring search does to ordinary words.

   First match wins and tools/build-brand-marks.js orders the table most
   specific first, so "YouTube Music" gets its own mark and not YouTube's. */
export function brandMarkFor(name: string | null | undefined): BrandMark | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!n) return undefined;
  for (const mark of BRAND_MARKS) {
    for (const prefix of mark.match) {
      if (!n.startsWith(prefix)) continue;
      const next = n.charAt(prefix.length);
      if (next === "" || !/[a-z0-9À-ɏ]/.test(next)) return mark;
    }
  }
  return undefined;
}

/* The same list with every service that has a mark ahead of every service
   that does not, each group keeping its original order. Used where a handful
   of services is offered as tiles, so the row reads as logos rather than as a
   mix of logos and generic category icons. Nothing is dropped. */
export function marksFirst<T extends { name: string }>(list: readonly T[]): T[] {
  return [...list.filter((x) => brandMarkFor(x.name)), ...list.filter((x) => !brandMarkFor(x.name))];
}
