// Small UTC-based date helpers. We work entirely in `YYYY-MM-DD` strings to
// avoid timezone drift — every date is treated as a UTC calendar day.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function fromUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * MS_PER_DAY);
}

/** Whole-day difference `b - a` (can be negative). */
export function dayDiff(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / MS_PER_DAY);
}

/** Today as a `YYYY-MM-DD` string in UTC. */
export function today(now: number = Date.now()): string {
  return fromUtc(now);
}

/** Format an ISO date for display, e.g. "1 Jul 2026". */
export function formatDate(iso: string): string {
  const d = new Date(toUtc(iso));
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
