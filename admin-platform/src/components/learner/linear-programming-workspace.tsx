"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Calculator, CheckCircle2, CircleAlert, Expand, Minimize2, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadGeoGebra, type GeoGebraApi } from "@/lib/experiments/geogebra";
import { cn } from "@/lib/utils";
import {
  formatLpMoney,
  formatLpNumber,
  initialLinearProgrammingState,
  parseLinearProgrammingWorkspace,
  solveLinearProgramming,
  type LinearProgrammingSolution,
  type LinearProgrammingState,
  type LinearProgrammingWorkspace,
} from "@/lib/experiments/linear-programming";

type WorkspaceProps = {
  workspaceDefinition: unknown;
  rendererConfig: Record<string, unknown>;
  state: Record<string, unknown>;
  onStateChange: (state: Record<string, unknown>) => void;
  onProgress: (progress: number, state: Record<string, unknown>, complete: boolean) => void;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function number(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function signedTerm(coefficient: number, symbol: string, first: boolean) {
  const sign = coefficient < 0 ? "−" : first ? "" : "+ ";
  const magnitude = Math.abs(coefficient);
  return `${sign}${formatLpNumber(magnitude)}${symbol}`;
}

function expression(coefficients: Record<string, number>, workspace: LinearProgrammingWorkspace) {
  const terms = workspace.variables
    .filter((variable) => coefficients[variable.id] !== 0)
    .map((variable, index) => signedTerm(coefficients[variable.id], variable.symbol, index === 0));
  return terms.length ? terms.join(" ") : "0";
}

function modelState(model: LinearProgrammingState) {
  return {
    variable_values: model.variableValues,
    objective_coefficients: model.objectiveCoefficients,
    constraint_coefficients: model.constraintCoefficients,
    constraint_rhs: model.constraintRhs,
    variable_bounds: model.variableBounds,
    plotted: model.plotted,
  };
}

function commandNumber(value: number) {
  return Number(value.toPrecision(12)).toString();
}

function drawConstruction(api: GeoGebraApi, workspace: LinearProgrammingWorkspace, model: LinearProgrammingState, solution: LinearProgrammingSolution) {
  api.reset();
  api.setPerspective?.("G");
  const [xId, yId] = workspace.axisVariables;
  const xVariable = workspace.variables.find((variable) => variable.id === xId)!;
  const yVariable = workspace.variables.find((variable) => variable.id === yId)!;
  const xBounds = model.variableBounds[xId];
  const yBounds = model.variableBounds[yId];
  const xPadding = Math.max(1, (xBounds.max - xBounds.min) * 0.12);
  const yPadding = Math.max(1, (yBounds.max - yBounds.min) * 0.12);
  api.setCoordSystem?.(Math.min(0, xBounds.min - xPadding), xBounds.max + xPadding, Math.min(0, yBounds.min - yPadding), yBounds.max + yPadding);
  api.setAxesVisible?.(1, true, true, false);
  api.setAxisLabels?.(1, xVariable.symbol, yVariable.symbol, "");
  api.setGridVisible?.(1, true);

  if (!solution.ok) return;
  const feasibleRegion = solution.boundaries.map((boundary) => (
    `(${commandNumber(boundary.a)}*x+${commandNumber(boundary.b)}*y${boundary.operator}${commandNumber(boundary.rhs)})`
  )).join("&&");
  api.evalCommand(`TellaRegion=${feasibleRegion}`);
  api.setColor?.("TellaRegion", 82, 196, 104);
  api.setFilling?.("TellaRegion", 0.38);
  api.setLineThickness?.("TellaRegion", 4);
  api.setLabelVisible?.("TellaRegion", false);

  solution.boundaries.forEach((boundary, index) => {
    if (Math.abs(boundary.a) < 1e-10 && Math.abs(boundary.b) < 1e-10) return;
    const name = `TellaBoundary${index + 1}`;
    api.evalCommand(`${name}:${commandNumber(boundary.a)}*x+${commandNumber(boundary.b)}*y=${commandNumber(boundary.rhs)}`);
    api.setColor?.(name, index < 4 ? 108 : 205, index < 4 ? 116 : 74, index < 4 ? 130 : 96);
    api.setLineThickness?.(name, index < 4 ? 2 : 4);
    api.setCaption?.(name, boundary.label);
    api.setLabelStyle?.(name, 3);
    api.setLabelVisible?.(name, index >= 4);
  });

  solution.vertices.forEach((vertex, index) => {
    const name = `TellaVertex${index + 1}`;
    api.evalCommand(`${name}=(${commandNumber(vertex.x)},${commandNumber(vertex.y)})`);
    api.setColor?.(name, 35, 76, 190);
    api.setPointSize?.(name, 5);
    api.setCaption?.(name, vertex.label);
    api.setLabelStyle?.(name, 3);
    api.setLabelVisible?.(name, true);
  });

  if (solution.best) {
    const xCoefficient = model.objectiveCoefficients[xId];
    const yCoefficient = model.objectiveCoefficients[yId];
    const level = solution.best.objectiveValue - solution.objectiveConstant;
    if (Math.abs(xCoefficient) > 1e-10 || Math.abs(yCoefficient) > 1e-10) {
      api.evalCommand(`TellaObjective:${commandNumber(xCoefficient)}*x+${commandNumber(yCoefficient)}*y=${commandNumber(level)}`);
      api.setColor?.("TellaObjective", 21, 128, 90);
      api.setLineThickness?.("TellaObjective", 5);
      api.setCaption?.("TellaObjective", `${workspace.objective.label} = ${formatLpMoney(solution.best.objectiveValue, workspace.objective.currency)}`);
      api.setLabelStyle?.("TellaObjective", 3);
      api.setLabelVisible?.("TellaObjective", true);
    }
  }
}

function GeoGebraPlot({ workspace, model, solution, rendererConfig }: { workspace: LinearProgrammingWorkspace; model: LinearProgrammingState; solution: LinearProgrammingSolution; rendererConfig: Record<string, unknown> }) {
  const hostId = `tella-lpp-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const frameRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GeoGebraApi | null>(null);
  const [status, setStatus] = useState("Loading GeoGebra workspace…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    setFailed(false);
    void loadGeoGebra().then((GGBApplet) => {
      if (disposed) return;
      const frame = frameRef.current;
      const configuredWidth = typeof rendererConfig.width === "number" ? rendererConfig.width : 900;
      const configuredHeight = typeof rendererConfig.height === "number" ? rendererConfig.height : 620;
      const initialWidth = Math.max(1, Math.round(frame?.clientWidth || configuredWidth));
      const initialHeight = Math.max(1, Math.round(frame?.clientHeight || configuredHeight));
      const parameters: Record<string, unknown> = {
        ...object(rendererConfig.parameters),
        appName: typeof rendererConfig.app_name === "string" ? rendererConfig.app_name : "graphing",
        width: initialWidth,
        height: initialHeight,
        showToolBar: false,
        showMenuBar: false,
        showAlgebraInput: false,
        perspective: "G",
        enableRightClick: false,
        enableShiftDragZoom: true,
        showResetIcon: false,
        appletOnLoad: (api: GeoGebraApi) => {
          if (disposed) return;
          apiRef.current = api;
          drawConstruction(api, workspace, model, solution);
          if (frame && typeof ResizeObserver !== "undefined" && api.setSize) {
            let fittedWidth = initialWidth;
            let fittedHeight = initialHeight;
            resizeObserver = new ResizeObserver(() => {
              if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
              resizeFrame = requestAnimationFrame(() => {
                resizeFrame = null;
                if (disposed) return;
                const width = Math.max(1, Math.round(frame.clientWidth));
                const height = Math.max(1, Math.round(frame.clientHeight));
                if (width === fittedWidth && height === fittedHeight) return;
                fittedWidth = width;
                fittedHeight = height;
                api.setSize?.(width, height);
                api.recalculateEnvironments?.();
              });
            });
            resizeObserver.observe(frame);
          }
          setStatus("GeoGebra graph ready. Change any value to redraw it.");
        },
      };
      delete parameters.scaleContainerClass;
      delete parameters.autoHeight;
      new GGBApplet(parameters, true).inject(hostId);
    }).catch(() => {
      if (!disposed) {
        setFailed(true);
        setStatus("GeoGebra could not be loaded. Check your connection and try again.");
      }
    });
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      apiRef.current = null;
    };
    // The applet is mounted once; a separate effect redraws the construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId]);

  useEffect(() => {
    if (apiRef.current) drawConstruction(apiRef.current, workspace, model, solution);
  }, [model, solution, workspace]);

  return (
    <div className="flex flex-col gap-3">
      <div ref={frameRef} className="tella-geogebra-frame tella-geogebra-frame-api-sized h-[430px] w-full overflow-hidden rounded-lg bg-card sm:h-[500px] 2xl:h-[560px]">
        <div id={hostId} className="size-full" />
      </div>
      <p className={failed ? "flex items-center gap-2 text-xs text-destructive" : "flex items-center gap-2 text-xs text-muted-foreground"} role={failed ? "alert" : "status"}>
        {failed ? <CircleAlert className="size-3.5" /> : status.startsWith("Loading") ? <Spinner /> : <CheckCircle2 className="size-3.5 text-success" />}
        {status}
      </p>
    </div>
  );
}

function NumericField({ id, label, value, step = "any", onChange }: { id: string; label: string; value: number; step?: string | number; onChange: (value: number) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(number(event.target.value, value))} />
    </Field>
  );
}

function ProblemModel({ workspace, model }: { workspace: LinearProgrammingWorkspace; model: LinearProgrammingState }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{workspace.title}</CardTitle>
        <CardDescription className="whitespace-pre-wrap leading-6">{workspace.problemStatement}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 rounded-lg bg-muted/60 py-4 font-mono text-xs leading-6">
        <p><span className="font-semibold">{workspace.objective.sense === "maximize" ? "Maximize" : "Minimize"}</span> Z = {expression(model.objectiveCoefficients, workspace)}</p>
        {workspace.constraints.map((constraint) => (
          <p key={constraint.id}>{expression(model.constraintCoefficients[constraint.id], workspace)} {constraint.operator === "<=" ? "≤" : "≥"} {formatLpNumber(model.constraintRhs[constraint.id])} <span className="font-sans text-muted-foreground">({constraint.label})</span></p>
        ))}
        <p>{workspace.variables.map((variable) => `${formatLpNumber(model.variableBounds[variable.id].min)} ≤ ${variable.symbol} ≤ ${formatLpNumber(model.variableBounds[variable.id].max)}`).join(", ")}</p>
      </CardContent>
    </Card>
  );
}

function Controls({ workspace, model, change }: { workspace: LinearProgrammingWorkspace; model: LinearProgrammingState; change: (updater: (current: LinearProgrammingState) => LinearProgrammingState) => void }) {
  const [xId, yId] = workspace.axisVariables;
  const parameterVariables = workspace.variables.filter((variable) => variable.id !== xId && variable.id !== yId);
  return (
    <div className="flex flex-col gap-5">
      {parameterVariables.length > 0 && (
        <FieldSet>
          <FieldLegend>Fixed product parameters</FieldLegend>
          <FieldDescription>Move a slider to inspect a two-dimensional slice of the full model.</FieldDescription>
          <FieldGroup>
            {parameterVariables.map((variable) => {
              const bounds = model.variableBounds[variable.id];
              const value = model.variableValues[variable.id];
              return (
                <Field key={variable.id}>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel htmlFor={`parameter-${variable.id}`}>{variable.label} ({variable.symbol})</FieldLabel>
                    <span className="text-xs tabular-nums text-muted-foreground">{formatLpNumber(value)} {variable.unit}</span>
                  </div>
                  <Slider
                    id={`parameter-${variable.id}`}
                    min={bounds.min}
                    max={bounds.max}
                    step={variable.step}
                    value={[value]}
                    onValueChange={(values) => change((current) => ({ ...current, variableValues: { ...current.variableValues, [variable.id]: Array.isArray(values) ? values[0] : value } }))}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{formatLpNumber(bounds.min)}</span><span>{formatLpNumber(bounds.max)}</span></div>
                </Field>
              );
            })}
          </FieldGroup>
        </FieldSet>
      )}

      <Separator />
      <FieldSet>
        <FieldLegend>Objective function</FieldLegend>
        <FieldDescription>Change the contribution of each product to {workspace.objective.label.toLowerCase()}.</FieldDescription>
        <FieldGroup className="grid sm:grid-cols-3">
          {workspace.variables.map((variable) => (
            <NumericField
              key={variable.id}
              id={`objective-${variable.id}`}
              label={`${variable.symbol} (${variable.label})`}
              value={model.objectiveCoefficients[variable.id]}
              onChange={(value) => change((current) => ({ ...current, objectiveCoefficients: { ...current.objectiveCoefficients, [variable.id]: value } }))}
            />
          ))}
        </FieldGroup>
      </FieldSet>

      <Separator />
      <FieldSet>
        <FieldLegend>Resource constraints</FieldLegend>
        <FieldDescription>Coefficients describe resource use per unit; total is the available amount.</FieldDescription>
        <FieldGroup>
          {workspace.constraints.map((constraint) => (
            <Card key={constraint.id} size="sm">
              <CardHeader><CardTitle>{constraint.label}</CardTitle><CardAction><span className="text-xs text-muted-foreground">{constraint.operator === "<=" ? "At most" : "At least"}</span></CardAction></CardHeader>
              <CardContent>
                <FieldGroup className="grid sm:grid-cols-4">
                  {workspace.variables.map((variable) => (
                    <NumericField
                      key={variable.id}
                      id={`constraint-${constraint.id}-${variable.id}`}
                      label={variable.symbol}
                      value={model.constraintCoefficients[constraint.id][variable.id]}
                      onChange={(value) => change((current) => ({ ...current, constraintCoefficients: { ...current.constraintCoefficients, [constraint.id]: { ...current.constraintCoefficients[constraint.id], [variable.id]: value } } }))}
                    />
                  ))}
                  <NumericField
                    id={`constraint-${constraint.id}-rhs`}
                    label="Total"
                    value={model.constraintRhs[constraint.id]}
                    onChange={(value) => change((current) => ({ ...current, constraintRhs: { ...current.constraintRhs, [constraint.id]: value } }))}
                  />
                </FieldGroup>
              </CardContent>
            </Card>
          ))}
        </FieldGroup>
      </FieldSet>

      <Separator />
      <FieldSet>
        <FieldLegend>Product bounds</FieldLegend>
        <FieldDescription>Set the minimum commitment and maximum capacity for each product.</FieldDescription>
        <FieldGroup>
          {workspace.variables.map((variable) => (
            <div key={variable.id} className="grid gap-3 sm:grid-cols-[1fr_130px_130px] sm:items-end">
              <div><p className="text-sm font-medium">{variable.label}</p><p className="text-xs text-muted-foreground">{variable.symbol} · {variable.unit}</p></div>
              <NumericField id={`bound-${variable.id}-min`} label="Minimum" value={model.variableBounds[variable.id].min} onChange={(value) => change((current) => {
                const min = Math.min(value, current.variableBounds[variable.id].max - variable.step);
                return {
                  ...current,
                  variableBounds: { ...current.variableBounds, [variable.id]: { ...current.variableBounds[variable.id], min } },
                  variableValues: { ...current.variableValues, [variable.id]: Math.max(min, current.variableValues[variable.id]) },
                };
              })} />
              <NumericField id={`bound-${variable.id}-max`} label="Maximum" value={model.variableBounds[variable.id].max} onChange={(value) => change((current) => {
                const max = Math.max(value, current.variableBounds[variable.id].min + variable.step);
                return {
                  ...current,
                  variableBounds: { ...current.variableBounds, [variable.id]: { ...current.variableBounds[variable.id], max } },
                  variableValues: { ...current.variableValues, [variable.id]: Math.min(max, current.variableValues[variable.id]) },
                };
              })} />
            </div>
          ))}
        </FieldGroup>
      </FieldSet>
    </div>
  );
}

function Results({ workspace, solution }: { workspace: LinearProgrammingWorkspace; solution: LinearProgrammingSolution }) {
  if (!solution.ok || !solution.best || !solution.worst) {
    return <Alert variant="destructive"><CircleAlert /><AlertTitle>No feasible polygon</AlertTitle><AlertDescription>{solution.message}</AlertDescription></Alert>;
  }
  return (
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardHeader><CardTitle>Feasible region and vertices</CardTitle><CardAction><span className="text-xs tabular-nums text-muted-foreground">Area {formatLpNumber(solution.area)} sq units</span></CardAction></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Vertex</TableHead><TableHead>Coordinates</TableHead><TableHead className="text-right">Z value</TableHead></TableRow></TableHeader>
            <TableBody>
              {solution.vertices.map((vertex) => (
                <TableRow key={vertex.label} data-state={vertex.label === solution.best?.label ? "selected" : undefined}>
                  <TableCell className="font-medium">{vertex.label}</TableCell>
                  <TableCell>({formatLpNumber(vertex.x)}, {formatLpNumber(vertex.y)})</TableCell>
                  <TableCell className="text-right tabular-nums">{formatLpMoney(vertex.objectiveValue, workspace.objective.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Alert>
        <CheckCircle2 />
        <AlertTitle>{workspace.objective.sense === "maximize" ? "Best allocation" : "Lowest-cost allocation"}</AlertTitle>
        <AlertDescription>
          <p>{workspace.variables.map((variable) => `${variable.label}: ${formatLpNumber(solution.allocation[variable.id])}`).join(" · ")}</p>
          <p className="mt-2 font-medium">{workspace.objective.label}: {formatLpMoney(solution.best.objectiveValue, workspace.objective.currency)}</p>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function LinearProgrammingWorkspaceView({ workspaceDefinition, rendererConfig, state, onStateChange, onProgress }: WorkspaceProps) {
  const parsed = useMemo(() => parseLinearProgrammingWorkspace(workspaceDefinition), [workspaceDefinition]);
  const workspace = parsed.workspace;
  const savedState = object(state.linear_programming);
  const [model, setModel] = useState<LinearProgrammingState | null>(() => workspace ? initialLinearProgrammingState(workspace, savedState) : null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const solution = useMemo(() => workspace && model ? solveLinearProgramming(workspace, model) : null, [model, workspace]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  if (!workspace || !model || !solution) {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Invalid linear-programming definition</AlertTitle>
        <AlertDescription>{parsed.errors.join(" ")}</AlertDescription>
      </Alert>
    );
  }
  const activeWorkspace = workspace;
  const activeModel = model;

  function commit(next: LinearProgrammingState) {
    setModel(next);
    onStateChange({ ...state, linear_programming: modelState(next) });
  }

  function change(updater: (current: LinearProgrammingState) => LinearProgrammingState) {
    const next = updater(activeModel);
    commit({ ...next, plotted: activeModel.plotted });
  }

  function reset() {
    commit(initialLinearProgrammingState(activeWorkspace));
  }

  function calculate() {
    const next: LinearProgrammingState = { ...activeModel, plotted: true };
    const nextSolution = solveLinearProgramming(activeWorkspace, next);
    commit(next);
    if (nextSolution.ok && nextSolution.best) {
      onProgress(100, {
        workspace_type: activeWorkspace.type,
        calculated: true,
        vertex_count: nextSolution.vertices.length,
        best_allocation: nextSolution.allocation,
        objective_value: nextSolution.best.objectiveValue,
      }, true);
    }
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement === frameRef.current) {
      await document.exitFullscreen?.();
      return;
    }
    await frameRef.current?.requestFullscreen?.();
  }

  return (
    <div
      ref={frameRef}
      data-workspace="linear-programming"
      className={cn(
        "flex flex-col gap-5 rounded-xl bg-background p-1 sm:p-3",
        isFullscreen && "h-screen overflow-y-auto rounded-none p-4 sm:p-5",
      )}
    >
      <div className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        isFullscreen && "sticky top-0 z-20 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur",
      )}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>GeoGebra workspace</span><span>2D slice</span></div>
          <p className="text-sm text-muted-foreground">All problem data came from the published experiment record.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={calculate}><Calculator data-icon="inline-start" />Calculate &amp; plot</Button>
          <Button variant="outline" onClick={reset}><RotateCcw data-icon="inline-start" />Reset</Button>
          <Button variant="outline" onClick={() => void toggleFullscreen()} aria-pressed={isFullscreen}>
            {isFullscreen ? <Minimize2 data-icon="inline-start" /> : <Expand data-icon="inline-start" />}
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(500px,1.2fr)_minmax(340px,0.8fr)]">
        <Card className="order-2 min-w-0 lg:order-1 lg:col-start-1 lg:row-span-2 lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Feasible region</CardTitle>
            <CardDescription>{workspace.variables.find((variable) => variable.id === workspace.axisVariables[0])?.label} against {workspace.variables.find((variable) => variable.id === workspace.axisVariables[1])?.label}</CardDescription>
            {solution.ok && solution.best && (
              <CardAction className="flex flex-wrap gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">Area {formatLpNumber(solution.area)}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{workspace.objective.label} {formatLpMoney(solution.best.objectiveValue, workspace.objective.currency)}</span>
              </CardAction>
            )}
          </CardHeader>
          <CardContent><GeoGebraPlot workspace={workspace} model={model} solution={solution} rendererConfig={rendererConfig} /></CardContent>
          <CardFooter className="text-xs text-muted-foreground">Live view — every parameter change redraws the region and optimum.</CardFooter>
        </Card>

        <div className="order-1 min-w-0 lg:order-2 lg:col-start-2">
          <ProblemModel workspace={workspace} model={model} />
        </div>

        <Card className="order-3 min-w-0 lg:col-start-2">
          <CardHeader><CardTitle>Model controls</CardTitle><CardDescription>Change an assumption and watch the graph update beside it.</CardDescription></CardHeader>
          <CardContent><Controls workspace={workspace} model={model} change={change} /></CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Results workspace={workspace} solution={solution} />

        <Card size="sm" className="min-w-0">
          <CardHeader><CardTitle>Model formulation summary</CardTitle><CardDescription>Current values used in this calculation.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Constraint</TableHead>{workspace.variables.map((variable) => <TableHead key={variable.id}>{variable.label}</TableHead>)}<TableHead>Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {workspace.constraints.map((constraint) => <TableRow key={constraint.id}><TableCell className="font-medium">{constraint.label}</TableCell>{workspace.variables.map((variable) => <TableCell key={variable.id}>{formatLpNumber(model.constraintCoefficients[constraint.id][variable.id])}</TableCell>)}<TableCell>{constraint.operator === "<=" ? "≤" : "≥"} {formatLpNumber(model.constraintRhs[constraint.id])}</TableCell></TableRow>)}
                <TableRow><TableCell className="font-medium">{workspace.objective.label} contribution</TableCell>{workspace.variables.map((variable) => <TableCell key={variable.id}>{formatLpNumber(model.objectiveCoefficients[variable.id])}</TableCell>)}<TableCell>—</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
