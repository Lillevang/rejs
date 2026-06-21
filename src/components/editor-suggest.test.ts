import { describe, expect, it } from "vitest";
import { getCompletionContext } from "./editor-suggest";

/** Helper: put the caret at the `|` marker and return the completion context. */
function at(textWithCaret: string) {
  const caret = textWithCaret.indexOf("|");
  const value = textWithCaret.replace("|", "");
  return getCompletionContext(value, caret);
}

describe("getCompletionContext", () => {
  it("suggests top-level directives for an unindented word", () => {
    const ctx = at("st|");
    expect(ctx?.items.map((i) => i.label)).toContain("start:");
    expect(ctx?.token).toBe("st");
    expect(ctx?.start).toBe(0);
  });

  it("suggests hop fields for an indented word", () => {
    const ctx = at("hop Berlin:\n  tr|");
    const labels = ctx?.items.map((i) => i.label) ?? [];
    expect(labels).toContain("travel:");
    expect(labels).not.toContain("trip");
  });

  it("suggests activity as an indented hop field", () => {
    const ctx = at("hop Berlin:\n  act|");
    expect(ctx?.items.map((i) => i.label)).toEqual(["activity:"]);
  });

  it("suggests drive at the top level", () => {
    const ctx = at("dr|");
    expect(ctx?.items.map((i) => i.label)).toContain("drive");
  });

  it("suggests stop: inside a drive block, not hop fields", () => {
    const ctx = at("hop Sydney:\n  stay: 6d\ndrive -> Melbourne:\n  st|");
    const labels = ctx?.items.map((i) => i.label) ?? [];
    expect(labels).toContain("stop:");
    expect(labels).not.toContain("stay:");
  });

  it("still suggests hop fields inside a hop block", () => {
    const ctx = at("drive -> X:\n  stop: Canberra\nhop Melbourne:\n  st|");
    const labels = ctx?.items.map((i) => i.label) ?? [];
    expect(labels).toContain("stay:");
    expect(labels).not.toContain("stop:");
  });

  it("suggests transport modes after arrive_by:", () => {
    const ctx = at("hop Berlin:\n  arrive_by: t|");
    expect(ctx?.items.map((i) => i.label)).toEqual(["train"]);
  });

  it("lists all modes when the value is still empty", () => {
    const ctx = at("hop X:\n  arrive_by: |");
    expect(ctx?.items.length).toBe(6);
    expect(ctx?.start).toBe(ctx ? ctx.start : -1);
  });

  it("returns null once a key is complete (has a colon)", () => {
    expect(at("hop X:\n  stay:|")).toBeNull();
  });

  it("returns null on a blank line", () => {
    expect(at("hop X:\n|")).toBeNull();
  });

  it("inserts a key with its colon and a trailing space", () => {
    const ctx = at("hop X:\n  bud|");
    const budget = ctx?.items.find((i) => i.label === "budget:");
    expect(budget?.insert).toBe("budget: ");
  });
});
