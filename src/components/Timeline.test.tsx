import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Timeline } from "./Timeline";
import type { DisplayHop } from "./display";

afterEach(cleanup);

/** Minimal display hop fixture: only the fields the Timeline reads. */
function displayHop(overrides: Partial<DisplayHop["hop"]> = {}): DisplayHop {
  return {
    hop: {
      id: "hop-0",
      name: "Copenhagen",
      line: 1,
      startDate: "2026-07-01",
      endDate: "2026-07-04",
      days: 3,
      ...overrides,
    },
    index: 0,
    color: "#3b82f6",
    location: { lat: 55.68, lng: 12.57 },
    locationState: "manual",
    activities: [],
    driveStops: [],
  };
}

describe("Timeline add-hop affordance", () => {
  it("renders an Add hop button on the empty state and fires onAddHop", () => {
    const onAddHop = vi.fn();
    render(<Timeline hops={[]} activeHopId={null} onHover={vi.fn()} onAddHop={onAddHop} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add hop" }));
    expect(onAddHop).toHaveBeenCalledTimes(1);
  });

  it("renders an Add hop button below the rows and fires onAddHop", () => {
    const onAddHop = vi.fn();
    render(
      <Timeline hops={[displayHop()]} activeHopId={null} onHover={vi.fn()} onAddHop={onAddHop} />,
    );
    expect(screen.getByText("Copenhagen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Add hop" }));
    expect(onAddHop).toHaveBeenCalledTimes(1);
  });
});
