import { afterEach, describe, expect, it } from "vitest";
import { deletePlan, listPlans, loadPlan, planExists, savePlan } from "./store";

afterEach(() => {
  localStorage.clear();
});

describe("named plan storage", () => {
  it("saves and loads a plan by name", () => {
    savePlan("Trip", "hop A:\n");
    expect(loadPlan("Trip")).toBe("hop A:\n");
    expect(listPlans()).toEqual(["Trip"]);
  });

  it("overwrites an existing slot in place rather than creating a duplicate", () => {
    savePlan("Trip", "first");
    savePlan("Trip", "second");
    expect(loadPlan("Trip")).toBe("second");
    expect(listPlans()).toEqual(["Trip"]);
  });

  it("trims the name on save so lookups are stable", () => {
    savePlan("  Trip  ", "x");
    expect(loadPlan("Trip")).toBe("x");
    expect(planExists("Trip")).toBe(true);
  });

  it("ignores a blank name", () => {
    savePlan("   ", "x");
    expect(listPlans()).toEqual([]);
  });

  it("reports whether a slot exists", () => {
    expect(planExists("Trip")).toBe(false);
    savePlan("Trip", "x");
    expect(planExists("Trip")).toBe(true);
    expect(planExists(" Trip ")).toBe(true);
  });

  it("returns null for a missing plan", () => {
    expect(loadPlan("nope")).toBeNull();
  });

  it("deletes a plan", () => {
    savePlan("Trip", "x");
    deletePlan("Trip");
    expect(planExists("Trip")).toBe(false);
    expect(loadPlan("Trip")).toBeNull();
  });
});
