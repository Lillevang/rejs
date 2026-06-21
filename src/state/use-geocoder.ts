import { useEffect, useMemo, useState } from "react";
import { createGeocoder, type GeocodeCandidate } from "../geocode/nominatim";
import type { LatLng } from "../dsl/types";

export type LocationStatus = LatLng | "loading" | "notfound";

export interface GeocoderState {
  /** Normalized name → resolved coordinates, or a loading/not-found marker. */
  locations: Record<string, LocationStatus>;
  /** Normalized name → all plausible matches (best first), for disambiguation. */
  candidates: Record<string, GeocodeCandidate[]>;
}

function keyOf(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Geocode a list of place names, returning a map from normalized name to its
 * resolved coordinates (or a loading/not-found marker) plus the full candidate
 * list per name (so a caller can offer a disambiguation choice). The geocoder
 * dedupes by key (cache + in-flight requests), so re-running the effect — e.g.
 * across React's StrictMode mount/remount — never fires a duplicate lookup.
 */
export function useGeocoder(names: string[]): GeocoderState {
  const geocoder = useMemo(() => createGeocoder(), []);
  const [locations, setLocations] = useState<Record<string, LocationStatus>>({});
  const [candidates, setCandidates] = useState<Record<string, GeocodeCandidate[]>>({});

  // Serialize the unique, non-empty keys so the effect only re-runs on change.
  const keys = useMemo(() => {
    const set = new Set<string>();
    for (const name of names) {
      const k = keyOf(name);
      if (k) set.add(k);
    }
    return Array.from(set);
  }, [names]);

  useEffect(() => {
    let cancelled = false;
    for (const key of keys) {
      setLocations((prev) => (key in prev ? prev : { ...prev, [key]: "loading" }));
      geocoder
        .geocodeCandidates(key)
        .then((list) => {
          if (cancelled) return;
          const first = list[0];
          setLocations((prev) => ({
            ...prev,
            [key]: first ? { lat: first.lat, lng: first.lng } : "notfound",
          }));
          setCandidates((prev) => ({ ...prev, [key]: list }));
        })
        .catch(() => {
          if (cancelled) return;
          setLocations((prev) => ({ ...prev, [key]: "notfound" }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [keys, geocoder]);

  return { locations, candidates };
}

export { keyOf as geocodeKey };
