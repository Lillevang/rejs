import { describe, expect, it } from "vitest";
import { appendHop, formatCoords, NEW_HOP_NAME, setHopCoords } from "./edit";
import { parse } from "./parse";

describe("formatCoords", () => {
  it("joins lat and lng with a comma-space, matching the parser", () => {
    expect(formatCoords(55.6761, 12.5683)).toBe("55.6761, 12.5683");
  });

  it("rounds to ~1m precision (5 decimals)", () => {
    expect(formatCoords(55.67611111, 12.56833333)).toBe("55.67611, 12.56833");
  });

  it("drops trailing zeros from rounding", () => {
    expect(formatCoords(52.52, 13.405)).toBe("52.52, 13.405");
  });

  it("handles negative coordinates", () => {
    expect(formatCoords(-33.8688, 151.2093)).toBe("-33.8688, 151.2093");
  });
});

describe("setHopCoords", () => {
  it("inserts a coords line after the header when absent", () => {
    const text = ["hop Berlin:", "  stay: 3d", "  budget: 240 EUR"].join("\n");
    const next = setHopCoords(text, 1, 52.52, 13.405);
    expect(next).toBe(
      ["hop Berlin:", "  coords: 52.52, 13.405", "  stay: 3d", "  budget: 240 EUR"].join("\n"),
    );
  });

  it("replaces an existing coords line in place", () => {
    const text = ["hop Berlin:", "  coords: 1, 2", "  stay: 3d"].join("\n");
    const next = setHopCoords(text, 1, 52.52, 13.405);
    expect(next).toBe(["hop Berlin:", "  coords: 52.52, 13.405", "  stay: 3d"].join("\n"));
  });

  it("preserves the indentation of an existing coords line", () => {
    const text = ["hop Berlin:", "    coords: 1, 2"].join("\n");
    const next = setHopCoords(text, 1, 10, 20);
    expect(next).toBe(["hop Berlin:", "    coords: 10, 20"].join("\n"));
  });

  it("matches the body indentation when inserting", () => {
    const text = ["hop Berlin:", "    stay: 3d"].join("\n");
    const next = setHopCoords(text, 1, 10, 20);
    expect(next).toBe(["hop Berlin:", "    coords: 10, 20", "    stay: 3d"].join("\n"));
  });

  it("targets only the named hop, leaving sibling hops untouched", () => {
    const text = [
      "hop Copenhagen:",
      "  coords: 55.68, 12.57",
      "",
      "hop Berlin:",
      "  stay: 3d",
    ].join("\n");
    const next = setHopCoords(text, 4, 52.52, 13.405);
    expect(next).toBe(
      [
        "hop Copenhagen:",
        "  coords: 55.68, 12.57",
        "",
        "hop Berlin:",
        "  coords: 52.52, 13.405",
        "  stay: 3d",
      ].join("\n"),
    );
  });

  it("does not clobber a later hop's coords when replacing an earlier one", () => {
    const text = ["hop Copenhagen:", "  coords: 1, 2", "", "hop Berlin:", "  coords: 3, 4"].join(
      "\n",
    );
    const next = setHopCoords(text, 1, 55.68, 12.57);
    expect(next).toBe(
      ["hop Copenhagen:", "  coords: 55.68, 12.57", "", "hop Berlin:", "  coords: 3, 4"].join("\n"),
    );
  });

  it("stops the body search at the next hop even without a blank line", () => {
    const text = ["hop Copenhagen:", "hop Berlin:", "  coords: 3, 4"].join("\n");
    const next = setHopCoords(text, 1, 9, 9);
    expect(next).toBe(
      ["hop Copenhagen:", "  coords: 9, 9", "hop Berlin:", "  coords: 3, 4"].join("\n"),
    );
  });

  it("keeps blank lines inside the body without treating them as boundaries", () => {
    const text = ["hop Berlin:", "  stay: 3d", "", "  budget: 240 EUR", "  coords: 1, 2"].join(
      "\n",
    );
    const next = setHopCoords(text, 1, 52.52, 13.405);
    expect(next).toBe(
      ["hop Berlin:", "  stay: 3d", "", "  budget: 240 EUR", "  coords: 52.52, 13.405"].join("\n"),
    );
  });

  it("is idempotent: applying the same coords twice yields the same text", () => {
    const text = ["hop Berlin:", "  stay: 3d"].join("\n");
    const once = setHopCoords(text, 1, 52.52, 13.405);
    const twice = setHopCoords(once, 1, 52.52, 13.405);
    expect(twice).toBe(once);
  });

  it("returns the text unchanged when the line is out of range", () => {
    const text = "hop Berlin:\n  stay: 3d";
    expect(setHopCoords(text, 99, 1, 2)).toBe(text);
    expect(setHopCoords(text, 0, 1, 2)).toBe(text);
  });

  it("matches coords case-insensitively when replacing", () => {
    const text = ["hop Berlin:", "  Coords: 1, 2"].join("\n");
    const next = setHopCoords(text, 1, 10, 20);
    expect(next).toBe(["hop Berlin:", "  coords: 10, 20"].join("\n"));
  });
});

describe("appendHop", () => {
  it("starts a buffer from empty with no leading blank line", () => {
    const { text } = appendHop("");
    expect(text).toBe("hop New stop:\n  stay: 2d\n");
  });

  it("separates the new block from existing content by one blank line", () => {
    const { text } = appendHop("hop Berlin:\n  stay: 3d\n");
    expect(text).toBe("hop Berlin:\n  stay: 3d\n\nhop New stop:\n  stay: 2d\n");
  });

  it("inserts exactly one blank line even when the buffer has no trailing newline", () => {
    const { text } = appendHop("hop Berlin:\n  stay: 3d");
    expect(text).toBe("hop Berlin:\n  stay: 3d\n\nhop New stop:\n  stay: 2d\n");
  });

  it("collapses trailing whitespace before adding the separator", () => {
    const { text } = appendHop("hop Berlin:\n  stay: 3d\n\n\n  ");
    expect(text).toBe("hop Berlin:\n  stay: 3d\n\nhop New stop:\n  stay: 2d\n");
  });

  it("returns offsets that select exactly the placeholder name", () => {
    const { text, nameStart, nameEnd } = appendHop("hop Berlin:\n  stay: 3d\n");
    expect(text.slice(nameStart, nameEnd)).toBe(NEW_HOP_NAME);
  });

  it("returns offsets for the placeholder name when starting from empty", () => {
    const { text, nameStart, nameEnd } = appendHop("");
    expect(text.slice(nameStart, nameEnd)).toBe(NEW_HOP_NAME);
    expect(nameStart).toBe("hop ".length);
  });

  it("produces a block the real parser reads as one more hop", () => {
    const before = parse("hop Berlin:\n  stay: 3d\n");
    const after = parse(appendHop("hop Berlin:\n  stay: 3d\n").text);
    expect(after.trip.hops).toHaveLength(before.trip.hops.length + 1);
    expect(after.trip.hops.at(-1)?.name).toBe(NEW_HOP_NAME);
    expect(after.trip.hops.at(-1)?.stayDays).toBe(2);
    expect(after.diagnostics).toEqual([]);
  });

  it("allows repeated quick-adds (duplicate placeholder names parse cleanly)", () => {
    const once = appendHop("").text;
    const twice = appendHop(once).text;
    const { trip, diagnostics } = parse(twice);
    expect(trip.hops.map((h) => h.name)).toEqual([NEW_HOP_NAME, NEW_HOP_NAME]);
    expect(diagnostics).toEqual([]);
  });
});
