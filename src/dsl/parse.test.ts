import { describe, expect, it } from "vitest";
import { parse, isValidIsoDate } from "./parse";

describe("isValidIsoDate", () => {
  it("accepts real dates", () => {
    expect(isValidIsoDate("2026-07-01")).toBe(true);
  });
  it("rejects impossible dates", () => {
    expect(isValidIsoDate("2026-13-40")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("07/01/2026")).toBe(false);
  });
});

describe("parse", () => {
  it("parses a full hop block", () => {
    const { trip, diagnostics } = parse(`
trip "Summer"
currency: DKK

hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-04
  budget: 1200 DKK
  arrive_by: flight
  note: "Start of trip"
`);
    expect(diagnostics).toHaveLength(0);
    expect(trip.title).toBe("Summer");
    expect(trip.defaultCurrency).toBe("DKK");
    expect(trip.hops).toHaveLength(1);
    const cph = trip.hops[0];
    expect(cph.name).toBe("Copenhagen");
    expect(cph.startDate).toBe("2026-07-01");
    expect(cph.endDate).toBe("2026-07-04");
    expect(cph.budget).toEqual({ amount: 1200, currency: "DKK" });
    expect(cph.arriveBy).toBe("flight");
    expect(cph.note).toBe("Start of trip");
  });

  it("supports multiple hops and stay durations", () => {
    const { trip } = parse(`
hop Berlin:
  stay: 3d
hop Prague:
  stay: 2 nights
`);
    expect(trip.hops.map((h) => h.name)).toEqual(["Berlin", "Prague"]);
    expect(trip.hops[0].stayDays).toBe(3);
    expect(trip.hops[1].stayDays).toBe(2);
  });

  it("inherits the default currency for bare budgets", () => {
    const { trip, diagnostics } = parse(`
currency: EUR
hop Rome:
  budget: 800
`);
    expect(trip.hops[0].budget).toEqual({ amount: 800, currency: "EUR" });
    expect(diagnostics).toHaveLength(0);
  });

  it("warns on a budget with no currency and no default", () => {
    const { diagnostics } = parse(`
hop Rome:
  budget: 800
`);
    expect(diagnostics.some((d) => d.severity === "warning" && /currency/.test(d.message))).toBe(
      true,
    );
  });

  it("parses coords and thousands separators", () => {
    const { trip } = parse(`
hop Prague:
  coords: 50.0755, 14.4378
  budget: 1,200 CZK
`);
    expect(trip.hops[0].coords).toEqual({ lat: 50.0755, lng: 14.4378 });
    expect(trip.hops[0].budget?.amount).toBe(1200);
  });

  it("ignores comments, including inline ones, but keeps # inside quotes", () => {
    const { trip, diagnostics } = parse(`
# leading comment
hop Vienna:  # trailing comment
  note: "café #1"
`);
    expect(diagnostics).toHaveLength(0);
    expect(trip.hops[0].name).toBe("Vienna");
    expect(trip.hops[0].note).toBe("café #1");
  });

  it("flags bad dates and reversed ranges", () => {
    const { diagnostics } = parse(`
hop X:
  dates: 2026-07-04 .. 2026-07-01
`);
    expect(diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("flags fields before any hop", () => {
    const { diagnostics } = parse(`budget: 100 EUR`);
    expect(diagnostics[0].severity).toBe("error");
  });

  it("flags unknown transport modes as warnings", () => {
    const { diagnostics } = parse(`
hop X:
  arrive_by: teleport
`);
    expect(diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("flags unparseable lines", () => {
    const { diagnostics } = parse(`
hop X:
  this is not a field
`);
    expect(diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("parses start and end waypoints (name or coords)", () => {
    const { trip, diagnostics } = parse(`
start: Oslo
end: 41.9028, 12.4964
hop Berlin:
  stay: 2d
`);
    expect(diagnostics).toHaveLength(0);
    expect(trip.start).toEqual({ name: "Oslo", line: 2 });
    expect(trip.end).toEqual({
      name: "41.9028, 12.4964",
      coords: { lat: 41.9028, lng: 12.4964 },
      line: 3,
    });
  });

  it("flags a start/end with no place name", () => {
    const { diagnostics } = parse(`start:`);
    expect(diagnostics.some((d) => d.severity === "error" && /start/.test(d.message))).toBe(true);
  });

  it("parses optional per-hop travel time into minutes", () => {
    const { trip, diagnostics } = parse(`
hop Berlin:
  arrive_by: train
  travel: 4h 30m
`);
    expect(diagnostics).toHaveLength(0);
    expect(trip.hops[0].travelMinutes).toBe(270);
  });

  it("flags an unparseable travel time", () => {
    const { diagnostics } = parse(`
hop Berlin:
  travel: soon
`);
    expect(diagnostics.some((d) => d.severity === "error" && /travel/.test(d.message))).toBe(true);
  });

  it("collects inline activities with an optional fixed date", () => {
    const { trip, diagnostics } = parse(`
hop Copenhagen:
  activity: Tivoli Gardens
  activity: Round Tower @ 2026-07-02
`);
    expect(diagnostics).toHaveLength(0);
    const acts = trip.hops[0].activities ?? [];
    expect(acts.map((a) => a.name)).toEqual(["Tivoli Gardens", "Round Tower"]);
    expect(acts[0].date).toBeUndefined();
    expect(acts[1].date).toBe("2026-07-02");
  });

  it("warns on an activity with an invalid date and keeps the name", () => {
    const { trip, diagnostics } = parse(`
hop X:
  activity: Thing @ 2026-13-40
`);
    expect(diagnostics.some((d) => d.severity === "warning" && /date/.test(d.message))).toBe(true);
    expect(trip.hops[0].activities?.[0]).toMatchObject({ name: "Thing", date: undefined });
  });

  it("flags an activity with no name", () => {
    const { diagnostics } = parse(`
hop X:
  activity: @ 2026-07-02
`);
    expect(diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("attaches a drive block's stops to the next hop", () => {
    const { trip, diagnostics } = parse(`
hop Sydney:
  stay: 6d

drive -> Melbourne:
  by: car
  stop: Canberra
  stop: Lakes Entrance 2d

hop Melbourne:
  stay: 4d
  arrive_by: car
`);
    expect(diagnostics).toHaveLength(0);
    const melbourne = trip.hops.find((h) => h.name === "Melbourne");
    expect(melbourne?.driveMode).toBe("car");
    expect(melbourne?.driveStops?.map((s) => [s.name, s.nights])).toEqual([
      ["Canberra", 1],
      ["Lakes Entrance", 2],
    ]);
    // The stops belong to Melbourne, not Sydney.
    expect(trip.hops.find((h) => h.name === "Sydney")?.driveStops).toBeUndefined();
  });

  it("warns when the drive destination doesn't match the next hop", () => {
    const { diagnostics } = parse(`
hop Sydney:
  stay: 6d
drive -> Perth:
  stop: Canberra
hop Melbourne:
  stay: 4d
`);
    expect(diagnostics.some((d) => d.severity === "warning" && /Perth/.test(d.message))).toBe(true);
  });

  it("errors on a drive with no preceding hop", () => {
    const { diagnostics } = parse(`
drive -> Melbourne:
  stop: Canberra
hop Melbourne:
  stay: 2d
`);
    expect(diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("warns on a drive block that never reaches a hop", () => {
    const { diagnostics } = parse(`
hop Sydney:
  stay: 6d
drive:
  stop: Canberra
`);
    expect(diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });
});
