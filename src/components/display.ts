import type { Activity, LatLng, ResolvedDriveStop, ResolvedHop } from "../dsl/types";

export type LocationState = "ok" | "manual" | "loading" | "notfound";

/** An activity enriched with its geocoded location. */
export interface DisplayActivity {
  activity: Activity;
  location: LatLng | null;
  locationState: LocationState;
}

/** A drive stop enriched with its geocoded location. */
export interface DisplayDriveStop {
  stop: ResolvedDriveStop;
  location: LatLng | null;
  locationState: LocationState;
}

/** A resolved hop enriched with the per-hop color and its geocoded location. */
export interface DisplayHop {
  hop: ResolvedHop;
  index: number;
  color: string;
  location: LatLng | null;
  locationState: LocationState;
  activities: DisplayActivity[];
  /** Overnight stops on the drive into this hop, in order. */
  driveStops: DisplayDriveStop[];
}

/** Geocoding query for an activity — its name plus the hop, for disambiguation. */
export function activityQuery(activityName: string, hopName: string): string {
  return `${activityName}, ${hopName}`;
}

/** A start/end point enriched with its geocoded location. */
export interface DisplayWaypoint {
  name: string;
  location: LatLng | null;
  locationState: LocationState;
}
