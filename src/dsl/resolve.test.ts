import { describe, expect, it } from "vitest";
import { parse } from "./parse";
import { resolve } from "./resolve";

function resolved(dsl: string) {
  return resolve(parse(dsl).trip, { defaultStart: "2026-07-01" });
}

describe("resolve", () => {
  it("uses explicit date windows verbatim", () => {
    const trip = resolved(`
hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-04
`);
    expect(trip.hops[0].startDate).toBe("2026-07-01");
    expect(trip.hops[0].endDate).toBe("2026-07-04");
    expect(trip.hops[0].days).toBe(3);
  });

  it("chains stay durations from the previous hop's end", () => {
    const trip = resolved(`
hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-04
hop Berlin:
  stay: 3d
hop Prague:
  stay: 2d
`);
    expect(trip.hops[1].startDate).toBe("2026-07-04");
    expect(trip.hops[1].endDate).toBe("2026-07-07");
    expect(trip.hops[2].startDate).toBe("2026-07-07");
    expect(trip.hops[2].endDate).toBe("2026-07-09");
  });

  it("defaults the first hop's start when none is given", () => {
    const trip = resolved(`
hop Berlin:
  stay: 3d
`);
    expect(trip.hops[0].startDate).toBe("2026-07-01");
    expect(trip.hops[0].endDate).toBe("2026-07-04");
  });

  it("defaults a hop with no timing to one day", () => {
    const trip = resolved(`
hop Berlin:
hop Prague:
`);
    expect(trip.hops[0].days).toBe(1);
    expect(trip.hops[1].startDate).toBe("2026-07-02");
  });

  it("computes total days across the whole trip", () => {
    const trip = resolved(`
hop A:
  dates: 2026-07-01 .. 2026-07-04
hop B:
  stay: 3d
`);
    expect(trip.totalDays).toBe(6);
  });

  it("sums budgets per currency", () => {
    const trip = resolved(`
currency: EUR
hop A:
  budget: 900 EUR
hop B:
  budget: 600 EUR
hop C:
  budget: 1200 DKK
`);
    expect(trip.budgetByCurrency).toEqual({ EUR: 1500, DKK: 1200 });
  });

  it("consumes drive-stop nights and pushes the next hop's arrival", () => {
    const trip = resolved(`
hop Sydney:
  dates: 2026-07-01 .. 2026-07-07
drive -> Melbourne:
  stop: Canberra
  stop: Lakes Entrance 2d
hop Melbourne:
  stay: 4d
`);
    const melbourne = trip.hops[1];
    expect(melbourne.driveStops?.map((s) => [s.startDate, s.endDate])).toEqual([
      ["2026-07-07", "2026-07-08"], // Canberra, 1 night
      ["2026-07-08", "2026-07-10"], // Lakes Entrance, 2 nights
    ]);
    // Melbourne arrives only after the 3 drive nights.
    expect(melbourne.startDate).toBe("2026-07-10");
    expect(melbourne.endDate).toBe("2026-07-14");
  });

  it("handles an empty trip", () => {
    const trip = resolved(``);
    expect(trip.hops).toHaveLength(0);
    expect(trip.totalDays).toBe(0);
  });
});
