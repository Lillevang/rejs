import { describe, expect, it } from "vitest";
import { formatDuration, parseDurationMinutes } from "./duration";

describe("parseDurationMinutes", () => {
  it("parses hours and minutes", () => {
    expect(parseDurationMinutes("4h 30m")).toBe(270);
    expect(parseDurationMinutes("2h")).toBe(120);
    expect(parseDurationMinutes("45m")).toBe(45);
  });

  it("parses fractional hours and bare minutes", () => {
    expect(parseDurationMinutes("1.5h")).toBe(90);
    expect(parseDurationMinutes("90")).toBe(90);
  });

  it("returns null for unparseable or non-positive input", () => {
    expect(parseDurationMinutes("soon")).toBeNull();
    expect(parseDurationMinutes("")).toBeNull();
    expect(parseDurationMinutes("0")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats minutes back to a compact string", () => {
    expect(formatDuration(270)).toBe("4h 30m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(45)).toBe("45m");
  });
});
