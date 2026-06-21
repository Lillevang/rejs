import type { LatLng } from "../dsl/types";

const CACHE_KEY = "rejs.geocode.v2";
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
// Nominatim's usage policy asks for at most 1 request per second.
const MIN_INTERVAL_MS = 1100;
// How many candidates to ask Nominatim for. Enough to detect ambiguity (#3)
// without flooding the response; the primary result is still candidate #1.
const CANDIDATE_LIMIT = 5;

export type GeocodeResult = LatLng | null;

/** One plausible match for a place name, used to offer a disambiguation choice. */
export interface GeocodeCandidate extends LatLng {
  /** Human-readable name from Nominatim, e.g. "Venice, Veneto, Italy". */
  label: string;
  /** Nominatim's relevance score (0..1); higher is a better match. */
  importance: number;
}

interface CacheEntry {
  found: boolean;
  /** All candidates returned (best first). Empty when `found` is false. */
  candidates: GeocodeCandidate[];
}

type CacheStore = Record<string, CacheEntry>;

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

function loadCache(storage: Storage): CacheStore {
  try {
    const raw = storage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheStore) : {};
  } catch {
    return {};
  }
}

function saveCache(storage: Storage, cache: CacheStore): void {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage may be full or unavailable; geocoding still works without caching.
  }
}

export interface GeocoderDeps {
  fetchImpl?: typeof fetch;
  storage?: Storage;
  /** Resolves after `ms`; injectable so tests don't actually wait. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface Geocoder {
  /** Resolve a place name to coordinates, or null if not found. Results are cached. */
  geocode(name: string): Promise<GeocodeResult>;
  /**
   * Resolve a place name to all plausible matches (best first), or [] if none.
   * Shares the same cache and network request as `geocode`, so calling both for
   * a name costs a single lookup.
   */
  geocodeCandidates(name: string): Promise<GeocodeCandidate[]>;
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name?: string;
  importance?: number;
}

/**
 * Build a geocoder backed by Nominatim with a localStorage cache. Lookups are
 * serialized and throttled to respect Nominatim's ≤1 req/s policy, and both hits
 * and misses are cached so repeated edits don't re-query the network. Each lookup
 * keeps up to a few candidates so the UI can offer a disambiguation choice when a
 * name (e.g. "Venice") is ambiguous, while `geocode` still auto-picks the best.
 */
export function createGeocoder(deps: GeocoderDeps = {}): Geocoder {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const storage = deps.storage ?? localStorage;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;

  const cache = loadCache(storage);
  const inFlight = new Map<string, Promise<GeocodeCandidate[]>>();
  let queue: Promise<unknown> = Promise.resolve();
  let lastRequest = 0;

  async function query(name: string): Promise<GeocodeCandidate[]> {
    const wait = MIN_INTERVAL_MS - (now() - lastRequest);
    if (wait > 0) await sleep(wait);
    lastRequest = now();

    const url =
      `${ENDPOINT}?format=json&addressdetails=0&limit=${CANDIDATE_LIMIT}` +
      `&q=${encodeURIComponent(name)}`;
    const res = await fetchImpl(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    const data = (await res.json()) as NominatimHit[];
    return data.map((hit) => ({
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      label: hit.display_name ?? name,
      importance: typeof hit.importance === "number" ? hit.importance : 0,
    }));
  }

  /** Shared lookup that returns the cached/queried candidate list for a key. */
  function lookup(name: string): Promise<GeocodeCandidate[]> {
    const key = normalizeKey(name);
    if (key === "") return Promise.resolve([]);
    const cached = cache[key];
    if (cached) return Promise.resolve(cached.candidates);

    // Share a single request per key so concurrent callers (and React's
    // mount/remount cycles) don't each fire their own network lookup.
    const pending = inFlight.get(key);
    if (pending) return pending;

    // Chain onto the queue so requests run one at a time, in order.
    const run = queue.then(() => query(name));
    queue = run.catch(() => undefined);
    const promise = run
      .then((candidates) => {
        cache[key] = { found: candidates.length > 0, candidates };
        saveCache(storage, cache);
        inFlight.delete(key);
        return candidates;
      })
      .catch((err) => {
        inFlight.delete(key);
        throw err;
      });
    inFlight.set(key, promise);
    return promise;
  }

  return {
    geocode(name: string): Promise<GeocodeResult> {
      return lookup(name).then((candidates) =>
        candidates.length > 0 ? { lat: candidates[0].lat, lng: candidates[0].lng } : null,
      );
    },
    geocodeCandidates(name: string): Promise<GeocodeCandidate[]> {
      return lookup(name);
    },
  };
}
