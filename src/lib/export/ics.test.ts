import { describe, expect, it } from "vitest";
import { parse } from "../../dsl/parse";
import { resolve } from "../../dsl/resolve";
import type { ResolvedTrip } from "../../dsl/types";
import { icsFilename, planToIcs } from "./ics";

/** Parse + resolve a DSL string into a resolved trip, with a fixed start date so
 * chained `stay:` hops produce deterministic windows in tests. */
function resolved(dsl: string): ResolvedTrip {
  const { trip } = parse(dsl);
  return resolve(trip, { defaultStart: "2026-07-01" });
}

const SAMPLE = `trip "Summer Trip"
currency: EUR

hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-04
  budget: 320 EUR
  arrive_by: train

hop Berlin:
  stay: 3d
`;

describe("planToIcs structure", () => {
  it("wraps events in a valid VCALENDAR with version and prodid", () => {
    const ics = planToIcs(resolved(SAMPLE));
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("PRODID:");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("emits one VEVENT per hop", () => {
    const ics = planToIcs(resolved(SAMPLE));
    const count = ics.match(/BEGIN:VEVENT/g)?.length ?? 0;
    expect(count).toBe(2);
  });

  it("uses CRLF line endings everywhere", () => {
    const ics = planToIcs(resolved(SAMPLE));
    // Every newline must be a CRLF — no bare LF.
    expect(ics.includes("\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });
});

describe("all-day hop events", () => {
  it("uses DATE-valued DTSTART and an exclusive DTEND (morning after last night)", () => {
    // Copenhagen: 2026-07-01 .. 2026-07-04 means nights of 1,2,3 July, checkout
    // the morning of the 4th. DTEND is exclusive, so it must be 20260704, NOT
    // 20260703 (the classic all-day off-by-one).
    const ics = planToIcs(resolved(SAMPLE));
    expect(ics).toContain("DTSTART;VALUE=DATE:20260701");
    expect(ics).toContain("DTEND;VALUE=DATE:20260704");
  });

  it("chains a stay-only hop off the previous hop's end", () => {
    // Berlin (stay: 3d) starts when Copenhagen ends (4 Jul) and runs 3 nights,
    // so DTEND is the exclusive 7 Jul.
    const ics = planToIcs(resolved(SAMPLE));
    expect(ics).toContain("DTSTART;VALUE=DATE:20260704");
    expect(ics).toContain("DTEND;VALUE=DATE:20260707");
  });

  it("includes budget and transport in the hop description", () => {
    const ics = planToIcs(resolved(SAMPLE));
    expect(ics).toContain("DESCRIPTION:Budget: 320 EUR\\nArrive by: train");
  });
});

describe("fixed-date activities", () => {
  it("emits an all-day single-day VEVENT per fixed-date activity", () => {
    const ics = planToIcs(
      resolved(`hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-05
  activity: Tivoli @ 2026-07-02
`),
    );
    // One hop event + one activity event.
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics).toContain("SUMMARY:Tivoli");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260702");
    // Single all-day event: exclusive DTEND is the next day.
    expect(ics).toContain("DTEND;VALUE=DATE:20260703");
  });

  it("ignores flexible (undated) activities", () => {
    const ics = planToIcs(
      resolved(`hop Copenhagen:
  stay: 2d
  activity: Beach day
`),
    );
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(ics).not.toContain("Beach day");
  });
});

describe("text escaping", () => {
  it("escapes commas, semicolons, and backslashes in names", () => {
    const ics = planToIcs(
      resolved(`hop Lyngby, Denmark:
  stay: 1d
  note: A; B \\ C
`),
    );
    expect(ics).toContain("SUMMARY:Lyngby\\, Denmark");
    expect(ics).toContain("A\\; B \\\\ C");
  });
});

describe("determinism", () => {
  it("produces byte-identical output for the same input (stable UID + DTSTAMP)", () => {
    const trip = resolved(SAMPLE);
    expect(planToIcs(trip)).toBe(planToIcs(trip));
  });

  it("uses a fixed, non-wall-clock DTSTAMP", () => {
    const ics = planToIcs(resolved(SAMPLE));
    expect(ics).toContain("DTSTAMP:20000101T000000Z");
  });

  it("derives stable per-hop and per-activity UIDs", () => {
    const ics = planToIcs(
      resolved(`hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-03
  activity: Tivoli @ 2026-07-02
`),
    );
    expect(ics).toContain("UID:hop-0@rejs.local");
    expect(ics).toContain("UID:activity-act-0@rejs.local");
  });
});

describe("line folding", () => {
  it("folds content lines longer than 75 octets", () => {
    const longName = "A".repeat(120);
    const ics = planToIcs(
      resolved(`hop ${longName}:
  stay: 1d
`),
    );
    // A folded continuation line begins with CRLF + a single space.
    expect(ics).toMatch(/\r\n /);
    // No single content line (between CRLFs, ignoring continuations) exceeds 75
    // octets.
    const unfolded = ics.split("\r\n");
    for (const line of unfolded) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("date-less / empty plans", () => {
  it("produces a valid but event-free calendar for a hop-less trip", () => {
    const ics = planToIcs(resolved(`trip "Empty"\n`));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("still emits events for an undated stay-only plan (dates chain off today)", () => {
    // No explicit dates anywhere, but resolve() chains concrete dates from the
    // trip start, so each hop still has a real all-day window to export.
    const ics = planToIcs(resolved(`hop Paris:\n  stay: 2d\n`));
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(ics).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
  });
});

describe("icsFilename", () => {
  it("derives a safe filename from the trip title", () => {
    expect(icsFilename("Summer Trip")).toBe("Summer-Trip.ics");
  });

  it("strips unsafe characters", () => {
    expect(icsFilename("Trip: Italy/France!")).toBe("Trip-ItalyFrance.ics");
  });

  it("falls back to trip.ics for an empty or missing title", () => {
    expect(icsFilename(undefined)).toBe("trip.ics");
    expect(icsFilename("   ")).toBe("trip.ics");
    expect(icsFilename("!!!")).toBe("trip.ics");
  });
});
