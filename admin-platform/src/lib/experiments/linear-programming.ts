export type LpOperator = "<=" | ">=";
export type LpSense = "maximize" | "minimize";

export type LpVariable = {
  id: string;
  label: string;
  symbol: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  initial: number;
};

export type LpConstraint = {
  id: string;
  label: string;
  coefficients: Record<string, number>;
  operator: LpOperator;
  rhs: number;
};

export type LinearProgrammingWorkspace = {
  type: "linear_programming";
  title: string;
  problemStatement: string;
  axisVariables: [string, string];
  variables: LpVariable[];
  constraints: LpConstraint[];
  objective: {
    label: string;
    sense: LpSense;
    currency: string;
    coefficients: Record<string, number>;
  };
};

export type LinearProgrammingState = {
  variableValues: Record<string, number>;
  objectiveCoefficients: Record<string, number>;
  constraintCoefficients: Record<string, Record<string, number>>;
  constraintRhs: Record<string, number>;
  variableBounds: Record<string, { min: number; max: number }>;
  plotted: boolean;
};

export type LpPoint = { x: number; y: number };

export type LpVertex = LpPoint & {
  label: string;
  objectiveValue: number;
};

export type ReducedBoundary = {
  id: string;
  label: string;
  a: number;
  b: number;
  rhs: number;
  operator: LpOperator;
};

export type LinearProgrammingSolution = {
  ok: boolean;
  message: string;
  vertices: LpVertex[];
  boundaries: ReducedBoundary[];
  area: number;
  best: LpVertex | null;
  worst: LpVertex | null;
  allocation: Record<string, number>;
  objectiveConstant: number;
};

const EPSILON = 1e-7;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown, fallback = Number.NaN): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function nonEmpty(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeId(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(value) ? value : "";
}

function numberMap(value: unknown, variableIds: Set<string>): Record<string, number> {
  const source = record(value);
  const result: Record<string, number> = {};
  variableIds.forEach((id) => {
    const parsed = finiteNumber(source[id]);
    if (Number.isFinite(parsed)) result[id] = parsed;
  });
  return result;
}

export function parseLinearProgrammingWorkspace(value: unknown): { workspace: LinearProgrammingWorkspace | null; errors: string[] } {
  const source = record(value);
  const errors: string[] = [];
  if (source.type !== "linear_programming") return { workspace: null, errors: ["workspace.type must be linear_programming."] };

  const rawVariables = Array.isArray(source.variables) ? source.variables : [];
  if (rawVariables.length < 2) errors.push("workspace.variables must contain at least two variables.");
  const variables = rawVariables.flatMap((entry, index): LpVariable[] => {
    const item = record(entry);
    const id = safeId(item.id);
    if (!id) {
      errors.push(`workspace.variables[${index}].id must start with a letter and contain only letters, numbers, or underscores.`);
      return [];
    }
    const min = finiteNumber(item.min);
    const max = finiteNumber(item.max);
    const initial = finiteNumber(item.initial, min);
    const step = finiteNumber(item.step, 1);
    if (![min, max, initial, step].every(Number.isFinite)) errors.push(`workspace variable ${id} must have numeric min, max, initial, and step values.`);
    if (Number.isFinite(min) && Number.isFinite(max) && min >= max) errors.push(`workspace variable ${id} must have min smaller than max.`);
    if (Number.isFinite(step) && step <= 0) errors.push(`workspace variable ${id} must have a positive step.`);
    return [{
      id,
      label: nonEmpty(item.label, id),
      symbol: nonEmpty(item.symbol, id),
      unit: nonEmpty(item.unit, "units"),
      min,
      max,
      initial: Math.min(max, Math.max(min, initial)),
      step,
    }];
  });
  const ids = new Set(variables.map((variable) => variable.id));
  if (ids.size !== variables.length) errors.push("workspace variable IDs must be unique.");

  const axes = Array.isArray(source.axis_variables) ? source.axis_variables.map(safeId) : [];
  if (axes.length !== 2 || !axes[0] || !axes[1] || axes[0] === axes[1] || !axes.every((id) => ids.has(id))) {
    errors.push("workspace.axis_variables must contain two different variable IDs.");
  }

  const objectiveSource = record(source.objective);
  const objectiveCoefficients = numberMap(objectiveSource.coefficients, ids);
  if (variables.some((variable) => !Number.isFinite(objectiveCoefficients[variable.id]))) {
    errors.push("workspace.objective.coefficients must provide a number for every variable.");
  }
  const sense: LpSense = objectiveSource.sense === "minimize" ? "minimize" : "maximize";

  const rawConstraints = Array.isArray(source.constraints) ? source.constraints : [];
  if (!rawConstraints.length) errors.push("workspace.constraints must contain at least one constraint.");
  const constraintIds = new Set<string>();
  const constraints = rawConstraints.flatMap((entry, index): LpConstraint[] => {
    const item = record(entry);
    const id = safeId(item.id);
    if (!id) {
      errors.push(`workspace.constraints[${index}].id is invalid.`);
      return [];
    }
    if (constraintIds.has(id)) errors.push(`workspace constraint ID ${id} is duplicated.`);
    constraintIds.add(id);
    const coefficients = numberMap(item.coefficients, ids);
    if (variables.some((variable) => !Number.isFinite(coefficients[variable.id]))) {
      errors.push(`workspace constraint ${id} must provide a coefficient for every variable.`);
    }
    const operator = item.operator === ">=" ? ">=" : item.operator === "<=" ? "<=" : null;
    if (!operator) errors.push(`workspace constraint ${id} operator must be <= or >=.`);
    const rhs = finiteNumber(item.rhs);
    if (!Number.isFinite(rhs)) errors.push(`workspace constraint ${id} rhs must be numeric.`);
    return [{ id, label: nonEmpty(item.label, id), coefficients, operator: operator ?? "<=", rhs }];
  });

  if (errors.length) return { workspace: null, errors };
  return {
    errors: [],
    workspace: {
      type: "linear_programming",
      title: nonEmpty(source.title, "Linear programming workspace"),
      problemStatement: nonEmpty(source.problem_statement, "Use the controls to explore the feasible region and best allocation."),
      axisVariables: [axes[0], axes[1]],
      variables,
      constraints,
      objective: {
        label: nonEmpty(objectiveSource.label, "Objective value"),
        sense,
        currency: typeof objectiveSource.currency === "string" ? objectiveSource.currency : "",
        coefficients: objectiveCoefficients,
      },
    },
  };
}

export function initialLinearProgrammingState(workspace: LinearProgrammingWorkspace, saved?: unknown): LinearProgrammingState {
  const persisted = record(saved);
  const persistedValues = record(persisted.variableValues ?? persisted.variable_values);
  const persistedObjective = record(persisted.objectiveCoefficients ?? persisted.objective_coefficients);
  const persistedConstraintCoefficients = record(persisted.constraintCoefficients ?? persisted.constraint_coefficients);
  const persistedConstraintRhs = record(persisted.constraintRhs ?? persisted.constraint_rhs);
  const persistedBounds = record(persisted.variableBounds ?? persisted.variable_bounds);

  const variableValues: Record<string, number> = {};
  const objectiveCoefficients: Record<string, number> = {};
  const variableBounds: Record<string, { min: number; max: number }> = {};
  workspace.variables.forEach((variable) => {
    const bounds = record(persistedBounds[variable.id]);
    const min = finiteNumber(bounds.min, variable.min);
    const max = finiteNumber(bounds.max, variable.max);
    const safeMin = min < max ? min : variable.min;
    const safeMax = min < max ? max : variable.max;
    variableBounds[variable.id] = { min: safeMin, max: safeMax };
    const value = finiteNumber(persistedValues[variable.id], variable.initial);
    variableValues[variable.id] = Math.min(safeMax, Math.max(safeMin, value));
    objectiveCoefficients[variable.id] = finiteNumber(persistedObjective[variable.id], workspace.objective.coefficients[variable.id]);
  });

  const constraintCoefficients: Record<string, Record<string, number>> = {};
  const constraintRhs: Record<string, number> = {};
  workspace.constraints.forEach((constraint) => {
    const savedCoefficients = record(persistedConstraintCoefficients[constraint.id]);
    constraintCoefficients[constraint.id] = Object.fromEntries(workspace.variables.map((variable) => [
      variable.id,
      finiteNumber(savedCoefficients[variable.id], constraint.coefficients[variable.id]),
    ]));
    constraintRhs[constraint.id] = finiteNumber(persistedConstraintRhs[constraint.id], constraint.rhs);
  });

  return {
    variableValues,
    objectiveCoefficients,
    constraintCoefficients,
    constraintRhs,
    variableBounds,
    plotted: persisted.plotted === true,
  };
}

function intersection(left: ReducedBoundary, right: ReducedBoundary): LpPoint | null {
  const determinant = left.a * right.b - right.a * left.b;
  if (Math.abs(determinant) < EPSILON) return null;
  return {
    x: (left.rhs * right.b - right.rhs * left.b) / determinant,
    y: (left.a * right.rhs - right.a * left.rhs) / determinant,
  };
}

function satisfies(point: LpPoint, boundary: ReducedBoundary) {
  const value = boundary.a * point.x + boundary.b * point.y;
  return boundary.operator === "<=" ? value <= boundary.rhs + EPSILON : value >= boundary.rhs - EPSILON;
}

function uniquePoints(points: LpPoint[]) {
  return points.filter((point, index) => points.findIndex((candidate) => Math.abs(candidate.x - point.x) < 1e-5 && Math.abs(candidate.y - point.y) < 1e-5) === index);
}

function polygonArea(points: LpPoint[]) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

export function solveLinearProgramming(workspace: LinearProgrammingWorkspace, state: LinearProgrammingState): LinearProgrammingSolution {
  const [xId, yId] = workspace.axisVariables;
  const xBounds = state.variableBounds[xId];
  const yBounds = state.variableBounds[yId];
  const boundaries: ReducedBoundary[] = [
    { id: `${xId}_min`, label: `${workspace.variables.find((item) => item.id === xId)?.label} minimum`, a: 1, b: 0, rhs: xBounds.min, operator: ">=" },
    { id: `${xId}_max`, label: `${workspace.variables.find((item) => item.id === xId)?.label} maximum`, a: 1, b: 0, rhs: xBounds.max, operator: "<=" },
    { id: `${yId}_min`, label: `${workspace.variables.find((item) => item.id === yId)?.label} minimum`, a: 0, b: 1, rhs: yBounds.min, operator: ">=" },
    { id: `${yId}_max`, label: `${workspace.variables.find((item) => item.id === yId)?.label} maximum`, a: 0, b: 1, rhs: yBounds.max, operator: "<=" },
  ];

  workspace.constraints.forEach((constraint) => {
    const coefficients = state.constraintCoefficients[constraint.id];
    const fixedContribution = workspace.variables
      .filter((variable) => variable.id !== xId && variable.id !== yId)
      .reduce((sum, variable) => sum + coefficients[variable.id] * state.variableValues[variable.id], 0);
    boundaries.push({
      id: constraint.id,
      label: constraint.label,
      a: coefficients[xId],
      b: coefficients[yId],
      rhs: state.constraintRhs[constraint.id] - fixedContribution,
      operator: constraint.operator,
    });
  });

  const candidates: LpPoint[] = [];
  for (let left = 0; left < boundaries.length; left += 1) {
    for (let right = left + 1; right < boundaries.length; right += 1) {
      const point = intersection(boundaries[left], boundaries[right]);
      if (point && boundaries.every((boundary) => satisfies(point, boundary))) candidates.push(point);
    }
  }
  const points = uniquePoints(candidates);
  if (points.length < 3) {
    return {
      ok: false,
      message: "These values do not create a bounded feasible region. Adjust a limit or constraint and calculate again.",
      vertices: [], boundaries, area: 0, best: null, worst: null, allocation: {}, objectiveConstant: 0,
    };
  }

  const center = points.reduce((total, point) => ({ x: total.x + point.x / points.length, y: total.y + point.y / points.length }), { x: 0, y: 0 });
  points.sort((left, right) => Math.atan2(left.y - center.y, left.x - center.x) - Math.atan2(right.y - center.y, right.x - center.x));
  const start = points.reduce((best, point, index) => point.y < points[best].y - EPSILON || (Math.abs(point.y - points[best].y) < EPSILON && point.x < points[best].x) ? index : best, 0);
  const ordered = [...points.slice(start), ...points.slice(0, start)];

  const objectiveConstant = workspace.variables
    .filter((variable) => variable.id !== xId && variable.id !== yId)
    .reduce((sum, variable) => sum + state.objectiveCoefficients[variable.id] * state.variableValues[variable.id], 0);
  const vertices = ordered.map((point, index): LpVertex => ({
    ...point,
    label: `V${index + 1}`,
    objectiveValue: state.objectiveCoefficients[xId] * point.x + state.objectiveCoefficients[yId] * point.y + objectiveConstant,
  }));
  const sortedByObjective = [...vertices].sort((left, right) => left.objectiveValue - right.objectiveValue);
  const best = workspace.objective.sense === "maximize" ? sortedByObjective.at(-1)! : sortedByObjective[0];
  const worst = workspace.objective.sense === "maximize" ? sortedByObjective[0] : sortedByObjective.at(-1)!;
  const allocation = Object.fromEntries(workspace.variables.map((variable) => [
    variable.id,
    variable.id === xId ? best.x : variable.id === yId ? best.y : state.variableValues[variable.id],
  ]));

  return {
    ok: true,
    message: "Feasible region calculated.",
    vertices,
    boundaries,
    area: polygonArea(vertices),
    best,
    worst,
    allocation,
    objectiveConstant,
  };
}

export function formatLpNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.abs(value - Math.round(value)) < 1e-8 ? Math.round(value) : Number(value.toFixed(digits));
  return rounded.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

export function formatLpMoney(value: number, currency: string) {
  return `${currency}${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
