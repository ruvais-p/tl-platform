import { describe, expect, it, vi } from "vitest";
import type { GeoGebraApi } from "./geogebra";
import { createMainProfitPlot, createSliceProfitPlot, type ProfitScene } from "./geogebra-profit";
import { analyseProfit, initialMultivariableState, parseMultivariableProfitWorkspace } from "./multivariable-profit";

function scene(): ProfitScene {
  const parsed = parseMultivariableProfitWorkspace({
    type: "multivariable_profit",
    version: 1,
    title: "Profit hill",
    scenario: "Choose a mix.",
    currency: "₹",
    products: [
      { id: "x", label: "Product X", unit: "units", price: 30, price_drop: 0.05, unit_cost: 12.5, initial: 200, min: 0, max: 400, step: 5 },
      { id: "y", label: "Product Y", unit: "units", price: 16, price_drop: 0.02, unit_cost: 4.5, initial: 150, min: 0, max: 500, step: 5 },
    ],
    cross_effect: 0.01,
    fixed_cost: 1000,
    target_tolerance: 10,
    steps: [
      { kind: "hill", title: "Hill", instruction: "See it." },
      { kind: "slope", title: "Slope", instruction: "Slice it." },
      { kind: "walk", title: "Walk", instruction: "Climb it." },
      { kind: "result", title: "Result", instruction: "Compare it." },
      { kind: "question", title: "Your Q", instruction: "Explain it." },
    ],
    questions: {
      slope: { prompt: "What happens?", options: [
        { value: "increase", label: "Up" },
        { value: "decrease", label: "Down" },
        { value: "same", label: "Same" },
      ] },
      reflection: { prompt: "Why?", minimum_characters: 10 },
    },
  });
  const workspace = parsed.workspace!;
  const state = initialMultivariableState(workspace);
  return {
    workspace,
    model: state.model,
    analysis: analyseProfit(workspace, state.model, state.quantities),
    trail: state.trail,
    stage: "hill",
    view: "contour",
    heldProduct: 1,
  };
}

function fakeApi() {
  return {
    evalCommand: vi.fn((command: string) => {
      void command;
      return true;
    }),
    getValue: vi.fn(() => 0),
    getValueString: vi.fn(() => ""),
    reset: vi.fn(),
    setValue: vi.fn(),
    setCoords: vi.fn(),
    setVisible: vi.fn(),
    setPerspective: vi.fn(),
    setCoordSystem: vi.fn(),
    setAxisLabels: vi.fn(),
    setAxesVisible: vi.fn(),
    setGridVisible: vi.fn(),
    setColor: vi.fn(),
    setFilling: vi.fn(),
    setLineThickness: vi.fn(),
    setLineStyle: vi.fn(),
    setPointSize: vi.fn(),
    setLabelVisible: vi.fn(),
    setLayer: vi.fn(),
    setFixed: vi.fn(),
    deleteObject: vi.fn(),
    recalculateEnvironments: vi.fn(),
  } satisfies GeoGebraApi;
}

describe("generated GeoGebra profit adapter", () => {
  it("constructs the surface, contour bands, points, and gradient from a semantic scene", () => {
    const api = fakeApi();
    const handle = createMainProfitPlot(api);
    const current = scene();
    handle.update(current);
    const commands = api.evalCommand.mock.calls.map(([command]) => command).join("\n");

    expect(commands).toContain("tellaProfit(x,y)");
    expect(commands).toContain("Surface(u,v,tellaPlotProfit(u,v)");
    expect(commands).toContain("tellaBand0");
    expect(commands).toContain("tellaGradient = Vector");
    expect(api.setPerspective).toHaveBeenCalledWith("G");
    expect(api.setCoords).toHaveBeenCalledWith("TellaCurrent", 200, 150);

    handle.update({ ...current, view: "surface" });
    expect(api.setPerspective).toHaveBeenLastCalledWith("T");
  });

  it("constructs a synchronized slice and tangent without lesson-specific commands", () => {
    const api = fakeApi();
    const handle = createSliceProfitPlot(api);
    handle.update(scene());
    const commands = api.evalCommand.mock.calls.map(([command]) => command).join("\n");

    expect(commands).toContain("tellaSlice(t)");
    expect(commands).toContain("tellaTangent(x) = tellaSlice(tellaFree)");
    expect(api.setAxisLabels).toHaveBeenCalledWith(1, "Product X", "₹ profit");
  });
});
