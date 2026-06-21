import { describe, expect, it } from "vitest";
import { distanceKm, isAmbiguous } from "./ambiguity";
import type { GeocodeCandidate } from "./nominatim";

function candidate(lat: number, lng: number, importance = 0.5, label = "place"): GeocodeCandidate {
  return { lat, lng, importance, label };
}

describe("distanceKm", () => {
  it("is zero for the same point", () => {
    expect(distanceKm(candidate(55, 12), candidate(55, 12))).toBeCloseTo(0);
  });

  it("approximates a known distance (Venice IT to Venice FL ~ 8000km)", () => {
    const veniceIt = candidate(45.4371, 12.3326);
    const veniceFl = candidate(27.0998, -82.4543);
    const d = distanceKm(veniceIt, veniceFl);
    expect(d).toBeGreaterThan(7500);
    expect(d).toBeLessThan(8500);
  });
});

describe("isAmbiguous", () => {
  it("is false for a single candidate", () => {
    expect(isAmbiguous([candidate(45.4371, 12.3326)])).toBe(false);
  });

  it("is false for an empty list", () => {
    expect(isAmbiguous([])).toBe(false);
  });

  it("is true for two far-apart, similarly-important matches", () => {
    const veniceIt = candidate(45.4371, 12.3326, 0.8);
    const veniceFl = candidate(27.0998, -82.4543, 0.65);
    expect(isAmbiguous([veniceIt, veniceFl])).toBe(true);
  });

  it("is false when the runner-up is much less important than the top", () => {
    const paris = candidate(48.8566, 2.3522, 0.9);
    const parisTexas = candidate(33.6609, -95.5555, 0.3);
    expect(isAmbiguous([paris, parisTexas])).toBe(false);
  });

  it("is false when the top two are close together (same city cluster)", () => {
    const a = candidate(45.4371, 12.3326, 0.8);
    const b = candidate(45.45, 12.34, 0.79); // ~2km away
    expect(isAmbiguous([a, b])).toBe(false);
  });

  it("falls back to distance alone when importance is unavailable", () => {
    const a = candidate(45.4371, 12.3326, 0);
    const b = candidate(27.0998, -82.4543, 0);
    expect(isAmbiguous([a, b])).toBe(true);
  });
});
