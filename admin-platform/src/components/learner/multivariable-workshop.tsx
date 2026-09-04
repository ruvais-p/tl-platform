"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Expand,
  Eye,
  EyeOff,
  Lightbulb,
  Minimize2,
  Minus,
  Mountain,
  RotateCcw,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  createMainProfitPlot,
  createSliceProfitPlot,
  GEOGEBRA_CURRENT_POINT,
  type ProfitPlotHandle,
  type ProfitScene,
} from "@/lib/experiments/geogebra-profit";
import { loadGeoGebra, type GeoGebraApi } from "@/lib/experiments/geogebra";
import {
  MULTIVARIABLE_STAGE_KINDS,
  analyseProfit,
  formatProfitMoney,
  formatProfitNumber,
  initialMultivariableState,
  isValidProfitModel,
  modelFromWorkspace,
  parseMultivariableProfitWorkspace,
  serializeMultivariableState,
  workshopProgress,
  type MultivariableProfitWorkspace,
  type MultivariableWorkshopState,
  type ProfitModel,
} from "@/lib/experiments/multivariable-profit";
import { cn } from "@/lib/utils";

type WorkshopProps = {
  workspaceDefinition: unknown;
  rendererConfig: Record<string, unknown>;
  state: Record<string, unknown>;
  onStateChange: (state: Record<string, unknown>) => void;
  onProgress: (progress: number, state: Record<string, unknown>, complete: boolean) => void;
};

type PlotProps = {
  kind: "main" | "slice";
  scene: ProfitScene;
  rendererConfig: Record<string, unknown>;
  onPointChange?: (x: number, y: number) => void;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberFromInput(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scalarSliderValue(value: number | readonly number[]) {
  return Array.isArray(value) ? value[0] : value;
}

function savedWorkshopState(state: Record<string, unknown>) {
  const tracked = object(object(object(state.experiment).state).multivariable_profit);
  if (Object.keys(tracked).length) return tracked;
  return object(state.multivariable_profit);
}

function GeoGebraProfitPlot({ kind, scene, rendererConfig, onPointChange }: PlotProps) {
  const hostId = `tella-profit-${kind}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const frameRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ProfitPlotHandle | null>(null);
  const apiRef = useRef<GeoGebraApi | null>(null);
  const sceneRef = useRef(scene);
  const pointCallbackRef = useRef(onPointChange);
  const configRef = useRef(rendererConfig);
  const [status, setStatus] = useState("Loading GeoGebra…");
  const [failed, setFailed] = useState(false);

  useEffect(() => { sceneRef.current = scene; }, [scene]);
  useEffect(() => { pointCallbackRef.current = onPointChange; }, [onPointChange]);
  useEffect(() => { configRef.current = rendererConfig; }, [rendererConfig]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let scheduleFit: (() => void) | null = null;
    let callbackName = "";
    setFailed(false);
    setStatus("Loading GeoGebra…");

    void loadGeoGebra().then((GGBApplet) => {
      if (disposed) return;
      const frame = frameRef.current;
      if (!frame) return;
      const config = configRef.current;
      const configured = object(config.parameters);
      const parameters: Record<string, unknown> = {
        ...configured,
        appName: kind === "main" ? "classic" : "graphing",
        perspective: "G",
        width: Math.max(1, Math.round(frame.clientWidth || (typeof config.width === "number" ? config.width : 960))),
        height: Math.max(1, Math.round(frame.clientHeight || (kind === "main" ? 540 : 360))),
        showToolBar: false,
        showMenuBar: false,
        showAlgebraInput: false,
        showResetIcon: false,
        enableRightClick: false,
        appletOnLoad: (api: GeoGebraApi) => {
          if (disposed) return;
          apiRef.current = api;
          const handle = kind === "main" ? createMainProfitPlot(api) : createSliceProfitPlot(api);
          handleRef.current = handle;
          handle.update(sceneRef.current);

          if (kind === "main" && api.registerObjectUpdateListener && api.getXcoord && api.getYcoord) {
            callbackName = `__tellaProfitPoint${hostId.replace(/[^a-zA-Z0-9]/g, "")}`;
            const callbackWindow = window as unknown as Record<string, unknown>;
            callbackWindow[callbackName] = () => {
              if (disposed) return;
              const x = api.getXcoord?.(GEOGEBRA_CURRENT_POINT);
              const y = api.getYcoord?.(GEOGEBRA_CURRENT_POINT);
              const current = sceneRef.current.analysis.current;
              if (
                typeof x === "number"
                && typeof y === "number"
                && Number.isFinite(x)
                && Number.isFinite(y)
                && (Math.abs(x - current.x) > 0.01 || Math.abs(y - current.y) > 0.01)
              ) {
                pointCallbackRef.current?.(x, y);
              }
            };
            api.registerObjectUpdateListener(GEOGEBRA_CURRENT_POINT, callbackName);
          }

          if (api.setSize) {
            scheduleFit = () => {
              if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
              resizeFrame = requestAnimationFrame(() => {
                resizeFrame = null;
                if (disposed) return;
                const width = Math.max(1, Math.round(frame.clientWidth));
                const height = Math.max(1, Math.round(frame.clientHeight));
                api.setSize?.(width, height);
                api.recalculateEnvironments?.();
              });
            };
            if (typeof ResizeObserver !== "undefined") {
              resizeObserver = new ResizeObserver(() => {
                scheduleFit?.();
              });
              resizeObserver.observe(frame);
            }
            window.addEventListener("resize", scheduleFit);
            window.visualViewport?.addEventListener("resize", scheduleFit);
            scheduleFit();
          }
          setStatus(kind === "main" ? "GeoGebra scene ready. Drag the dark point or use the sliders." : "Live slice and tangent ready.");
        },
      };
      new GGBApplet(parameters, true).inject(hostId);
    }).catch(() => {
      if (!disposed) {
        setFailed(true);
        setStatus("GeoGebra could not be loaded. Check the connection and reload this activity.");
      }
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (scheduleFit) {
        window.removeEventListener("resize", scheduleFit);
        window.visualViewport?.removeEventListener("resize", scheduleFit);
      }
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      handleRef.current?.destroy();
      if (callbackName) Reflect.deleteProperty(window, callbackName);
      handleRef.current = null;
      apiRef.current = null;
    };
  }, [hostId, kind]);

  useEffect(() => {
    handleRef.current?.update(scene);
  }, [scene]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={frameRef}
        className={cn(
          "tella-geogebra-frame tella-geogebra-frame-api-sized w-full overflow-hidden rounded-lg bg-card",
          kind === "main" ? "h-[430px] sm:h-[520px] xl:h-[580px]" : "h-[320px] sm:h-[360px]",
        )}
      >
        <div id={hostId} className="size-full" aria-label={kind === "main" ? "Interactive profit landscape" : "Profit slice and tangent"} />
      </div>
      <p className={cn("flex items-center gap-2 text-xs", failed ? "text-destructive" : "text-muted-foreground")} role={failed ? "alert" : "status"}>
        {failed ? <CircleAlert /> : status.startsWith("Loading") ? <Spinner /> : <CheckCircle2 />}
        {status}
      </p>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums" aria-live="polite">{value}</CardTitle>
      </CardHeader>
      <CardFooter className="text-xs text-muted-foreground">{detail}</CardFooter>
    </Card>
  );
}

function QuantityControls({
  workspace,
  workshopState,
  visibleProducts = [0, 1],
  onChange,
}: {
  workspace: MultivariableProfitWorkspace;
  workshopState: MultivariableWorkshopState;
  visibleProducts?: Array<0 | 1>;
  onChange: (index: 0 | 1, value: number) => void;
}) {
  return (
    <FieldSet>
      <FieldLegend>Production quantities</FieldLegend>
      <FieldDescription>The graph and live slopes update while you move each control.</FieldDescription>
      <FieldGroup>
        {visibleProducts.map((index) => {
          const product = workspace.products[index];
          return (
            <Field key={product.id}>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor={`profit-quantity-${product.id}`}>{product.label}</FieldLabel>
                <span className="text-xs tabular-nums text-muted-foreground">{formatProfitNumber(workshopState.quantities[index], 0)}</span>
              </div>
              <Slider
                id={`profit-quantity-${product.id}`}
                min={product.min}
                max={product.max}
                step={product.step}
                value={[workshopState.quantities[index]]}
                onValueChange={(value) => onChange(index, scalarSliderValue(value))}
                aria-label={`${product.label} production quantity`}
              />
              <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                <span>{formatProfitNumber(product.min, 0)}</span>
                <span>{product.unit}</span>
                <span>{formatProfitNumber(product.max, 0)}</span>
              </div>
            </Field>
          );
        })}
      </FieldGroup>
    </FieldSet>
  );
}

function ModelEditor({
  workspace,
  model,
  error,
  onChange,
}: {
  workspace: MultivariableProfitWorkspace;
  model: ProfitModel;
  error: string;
  onChange: (model: ProfitModel) => void;
}) {
  function productValue(index: 0 | 1, field: "price" | "priceDrop" | "unitCost", value: string) {
    const next = structuredClone(model);
    next.products[index][field] = numberFromInput(value, model.products[index][field]);
    onChange(next);
  }

  return (
    <FieldGroup>
      {workspace.products.map((product, rawIndex) => {
        const index = rawIndex as 0 | 1;
        return (
          <FieldSet key={product.id}>
            <FieldLegend>{product.label}</FieldLegend>
            <FieldGroup className="grid sm:grid-cols-3">
              <Field>
                <FieldLabel className="sm:min-h-10 sm:items-end" htmlFor={`model-${product.id}-price`}>Starting price</FieldLabel>
                <Input id={`model-${product.id}-price`} type="number" min="0" step="any" value={model.products[index].price} onChange={(event) => productValue(index, "price", event.target.value)} />
              </Field>
              <Field>
                <FieldLabel className="sm:min-h-10 sm:items-end" htmlFor={`model-${product.id}-drop`}>Price drop per unit</FieldLabel>
                <Input id={`model-${product.id}-drop`} type="number" min="0.000001" step="any" value={model.products[index].priceDrop} onChange={(event) => productValue(index, "priceDrop", event.target.value)} />
              </Field>
              <Field>
                <FieldLabel className="sm:min-h-10 sm:items-end" htmlFor={`model-${product.id}-cost`}>Unit cost</FieldLabel>
                <Input id={`model-${product.id}-cost`} type="number" min="0" step="any" value={model.products[index].unitCost} onChange={(event) => productValue(index, "unitCost", event.target.value)} />
              </Field>
            </FieldGroup>
          </FieldSet>
        );
      })}
      <FieldGroup className="grid sm:grid-cols-2">
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="model-cross-effect">Shared factory effect</FieldLabel>
          <Input id="model-cross-effect" type="number" step="any" value={model.crossEffect} aria-invalid={Boolean(error)} onChange={(event) => onChange({ ...model, crossEffect: numberFromInput(event.target.value, model.crossEffect) })} />
          <FieldDescription>Keep this small enough for one clear hilltop.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="model-fixed-cost">Fixed cost</FieldLabel>
          <Input id="model-fixed-cost" type="number" min="0" step="any" value={model.fixedCost} onChange={(event) => onChange({ ...model, fixedCost: numberFromInput(event.target.value, model.fixedCost) })} />
        </Field>
      </FieldGroup>
      {error && <Alert variant="destructive"><CircleAlert /><AlertTitle>These values do not form one profit hill</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    </FieldGroup>
  );
}

export function MultivariableWorkshopView({
  workspaceDefinition,
  rendererConfig,
  state,
  onStateChange,
  onProgress,
}: WorkshopProps) {
  const parsed = useMemo(() => parseMultivariableProfitWorkspace(workspaceDefinition), [workspaceDefinition]);
  const workspace = parsed.workspace;
  const [workshopState, setWorkshopState] = useState<MultivariableWorkshopState | null>(() => (
    workspace ? initialMultivariableState(workspace, savedWorkshopState(state)) : null
  ));
  const [feedback, setFeedback] = useState("");
  const [modelError, setModelError] = useState("");
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const analysis = useMemo(() => (
    workspace && workshopState
      ? analyseProfit(workspace, workshopState.model, workshopState.quantities)
      : null
  ), [workspace, workshopState]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const leaveOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", leaveOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", leaveOnEscape);
    };
  }, [isFullscreen]);

  if (!workspace || !workshopState || !analysis) {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Invalid multivariable workshop definition</AlertTitle>
        <AlertDescription>{parsed.errors.join(" ")}</AlertDescription>
      </Alert>
    );
  }

  const activeWorkspace = workspace;
  const activeState = workshopState;
  const activeAnalysis = analysis;
  const activeStageIndex = MULTIVARIABLE_STAGE_KINDS.indexOf(activeState.stage);
  const stage = activeWorkspace.steps[activeStageIndex];
  const progress = workshopProgress(activeWorkspace, activeState);
  const slope = activeState.heldProduct === 1 ? activeAnalysis.gradient.x : activeAnalysis.gradient.y;
  const movingProductIndex: 0 | 1 = activeState.heldProduct === 1 ? 0 : 1;
  const movingProduct = activeWorkspace.products[movingProductIndex];
  const heldProduct = activeWorkspace.products[activeState.heldProduct];
  const startingQuantities = activeWorkspace.products.map((product) => product.initial) as [number, number];
  const startingAnalysis = analyseProfit(activeWorkspace, activeState.model, startingQuantities);
  const improvementFromStart = activeAnalysis.optimum.profit - startingAnalysis.current.profit;
  const scene: ProfitScene = {
    workspace: activeWorkspace,
    model: activeState.model,
    analysis: activeAnalysis,
    trail: activeState.trail,
    stage: activeState.stage,
    view: activeState.stage === "hill" ? activeState.view : "contour",
    heldProduct: activeState.heldProduct,
  };

  function commit(next: MultivariableWorkshopState) {
    setWorkshopState(next);
    onStateChange({ ...state, multivariable_profit: serializeMultivariableState(next) });
  }

  function report(next: MultivariableWorkshopState) {
    const saved = serializeMultivariableState(next);
    const nextProgress = workshopProgress(activeWorkspace, next);
    onProgress(nextProgress.percentage, { multivariable_profit: saved }, nextProgress.complete);
  }

  function updateQuantities(index: 0 | 1, rawValue: number) {
    const product = activeWorkspace.products[index];
    const value = Math.max(product.min, Math.min(product.max, rawValue));
    const quantities = [...activeState.quantities] as [number, number];
    quantities[index] = value;
    const point = { x: quantities[0], y: quantities[1] };
    let trail = activeState.trail;
    if (activeState.stage === "walk") {
      const previous = trail.at(-1);
      const threshold = Math.max(activeWorkspace.products[0].step, activeWorkspace.products[1].step);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= threshold) {
        trail = [...trail, point].slice(-32);
      }
    }
    const nextAnalysis = analyseProfit(activeWorkspace, activeState.model, quantities);
    const newlyComplete = nextAnalysis.distanceToOptimum <= activeWorkspace.targetTolerance;
    const next = { ...activeState, quantities, trail, walkComplete: activeState.walkComplete || newlyComplete };
    commit(next);
    if (newlyComplete && !activeState.walkComplete) report(next);
  }

  function updatePoint(x: number, y: number) {
    const first = activeWorkspace.products[0];
    const second = activeWorkspace.products[1];
    const latest = { ...activeState, quantities: [Math.max(first.min, Math.min(first.max, x)), Math.max(second.min, Math.min(second.max, y))] as [number, number] };
    const point = { x: latest.quantities[0], y: latest.quantities[1] };
    const previous = activeState.trail.at(-1);
    latest.trail = activeState.stage === "walk" && (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= Math.max(first.step, second.step))
      ? [...activeState.trail, point].slice(-32)
      : activeState.trail;
    latest.walkComplete = activeState.walkComplete || analyseProfit(activeWorkspace, activeState.model, latest.quantities).distanceToOptimum <= activeWorkspace.targetTolerance;
    commit(latest);
  }

  function visitStage(index: number) {
    if (index > activeState.furthestStage) return;
    const kind = MULTIVARIABLE_STAGE_KINDS[index];
    commit({ ...activeState, stage: kind, view: kind === "hill" ? activeState.view : "contour" });
    setFeedback("");
  }

  function advance() {
    if (activeState.stage === "slope" && !activeState.exploredHeldProducts.every(Boolean)) {
      setFeedback("Swap the held product once before continuing so you can inspect both partial slopes.");
      return;
    }
    if (activeState.stage === "walk" && !activeState.walkComplete) {
      setFeedback("Move close to the gold peak, or use Show optimum, before continuing.");
      return;
    }
    const nextIndex = Math.min(4, activeStageIndex + 1);
    const next: MultivariableWorkshopState = {
      ...activeState,
      stage: MULTIVARIABLE_STAGE_KINDS[nextIndex],
      furthestStage: Math.max(activeState.furthestStage, nextIndex),
      view: "contour",
      exploredHeldProducts: activeState.stage === "hill"
        ? activeState.exploredHeldProducts.map((value, index) => index === activeState.heldProduct ? true : value) as [boolean, boolean]
        : activeState.exploredHeldProducts,
    };
    commit(next);
    report(next);
    setFeedback("");
  }

  function previousStage() {
    visitStage(Math.max(0, activeStageIndex - 1));
  }

  function swapHeldProduct() {
    const nextHeld: 0 | 1 = activeState.heldProduct === 0 ? 1 : 0;
    const explored = [...activeState.exploredHeldProducts] as [boolean, boolean];
    explored[activeState.heldProduct] = true;
    explored[nextHeld] = true;
    commit({ ...activeState, heldProduct: nextHeld, exploredHeldProducts: explored, slopeAnswer: null });
    setFeedback("");
  }

  function jumpToOptimum() {
    const quantities: [number, number] = [activeAnalysis.optimum.x, activeAnalysis.optimum.y];
    const next = {
      ...activeState,
      quantities,
      trail: [...activeState.trail, { x: quantities[0], y: quantities[1] }].slice(-32),
      walkComplete: true,
    };
    commit(next);
    report(next);
    setFeedback("You reached the peak. Notice that both live slopes are now approximately zero.");
  }

  function resetPosition() {
    const quantities: [number, number] = activeWorkspace.products.map((product) => product.initial) as [number, number];
    commit({ ...activeState, quantities, trail: [{ x: quantities[0], y: quantities[1] }], walkComplete: false });
    setFeedback("");
  }

  function updateModel(candidate: ProfitModel) {
    if (!isValidProfitModel(candidate)) {
      setModelError("Price drops must stay positive and the shared effect must satisfy 4 × drop₁ × drop₂ − effect² > 0.");
      return;
    }
    setModelError("");
    commit({ ...activeState, model: candidate, walkComplete: false, slopePassed: false });
  }

  function restoreAuthoredScenario() {
    const model = modelFromWorkspace(activeWorkspace);
    const quantities: [number, number] = activeWorkspace.products.map((product) => product.initial) as [number, number];
    commit({
      ...initialMultivariableState(activeWorkspace),
      model,
      quantities,
      trail: [{ x: quantities[0], y: quantities[1] }],
      stage: "question",
      furthestStage: 4,
      reflection: activeState.reflection,
    });
    setModelError("");
  }

  function playOwnScenario() {
    const quantities: [number, number] = activeWorkspace.products.map((product) => product.initial) as [number, number];
    const next = {
      ...activeState,
      stage: "hill" as const,
      quantities,
      trail: [{ x: quantities[0], y: quantities[1] }],
      view: "contour" as const,
      slopePassed: false,
      walkComplete: false,
    };
    commit(next);
    setFeedback("Your numbers now drive the same generated GeoGebra workshop.");
  }

  function completeWorkshop() {
    const next = { ...activeState, furthestStage: 4 };
    commit(next);
    report(next);
    setFeedback("Workshop completed. Your explanation and experiment state were saved.");
  }

  const slopeIcon = slope > 0.005 ? ArrowUpRight : slope < -0.005 ? ArrowDownRight : Minus;
  const SlopeIcon = slopeIcon;

  return (
    <div
      ref={workspaceRef}
      data-workspace="multivariable-profit"
      className={cn(
        "flex flex-col gap-5 rounded-xl bg-background p-1 sm:p-3",
        isFullscreen && "fixed inset-0 z-[100] h-dvh overflow-y-auto rounded-none bg-background p-4 sm:p-5",
      )}
    >
      <header className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-4",
        isFullscreen && "sticky top-0 z-20 shadow-sm",
      )}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Generated GeoGebra</span>
              <span>Admin-authored lesson</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">{activeWorkspace.title}</h2>
            <p className="max-w-4xl text-sm leading-6 text-muted-foreground">{activeWorkspace.scenario}</p>
          </div>
          <Button variant="outline" onClick={() => setIsFullscreen((current) => !current)} aria-pressed={isFullscreen}>
            {isFullscreen ? <Minimize2 data-icon="inline-start" /> : <Expand data-icon="inline-start" />}
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </Button>
        </div>
        <Progress value={progress.percentage}>
          <ProgressLabel>Guided workshop progress</ProgressLabel>
          <ProgressValue />
        </Progress>
      </header>

      <nav aria-label="Workshop stages">
        <ol className="grid gap-2 sm:grid-cols-5">
          {activeWorkspace.steps.map((item, index) => {
            const active = index === activeStageIndex;
            const unlocked = index <= activeState.furthestStage;
            return (
              <li key={item.kind}>
                <Button
                  className="w-full justify-start"
                  variant={active ? "default" : index < activeState.furthestStage ? "secondary" : "outline"}
                  disabled={!unlocked}
                  aria-current={active ? "step" : undefined}
                  onClick={() => visitStage(index)}
                >
                  <span className="tabular-nums">{index + 1}.</span> {item.title}
                </Button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>{stage.title}</CardTitle>
          <CardDescription className="max-w-4xl leading-6">{stage.instruction}</CardDescription>
          <CardAction><span className="text-xs tabular-nums text-muted-foreground">Step {activeStageIndex + 1} of 5</span></CardAction>
        </CardHeader>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(560px,1.25fr)_minmax(340px,0.75fr)]">
        <Card className="min-w-0 xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle>{activeState.view === "surface" && activeState.stage === "hill" ? "3D profit surface" : "Profit contour map"}</CardTitle>
            <CardDescription>
              Dark point: current mix · Gold point: best mix
              {activeState.stage === "walk" ? " · Green arrow: fastest local increase" : ""}
            </CardDescription>
            {activeState.stage === "hill" && (
              <CardAction>
                <Button variant="outline" size="sm" onClick={() => commit({ ...activeState, view: activeState.view === "surface" ? "contour" : "surface" })}>
                  {activeState.view === "surface" ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
                  {activeState.view === "surface" ? "Show contour" : "Show 3D hill"}
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <GeoGebraProfitPlot kind="main" scene={scene} rendererConfig={rendererConfig} onPointChange={updatePoint} />
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">The construction is generated from the published model; no lesson-specific GeoGebra material is loaded.</CardFooter>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <MetricCard label="Current profit" value={formatProfitMoney(activeAnalysis.current.profit, activeWorkspace.currency)} detail="At the dark point" />
            <MetricCard label="Percent of maximum" value={`${formatProfitNumber(activeAnalysis.percentOfMaximum, 1)}%`} detail="Compared with the best point" />
            <MetricCard label={`One more ${activeWorkspace.products[0].label}`} value={formatProfitMoney(activeAnalysis.gradient.x, activeWorkspace.currency, 2)} detail="Partial slope with product 2 fixed" />
            <MetricCard label={`One more ${activeWorkspace.products[1].label}`} value={formatProfitMoney(activeAnalysis.gradient.y, activeWorkspace.currency, 2)} detail="Partial slope with product 1 fixed" />
          </div>

          {activeState.stage === "hill" && (
            <Card>
              <CardHeader><CardTitle>Explore the landscape</CardTitle><CardDescription>Move today’s mix and watch the profit and slopes change immediately.</CardDescription></CardHeader>
              <CardContent><QuantityControls workspace={activeWorkspace} workshopState={activeState} onChange={updateQuantities} /></CardContent>
            </Card>
          )}

          {activeState.stage === "slope" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Hold one input still</CardTitle>
                  <CardDescription>{heldProduct.label} stays fixed at {formatProfitNumber(activeState.quantities[activeState.heldProduct], 0)}. Move {movingProduct.label}.</CardDescription>
                  <CardAction><Button variant="outline" size="sm" onClick={swapHeldProduct}><Shuffle data-icon="inline-start" />Swap product</Button></CardAction>
                </CardHeader>
                <CardContent><QuantityControls workspace={activeWorkspace} workshopState={activeState} visibleProducts={[movingProductIndex]} onChange={updateQuantities} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Live slice and tangent</CardTitle><CardDescription>The tangent direction matches the partial slope at the dark point.</CardDescription></CardHeader>
                <CardContent><GeoGebraProfitPlot kind="slice" scene={scene} rendererConfig={rendererConfig} /></CardContent>
              </Card>
              <Alert>
                <SlopeIcon />
                <AlertTitle>{formatProfitMoney(slope, activeWorkspace.currency, 2)} per additional unit</AlertTitle>
                <AlertDescription>
                  {slope > 0.005
                    ? `One more ${movingProduct.label} increases profit at this point.`
                    : slope < -0.005
                      ? `One more ${movingProduct.label} decreases profit at this point.`
                      : `One more ${movingProduct.label} makes almost no change at this point.`}
                </AlertDescription>
              </Alert>
            </>
          )}

          {activeState.stage === "walk" && (
            <Card>
              <CardHeader><CardTitle>Walk uphill</CardTitle><CardDescription>Follow the green arrow. It becomes shorter as both partial slopes approach zero.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-5">
                <QuantityControls workspace={activeWorkspace} workshopState={activeState} onChange={updateQuantities} />
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={jumpToOptimum}><Sparkles data-icon="inline-start" />Show optimum</Button>
                  <Button variant="outline" onClick={resetPosition}><RotateCcw data-icon="inline-start" />Back to today</Button>
                </div>
                <p className="text-xs text-muted-foreground">Distance to peak: {formatProfitNumber(activeAnalysis.distanceToOptimum, 0)} quantity units · target: {formatProfitNumber(activeWorkspace.targetTolerance, 0)}</p>
              </CardContent>
            </Card>
          )}

          {activeState.stage === "result" && (
            <Card>
              <CardHeader><CardTitle>Management recommendation</CardTitle><CardDescription>The peak is where neither product has a profitable first-order move left.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Alert><Lightbulb /><AlertTitle>Move toward {formatProfitNumber(activeAnalysis.optimum.x, 0)} and {formatProfitNumber(activeAnalysis.optimum.y, 0)} units</AlertTitle><AlertDescription>Compared with the starting mix, that recommendation improves modelled profit by approximately {formatProfitMoney(improvementFromStart, activeWorkspace.currency)} for the same operating period.</AlertDescription></Alert>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Starting mix</dt><dd className="mt-1 font-medium">{formatProfitNumber(startingAnalysis.current.x, 0)} · {formatProfitNumber(startingAnalysis.current.y, 0)}</dd></div>
                  <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Recommended mix</dt><dd className="mt-1 font-medium">{formatProfitNumber(activeAnalysis.optimum.x, 0)} · {formatProfitNumber(activeAnalysis.optimum.y, 0)}</dd></div>
                  <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Starting profit</dt><dd className="mt-1 font-medium">{formatProfitMoney(startingAnalysis.current.profit, activeWorkspace.currency)}</dd></div>
                  <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Best profit</dt><dd className="mt-1 font-medium">{formatProfitMoney(activeAnalysis.optimum.profit, activeWorkspace.currency)}</dd></div>
                </dl>
              </CardContent>
            </Card>
          )}

          {activeState.stage === "question" && (
            <>
              <Card>
                <CardHeader><CardTitle>Explain your decision</CardTitle><CardDescription>{activeWorkspace.questions.reflection.prompt}</CardDescription></CardHeader>
                <CardContent>
                  <Field data-invalid={activeState.reflection.length > 0 && activeState.reflection.trim().length < activeWorkspace.questions.reflection.minimumCharacters}>
                    <FieldLabel htmlFor="profit-reflection">Your recommendation</FieldLabel>
                    <Textarea
                      id="profit-reflection"
                      rows={5}
                      value={activeState.reflection}
                      aria-invalid={activeState.reflection.length > 0 && activeState.reflection.trim().length < activeWorkspace.questions.reflection.minimumCharacters}
                      onChange={(event) => commit({ ...activeState, reflection: event.target.value })}
                      placeholder="Use the current profit, partial slopes, and best mix as evidence."
                    />
                    <FieldDescription>{activeState.reflection.trim().length}/{activeWorkspace.questions.reflection.minimumCharacters} minimum characters</FieldDescription>
                  </Field>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Build another question</CardTitle><CardDescription>Change the scenario values. The same runtime will generate a new surface, contours, slopes, tangent, optimum, and questions.</CardDescription></CardHeader>
                <CardContent><ModelEditor workspace={activeWorkspace} model={activeState.model} error={modelError} onChange={updateModel} /></CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Button onClick={playOwnScenario} disabled={Boolean(modelError)}><Mountain data-icon="inline-start" />Play this question</Button>
                  <Button variant="outline" onClick={restoreAuthoredScenario}><RotateCcw data-icon="inline-start" />Restore authored values</Button>
                </CardFooter>
              </Card>
            </>
          )}
        </div>
      </div>

      {feedback && (
        <Alert variant={feedback.startsWith("Correct") || feedback.startsWith("You reached") || feedback.startsWith("Workshop completed") ? "default" : undefined}>
          {feedback.startsWith("Correct") || feedback.startsWith("You reached") || feedback.startsWith("Workshop completed") ? <CheckCircle2 /> : <CircleAlert />}
          <AlertTitle>{feedback.startsWith("Correct") || feedback.startsWith("You reached") || feedback.startsWith("Workshop completed") ? "Ready" : "Keep exploring"}</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

      <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={previousStage} disabled={activeStageIndex === 0}><ArrowLeft data-icon="inline-start" />Previous</Button>
        {activeState.stage === "question" ? (
          <Button onClick={completeWorkshop} disabled={activeState.reflection.trim().length < activeWorkspace.questions.reflection.minimumCharacters}>
            <CheckCircle2 data-icon="inline-start" />Complete workshop
          </Button>
        ) : (
          <Button onClick={advance}>Continue<ArrowRight data-icon="inline-end" /></Button>
        )}
      </footer>
    </div>
  );
}
