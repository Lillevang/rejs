import { parseDurationMinutes } from "../lib/duration";
import {
  TRANSPORT_MODES,
  type Diagnostic,
  type DriveStop,
  type Hop,
  type ParsedTrip,
  type ParseResult,
  type TransportMode,
  type Waypoint,
} from "./types";

const HOP_HEADER = /^hop\s+(.+?)\s*:\s*$/i;
const DRIVE_HEADER = /^drive\b\s*(?:->\s*(.+?))?\s*:\s*$/i;

/** A `drive` block being accumulated until it reaches its destination hop. */
interface PendingDrive {
  stops: DriveStop[];
  mode?: TransportMode;
  dest?: string;
  line: number;
}

const FIELD = /^([a-z_]+)\s*:\s*(.*)$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Strip a trailing `# comment`, but ignore `#` inside double quotes. */
function stripComment(line: string): string {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "#" && !inQuotes) return line.slice(0, i);
  }
  return line;
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1);
  }
  return v;
}

/** True for a valid `YYYY-MM-DD` calendar date (rejects 2026-13-40). */
export function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Parse `stay:` values like `3d`, `3`, `2 nights`, `4 days`. Returns null if unparseable. */
function parseStay(raw: string): number | null {
  const m = raw.trim().match(/^(\d+)\s*(d|day|days|night|nights)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

/** Parse `budget:` like `1200 DKK`, `1,200 EUR`, `900`. Returns amount + optional currency. */
function parseBudget(raw: string): { amount: number; currency?: string } | null {
  const m = raw.trim().match(/^([\d.,\s]+?)\s*([A-Za-z]{3})?$/);
  if (!m) return null;
  const amount = Number(m[1].replace(/[,\s]/g, ""));
  if (!Number.isFinite(amount)) return null;
  return { amount, currency: m[2]?.toUpperCase() };
}

/** Parse `activity:` like `Tivoli Gardens` or `Round Tower @ 2026-07-02`. */
function parseActivity(raw: string): { name: string; date?: string; dateInvalid?: boolean } | null {
  const value = raw.trim();
  if (value === "") return null;
  const at = value.match(/^(.*?)\s*@\s*(\S+)\s*$/);
  if (!at) return { name: unquote(value) };
  const name = unquote(at[1].trim());
  if (name === "") return null;
  return isValidIsoDate(at[2]) ? { name, date: at[2] } : { name, dateInvalid: true };
}

/** Parse a `stop:` line like `Canberra` or `Lakes Entrance 2d`. Default 1 night. */
function parseStop(raw: string): { name: string; nights: number } | null {
  const value = raw.trim();
  if (value === "") return null;
  const m = value.match(/^(.*?)(?:\s+(\d+)\s*(?:d|days?|nights?))?$/i);
  const name = unquote((m?.[1] ?? value).trim());
  if (name === "") return null;
  const nights = m?.[2] ? Number(m[2]) : 1;
  return { name, nights: nights > 0 ? nights : 1 };
}

/** Parse `coords:` like `55.6761, 12.5683`. */
function parseCoords(raw: string): { lat: number; lng: number } | null {
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Parse rejs DSL text into a trip plus diagnostics. The parser is forgiving:
 * it never throws and always returns the best-effort trip it can build, so the
 * UI can update live while the user is mid-edit.
 */
export function parse(text: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const hops: Hop[] = [];
  let title: string | undefined;
  let defaultCurrency: string | undefined;
  let start: Waypoint | undefined;
  let end: Waypoint | undefined;
  let current: Hop | null = null;
  let hopSeq = 0;
  let actSeq = 0;
  let stopSeq = 0;
  // A `drive` block buffers its stops until the next hop, which the drive leads
  // into. `current` is set to null while inside a drive block.
  let pendingDrive: PendingDrive | null = null;

  /** Build a waypoint from a `start:`/`end:` value: a place name or `lat, lng`. */
  const toWaypoint = (value: string, lineNo: number): Waypoint => {
    const coords = parseCoords(value);
    return coords
      ? { name: unquote(value), coords, line: lineNo }
      : { name: unquote(value), line: lineNo };
  };

  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const line = stripComment(rawLine).trim();
    if (line === "") return;

    // Hop header.
    const header = line.match(HOP_HEADER);
    if (header) {
      const name = header[1].trim();
      if (name === "") {
        diagnostics.push({
          line: lineNo,
          message: "Hop is missing a place name.",
          severity: "error",
        });
        current = null;
        return;
      }
      current = { id: `hop-${hopSeq++}`, name, line: lineNo };
      // A preceding `drive` block leads into this hop: attach its stops here.
      if (pendingDrive) {
        if (pendingDrive.dest && pendingDrive.dest.toLowerCase() !== name.toLowerCase()) {
          diagnostics.push({
            line: pendingDrive.line,
            message: `Drive says "-> ${pendingDrive.dest}" but the next hop is "${name}".`,
            severity: "warning",
          });
        }
        if (pendingDrive.stops.length > 0) {
          current.driveStops = pendingDrive.stops;
          current.driveMode = pendingDrive.mode ?? "car";
        }
        pendingDrive = null;
      }
      hops.push(current);
      return;
    }

    // Drive block header: `drive -> Melbourne:` or just `drive:`.
    const drive = line.match(DRIVE_HEADER);
    if (drive) {
      if (hops.length === 0) {
        diagnostics.push({
          line: lineNo,
          message: "A `drive` needs a hop before it to drive from.",
          severity: "error",
        });
      }
      if (pendingDrive && pendingDrive.stops.length > 0) {
        diagnostics.push({
          line: pendingDrive.line,
          message: "This `drive` block never reaches a hop; its stops are ignored.",
          severity: "warning",
        });
      }
      pendingDrive = { stops: [], dest: drive[1]?.trim() || undefined, line: lineNo };
      current = null; // subsequent stop:/by: lines belong to the drive
      return;
    }

    // `trip "Title"` directive without a colon.
    const bareTrip = line.match(/^trip\s+(.+)$/i);
    if (bareTrip && !line.includes(":")) {
      title = unquote(bareTrip[1]);
      return;
    }

    const field = line.match(FIELD);
    if (!field) {
      diagnostics.push({
        line: lineNo,
        message: `Couldn't parse "${line}". Expected \`hop Name:\` or \`key: value\`.`,
        severity: "error",
      });
      return;
    }

    const key = field[1].toLowerCase();
    const value = field[2].trim();

    // Top-level directives are allowed before the first hop.
    if (key === "trip" || key === "title") {
      title = unquote(value);
      return;
    }
    if (key === "currency") {
      const cur = value.toUpperCase();
      if (!/^[A-Z]{3}$/.test(cur)) {
        diagnostics.push({
          line: lineNo,
          message: `Invalid currency "${value}" (expected a 3-letter code).`,
          severity: "warning",
        });
        return;
      }
      defaultCurrency = cur;
      return;
    }
    if (key === "start" || key === "end") {
      if (value.trim() === "") {
        diagnostics.push({
          line: lineNo,
          message: `\`${key}:\` needs a place name (e.g. \`${key}: Oslo\`).`,
          severity: "error",
        });
        return;
      }
      const wp = toWaypoint(value, lineNo);
      if (key === "start") start = wp;
      else end = wp;
      // A top-level directive ends any open hop block.
      current = null;
      return;
    }

    // Inside a `drive` block: only `stop:` and `by:` are meaningful.
    if (pendingDrive) {
      if (key === "stop") {
        const parsed = parseStop(value);
        if (!parsed) {
          diagnostics.push({
            line: lineNo,
            message: "Expected `stop: <place>` (optionally `2d` for extra nights).",
            severity: "error",
          });
          return;
        }
        pendingDrive.stops.push({
          id: `stop-${stopSeq++}`,
          name: parsed.name,
          nights: parsed.nights,
          line: lineNo,
        });
        return;
      }
      if (key === "by" || key === "arrive_by") {
        const mode = value.toLowerCase();
        if (!(TRANSPORT_MODES as readonly string[]).includes(mode)) {
          diagnostics.push({
            line: lineNo,
            message: `Unknown transport "${value}". Use one of: ${TRANSPORT_MODES.join(", ")}.`,
            severity: "warning",
          });
          return;
        }
        pendingDrive.mode = mode as TransportMode;
        return;
      }
      diagnostics.push({
        line: lineNo,
        message: `\`${key}\` isn't valid inside a \`drive\` block (use \`stop:\` or \`by:\`).`,
        severity: "warning",
      });
      return;
    }

    if (!current) {
      diagnostics.push({
        line: lineNo,
        message: `\`${key}\` appears before any \`hop\` — it will be ignored.`,
        severity: "error",
      });
      return;
    }

    switch (key) {
      case "dates": {
        const m = value.match(/^(\S+)\s*\.\.\s*(\S+)$/);
        if (!m) {
          diagnostics.push({
            line: lineNo,
            message: "Expected `dates: YYYY-MM-DD .. YYYY-MM-DD`.",
            severity: "error",
          });
          break;
        }
        const [, start, end] = m;
        if (!isValidIsoDate(start) || !isValidIsoDate(end)) {
          diagnostics.push({
            line: lineNo,
            message: "Dates must be valid `YYYY-MM-DD` values.",
            severity: "error",
          });
          break;
        }
        if (end < start) {
          diagnostics.push({
            line: lineNo,
            message: "End date is before start date.",
            severity: "error",
          });
          break;
        }
        current.startDate = start;
        current.endDate = end;
        break;
      }
      case "stay": {
        const days = parseStay(value);
        if (days === null) {
          diagnostics.push({
            line: lineNo,
            message: "Expected `stay: Nd` (e.g. `stay: 3d`).",
            severity: "error",
          });
          break;
        }
        current.stayDays = days;
        break;
      }
      case "budget": {
        const b = parseBudget(value);
        if (!b) {
          diagnostics.push({
            line: lineNo,
            message: "Expected `budget: <amount> <CUR>` (e.g. `budget: 900 EUR`).",
            severity: "error",
          });
          break;
        }
        current.budget = { amount: b.amount, currency: b.currency ?? defaultCurrency ?? "" };
        if (!b.currency && !defaultCurrency) {
          diagnostics.push({
            line: lineNo,
            message: "Budget has no currency and no `currency:` default is set.",
            severity: "warning",
          });
        }
        break;
      }
      case "arrive_by":
      case "by": {
        const mode = value.toLowerCase();
        if (!(TRANSPORT_MODES as readonly string[]).includes(mode)) {
          diagnostics.push({
            line: lineNo,
            message: `Unknown transport "${value}". Use one of: ${TRANSPORT_MODES.join(", ")}.`,
            severity: "warning",
          });
          break;
        }
        current.arriveBy = mode as TransportMode;
        break;
      }
      case "note": {
        current.note = unquote(value);
        break;
      }
      case "coords": {
        const c = parseCoords(value);
        if (!c) {
          diagnostics.push({
            line: lineNo,
            message: "Expected `coords: lat, lng` (e.g. `coords: 55.68, 12.57`).",
            severity: "error",
          });
          break;
        }
        current.coords = c;
        break;
      }
      case "travel": {
        const minutes = parseDurationMinutes(value);
        if (minutes === null) {
          diagnostics.push({
            line: lineNo,
            message: "Expected `travel: <duration>` (e.g. `travel: 4h 30m`).",
            severity: "error",
          });
          break;
        }
        current.travelMinutes = minutes;
        break;
      }
      case "activity": {
        const parsed = parseActivity(value);
        if (!parsed) {
          diagnostics.push({
            line: lineNo,
            message: "Expected `activity: <name>` (optionally `@ YYYY-MM-DD`).",
            severity: "error",
          });
          break;
        }
        if (parsed.dateInvalid) {
          diagnostics.push({
            line: lineNo,
            message: "Activity date must be a valid `YYYY-MM-DD`; ignoring it.",
            severity: "warning",
          });
        }
        (current.activities ??= []).push({
          id: `act-${actSeq++}`,
          name: parsed.name,
          date: parsed.date,
          line: lineNo,
        });
        break;
      }
      default:
        diagnostics.push({
          line: lineNo,
          message: `Unknown field \`${key}\`.`,
          severity: "warning",
        });
    }
  });

  // `pendingDrive` is mutated inside the forEach above; TS's flow analysis
  // doesn't carry closure assignments to here, so re-assert the type.
  const leftover = pendingDrive as PendingDrive | null;
  if (leftover && leftover.stops.length > 0) {
    diagnostics.push({
      line: leftover.line,
      message: "This `drive` block never reaches a hop; its stops are ignored.",
      severity: "warning",
    });
  }

  const trip: ParsedTrip = { title, defaultCurrency, start, end, hops };
  return { trip, diagnostics };
}
