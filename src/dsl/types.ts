// Core data model for the rejs journey DSL.
//
// The pipeline is: raw DSL text --parse--> ParsedTrip (+ diagnostics)
// --resolve--> ResolvedTrip (concrete dates + budget totals) --> UI.

export type TransportMode = "flight" | "train" | "bus" | "ferry" | "car" | "walk";

export const TRANSPORT_MODES: readonly TransportMode[] = [
  "flight",
  "train",
  "bus",
  "ferry",
  "car",
  "walk",
];

export interface Money {
  amount: number;
  currency: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** An overnight stop on a multi-day drive into a hop (from a `drive` block). */
export interface DriveStop {
  id: string;
  name: string;
  /** Nights spent here on the drive (default 1). */
  nights: number;
  line: number;
}

/** An optional thing to do at a hop, geocoded to its own spot when possible. */
export interface Activity {
  id: string;
  /** Place/activity name, e.g. "Round Tower". */
  name: string;
  /** Fixed date for must-book activities (ISO `YYYY-MM-DD`); absent = flexible. */
  date?: string;
  /** 1-based source line, for diagnostics. */
  line: number;
}

/** A single stop as parsed from the DSL, before date/geocode resolution. */
export interface Hop {
  id: string;
  /** Place name as written, e.g. "Copenhagen". Used for geocoding. */
  name: string;
  /** Explicit window, ISO `YYYY-MM-DD`, when the user wrote `dates:`. */
  startDate?: string;
  endDate?: string;
  /** Number of nights/days when the user wrote `stay: Nd`. */
  stayDays?: number;
  budget?: Money;
  /** Mode of the leg arriving *into* this hop. */
  arriveBy?: TransportMode;
  note?: string;
  /** Manual coordinate override (`coords:`), bypassing geocoding. */
  coords?: LatLng;
  /** Travel time of the leg arriving *into* this hop, in minutes (`travel:`). */
  travelMinutes?: number;
  /** Optional things to do here, in source order. */
  activities?: Activity[];
  /** Overnight stops on the drive into this hop (from a preceding `drive` block). */
  driveStops?: DriveStop[];
  /** Transport for the drive segments into this hop (default `car`). */
  driveMode?: TransportMode;
  /** 1-based source line of the `hop` header, for editor diagnostics. */
  line: number;
}

/** An origin/destination point (`start:`/`end:`) — a place, not a stay. */
export interface Waypoint {
  /** Place name as written, used for geocoding. */
  name: string;
  /** Manual coordinate override, bypassing geocoding. */
  coords?: LatLng;
  /** 1-based source line, for editor diagnostics. */
  line: number;
}

export interface ParsedTrip {
  title?: string;
  defaultCurrency?: string;
  /** Where the journey begins, before the first hop. */
  start?: Waypoint;
  /** Where the journey ends, after the last hop. */
  end?: Waypoint;
  hops: Hop[];
}

export type Severity = "error" | "warning";

export interface Diagnostic {
  /** 1-based line number. */
  line: number;
  message: string;
  severity: Severity;
}

export interface ParseResult {
  trip: ParsedTrip;
  diagnostics: Diagnostic[];
}

/** A drive stop after resolution: concrete dates from chaining the drive nights. */
export interface ResolvedDriveStop extends DriveStop {
  startDate: string;
  endDate: string;
  days: number;
}

/** A hop after resolution: concrete start/end dates are always present. */
export interface ResolvedHop extends Hop {
  startDate: string;
  endDate: string;
  /** Inclusive day count of the stay. */
  days: number;
  /** Drive stops with resolved dates, occupying the nights before this hop. */
  driveStops?: ResolvedDriveStop[];
}

export interface ResolvedTrip {
  title?: string;
  defaultCurrency?: string;
  start?: Waypoint;
  end?: Waypoint;
  hops: ResolvedHop[];
  /** Total nights from the first hop's start to the last hop's end. */
  totalDays: number;
  /** Budget totals keyed by currency. */
  budgetByCurrency: Record<string, number>;
}
