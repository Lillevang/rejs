import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GeocodeCandidate } from "../geocode/nominatim";

const geocodeCandidates = vi.fn<(q: string) => Promise<GeocodeCandidate[]>>();
vi.mock("../geocode/nominatim", () => ({
  createGeocoder: () => ({ geocodeCandidates }),
}));

import { useGeocoder } from "./use-geocoder";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("useGeocoder", () => {
  it("reports a requested key as loading until it resolves", async () => {
    const pending = deferred<GeocodeCandidate[]>();
    geocodeCandidates.mockReturnValue(pending.promise);
    const names = ["Oslo"];

    const { result } = renderHook(() => useGeocoder(names));
    expect(result.current.locations).toEqual({ oslo: "loading" });

    const hit: GeocodeCandidate = { lat: 59.9, lng: 10.7, label: "Oslo, Norway", importance: 0.9 };
    await act(async () => pending.resolve([hit]));

    expect(result.current.locations.oslo).toEqual({ lat: 59.9, lng: 10.7 });
    expect(result.current.candidates.oslo).toEqual([hit]);
  });

  it("marks a key notfound when no candidate comes back", async () => {
    geocodeCandidates.mockResolvedValue([]);
    const names = ["Nowhere"];

    const { result } = renderHook(() => useGeocoder(names));
    await act(async () => {});

    expect(result.current.locations.nowhere).toBe("notfound");
  });
});
