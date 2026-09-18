import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  getDate,
  lastDayOfMonth,
  setDate,
  startOfDay,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { parseApiDate } from "./utils";

export interface RecurringSub {
  nextBillingDate: string | Date;
  billingCycle: string;
  /** The day of the month this subscription is really billed on.
   *
   *  nextBillingDate cannot carry it. A subscription due on the 31st has to be
   *  written as 28 February in a February, so projecting from the stored date
   *  alone draws every later month on the 28th while the server bills on the
   *  31st: the calendar and the charge disagree. Optional because rows created
   *  before the column exists have none, in which case the stored date's own
   *  day is the best available answer and is exactly what was used before. */
  billingAnchorDay?: number | null;
}

function anchorDayOf(sub: RecurringSub, anchor: Date): number {
  const d = Number(sub.billingAnchorDay);
  return Number.isInteger(d) && d >= 1 && d <= 31 ? d : getDate(anchor);
}

/**
 * Projects every occurrence of a recurring subscription that falls within the
 * given month, in both directions from `nextBillingDate` (the calendar has no
 * concept of a subscription's original start date, so month/year cycles are
 * assumed to recur indefinitely on the same day-of-month/day-of-year).
 */
export function getOccurrencesInMonth(sub: RecurringSub, monthDate: Date): Date[] {
  /* parseApiDate, not new Date(). The API sends TIMESTAMPTZ as an instant at
     midnight UTC, so new Date() on it lands on the PREVIOUS local day anywhere
     west of UTC, and every occurrence this projects inherits that shift. */
  const anchor = parseApiDate(sub.nextBillingDate);
  if (!anchor || isNaN(anchor.getTime())) return [];

  const rangeStart = startOfMonth(monthDate);
  const rangeEnd = endOfMonth(monthDate);

  // Weekly has no day-of-month to preserve, so the anchor day never applies.
  if (sub.billingCycle === "weekly") return getWeeklyOccurrences(anchor, rangeStart, rangeEnd);
  const anchorDay = anchorDayOf(sub, anchor);
  if (sub.billingCycle === "yearly") return getYearlyOccurrence(anchor, anchorDay, rangeStart);
  return getMonthlyOccurrence(anchorDay, rangeStart);
}

function getWeeklyOccurrences(anchor: Date, rangeStart: Date, rangeEnd: Date): Date[] {
  const period = 7;
  const daysFromAnchorToRangeStart = differenceInCalendarDays(rangeStart, anchor);
  const k = Math.floor(daysFromAnchorToRangeStart / period);
  let candidate = addDays(anchor, k * period);
  while (candidate < rangeStart) candidate = addDays(candidate, period);

  const results: Date[] = [];
  while (candidate <= rangeEnd) {
    results.push(candidate);
    candidate = addDays(candidate, period);
  }
  return results;
}

// Clamps the anchor's day-of-month into the target month (e.g. a subscription
// anchored on the 31st falls on the 28th/29th in February). Clamping happens
// per month from the true anchor day, so it never compounds: February draws the
// 28th and March goes back to the 31st.
function getMonthlyOccurrence(anchorDay: number, targetMonthStart: Date): Date[] {
  const day = Math.min(anchorDay, getDate(lastDayOfMonth(targetMonthStart)));
  return [setDate(targetMonthStart, day)];
}

// Only occurs once a year, in the anchor's month; clamps Feb 29 -> Feb 28 in
// non-leap years the same way the monthly case clamps month-end overflow.
function getYearlyOccurrence(anchor: Date, anchorDay: number, targetMonthStart: Date): Date[] {
  if (targetMonthStart.getMonth() !== anchor.getMonth()) return [];
  const day = Math.min(anchorDay, getDate(lastDayOfMonth(targetMonthStart)));
  return [setDate(targetMonthStart, day)];
}

export interface UpcomingOccurrence<T extends RecurringSub> {
  sub: T;
  date: Date;
}

/**
 * Every occurrence across all subs, from `fromDate` through `windowDays`
 * later (inclusive), sorted chronologically — the data source for a
 * "what's coming up" timeline view, as opposed to a single month's grid.
 */
export function getUpcomingOccurrences<T extends RecurringSub>(
  subs: T[],
  fromDate: Date,
  windowDays: number
): UpcomingOccurrence<T>[] {
  const rangeStart = startOfDay(fromDate);
  const rangeEnd = addDays(rangeStart, windowDays);
  const results: UpcomingOccurrence<T>[] = [];

  // getOccurrencesInMonth projects both forward and backward from each sub's
  // anchor (needed for the Calendar grid, which can browse past months). A
  // timeline of "what's coming up" must never show a phantom occurrence
  // before the tracked next-billing-date itself, even if that date is in
  // the past relative to `fromDate` (e.g. a stale anchor) — only ever clamp
  // it forward to `rangeStart`, never let it suppress real future
  // occurrences. Computed once per sub since it doesn't vary by month.
  const earliestAllowedBySub = new Map<T, Date>();
  for (const sub of subs) {
    const anchor = parseApiDate(sub.nextBillingDate);
    if (!anchor || isNaN(anchor.getTime())) continue;
    earliestAllowedBySub.set(sub, rangeStart > anchor ? rangeStart : startOfDay(anchor));
  }

  let cursor = startOfMonth(rangeStart);
  const lastMonth = startOfMonth(rangeEnd);
  while (cursor <= lastMonth) {
    for (const sub of subs) {
      const earliestAllowed = earliestAllowedBySub.get(sub);
      if (!earliestAllowed) continue;
      for (const date of getOccurrencesInMonth(sub, cursor)) {
        if (date >= earliestAllowed && date <= rangeEnd) results.push({ sub, date });
      }
    }
    cursor = addMonths(cursor, 1);
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}
