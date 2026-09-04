import type { GeoGebraApi } from "./geogebra";
import {
  profitAt,
  profitCoefficients,
  type MultivariableProfitWorkspace,
  type MultivariableStageKind,
  type ProfitAnalysis,
  type ProfitModel,
  type ProfitPoint,
  type ProfitView,
} from "./multivariable-profit";

export type ProfitScene = {
  workspace: MultivariableProfitWorkspace;
  model: ProfitModel;
  analysis: ProfitAnalysis;
  trail: ProfitPoint[];
  stage: MultivariableStageKind;
  view: ProfitView;
  heldProduct: 0 | 1;
};

export type ProfitPlotHandle = {
  update: (scene: ProfitScene) => void;
  destroy: () => void;
};

const MAIN_OBJECTS = {
  bands: Array.from({ length: 7 }, (_, index) => `tellaBand${index}`),
  contours: Array.from({ length: 7 }, (_, index) => `tellaContour${index}`),
  surface: "tellaSurface",
  // GeoGebra reserves lowercase coordinate labels for vectors. Keep generated
  // point labels uppercase so Vector(start, end), dragging, and 3D points all
  // receive Point objects rather than two-component vectors.
  current: "TellaCurrent",
  peak: "TellaPeak",
  surfaceCurrent: "TellaSurfaceCurrent",
  surfacePeak: "TellaSurfacePeak",
  gradient: "tellaGradient",
  gradientEnd: "TellaGradientEnd",
  heldX: "tellaHeldX",
  heldY: "tellaHeldY",
  breakEven: "tellaBreakEven",
  trail: "tellaTrail",
} as const;

const BAND_COLOURS = [
  [219, 234, 254],
  [191, 219, 254],
  [147, 197, 253],
  [96, 165, 250],
  [59, 130, 246],
  [37, 99, 235],
  [30, 64, 175],
] as const;

function commandNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toPrecision(12)).toString();
}

function commands(api: GeoGebraApi, values: string[]) {
  values.forEach((command) => api.evalCommand(command));
}

function setNumber(api: GeoGebraApi, name: string, value: number) {
  if (api.setValue) api.setValue(name, value);
  else api.evalCommand(`${name} = ${commandNumber(value)}`);
}

function setPoint(api: GeoGebraApi, name: string, point: ProfitPoint) {
  // setCoords is ignored for fixed GeoGebra points. Updates may arrive after a
  // view switch has fixed the 2D point, so release it before synchronising.
  api.setFixed?.(name, false);
  if (api.setCoords) api.setCoords(name, point.x, point.y);
  else api.evalCommand(`${name} = (${commandNumber(point.x)}, ${commandNumber(point.y)})`);
}

function setVisible(api: GeoGebraApi, names: readonly string[], visible: boolean) {
  names.forEach((name) => api.setVisible?.(name, visible));
}

function sampledProfitRange(workspace: MultivariableProfitWorkspace, model: ProfitModel) {
  const [first, second] = workspace.products;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let xIndex = 0; xIndex <= 12; xIndex += 1) {
    const x = first.min + (first.max - first.min) * xIndex / 12;
    for (let yIndex = 0; yIndex <= 12; yIndex += 1) {
      const y = second.min + (second.max - second.min) * yIndex / 12;
      const value = profitAt({ x, y }, model);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  const padding = Math.max(1, (max - min) * 0.08);
  return { min, max, paddedMin: min - padding, paddedMax: max + padding };
}

function syncNumbers(api: GeoGebraApi, scene: ProfitScene) {
  const { a, b, c, d, e, f } = profitCoefficients(scene.model);
  const [first, second] = scene.workspace.products;
  const range = sampledProfitRange(scene.workspace, scene.model);
  const plotDepth = Math.max(first.max - first.min, second.max - second.min) * 0.68;
  const profitSpan = Math.max(1, range.max - range.min);
  [
    ["tellaA", a], ["tellaB", b], ["tellaC", c], ["tellaD", d], ["tellaE", e], ["tellaF", f],
    ["tellaXMin", first.min], ["tellaXMax", first.max], ["tellaYMin", second.min], ["tellaYMax", second.max],
    ["tellaZMin", range.min], ["tellaZSpan", profitSpan], ["tellaZDepth", plotDepth],
  ].forEach(([name, value]) => setNumber(api, name as string, value as number));
  for (let index = 0; index < 7; index += 1) {
    setNumber(api, `tellaLevel${index}`, range.min + (range.max - range.min) * (index + 1) / 8);
  }
  setPoint(api, MAIN_OBJECTS.current, scene.analysis.current);
  setPoint(api, MAIN_OBJECTS.peak, scene.analysis.optimum);
  const gradient = scene.analysis.gradient;
  const length = Math.min(first.max - first.min, second.max - second.min) * 0.12;
  const end = gradient.magnitude < 0.005
    ? scene.analysis.current
    : {
        x: Math.max(first.min, Math.min(first.max, scene.analysis.current.x + gradient.x / gradient.magnitude * length)),
        y: Math.max(second.min, Math.min(second.max, scene.analysis.current.y + gradient.y / gradient.magnitude * length)),
      };
  setPoint(api, MAIN_OBJECTS.gradientEnd, end);
  api.setFixed?.(MAIN_OBJECTS.peak, true, false);
  api.setFixed?.(MAIN_OBJECTS.gradientEnd, true, false);
  setNumber(api, "tellaHeld", scene.heldProduct === 0 ? scene.analysis.current.x : scene.analysis.current.y);
  return { ...range, plotDepth };
}

function syncTrail(api: GeoGebraApi, trail: ProfitPoint[]) {
  api.deleteObject?.(MAIN_OBJECTS.trail);
  if (trail.length < 2) return;
  const points = trail.slice(-32).map((point) => `(${commandNumber(point.x)},${commandNumber(point.y)})`);
  api.evalCommand(`${MAIN_OBJECTS.trail} = Polyline(${points.join(",")})`);
  api.setColor?.(MAIN_OBJECTS.trail, 100, 116, 139);
  api.setLineThickness?.(MAIN_OBJECTS.trail, 4);
  api.setLayer?.(MAIN_OBJECTS.trail, 8);
  api.setLabelVisible?.(MAIN_OBJECTS.trail, false);
}

function initialiseMain(api: GeoGebraApi) {
  commands(api, [
    "tellaA = 1", "tellaB = 1", "tellaC = 1", "tellaD = 1", "tellaE = 0", "tellaF = 0",
    "tellaXMin = 0", "tellaXMax = 10", "tellaYMin = 0", "tellaYMax = 10", "tellaHeld = 0",
    "tellaZMin = 0", "tellaZSpan = 1", "tellaZDepth = 10",
    ...Array.from({ length: 7 }, (_, index) => `tellaLevel${index} = ${index + 1}`),
    "tellaProfit(x,y) = tellaA*x - tellaB*x^2 + tellaC*y - tellaD*y^2 - tellaE*x*y - tellaF",
    "tellaPlotProfit(x,y) = (tellaProfit(x,y) - tellaZMin) / tellaZSpan * tellaZDepth",
    "TellaCurrent = (0,0)",
    "TellaPeak = (0,0)",
    "TellaGradientEnd = (0,0)",
    "tellaGradient = Vector(TellaCurrent,TellaGradientEnd)",
    "tellaHeldX: x = tellaHeld",
    "tellaHeldY: y = tellaHeld",
    "tellaBreakEven: tellaProfit(x,y) = 0",
    ...MAIN_OBJECTS.bands.map((name, index) => `${name}: tellaProfit(x,y) >= tellaLevel${index}`),
    ...MAIN_OBJECTS.contours.map((name, index) => `${name}: tellaProfit(x,y) = tellaLevel${index}`),
    "tellaSurface = Surface(u,v,tellaPlotProfit(u,v),u,tellaXMin,tellaXMax,v,tellaYMin,tellaYMax)",
    "TellaSurfaceCurrent = (x(TellaCurrent),y(TellaCurrent),tellaPlotProfit(x(TellaCurrent),y(TellaCurrent)))",
    "TellaSurfacePeak = (x(TellaPeak),y(TellaPeak),tellaPlotProfit(x(TellaPeak),y(TellaPeak)))",
  ]);

  MAIN_OBJECTS.bands.forEach((name, index) => {
    const colour = BAND_COLOURS[index];
    api.setColor?.(name, colour[0], colour[1], colour[2]);
    api.setFilling?.(name, 0.28);
    api.setLineThickness?.(name, 1);
    api.setLayer?.(name, index);
    api.setLabelVisible?.(name, false);
  });
  MAIN_OBJECTS.contours.forEach((name, index) => {
    const colour = BAND_COLOURS[Math.min(BAND_COLOURS.length - 1, index + 1)];
    api.setColor?.(name, colour[0], colour[1], colour[2]);
    api.setLineThickness?.(name, 2);
    api.setLabelVisible?.(name, false);
  });
  api.setColor?.(MAIN_OBJECTS.surface, 96, 165, 250);
  api.setFilling?.(MAIN_OBJECTS.surface, 0.82);
  api.setColor?.(MAIN_OBJECTS.current, 31, 41, 55);
  api.setColor?.(MAIN_OBJECTS.surfaceCurrent, 31, 41, 55);
  api.setColor?.(MAIN_OBJECTS.peak, 245, 158, 11);
  api.setColor?.(MAIN_OBJECTS.surfacePeak, 245, 158, 11);
  api.setColor?.(MAIN_OBJECTS.gradient, 34, 197, 94);
  api.setColor?.(MAIN_OBJECTS.heldX, 59, 130, 246);
  api.setColor?.(MAIN_OBJECTS.heldY, 59, 130, 246);
  api.setColor?.(MAIN_OBJECTS.breakEven, 71, 85, 105);
  [MAIN_OBJECTS.current, MAIN_OBJECTS.surfaceCurrent].forEach((name) => api.setPointSize?.(name, 7));
  [MAIN_OBJECTS.peak, MAIN_OBJECTS.surfacePeak].forEach((name) => api.setPointSize?.(name, 8));
  [MAIN_OBJECTS.current, MAIN_OBJECTS.peak, MAIN_OBJECTS.gradientEnd].forEach((name) => api.setLayer?.(name, 9));
  [MAIN_OBJECTS.gradient, MAIN_OBJECTS.heldX, MAIN_OBJECTS.heldY, MAIN_OBJECTS.breakEven].forEach((name) => api.setLayer?.(name, 8));
  [MAIN_OBJECTS.gradient, MAIN_OBJECTS.heldX, MAIN_OBJECTS.heldY].forEach((name) => api.setLineThickness?.(name, 5));
  api.setLineStyle?.(MAIN_OBJECTS.heldX, 1);
  api.setLineStyle?.(MAIN_OBJECTS.heldY, 1);
  api.setLineStyle?.(MAIN_OBJECTS.breakEven, 2);
  Object.values(MAIN_OBJECTS).flat().forEach((name) => api.setLabelVisible?.(name, false));
  api.setFixed?.(MAIN_OBJECTS.peak, true, false);
  api.setFixed?.(MAIN_OBJECTS.gradientEnd, true, false);
}

export function createMainProfitPlot(api: GeoGebraApi): ProfitPlotHandle {
  initialiseMain(api);
  return {
    update(scene) {
      const range = syncNumbers(api, scene);
      syncTrail(api, scene.trail);
      const surface = scene.view === "surface";
      if (surface) {
        api.setPerspective?.("T");
        api.setAxesVisible?.(3, true, true, true);
        api.setCoordSystem?.(
          scene.workspace.products[0].min,
          scene.workspace.products[0].max,
          scene.workspace.products[1].min,
          scene.workspace.products[1].max,
          -range.plotDepth * 0.08,
          range.plotDepth * 1.08,
          false,
        );
        api.setAxisLabels?.(
          3,
          scene.workspace.products[0].label,
          scene.workspace.products[1].label,
          "relative profit",
        );
      } else {
        api.setPerspective?.("G");
        api.setAxesVisible?.(1, true, true);
        api.setGridVisible?.(1, true);
        api.setCoordSystem?.(
          scene.workspace.products[0].min,
          scene.workspace.products[0].max,
          scene.workspace.products[1].min,
          scene.workspace.products[1].max,
        );
        api.setAxisLabels?.(1, scene.workspace.products[0].label, scene.workspace.products[1].label);
      }
      setVisible(api, [MAIN_OBJECTS.surface, MAIN_OBJECTS.surfaceCurrent, MAIN_OBJECTS.surfacePeak], surface);
      setVisible(api, [...MAIN_OBJECTS.bands, ...MAIN_OBJECTS.contours, MAIN_OBJECTS.breakEven, MAIN_OBJECTS.current, MAIN_OBJECTS.peak], !surface);
      setVisible(api, [MAIN_OBJECTS.gradient, MAIN_OBJECTS.gradientEnd], !surface && scene.stage === "walk" && scene.analysis.gradient.magnitude >= 0.005);
      setVisible(api, [MAIN_OBJECTS.heldX], !surface && scene.stage === "slope" && scene.heldProduct === 0);
      setVisible(api, [MAIN_OBJECTS.heldY], !surface && scene.stage === "slope" && scene.heldProduct === 1);
      api.setVisible?.(MAIN_OBJECTS.trail, !surface && scene.stage === "walk" && scene.trail.length > 1);
      api.setFixed?.(MAIN_OBJECTS.current, surface, !surface);
      api.recalculateEnvironments?.();
    },
    destroy() {
      api.unregisterObjectUpdateListener?.(MAIN_OBJECTS.current);
    },
  };
}

function initialiseSlice(api: GeoGebraApi) {
  commands(api, [
    "tellaA = 1", "tellaB = 1", "tellaC = 1", "tellaD = 1", "tellaE = 0", "tellaF = 0",
    "tellaHeldIndex = 1", "tellaHeld = 0", "tellaFree = 0",
    "tellaProfit(x,y) = tellaA*x - tellaB*x^2 + tellaC*y - tellaD*y^2 - tellaE*x*y - tellaF",
    "tellaSlice(t) = If(tellaHeldIndex < 0.5, tellaProfit(tellaHeld,t), tellaProfit(t,tellaHeld))",
    "TellaSlicePoint = (tellaFree,tellaSlice(tellaFree))",
    "tellaSliceSlope = If(tellaHeldIndex < 0.5, tellaC - 2*tellaD*tellaFree - tellaE*tellaHeld, tellaA - 2*tellaB*tellaFree - tellaE*tellaHeld)",
    "tellaTangent(x) = tellaSlice(tellaFree) + tellaSliceSlope*(x - tellaFree)",
    "tellaFreeGuide: x = tellaFree",
  ]);
  api.setColor?.("tellaSlice", 37, 99, 235);
  api.setColor?.("TellaSlicePoint", 31, 41, 55);
  api.setColor?.("tellaTangent", 245, 158, 11);
  api.setColor?.("tellaFreeGuide", 100, 116, 139);
  api.setLineThickness?.("tellaSlice", 5);
  api.setLineThickness?.("tellaTangent", 4);
  api.setLineThickness?.("tellaFreeGuide", 2);
  api.setLineStyle?.("tellaFreeGuide", 2);
  api.setPointSize?.("TellaSlicePoint", 7);
  api.setLayer?.("TellaSlicePoint", 9);
  ["tellaSlice", "TellaSlicePoint", "tellaSliceSlope", "tellaTangent", "tellaFreeGuide"].forEach((name) => api.setLabelVisible?.(name, false));
}

export function createSliceProfitPlot(api: GeoGebraApi): ProfitPlotHandle {
  initialiseSlice(api);
  return {
    update(scene) {
      const { a, b, c, d, e, f } = profitCoefficients(scene.model);
      [["tellaA", a], ["tellaB", b], ["tellaC", c], ["tellaD", d], ["tellaE", e], ["tellaF", f]].forEach(
        ([name, value]) => setNumber(api, name as string, value as number),
      );
      const movingIndex = scene.heldProduct === 0 ? 1 : 0;
      const heldValue = scene.heldProduct === 0 ? scene.analysis.current.x : scene.analysis.current.y;
      const freeValue = movingIndex === 0 ? scene.analysis.current.x : scene.analysis.current.y;
      setNumber(api, "tellaHeldIndex", scene.heldProduct);
      setNumber(api, "tellaHeld", heldValue);
      setNumber(api, "tellaFree", freeValue);
      const moving = scene.workspace.products[movingIndex];
      let minProfit = Number.POSITIVE_INFINITY;
      let maxProfit = Number.NEGATIVE_INFINITY;
      for (let index = 0; index <= 40; index += 1) {
        const free = moving.min + (moving.max - moving.min) * index / 40;
        const point = scene.heldProduct === 0 ? { x: heldValue, y: free } : { x: free, y: heldValue };
        const value = profitAt(point, scene.model);
        minProfit = Math.min(minProfit, value);
        maxProfit = Math.max(maxProfit, value);
      }
      const padding = Math.max(1, (maxProfit - minProfit) * 0.12);
      api.setPerspective?.("G");
      api.setCoordSystem?.(moving.min, moving.max, minProfit - padding, maxProfit + padding);
      api.setAxisLabels?.(1, moving.label, `${scene.workspace.currency} profit`);
      api.setGridVisible?.(1, true);
      api.recalculateEnvironments?.();
    },
    destroy() {},
  };
}

export const GEOGEBRA_CURRENT_POINT = MAIN_OBJECTS.current;
