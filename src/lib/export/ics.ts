// Export a resolved trip as an iCalendar (.ics) file — pure string building, no
// backend. One all-day event per hop spanning its resolved nights, plus one
// all-day event per fixed-date (`@date`) activity. The DSL is the source of
// truth, so everything here is derived from the already-resolved dates.
//
// Determinism matters: re-exporting the same plan must produce byte-identical
// output (stable UIDs, fixed DTSTAMP). That keeps calendars from duplicating
// events on re-import and makes the output testable.

import type { ResolvedHop, ResolvedTrip } from "../../dsl/types";

// A fixed, non-wall-clock DTSTAMP so output is deterministic. Calendars only use
// DTSTAMP for change-tracking; an all-day plan export has no meaningful "stamp"
// time, so a constant is the honest, reproducible choice.
const DTSTAMP = "20000101T000000Z";

const PRODID = "-//rejs//journey planner//EN";

/** A short, stable host suffix for UIDs so they look like valid addresses. */
const UID_HOST = "rejs.local";

/**
 * Escape a text value for an iCalendar TEXT field (SUMMARY, DESCRIPTION, …) per
 * RFC 5545 §3.3.11: backslash, semicolon, comma, and newlines.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

/** `YYYY-MM-DD` → `YYYYMMDD` for a DATE-valued property. */
function toIcsDate(iso: string): string {
  return iso.replace(/-/g, "");
}

/**
 * Fold a content line to ≤75 octets per RFC 5545 §3.1: continuation lines start
 * with a single space. We fold on octet boundaries (UTF-8 byte length), not
 * character count, so multibyte place names don't break the limit. Splitting a
 * multibyte sequence across a fold is legal per spec, so a simple byte walk is
 * fine.
 */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  const decoder = new TextDecoder();
  let start = 0;
  // First line carries 75 octets; each continuation carries 74 (1 octet is the
  // leading space).
  let limit = 75;
  while (start < bytes.length) {
    const end = Math.min(start + limit, bytes.length);
    chunks.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
    limit = 74;
  }
  return chunks.join("\r\n ");
}

interface IcsEvent {
  uid: string;
  summary: string;
  /** Inclusive first day (DATE value). */
  startDate: string;
  /**
   * Exclusive last day (DATE value) — the morning after the final night. For a
   * single all-day event this is the day after `startDate`.
   */
  endExclusive: string;
  description?: string;
}

function eventLines(event: IcsEvent): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${DTSTAMP}`,
    `DTSTART;VALUE=DATE:${toIcsDate(event.startDate)}`,
    `DTEND;VALUE=DATE:${toIcsDate(event.endExclusive)}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  lines.push("END:VEVENT");
  return lines.map(foldLine);
}

/** One all-day VEVENT per hop, spanning its resolved nights. */
function hopEvent(hop: ResolvedHop, index: number): IcsEvent {
  const parts: string[] = [];
  if (hop.budget) {
    parts.push(`Budget: ${hop.budget.amount} ${hop.budget.currency}`.trim());
  }
  if (hop.arriveBy) parts.push(`Arrive by: ${hop.arriveBy}`);
  if (hop.note) parts.push(hop.note);

  return {
    uid: `hop-${index}@${UID_HOST}`,
    summary: hop.name,
    startDate: hop.startDate,
    // hop.endDate is already the exclusive checkout day (the morning after the
    // last night), produced by resolve() via addDays — so it maps straight to an
    // all-day DTEND with no off-by-one adjustment.
    endExclusive: hop.endDate,
    description: parts.length > 0 ? parts.join("\n") : undefined,
  };
}

/**
 * One all-day, single-day VEVENT per fixed-date activity. The DSL `@date` has no
 * time, so an all-day event on that date is the honest representation — we don't
 * invent a clock time.
 */
function activityEvents(hop: ResolvedHop): IcsEvent[] {
  const events: IcsEvent[] = [];
  for (const activity of hop.activities ?? []) {
    if (!activity.date) continue;
    events.push({
      uid: `activity-${activity.id}@${UID_HOST}`,
      summary: activity.name,
      startDate: activity.date,
      endExclusive: addOneDay(activity.date),
      description: `Part of ${hop.name}`,
    });
  }
  return events;
}

/** `YYYY-MM-DD` + 1 day, as a DATE string. Local to avoid a dates.ts dep cycle
 * and to keep this module self-contained pure string math. */
function addOneDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + 24 * 60 * 60 * 1000;
  const next = new Date(ms);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Build a valid iCalendar string from a resolved trip. CRLF line endings per
 * spec. A trip with no hops yields a valid but empty VCALENDAR (no VEVENTs) —
 * the honest representation of "nothing to put on a calendar".
 */
export function planToIcs(trip: ResolvedTrip): string {
  const events: IcsEvent[] = [];
  trip.hops.forEach((hop, index) => {
    events.push(hopEvent(hop, index));
    events.push(...activityEvents(hop));
  });

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${PRODID}`, "CALSCALE:GREGORIAN"];
  for (const event of events) lines.push(...eventLines(event));
  lines.push("END:VCALENDAR");

  // Trailing CRLF: iCalendar content lines (including the last) end with CRLF.
  return lines.join("\r\n") + "\r\n";
}

/** A filesystem-safe `.ics` filename derived from the trip title. */
export function icsFilename(title: string | undefined): string {
  const base = (title ?? "trip").trim() || "trip";
  const safe = base.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");
  return `${safe || "trip"}.ics`;
}
