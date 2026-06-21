import { addDays, dayDiff, formatDate, today } from "../lib/dates";
import type { Diagnostic, ParsedTrip, ResolvedDriveStop, ResolvedHop, ResolvedTrip } from "./types";

export interface ResolveOptions {
  /** Fallback start date for the first hop when none is given. Defaults to today. */
  defaultStart?: string;
}

/**
 * Turn a parsed trip into one with concrete start/end dates for every hop and
 * aggregate budget/duration totals.
 *
 * Date resolution chains hops together: a hop without an explicit `dates:` window
 * arrives the day the previous hop departs. `stay: Nd` sets the window length;
 * with no timing at all a hop defaults to a single day so it still renders.
 */
export function resolve(trip: ParsedTrip, options: ResolveOptions = {}): ResolvedTrip {
  const fallbackStart = options.defaultStart ?? today();
  let cursor = fallbackStart;

  const hops: ResolvedHop[] = trip.hops.map((hop) => {
    // Overnight drive stops occupy the nights right after the previous hop,
    // chaining forward and pushing this hop's arrival later.
    let driveCursor = cursor;
    const driveStops: ResolvedDriveStop[] | undefined = hop.driveStops?.map((stop) => {
      const s = driveCursor;
      const e = addDays(s, stop.nights);
      driveCursor = e;
      return { ...stop, startDate: s, endDate: e, days: stop.nights };
    });

    let start: string;
    let end: string;

    if (hop.startDate) {
      start = hop.startDate;
      end = hop.endDate ?? addDays(start, hop.stayDays ?? 1);
    } else {
      start = driveCursor;
      if (hop.endDate) {
        end = hop.endDate < start ? start : hop.endDate;
      } else {
        end = addDays(start, hop.stayDays ?? 1);
      }
    }

    cursor = end;
    return { ...hop, driveStops, startDate: start, endDate: end, days: dayDiff(start, end) };
  });

  const budgetByCurrency: Record<string, number> = {};
  for (const hop of hops) {
    if (!hop.budget) continue;
    const key = hop.budget.currency || "(unspecified)";
    budgetByCurrency[key] = (budgetByCurrency[key] ?? 0) + hop.budget.amount;
  }

  const totalDays = hops.length > 0 ? dayDiff(hops[0].startDate, hops[hops.length - 1].endDate) : 0;

  return {
    title: trip.title,
    defaultCurrency: trip.defaultCurrency,
    start: trip.start,
    end: trip.end,
    hops,
    totalDays,
    budgetByCurrency,
  };
}

/**
 * Gentle, high-signal date warnings layered on top of the resolved trip. These
 * are *warnings*, never errors: the plan still renders, we're just flagging
 * likely mistakes. Kept deliberately narrow so the diagnostics list stays
 * trustworthy — a plan with no dates produces zero warnings.
 *
 * Two checks:
 *   1. A fixed-date `activity ... @ <date>` whose date falls outside its hop's
 *      resolved window (before the hop starts or after it ends). Boundaries are
 *      inclusive — an activity on the arrival or departure day is fine.
 *   2. A hop with an *explicit* `dates:` / start whose start doesn't meet the
 *      previous hop's end — a real gap or overlap. Only explicit windows are
 *      checked; chained `stay:` hops always abut by construction, so flagging
 *      them would be noise.
 *
 * Pairs `parsed` (to know which dates the user actually wrote) with `resolved`
 * (for the concrete windows); they share hop order, so we zip by index.
 */
export function dateDiagnostics(parsed: ParsedTrip, resolved: ResolvedTrip): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  resolved.hops.forEach((hop, index) => {
    for (const activity of hop.activities ?? []) {
      if (!activity.date) continue;
      if (activity.date < hop.startDate || activity.date > hop.endDate) {
        diagnostics.push({
          line: activity.line,
          message: `Activity is dated ${formatDate(activity.date)}, outside ${hop.name}'s ${formatDate(hop.startDate)} – ${formatDate(hop.endDate)} window.`,
          severity: "warning",
        });
      }
    }

    if (index === 0) return;
    // Only flag when *this* hop pins its own start date; otherwise it was
    // chained off the previous hop and abuts it by construction.
    if (!parsed.hops[index]?.startDate) return;
    const prev = resolved.hops[index - 1];
    if (hop.startDate === prev.endDate) return;
    const verb = hop.startDate > prev.endDate ? "gap" : "overlap";
    diagnostics.push({
      line: hop.line,
      message: `Date ${verb}: ${prev.name} ends ${formatDate(prev.endDate)} but ${hop.name} starts ${formatDate(hop.startDate)}.`,
      severity: "warning",
    });
  });

  return diagnostics;
}
