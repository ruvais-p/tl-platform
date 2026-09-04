import { describe, expect, it } from "vitest";
import {
  initialLinearProgrammingState,
  parseLinearProgrammingWorkspace,
  solveLinearProgramming,
} from "./linear-programming";

const referenceWorkspace = {
  type: "linear_programming",
  title: "Example 1: LP Model Formulation",
  problem_statement: "A manufacturer produces products A, B, and C.",
  axis_variables: ["x1", "x2"],
  variables: [
    { id: "x1", label: "Product A", symbol: "x₁", unit: "units", min: 20, max: 50, initial: 20, step: 1 },
    { id: "x2", label: "Product B", symbol: "x₂", unit: "units", min: 0, max: 25, initial: 5, step: 1 },
    { id: "x3", label: "Product C", symbol: "x₃", unit: "units", min: 0, max: 30, initial: 10, step: 1 },
  ],
  objective: {
    label: "Profit",
    sense: "maximize",
    currency: "₹",
    coefficients: { x1: 12, x2: 20, x3: 45 },
  },
  constraints: [
    { id: "labour", label: "Assembly time", coefficients: { x1: 0.8, x2: 1.7, x3: 2.5 }, operator: "<=", rhs: 100 },
    { id: "commitment", label: "Combined commitment", coefficients: { x1: 0, x2: 1, x3: 1 }, operator: ">=", rhs: 15 },
  ],
};

describe("linear programming workspace", () => {
  it("reproduces the reference recording's feasible vertices and optimum", () => {
    const parsed = parseLinearProgrammingWorkspace(referenceWorkspace);
    expect(parsed.errors).toEqual([]);
    const state = initialLinearProgrammingState(parsed.workspace!);
    const solution = solveLinearProgramming(parsed.workspace!, state);

    expect(solution.ok).toBe(true);
    expect(solution.area).toBeCloseTo(579.31985294, 5);
    expect(solution.vertices).toHaveLength(5);
    expect(solution.vertices.map(({ x, y }) => [x, y])).toEqual([
      [20, 5],
      [50, 5],
      [50, expect.closeTo(20.588235294, 8)],
      [expect.closeTo(40.625, 8), 25],
      [20, 25],
    ]);
    expect(solution.best).toMatchObject({ x: 50 });
    expect(solution.best!.y).toBeCloseTo(20.588235294, 8);
    expect(solution.best!.objectiveValue).toBeCloseTo(1461.76470588, 8);
    expect(solution.allocation).toMatchObject({ x1: 50, x3: 10 });
  });

  it("uses saved learner values without changing the published definition", () => {
    const workspace = parseLinearProgrammingWorkspace(referenceWorkspace).workspace!;
    const state = initialLinearProgrammingState(workspace, {
      variable_values: { x3: 20 },
      objective_coefficients: { x1: 3.5 },
      plotted: true,
    });

    expect(state.variableValues.x3).toBe(20);
    expect(state.objectiveCoefficients.x1).toBe(3.5);
    expect(workspace.variables.find((variable) => variable.id === "x3")?.initial).toBe(10);
  });

  it("rejects incomplete admin definitions before rendering", () => {
    const parsed = parseLinearProgrammingWorkspace({ type: "linear_programming", variables: [] });
    expect(parsed.workspace).toBeNull();
    expect(parsed.errors.length).toBeGreaterThan(1);
  });
});
