export const MULTIVARIABLE_STAGE_KINDS = ["hill", "slope", "walk", "result", "question"] as const;

export type MultivariableStageKind = (typeof MULTIVARIABLE_STAGE_KINDS)[number];
export type ProfitDirection = "increase" | "decrease" | "same";
export type ProfitView = "contour" | "surface";
export type ProfitPoint = { x: number; y: number };

export type ProfitProduct = {
  id: string;
  label: string;
  unit: string;
  price: number;
  priceDrop: number;
  unitCost: number;
  initial: number;
  min: number;
  max: number;
  step: number;
};

export type ProfitModel = {
  products: [
    Pick<ProfitProduct, "price" | "priceDrop" | "unitCost">,
    Pick<ProfitProduct, "price" | "priceDrop" | "unitCost">,
  ];
  crossEffect: number;
  fixedCost: number;
};

export type WorkshopStep = {
  kind: MultivariableStageKind;
  title: string;
  instruction: string;
};

export type SlopeQuestion = {
  prompt: string;
  options: Array<{ value: ProfitDirection; label: string }>;
};

export type MultivariableProfitWorkspace = {
  type: "multivariable_profit";
  version: 1;
  title: string;
  scenario: string;
  currency: string;
  products: [ProfitProduct, ProfitProduct];
  crossEffect: number;
  fixedCost: number;
  targetTolerance: number;
  steps: [WorkshopStep, WorkshopStep, WorkshopStep, WorkshopStep, WorkshopStep];
  questions: {
    slope: SlopeQuestion;
    reflection: { prompt: string; minimumCharacters: number };
  };
};

export type MultivariableWorkshopState = {
  definitionVersion: 1;
  stage: MultivariableStageKind;
  furthestStage: number;
  view: ProfitView;
  quantities: [number, number];
  heldProduct: 0 | 1;
  trail: ProfitPoint[];
  exploredHeldProducts: [boolean, boolean];
  slopeAnswer: ProfitDirection | null;
  slopePassed: boolean;
  walkComplete: boolean;
  reflection: string;
  model: ProfitModel;
};

export type ProfitAnalysis = {
  current: ProfitPoint & { profit: number };
  optimum: ProfitPoint & { profit: number };
  gradient: { x: number; y: number; magnitude: number };
  distanceToOptimum: number;
  percentOfMaximum: number;
  potentialGain: number;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(value: unknown, fallback = Number.NaN) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function nonEmpty(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseProduct(value: unknown, index: number, errors: string[]): ProfitProduct | null {
  const source = record(value);
  const prefix = `workspace.products[${index}]`;
  const id = typeof source.id === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(source.id)
    ? source.id
    : "";
  if (!id) errors.push(`${prefix}.id is invalid.`);
  const product: ProfitProduct = {
    id,
    label: nonEmpty(source.label, ""),
    unit: nonEmpty(source.unit, ""),
    price: finiteNumber(source.price),
    priceDrop: finiteNumber(source.price_drop),
    unitCost: finiteNumber(source.unit_cost),
    initial: finiteNumber(source.initial),
    min: finiteNumber(source.min),
    max: finiteNumber(source.max),
    step: finiteNumber(source.step),
  };
  if (!product.label) errors.push(`${prefix}.label is required.`);
  if (!product.unit) errors.push(`${prefix}.unit is required.`);
  if (![product.price, product.priceDrop, product.unitCost, product.initial, product.min, product.max, product.step].every(Number.isFinite)) {
    errors.push(`${prefix} must contain finite numeric business values and bounds.`);
  } else {
    if (product.price < 0 || product.unitCost < 0) errors.push(`${prefix} prices and costs must not be negative.`);
    if (product.priceDrop <= 0) errors.push(`${prefix}.price_drop must be positive.`);
    if (product.min < 0 || product.min >= product.max) errors.push(`${prefix} must have a non-negative min smaller than max.`);
    if (product.initial < product.min || product.initial > product.max) errors.push(`${prefix}.initial must be inside the product range.`);
    if (product.step <= 0) errors.push(`${prefix}.step must be positive.`);
  }
  return errors.length ? null : product;
}

export function parseMultivariableProfitWorkspace(value: unknown): {
  workspace: MultivariableProfitWorkspace | null;
  errors: string[];
} {
  const source = record(value);
  const errors: string[] = [];
  if (source.type !== "multivariable_profit") {
    return { workspace: null, errors: ["workspace.type must be multivariable_profit."] };
  }
  if (source.version !== 1) errors.push("workspace.version must be 1.");

  const rawProducts = Array.isArray(source.products) ? source.products : [];
  if (rawProducts.length !== 2) errors.push("workspace.products must contain exactly two products.");
  const first = rawProducts.length > 0 ? parseProduct(rawProducts[0], 0, errors) : null;
  const second = rawProducts.length > 1 ? parseProduct(rawProducts[1], 1, errors) : null;
  if (first && second && first.id === second.id) errors.push("workspace product IDs must be unique.");

  const crossEffect = finiteNumber(source.cross_effect);
  const fixedCost = finiteNumber(source.fixed_cost);
  const targetTolerance = finiteNumber(source.target_tolerance);
  if (!Number.isFinite(crossEffect)) errors.push("workspace.cross_effect must be finite.");
  if (!Number.isFinite(fixedCost) || fixedCost < 0) errors.push("workspace.fixed_cost must not be negative.");
  if (!Number.isFinite(targetTolerance) || targetTolerance <= 0) errors.push("workspace.target_tolerance must be positive.");
  if (first && second && Number.isFinite(crossEffect)) {
    const determinant = 4 * first.priceDrop * second.priceDrop - crossEffect * crossEffect;
    if (determinant <= 1e-12) errors.push("workspace must describe one concave profit hill.");
  }

  const rawSteps = Array.isArray(source.steps) ? source.steps : [];
  if (rawSteps.length !== MULTIVARIABLE_STAGE_KINDS.length) {
    errors.push("workspace.steps must contain all five guided stages.");
  }
  const steps = rawSteps.map((entry, index): WorkshopStep => {
    const step = record(entry);
    const kind = MULTIVARIABLE_STAGE_KINDS.includes(step.kind as MultivariableStageKind)
      ? step.kind as MultivariableStageKind
      : MULTIVARIABLE_STAGE_KINDS[index] ?? "hill";
    if (kind !== MULTIVARIABLE_STAGE_KINDS[index]) errors.push("workspace.steps must use the guided stage order.");
    const title = nonEmpty(step.title, "");
    const instruction = nonEmpty(step.instruction, "");
    if (!title || !instruction) errors.push(`workspace.steps[${index}] requires title and instruction.`);
    return { kind, title, instruction };
  });

  const questions = record(source.questions);
  const slopeSource = record(questions.slope);
  const reflectionSource = record(questions.reflection);
  const optionValues = new Set<ProfitDirection>();
  const options: SlopeQuestion["options"] = (Array.isArray(slopeSource.options) ? slopeSource.options : []).flatMap((entry): SlopeQuestion["options"] => {
    const option = record(entry);
    const direction = option.value;
    if (direction !== "increase" && direction !== "decrease" && direction !== "same") return [];
    optionValues.add(direction);
    return [{ value: direction, label: nonEmpty(option.label, direction) }];
  });
  if (options.length !== 3 || optionValues.size !== 3) errors.push("workspace.questions.slope requires the three unique directions.");
  const slopePrompt = nonEmpty(slopeSource.prompt, "");
  if (!slopePrompt) errors.push("workspace.questions.slope.prompt is required.");
  const reflectionPrompt = nonEmpty(reflectionSource.prompt, "");
  const minimumCharacters = finiteNumber(reflectionSource.minimum_characters);
  if (!reflectionPrompt) errors.push("workspace.questions.reflection.prompt is required.");
  if (!Number.isInteger(minimumCharacters) || minimumCharacters < 1 || minimumCharacters > 2000) {
    errors.push("workspace.questions.reflection.minimum_characters is invalid.");
  }

  const title = nonEmpty(source.title, "");
  const scenario = nonEmpty(source.scenario, "");
  const currency = nonEmpty(source.currency, "");
  if (!title || !scenario || !currency) errors.push("workspace title, scenario, and currency are required.");
  if (errors.length || !first || !second || steps.length !== 5) return { workspace: null, errors };

  return {
    errors: [],
    workspace: {
      type: "multivariable_profit",
      version: 1,
      title,
      scenario,
      currency,
      products: [first, second],
      crossEffect,
      fixedCost,
      targetTolerance,
      steps: steps as MultivariableProfitWorkspace["steps"],
      questions: {
        slope: { prompt: slopePrompt, options },
        reflection: { prompt: reflectionPrompt, minimumCharacters },
      },
    },
  };
}

export function modelFromWorkspace(workspace: MultivariableProfitWorkspace): ProfitModel {
  return {
    products: workspace.products.map((product) => ({
      price: product.price,
      priceDrop: product.priceDrop,
      unitCost: product.unitCost,
    })) as ProfitModel["products"],
    crossEffect: workspace.crossEffect,
    fixedCost: workspace.fixedCost,
  };
}

export function profitCoefficients(model: ProfitModel) {
  return {
    a: model.products[0].price - model.products[0].unitCost,
    b: model.products[0].priceDrop,
    c: model.products[1].price - model.products[1].unitCost,
    d: model.products[1].priceDrop,
    e: model.crossEffect,
    f: model.fixedCost,
  };
}

export function isValidProfitModel(model: ProfitModel) {
  const values = [
    model.products[0].price,
    model.products[0].priceDrop,
    model.products[0].unitCost,
    model.products[1].price,
    model.products[1].priceDrop,
    model.products[1].unitCost,
    model.crossEffect,
    model.fixedCost,
  ];
  if (!values.every(Number.isFinite)) return false;
  if (model.products.some((product) => product.price < 0 || product.unitCost < 0 || product.priceDrop <= 0)) return false;
  if (model.fixedCost < 0) return false;
  const coefficients = profitCoefficients(model);
  return 4 * coefficients.b * coefficients.d - coefficients.e * coefficients.e > 1e-12;
}

export function profitAt(point: ProfitPoint, model: ProfitModel) {
  const { a, b, c, d, e, f } = profitCoefficients(model);
  return a * point.x - b * point.x * point.x + c * point.y - d * point.y * point.y - e * point.x * point.y - f;
}

export function gradientAt(point: ProfitPoint, model: ProfitModel) {
  const { a, b, c, d, e } = profitCoefficients(model);
  const x = a - 2 * b * point.x - e * point.y;
  const y = c - 2 * d * point.y - e * point.x;
  return { x, y, magnitude: Math.hypot(x, y) };
}

function boundedPoint(workspace: MultivariableProfitWorkspace, point: ProfitPoint) {
  return {
    x: clamp(point.x, workspace.products[0].min, workspace.products[0].max),
    y: clamp(point.y, workspace.products[1].min, workspace.products[1].max),
  };
}

export function boundedOptimum(workspace: MultivariableProfitWorkspace, model: ProfitModel) {
  const { a, b, c, d, e } = profitCoefficients(model);
  const [first, second] = workspace.products;
  const determinant = 4 * b * d - e * e;
  const candidates: ProfitPoint[] = [
    { x: first.min, y: second.min },
    { x: first.min, y: second.max },
    { x: first.max, y: second.min },
    { x: first.max, y: second.max },
  ];
  if (determinant > 1e-12) {
    candidates.push(boundedPoint(workspace, {
      x: (2 * d * a - e * c) / determinant,
      y: (2 * b * c - e * a) / determinant,
    }));
  }
  [first.min, first.max].forEach((x) => candidates.push({
    x,
    y: clamp((c - e * x) / (2 * d), second.min, second.max),
  }));
  [second.min, second.max].forEach((y) => candidates.push({
    x: clamp((a - e * y) / (2 * b), first.min, first.max),
    y,
  }));
  return candidates
    .map((point) => ({ ...point, profit: profitAt(point, model) }))
    .reduce((best, candidate) => candidate.profit > best.profit ? candidate : best);
}

export function analyseProfit(
  workspace: MultivariableProfitWorkspace,
  model: ProfitModel,
  quantities: [number, number],
): ProfitAnalysis {
  const currentPoint = boundedPoint(workspace, { x: quantities[0], y: quantities[1] });
  const current = { ...currentPoint, profit: profitAt(currentPoint, model) };
  const optimum = boundedOptimum(workspace, model);
  const gradient = gradientAt(currentPoint, model);
  const ratio = optimum.profit > 0 ? current.profit / optimum.profit : 0;
  return {
    current,
    optimum,
    gradient,
    distanceToOptimum: Math.hypot(current.x - optimum.x, current.y - optimum.y),
    percentOfMaximum: clamp(ratio * 100, 0, 100),
    potentialGain: Math.max(0, optimum.profit - current.profit),
  };
}

export function expectedSlopeDirection(analysis: ProfitAnalysis, heldProduct: 0 | 1): ProfitDirection {
  const slope = heldProduct === 1 ? analysis.gradient.x : analysis.gradient.y;
  if (Math.abs(slope) < 0.005) return "same";
  return slope > 0 ? "increase" : "decrease";
}

export function initialMultivariableState(
  workspace: MultivariableProfitWorkspace,
  saved?: unknown,
): MultivariableWorkshopState {
  const source = record(saved);
  const savedModel = record(source.model);
  const savedProducts = Array.isArray(savedModel.products) ? savedModel.products.map(record) : [];
  const candidateModel: ProfitModel = {
    products: workspace.products.map((product, index) => ({
      price: finiteNumber(savedProducts[index]?.price, product.price),
      priceDrop: finiteNumber(savedProducts[index]?.priceDrop ?? savedProducts[index]?.price_drop, product.priceDrop),
      unitCost: finiteNumber(savedProducts[index]?.unitCost ?? savedProducts[index]?.unit_cost, product.unitCost),
    })) as ProfitModel["products"],
    crossEffect: finiteNumber(savedModel.crossEffect ?? savedModel.cross_effect, workspace.crossEffect),
    fixedCost: finiteNumber(savedModel.fixedCost ?? savedModel.fixed_cost, workspace.fixedCost),
  };
  const model = isValidProfitModel(candidateModel) ? candidateModel : modelFromWorkspace(workspace);
  const savedQuantities = Array.isArray(source.quantities) ? source.quantities : [];
  const quantities: [number, number] = workspace.products.map((product, index) => clamp(
    finiteNumber(savedQuantities[index], product.initial),
    product.min,
    product.max,
  )) as [number, number];
  const furthestStage = clamp(Math.floor(finiteNumber(source.furthestStage ?? source.furthest_stage, 0)), 0, 4);
  const stage = MULTIVARIABLE_STAGE_KINDS.includes(source.stage as MultivariableStageKind)
    && MULTIVARIABLE_STAGE_KINDS.indexOf(source.stage as MultivariableStageKind) <= furthestStage
    ? source.stage as MultivariableStageKind
    : MULTIVARIABLE_STAGE_KINDS[furthestStage];
  const rawTrail = Array.isArray(source.trail) ? source.trail : [];
  const trail = rawTrail.flatMap((entry): ProfitPoint[] => {
    const point = record(entry);
    const x = finiteNumber(point.x);
    const y = finiteNumber(point.y);
    return Number.isFinite(x) && Number.isFinite(y) ? [boundedPoint(workspace, { x, y })] : [];
  }).slice(-32);
  const exploredValue = source.exploredHeldProducts ?? source.explored_held_products;
  const explored = Array.isArray(exploredValue) ? exploredValue : [];
  const answer = source.slopeAnswer ?? source.slope_answer;
  return {
    definitionVersion: 1,
    stage,
    furthestStage,
    view: source.view === "surface" ? "surface" : "contour",
    quantities,
    heldProduct: source.heldProduct === 0 || source.held_product === 0 ? 0 : 1,
    trail: trail.length ? trail : [{ x: quantities[0], y: quantities[1] }],
    exploredHeldProducts: [Boolean(explored[0]), Boolean(explored[1])],
    slopeAnswer: answer === "increase" || answer === "decrease" || answer === "same" ? answer : null,
    slopePassed: source.slopePassed === true || source.slope_passed === true,
    walkComplete: source.walkComplete === true || source.walk_complete === true,
    reflection: typeof source.reflection === "string" ? source.reflection : "",
    model,
  };
}

export function serializeMultivariableState(state: MultivariableWorkshopState) {
  return {
    definition_version: state.definitionVersion,
    stage: state.stage,
    furthest_stage: state.furthestStage,
    view: state.view,
    quantities: state.quantities,
    held_product: state.heldProduct,
    trail: state.trail,
    explored_held_products: state.exploredHeldProducts,
    slope_answer: state.slopeAnswer,
    slope_passed: state.slopePassed,
    walk_complete: state.walkComplete,
    reflection: state.reflection,
    model: {
      products: state.model.products.map((product) => ({
        price: product.price,
        price_drop: product.priceDrop,
        unit_cost: product.unitCost,
      })),
      cross_effect: state.model.crossEffect,
      fixed_cost: state.model.fixedCost,
    },
  };
}

export function workshopProgress(workspace: MultivariableProfitWorkspace, state: MultivariableWorkshopState) {
  const reflectionComplete = state.reflection.trim().length >= workspace.questions.reflection.minimumCharacters;
  return {
    percentage: reflectionComplete && state.furthestStage >= 4 ? 100 : state.furthestStage * 20,
    complete: reflectionComplete && state.furthestStage >= 4,
  };
}

export function promptForSlope(workspace: MultivariableProfitWorkspace, heldProduct: 0 | 1) {
  const movingProduct = heldProduct === 1 ? workspace.products[0] : workspace.products[1];
  const fixedProduct = workspace.products[heldProduct];
  return workspace.questions.slope.prompt
    .replaceAll("{held_product}", fixedProduct.label)
    .replaceAll("{moving_product}", movingProduct.label);
}

export function formatProfitMoney(value: number, currency: string, maximumFractionDigits = 0) {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "−" : "";
  return `${sign}${currency}${Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits })}`;
}

export function formatProfitNumber(value: number, maximumFractionDigits = 1) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits });
}
