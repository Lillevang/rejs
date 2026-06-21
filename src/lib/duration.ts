// Travel-time durations: parse the DSL's `travel:` values and format them for
// display on map legs. Stored internally as whole minutes.

/**
 * Parse a duration like `4h 30m`, `2h`, `45m`, `1.5h`, or a bare `90` (minutes).
 * Returns whole minutes, or null if nothing parseable/positive is found.
 */
export function parseDurationMinutes(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (s === "") return null;

  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const minMatch = s.match(/(\d+)\s*m/);

  if (!hourMatch && !minMatch) {
    // Bare number is interpreted as minutes.
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }

  let total = 0;
  if (hourMatch) total += Number(hourMatch[1]) * 60;
  if (minMatch) total += Number(minMatch[1]);
  total = Math.round(total);
  return total > 0 ? total : null;
}

/** Format whole minutes as `4h 30m`, `2h`, or `45m`. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
