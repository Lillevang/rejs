import type { GeocodeCandidate } from "./nominatim";

// A name is "ambiguous" only when auto-picking the first result is a real coin
// flip: there are at least two candidates, they sit far apart geographically,
// and the runner-up is nearly as relevant as the top pick. The thresholds are
// deliberately conservative so clear names (one obvious match, or a close
// cluster of same-city results) never trigger the chooser — zero added steps for
// the common case (#3).

/** Minimum great-circle distance (km) between top-2 for them to count as distinct places. */
const FAR_APART_KM = 100;
/** Runner-up must be at least this fraction of the top importance to be a real rival. */
const RIVAL_IMPORTANCE_RATIO = 0.75;

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometers (haversine). */
export function distanceKm(a: GeocodeCandidate, b: GeocodeCandidate): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * True when the top two candidates are genuinely competing for the same name:
 * far apart and similarly relevant. Used to decide whether to offer a chooser
 * instead of silently auto-picking the first result.
 */
export function isAmbiguous(candidates: GeocodeCandidate[]): boolean {
  if (candidates.length < 2) return false;
  const [top, runnerUp] = candidates;
  if (distanceKm(top, runnerUp) < FAR_APART_KM) return false;
  // Importance can be 0 from Nominatim; treat that as "no signal" and lean on
  // distance alone rather than dividing by zero.
  if (top.importance <= 0) return true;
  return runnerUp.importance / top.importance >= RIVAL_IMPORTANCE_RATIO;
}
