"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleAlert, Cloud, ExternalLink, FlaskConical } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { loadGeoGebra, type GeoGebraApi } from "@/lib/experiments/geogebra";
import type { Activity } from "@/lib/learner/types";
import { LinearProgrammingWorkspaceView } from "./linear-programming-workspace";
import { MultivariableWorkshopView } from "./multivariable-workshop";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function compare(actual: unknown, rule: Record<string, unknown>) {
  const expected = typeof rule.value === "boolean" ? Number(rule.value) : rule.value;
  const left = typeof actual === "boolean" ? Number(actual) : actual;
  switch (rule.operator) {
    case "truthy": return Boolean(left);
    case "equals": return left === expected;
    case "not_equals": return left !== expected;
    case "greater_than": return Number(left) > Number(expected);
    case "greater_than_or_equal": return Number(left) >= Number(expected);
    case "less_than": return Number(left) < Number(expected);
    case "less_than_or_equal": return Number(left) <= Number(expected);
    default: return false;
  }
}

function readGeoGebraObject(api: GeoGebraApi, name: string) {
  try {
    const numeric = api.getValue(name);
    if (Number.isFinite(numeric)) return numeric;
  } catch {}
  try { return api.getValueString(name); } catch { return null; }
}

function GeoGebraActivity({ definition, onProgress }: { definition: Record<string, unknown>; onProgress: (progress: number, state: Record<string, unknown>, complete: boolean) => void }) {
  const hostId = `tella-geogebra-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [status, setStatus] = useState("Loading interactive mathematics…");
  const [failed, setFailed] = useState(false);
  const callbackRef = useRef(onProgress);
  useEffect(() => { callbackRef.current = onProgress; }, [onProgress]);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const rendererConfig = object(definition.renderer_config);
    const materialId = typeof rendererConfig.material_id === "string" ? rendererConfig.material_id : "";
    if (!materialId) {
      setFailed(true);
      setStatus("This activity is missing its GeoGebra material ID.");
      return;
    }
    setFailed(false);
    setStatus("Loading interactive mathematics…");
    void loadGeoGebra().then((GGBApplet) => {
      if (disposed) return;
      const tracking = object(definition.tracking);
      const completion = object(tracking.completion);
      const names = [...new Set([
        ...(Array.isArray(tracking.watch_objects) ? tracking.watch_objects.filter((name): name is string => typeof name === "string") : []),
        typeof tracking.progress_object === "string" ? tracking.progress_object : "",
        typeof completion.object === "string" ? completion.object : "",
      ].filter(Boolean))];
      const parameters = {
        ...object(rendererConfig.parameters),
        appName: typeof rendererConfig.app_name === "string" ? rendererConfig.app_name : "graphing",
        material_id: materialId,
        width: typeof rendererConfig.width === "number" ? rendererConfig.width : 960,
        height: typeof rendererConfig.height === "number" ? rendererConfig.height : 600,
        scaleContainerClass: "tella-geogebra-frame",
        autoHeight: true,
        appletOnLoad: (api: GeoGebraApi) => {
          if (disposed) return;
          setStatus("Interactive activity ready and connected.");
          if (!names.length) return;
          let previous = "";
          const poll = () => {
            const values = Object.fromEntries(names.map((name) => [name, readGeoGebraObject(api, name)]));
            const complete = typeof completion.object === "string" && compare(values[completion.object], completion);
            const raw = typeof tracking.progress_object === "string" ? Number(values[tracking.progress_object]) : 0;
            const progress = complete ? 100 : Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
            const snapshot = JSON.stringify(values);
            if (snapshot !== previous) {
              previous = snapshot;
              callbackRef.current(progress, { values }, complete);
            }
            if (complete && timer) { clearInterval(timer); timer = null; setStatus("Activity completion recorded."); }
            return complete;
          };
          const alreadyComplete = poll();
          if (!alreadyComplete && names.length) timer = setInterval(poll, typeof tracking.throttle_ms === "number" ? Math.max(500, tracking.throttle_ms) : 1000);
        },
      };
      new GGBApplet(parameters, true).inject(hostId);
    }).catch(() => {
      if (!disposed) { setFailed(true); setStatus("GeoGebra could not be loaded. Check your connection and try again."); }
    });
    return () => { disposed = true; if (timer) clearInterval(timer); };
  }, [definition, hostId]);

  return (
    <div className="flex flex-col gap-3">
      <div id={hostId} className="tella-geogebra-frame min-h-[420px] w-full overflow-hidden rounded-xl border bg-card sm:min-h-[540px]" />
      <p className={failed ? "flex items-center gap-2 text-xs text-destructive" : "flex items-center gap-2 text-xs text-muted-foreground"} role={failed ? "alert" : "status"}>
        {failed ? <CircleAlert className="size-3.5" /> : status.startsWith("Loading") ? <Spinner /> : <Cloud className="size-3.5 text-success" />}
        {status}
      </p>
    </div>
  );
}

type ResponseField = { key: string; label: string; type: string; placeholder: string };

function responseFields(value: unknown): ResponseField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === "string") return [{ key: item, label: item.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), type: "textarea", placeholder: "Enter your response" }];
    const field = object(item);
    const key = typeof field.key === "string" ? field.key : typeof field.name === "string" ? field.name : `response_${index + 1}`;
    return [{ key, label: typeof field.label === "string" ? field.label : key.replaceAll("_", " "), type: typeof field.type === "string" ? field.type : "textarea", placeholder: typeof field.placeholder === "string" ? field.placeholder : "Enter your response" }];
  });
}

function ResponseForm({ fields, state, onStateChange }: { fields: ResponseField[]; state: Record<string, unknown>; onStateChange: (state: Record<string, unknown>) => void }) {
  const responses = object(state.experiment_responses);
  const formId = useId();
  return (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      {fields.map((field, index) => {
        const id = `${formId}-${index}`;
        const wide = field.type === "textarea" || index === fields.length - 1;
        return (
          <Field key={field.key} className={wide ? "sm:col-span-2" : undefined}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            {field.type === "textarea" ? (
              <Textarea id={id} value={typeof responses[field.key] === "string" ? String(responses[field.key]) : ""} onChange={(event) => onStateChange({ ...state, experiment_responses: { ...responses, [field.key]: event.target.value } })} rows={4} placeholder={field.placeholder} />
            ) : (
              <Input id={id} type={field.type === "number" ? "number" : "text"} value={typeof responses[field.key] === "string" || typeof responses[field.key] === "number" ? String(responses[field.key]) : ""} onChange={(event) => onStateChange({ ...state, experiment_responses: { ...responses, [field.key]: event.target.value } })} placeholder={field.placeholder} className="h-10" />
            )}
          </Field>
        );
      })}
    </FieldGroup>
  );
}

export function ExperimentRenderer({ activity, state, onStateChange, onTrackedProgress }: { activity: Activity; state: Record<string, unknown>; onStateChange: (state: Record<string, unknown>) => void; onTrackedProgress: (progress: number, state: Record<string, unknown>, complete: boolean) => void }) {
  const experiment = activity.experiment;
  const definition = experiment ? object(experiment.configuration) : {};
  const renderer = typeof definition.renderer === "string" ? definition.renderer.toLowerCase() : "";
  const config = object(definition.renderer_config);
  const fields = responseFields(definition.response_fields ?? config.response_fields);

  if (!experiment) return <Empty className="min-h-52 border bg-card"><EmptyHeader><EmptyMedia variant="icon"><FlaskConical /></EmptyMedia><EmptyTitle>Interactive setup pending</EmptyTitle><EmptyDescription>This activity is published, but its experiment definition is not available yet.</EmptyDescription></EmptyHeader></Empty>;
  if (renderer === "geogebra" && object(config.workspace).type === "linear_programming") return <LinearProgrammingWorkspaceView workspaceDefinition={config.workspace} rendererConfig={config} state={state} onStateChange={onStateChange} onProgress={onTrackedProgress} />;
  if (renderer === "geogebra" && object(config.workspace).type === "multivariable_profit") return <MultivariableWorkshopView workspaceDefinition={config.workspace} rendererConfig={config} state={state} onStateChange={onStateChange} onProgress={onTrackedProgress} />;
  if (renderer === "geogebra") return <GeoGebraActivity definition={definition} onProgress={onTrackedProgress} />;
    if (renderer === "graphspace") return <Card><CardHeader><CardTitle>{typeof config.heading === "string" ? config.heading : activity.title}</CardTitle><CardDescription>{typeof config.message === "string" ? config.message : experiment.instructions}</CardDescription></CardHeader><CardContent><Button asChild><a href={typeof config.path === "string" ? config.path : "/graphspace/index_3.html"} target="_blank" rel="noreferrer">Open GraphSpace<ExternalLink data-icon="inline-end" /></a></Button></CardContent></Card>;
  if (renderer === "placeholder") return <Card><CardHeader><CardTitle>{typeof config.heading === "string" ? config.heading : activity.title}</CardTitle><CardDescription>{typeof config.message === "string" ? config.message : experiment.instructions}</CardDescription></CardHeader>{typeof config.note === "string" && <CardContent><Alert><AlertDescription>{config.note}</AlertDescription></Alert></CardContent>}</Card>;
  if (fields.length) return <ResponseForm fields={fields} state={state} onStateChange={onStateChange} />;
  if (experiment.external_url) return <Button asChild variant="outline"><a href={experiment.external_url} target="_blank" rel="noreferrer">Open interactive resource<ExternalLink data-icon="inline-end" /></a></Button>;
  if (renderer) return <Alert><CircleAlert /><AlertTitle>Module unavailable</AlertTitle><AlertDescription>The “{renderer}” activity module is not available in this frontend yet. Its published definition has been preserved.</AlertDescription></Alert>;
  return <Alert><AlertDescription>Follow the instructions above, then save your progress when you are ready.</AlertDescription></Alert>;
}
