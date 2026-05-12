/** Accepts YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY and normalises to YYYY-MM-DD.
 *  Returns null if the string cannot be understood as a valid date.
 */
export function normaliseDateInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + "T00:00:00");
    return isNaN(d.getTime()) ? null : trimmed;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, a, b, y] = slashMatch;
    for (const [month, day] of [[b, a], [a, b]]) {
      const iso = `${y}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      const d = new Date(iso + "T00:00:00");
      if (!isNaN(d.getTime()) && d.getMonth() + 1 === Number(month)) return iso;
    }
  }

  return null;
}

/** Parse a YYYY-MM-DD string as a local date (avoids UTC off-by-one). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
