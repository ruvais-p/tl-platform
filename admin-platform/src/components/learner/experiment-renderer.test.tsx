import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Activity } from "@/lib/learner/types";
import { ExperimentRenderer } from "./experiment-renderer";

function experiment(configuration: Record<string, unknown>): Activity {
  return {
    id: "activity",
    subtopic: "subtopic",
    activity_type: "EXPERIMENT",
    title: "Admin-authored experiment",
    description: "",
    display_order: 1,
    is_required: true,
    estimated_minutes: 10,
    completion_rule: {},
    status: "PUBLISHED",
    content: {},
    content_record: null,
    experiment: {
      id: "experiment",
      activity: "activity",
      experiment_type: "QUESTION_BASED",
      instructions: "Use the supplied evidence.",
      configuration,
      external_url: null,
      created_at: "",
      updated_at: "",
    },
  };
}

function linearProgrammingConfiguration() {
  return {
    schema_version: 1,
    renderer: "geogebra",
    renderer_config: {
      workspace: {
        type: "linear_programming",
        title: "Three-product production plan",
        problem_statement: "Choose the daily production mix.",
        axis_variables: ["x1", "x2"],
        variables: [
          { id: "x1", label: "Product A", symbol: "x1", unit: "units", min: 20, max: 50, initial: 20, step: 1 },
          { id: "x2", label: "Product B", symbol: "x2", unit: "units", min: 0, max: 25, initial: 5, step: 1 },
          { id: "x3", label: "Product C", symbol: "x3", unit: "units", min: 0, max: 30, initial: 10, step: 1 },
        ],
        objective: { label: "Profit", sense: "maximize", currency: "₹", coefficients: { x1: 12, x2: 20, x3: 45 } },
        constraints: [
          { id: "labour", label: "Assembly time", coefficients: { x1: 0.8, x2: 1.7, x3: 2.5 }, operator: "<=", rhs: 100 },
          { id: "commitment", label: "Combined commitment", coefficients: { x1: 0, x2: 1, x3: 1 }, operator: ">=", rhs: 15 },
        ],
      },
    },
  };
}

function multivariableConfiguration() {
  return {
    schema_version: 1,
    renderer: "geogebra",
    renderer_config: {
      workspace: {
        type: "multivariable_profit",
        version: 1,
        title: "Two products, one hill",
        scenario: "Find a better production mix.",
        currency: "₹",
        products: [
          { id: "x", label: "Product X", unit: "units", price: 30, price_drop: 0.05, unit_cost: 12.5, initial: 200, min: 0, max: 400, step: 5 },
          { id: "y", label: "Product Y", unit: "units", price: 16, price_drop: 0.02, unit_cost: 4.5, initial: 150, min: 0, max: 500, step: 5 },
        ],
        cross_effect: 0.01,
        fixed_cost: 1000,
        target_tolerance: 10,
        steps: [
          { kind: "hill", title: "Hill", instruction: "Read the hill." },
          { kind: "slope", title: "Slope", instruction: "Read the slope." },
          { kind: "walk", title: "Walk", instruction: "Follow the gradient." },
          { kind: "result", title: "Result", instruction: "Compare the result." },
          { kind: "question", title: "Your Q", instruction: "Explain it." },
        ],
        questions: {
          slope: { prompt: "With {held_product} fixed, what happens after one more {moving_product}?", options: [
            { value: "increase", label: "Profit goes up" },
            { value: "decrease", label: "Profit goes down" },
            { value: "same", label: "Profit stays the same" },
          ] },
          reflection: { prompt: "What should management do?", minimum_characters: 20 },
        },
      },
    },
  };
}

describe("data-driven experiment renderer", () => {
  it("builds response fields from the administrator configuration", async () => {
    const onStateChange = vi.fn();
    render(<ExperimentRenderer activity={experiment({ response_fields: ["decision", { key: "risk", label: "Main risk", type: "text" }] })} state={{}} onStateChange={onStateChange} onTrackedProgress={vi.fn()} />);

    expect(screen.getByLabelText("Decision")).toBeDefined();
    expect(screen.getByLabelText("Main risk")).toBeDefined();
    await userEvent.type(screen.getByLabelText("Main risk"), "Low confidence");
    expect(onStateChange).toHaveBeenCalled();
  });

  it("renders placeholder copy entirely from the published definition", () => {
    render(<ExperimentRenderer activity={experiment({ renderer: "placeholder", renderer_config: { heading: "Coming next", message: "Admin supplied message", note: "Admin supplied note" } })} state={{}} onStateChange={vi.fn()} onTrackedProgress={vi.fn()} />);
    expect(screen.getByText("Coming next")).toBeDefined();
    expect(screen.getByText("Admin supplied message")).toBeDefined();
    expect(screen.getByText("Admin supplied note")).toBeDefined();
  });

  it("renders an admin-posted linear-programming workspace without a material ID", () => {
    render(<ExperimentRenderer activity={experiment(linearProgrammingConfiguration())} state={{}} onStateChange={vi.fn()} onTrackedProgress={vi.fn()} />);

    expect(screen.getByText("Three-product production plan")).toBeDefined();
    expect(screen.getByRole("button", { name: "Calculate & plot" })).toBeDefined();
    expect(screen.getByText("Feasible region and vertices")).toBeDefined();
    expect(screen.queryByText(/missing its GeoGebra material ID/i)).toBeNull();
  });

  it("renders the admin-posted multivariable workshop without a material ID", async () => {
    render(<ExperimentRenderer activity={experiment(multivariableConfiguration())} state={{}} onStateChange={vi.fn()} onTrackedProgress={vi.fn()} />);

    expect(screen.getByText("Two products, one hill")).toBeDefined();
    expect(screen.getByText("Current profit")).toBeDefined();
    expect(screen.getByRole("button", { name: "Show 3D hill" })).toBeDefined();
    expect(screen.queryByText(/missing its GeoGebra material ID/i)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByText("Hold one input still")).toBeDefined();
    expect(screen.getByText("Live slice and tangent")).toBeDefined();
    expect(screen.queryByText("Check your reading")).toBeNull();
  });

  it("provides a scrollable fullscreen mode with an explicit exit control", async () => {
    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
    const requestDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "requestFullscreen");
    const exitDescriptor = Object.getOwnPropertyDescriptor(document, "exitFullscreen");
    let fullscreenElement: Element | null = null;
    let workspaceElement: Element | null = null;
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: async () => {
        fullscreenElement = workspaceElement;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: async () => {
        fullscreenElement = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });

    const view = render(<ExperimentRenderer activity={experiment(linearProgrammingConfiguration())} state={{}} onStateChange={vi.fn()} onTrackedProgress={vi.fn()} />);
    workspaceElement = view.container.querySelector('[data-workspace="linear-programming"]');
    try {
      await userEvent.click(within(view.container).getByRole("button", { name: "Fullscreen" }));
      const exit = await within(view.container).findByRole("button", { name: "Exit fullscreen" });
      expect((fullscreenElement as HTMLElement | null)?.className).toContain("overflow-y-auto");
      expect(exit.getAttribute("aria-pressed")).toBe("true");
      expect(exit.parentElement?.parentElement?.className).toContain("sticky");

      await userEvent.click(exit);
      expect((await within(view.container).findByRole("button", { name: "Fullscreen" })).getAttribute("aria-pressed")).toBe("false");
    } finally {
      view.unmount();
      if (fullscreenDescriptor) Object.defineProperty(document, "fullscreenElement", fullscreenDescriptor);
      else Reflect.deleteProperty(document, "fullscreenElement");
      if (requestDescriptor) Object.defineProperty(Element.prototype, "requestFullscreen", requestDescriptor);
      else Reflect.deleteProperty(Element.prototype, "requestFullscreen");
      if (exitDescriptor) Object.defineProperty(document, "exitFullscreen", exitDescriptor);
      else Reflect.deleteProperty(document, "exitFullscreen");
    }
  });
});
