import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MapView } from "./MapView";
import type { DisplayHop } from "./display";
import type { ResolvedHop } from "../dsl/types";

// react-leaflet renders real Leaflet into jsdom; that's flaky for interaction,
// so these tests assert MapView mounts and wires its props without throwing.
// Drag-to-move and click-to-place behavior is covered end-to-end in Playwright
// (tests/e2e/plan.spec.ts), and the underlying text edit is unit-tested in
// src/dsl/edit.test.ts.

function hop(id: string, line: number, lat: number, lng: number): DisplayHop {
  const resolved: ResolvedHop = {
    id,
    name: id,
    line,
    coords: { lat, lng },
    startDate: "2026-07-01",
    endDate: "2026-07-02",
    days: 1,
  };
  return {
    hop: resolved,
    index: 0,
    color: "#123456",
    location: { lat, lng },
    locationState: "manual",
    activities: [],
    driveStops: [],
  };
}

describe("MapView", () => {
  it("renders hop pins from display hops", () => {
    const { container } = render(
      <MapView
        hops={[hop("Berlin", 1, 52.52, 13.405)]}
        start={null}
        end={null}
        activeHopId={null}
        onHover={vi.fn()}
        onHopMove={vi.fn()}
        onMapClick={vi.fn()}
      />,
    );
    expect(container.querySelectorAll(".map-pin")).toHaveLength(1);
  });

  it("mounts cleanly with no hops and the given callbacks", () => {
    expect(() =>
      render(
        <MapView
          hops={[]}
          start={null}
          end={null}
          activeHopId={null}
          onHover={vi.fn()}
          onHopMove={vi.fn()}
          onMapClick={vi.fn()}
        />,
      ),
    ).not.toThrow();
  });
});
