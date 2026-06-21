import { describe, expect, it } from "vitest";
import { parse } from "./parse";
import { dateDiagnostics, resolve } from "./resolve";

function resolved(dsl: string) {
  return resolve(parse(dsl).trip, { defaultStart: "2026-07-01" });
}

function dateWarnings(dsl: string) {
  const trip = parse(dsl).trip;
  return dateDiagnostics(trip, resolve(trip, { defaultStart: "2026-07-01" }));
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

describe("dateDiagnostics", () => {
  it("warns when a fixed-date activity falls before the hop window", () => {
    const w = dateWarnings(`
hop Copenhagen:
  dates: 2026-07-05 .. 2026-07-08
  activity: Tivoli @ 2026-07-03
`);
    expect(w).toHaveLength(1);
    expect(w[0].severity).toBe("warning");
    expect(w[0].line).toBe(4); // the activity line
    expect(w[0].message).toMatch(/outside/);
  });

  it("warns when a fixed-date activity falls after the hop window", () => {
    const w = dateWarnings(`
hop Copenhagen:
  dates: 2026-07-05 .. 2026-07-08
  activity: Tivoli @ 2026-07-12
`);
    expect(w).toHaveLength(1);
    expect(w[0].severity).toBe("warning");
  });

  it("does not warn for an activity on the hop's start or end boundary", () => {
    const w = dateWarnings(`
hop Copenhagen:
  dates: 2026-07-05 .. 2026-07-08
  activity: Arrival drinks @ 2026-07-05
  activity: Farewell @ 2026-07-08
`);
    expect(w).toHaveLength(0);
  });

  it("does not warn for an activity inside the hop window", () => {
    const w = dateWarnings(`
hop Copenhagen:
  dates: 2026-07-05 .. 2026-07-08
  activity: Round Tower @ 2026-07-06
`);
    expect(w).toHaveLength(0);
  });

  it("warns on a gap between two explicitly-dated hops", () => {
    const w = dateWarnings(`
hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-04
hop Berlin:
  dates: 2026-07-06 .. 2026-07-09
`);
    expect(w).toHaveLength(1);
    expect(w[0].severity).toBe("warning");
    expect(w[0].line).toBe(4); // Berlin's header line
    expect(w[0].message).toMatch(/gap/);
  });

  it("warns on an overlap between two explicitly-dated hops", () => {
    const w = dateWarnings(`
hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-05
hop Berlin:
  dates: 2026-07-03 .. 2026-07-09
`);
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/overlap/);
  });

  it("does not warn when explicitly-dated hops meet exactly", () => {
    const w = dateWarnings(`
hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-04
hop Berlin:
  dates: 2026-07-04 .. 2026-07-07
`);
    expect(w).toHaveLength(0);
  });

  it("does not warn on chained stay-only hops (no explicit dates)", () => {
    const w = dateWarnings(`
hop Copenhagen:
  stay: 3d
hop Berlin:
  stay: 3d
hop Prague:
  stay: 2d
`);
    expect(w).toHaveLength(0);
  });

  it("produces no warnings for an undated plan", () => {
    const w = dateWarnings(`
hop Copenhagen:
hop Berlin:
  activity: Wander around
`);
    expect(w).toHaveLength(0);
  });

  it("does not flag a gap when only the later hop is chained off an early one", () => {
    // The first hop is dated; the second uses `stay:` and abuts by construction.
    const w = dateWarnings(`
hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-04
hop Berlin:
  stay: 3d
`);
    expect(w).toHaveLength(0);
  });
});
