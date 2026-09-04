import { describe, expect, it } from "vitest";
import {
  analyseProfit,
  expectedSlopeDirection,
  initialMultivariableState,
  parseMultivariableProfitWorkspace,
  promptForSlope,
  workshopProgress,
} from "./multivariable-profit";

function definition(crossEffect = 0.007) {
  return {
    type: "multivariable_profit",
    version: 1,
    title: "Two TV models, one profit hill",
    scenario: "Choose a better production mix.",
    currency: "₹",
    products: [
      { id: "small_tv", label: "19-inch TVs", unit: "TVs per month", price: 339, price_drop: 0.01, unit_cost: 195, initial: 3000, min: 0, max: 8500, step: 100 },
      { id: "large_tv", label: "21-inch TVs", unit: "TVs per month", price: 399, price_drop: 0.01, unit_cost: 225, initial: 5000, min: 0, max: 11000, step: 100 },
    ],
    cross_effect: crossEffect,
    fixed_cost: 400000,
    target_tolerance: 150,
    steps: [
      { kind: "hill", title: "Hill", instruction: "Read the hill." },
      { kind: "slope", title: "Slope", instruction: "Read a slice." },
      { kind: "walk", title: "Walk", instruction: "Follow the gradient." },
      { kind: "result", title: "Result", instruction: "Compare the result." },
      { kind: "question", title: "Your Q", instruction: "Explain the decision." },
    ],
    questions: {
      slope: {
        prompt: "With {held_product} fixed, what happens after one more {moving_product}?",
        options: [
          { value: "increase", label: "Profit goes up" },
          { value: "decrease", label: "Profit goes down" },
          { value: "same", label: "Profit stays the same" },
        ],
      },
      reflection: { prompt: "What should management do?", minimum_characters: 40 },
    },
  };
}

describe("multivariable profit workshop", () => {
  it("derives the video example from the administrator definition", () => {
    const parsed = parseMultivariableProfitWorkspace(definition());
    expect(parsed.errors).toEqual([]);
    const workspace = parsed.workspace!;
    const state = initialMultivariableState(workspace);
    const analysis = analyseProfit(workspace, state.model, state.quantities);

    expect(analysis.current.profit).toBeCloseTo(457000, 5);
    expect(analysis.gradient.x).toBeCloseTo(49, 5);
    expect(analysis.gradient.y).toBeCloseTo(53, 5);
    expect(analysis.optimum.x).toBeCloseTo(4735.04, 1);
    expect(analysis.optimum.y).toBeCloseTo(7042.74, 1);
    expect(analysis.optimum.profit).toBeCloseTo(553641.03, 1);
    expect(expectedSlopeDirection(analysis, 1)).toBe("increase");
  });

  it("keeps authored labels and question copy separate from the mathematics", () => {
    const workspace = parseMultivariableProfitWorkspace(definition()).workspace!;
    expect(promptForSlope(workspace, 1)).toBe(
      "With 21-inch TVs fixed, what happens after one more 19-inch TVs?",
    );
  });

  it("restores learner state without storing derived values", () => {
    const workspace = parseMultivariableProfitWorkspace(definition()).workspace!;
    const restored = initialMultivariableState(workspace, {
      stage: "question",
      furthest_stage: 4,
      quantities: [4800, 7000],
      reflection: "Increase both models until the live slopes approach zero.",
    });
    const progress = workshopProgress(workspace, restored);

    expect(restored.quantities).toEqual([4800, 7000]);
    expect(progress).toEqual({ percentage: 100, complete: true });
    expect(restored).not.toHaveProperty("profit");
  });

  it("rejects a definition that cannot produce one concave hill", () => {
    const parsed = parseMultivariableProfitWorkspace(definition(1));
    expect(parsed.workspace).toBeNull();
    expect(parsed.errors).toContain("workspace must describe one concave profit hill.");
  });
});
