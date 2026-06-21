import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGeocoder } from "./nominatim";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe("createGeocoder", () => {
  let storage: Storage;
  const sleep = () => Promise.resolve();

  beforeEach(() => {
    storage = memoryStorage();
  });

  it("resolves a place name to coordinates", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ lat: "55.6761", lon: "12.5683" }]));
    const geocoder = createGeocoder({ fetchImpl, storage, sleep });
    const result = await geocoder.geocode("Copenhagen");
    expect(result).toEqual({ lat: 55.6761, lng: 12.5683 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("caches hits and does not re-query", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ lat: "1", lon: "2" }]));
    const geocoder = createGeocoder({ fetchImpl, storage, sleep });
    await geocoder.geocode("Berlin");
    await geocoder.geocode("berlin "); // different casing/whitespace -> same key
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("caches misses too", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const geocoder = createGeocoder({ fetchImpl, storage, sleep });
    expect(await geocoder.geocode("Nowheresville")).toBeNull();
    expect(await geocoder.geocode("Nowheresville")).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("persists the cache across geocoder instances", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ lat: "10", lon: "20" }]));
    await createGeocoder({ fetchImpl, storage, sleep }).geocode("Rome");
    const second = createGeocoder({ fetchImpl, storage, sleep });
    expect(await second.geocode("Rome")).toEqual({ lat: 10, lng: 20 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("shares one request for concurrent lookups of the same key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ lat: "1", lon: "2" }]));
    const geocoder = createGeocoder({ fetchImpl, storage, sleep });
    // Fire both before the first resolves — mirrors StrictMode's double mount.
    const [a, b] = await Promise.all([geocoder.geocode("Oslo"), geocoder.geocode("Oslo")]);
    expect(a).toEqual({ lat: 1, lng: 2 });
    expect(b).toEqual({ lat: 1, lng: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns null for blank names without fetching", async () => {
    const fetchImpl = vi.fn();
    const geocoder = createGeocoder({ fetchImpl, storage, sleep });
    expect(await geocoder.geocode("  ")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exposes all candidates with labels and importance", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        { lat: "45.4371", lon: "12.3326", display_name: "Venice, Veneto, Italy", importance: 0.8 },
        { lat: "27.0998", lon: "-82.4543", display_name: "Venice, FL, USA", importance: 0.6 },
      ]),
    );
    const geocoder = createGeocoder({ fetchImpl, storage, sleep });
    const candidates = await geocoder.geocodeCandidates("Venice");
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      lat: 45.4371,
      lng: 12.3326,
      label: "Venice, Veneto, Italy",
      importance: 0.8,
    });
    expect(candidates[1].label).toBe("Venice, FL, USA");
  });

  it("geocode and geocodeCandidates share one network request per key", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse([{ lat: "1", lon: "2", display_name: "A" }]));
    const geocoder = createGeocoder({ fetchImpl, storage, sleep });
    await geocoder.geocode("Lisbon");
    const candidates = await geocoder.geocodeCandidates("Lisbon");
    expect(candidates).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("requests several candidates so ambiguity can be detected", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ lat: "1", lon: "2" }]));
    const geocoder = createGeocoder({ fetchImpl, storage, sleep });
    await geocoder.geocode("Springfield");
    const url = fetchImpl.mock.calls[0][0] as string;
    expect(url).toContain("limit=5");
  });
});
