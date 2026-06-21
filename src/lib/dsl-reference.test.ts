import { describe, expect, it } from "vitest";
import { DSL_REFERENCE } from "./dsl-reference";
import { parse } from "../dsl/parse";

// The DSL guide doubles as documentation; these tests ensure every snippet
// stays valid as the parser evolves, so the guide can't drift out of sync.
describe("DSL_REFERENCE", () => {
  it("has sections", () => {
    expect(DSL_REFERENCE.length).toBeGreaterThan(0);
  });

  for (const section of DSL_REFERENCE) {
    it(`"${section.title}" parses without errors`, () => {
      const { diagnostics } = parse(section.code);
      const errors = diagnostics.filter((d) => d.severity === "error");
      expect(errors).toEqual([]);
    });
  }
});
