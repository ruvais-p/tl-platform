"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Code2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { defaultForType, isJsonObject, jsonType, moveArrayItem, moveObjectKey, parseJsonObject, removeAtPath, updateAtPath, type JsonObject, type JsonValue } from "@/lib/structured-json";

const valueTypes = ["string", "number", "boolean", "null", "object", "array"];

export function StructuredJsonEditor({ id, label, value, onChange, onValidityChange, error, description }: { id: string; label: string; value: JsonObject; onChange: (value: JsonObject) => void; onValidityChange?: (valid: boolean) => void; error?: string; description?: string }) {
  const [rawOpen, setRawOpen] = useState(false);
  const [raw, setRaw] = useState(() => JSON.stringify(value, null, 2));
  const [rawError, setRawError] = useState("");
  const [rawDirty, setRawDirty] = useState(false);
  const errorId = `${id}-error`;

  useEffect(() => {
    if (!rawDirty) setRaw(JSON.stringify(value, null, 2));
  }, [value, rawDirty]);

  function applyRaw() {
    const result = parseJsonObject(raw);
    if (!result.value) return setRawError(result.error || "Enter valid JSON.");
    onChange(result.value);
    setRaw(JSON.stringify(result.value, null, 2));
    setRawError("");
    setRawDirty(false);
    onValidityChange?.(true);
  }

  return <section className="min-w-0 space-y-3 border-t border-border/70 pt-5" aria-labelledby={`${id}-label`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 id={`${id}-label`} className="text-sm font-semibold">{label}</h3>
        {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <Button type="button" size="sm" variant="ghost" aria-expanded={rawOpen} onClick={() => {
        if (rawOpen && rawDirty && !confirm("Discard unapplied JSON changes?")) return;
        setRawOpen(!rawOpen); setRawError(""); setRawDirty(false); setRaw(JSON.stringify(value, null, 2)); onValidityChange?.(true);
      }}><Code2 />Advanced JSON</Button>
    </div>
    {!rawOpen && <JsonNode value={value} path={[]} label="Content root" root={value} onRootChange={next => isJsonObject(next) && onChange(next)} depth={0} />}
    {rawOpen && <div className="space-y-3">
      <Label htmlFor={`${id}-raw`} className="sr-only">{label} raw JSON</Label>
      <Textarea id={`${id}-raw`} className="min-h-64 max-w-full overflow-x-auto whitespace-pre font-mono text-xs leading-5" value={raw} aria-invalid={Boolean(rawError)} aria-describedby={rawError ? errorId : undefined} onChange={event => { setRaw(event.target.value); setRawDirty(true); setRawError(""); onValidityChange?.(false); }} />
      {rawError && <p id={errorId} role="alert" className="text-xs text-destructive">{rawError}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={applyRaw}>Apply JSON</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setRaw(JSON.stringify(value, null, 2)); setRawDirty(false); setRawError(""); onValidityChange?.(true); }}>Reset</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { const result = parseJsonObject(raw); if (result.value) { setRaw(JSON.stringify(result.value, null, 2)); setRawError(""); } else setRawError(result.error || "Enter valid JSON."); }}>Format</Button>
      </div>
    </div>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </section>;
}

function JsonNode({ value, path, label, root, onRootChange, depth }: { value: JsonValue; path: (string | number)[]; label: string; root: JsonValue; onRootChange: (value: JsonValue) => void; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const [newKey, setNewKey] = useState("");
  const uid = useId();
  const collection = Array.isArray(value) || isJsonObject(value);
  const entries: [string, JsonValue][] = Array.isArray(value) ? value.map((item, index) => [String(index), item]) : isJsonObject(value) ? Object.entries(value) : [];
  const setValue = (next: JsonValue) => onRootChange(updateAtPath(root, path, next));

  if (!collection) return <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(8rem,0.7fr)_7rem_minmax(10rem,1fr)] sm:items-center">
    <span className="truncate text-xs font-medium" title={label}>{label}</span>
    <TypeSelect label={label} value={value} onChange={setValue} />
    <PrimitiveInput id={uid} label={label} value={value} onChange={setValue} />
  </div>;

  return <div className={`min-w-0 ${depth ? "border-l border-border/80 pl-2 sm:pl-4" : ""}`}>
    <div className="flex min-h-9 min-w-0 items-center gap-2">
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`${open ? "Collapse" : "Expand"} ${label}`} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <ChevronDown /> : <ChevronRight />}</Button>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{label}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{Array.isArray(value) ? `Array · ${value.length}` : `Object · ${entries.length}`}</span>
      {depth > 0 && <div className="w-24"><TypeSelect label={label} value={value} onChange={setValue} /></div>}
    </div>
    {open && <div className="space-y-3 pb-3 pt-2">
      {entries.length === 0 && <p className="px-2 text-xs text-muted-foreground">No fields yet.</p>}
      {entries.map(([key, child], index) => <div key={`${key}-${index}`} className="group/node min-w-0 rounded-lg bg-muted/35 p-2 sm:p-3">
        <div className="mb-2 flex min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{Array.isArray(value) ? `Item ${index + 1}` : key}</span>
          <Button type="button" size="icon-xs" variant="ghost" disabled={index === 0} aria-label={`Move ${Array.isArray(value) ? `${label} item ${index + 1}` : key} up`} onClick={() => onRootChange(Array.isArray(value) ? moveArrayItem(root, path, index, index - 1) : moveObjectKey(root, path, index, index - 1))}><ChevronUp /></Button><Button type="button" size="icon-xs" variant="ghost" disabled={index === entries.length - 1} aria-label={`Move ${Array.isArray(value) ? `${label} item ${index + 1}` : key} down`} onClick={() => onRootChange(Array.isArray(value) ? moveArrayItem(root, path, index, index + 1) : moveObjectKey(root, path, index, index + 1))}><ChevronDown /></Button>
          <Button type="button" size="icon-xs" variant="ghost" aria-label={`Remove ${Array.isArray(value) ? `item ${index + 1}` : key}`} onClick={() => onRootChange(removeAtPath(root, [...path, Array.isArray(value) ? index : key]))}><Trash2 /></Button>
        </div>
        <JsonNode value={child} path={[...path, Array.isArray(value) ? index : key]} label={Array.isArray(value) ? `Item ${index + 1}` : key} root={root} onRootChange={onRootChange} depth={depth + 1} />
      </div>)}
      {Array.isArray(value) ? <Button type="button" size="sm" variant="outline" onClick={() => setValue([...value, ""])}><Plus />Add item</Button> : <div className="flex flex-col gap-2 sm:flex-row"><Label htmlFor={`${uid}-key`} className="sr-only">New property name</Label><Input id={`${uid}-key`} value={newKey} placeholder="New property name" onChange={event => setNewKey(event.target.value)} /><Button type="button" size="sm" variant="outline" disabled={!newKey.trim() || Object.hasOwn(value, newKey.trim())} onClick={() => { setValue({ ...value, [newKey.trim()]: "" }); setNewKey(""); }}><Plus />Add property</Button></div>}
    </div>}
  </div>;
}

function TypeSelect({ label, value, onChange }: { label: string; value: JsonValue; onChange: (value: JsonValue) => void }) {
  return <select className="h-8 w-full rounded-lg border bg-background px-2 text-xs" aria-label={`${label} value type`} value={jsonType(value)} onChange={event => onChange(defaultForType(event.target.value))}>{valueTypes.map(type => <option key={type}>{type}</option>)}</select>;
}

function PrimitiveInput({ id, label, value, onChange }: { id: string; label: string; value: JsonValue; onChange: (value: JsonValue) => void }) {
  if (typeof value === "boolean") return <label className="flex h-8 items-center gap-2 text-xs"><input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)} />Enabled</label>;
  if (value === null) return <span className="text-xs italic text-muted-foreground">Null value</span>;
  const primitive = value as string | number;
  return <><Label htmlFor={id} className="sr-only">{label} value</Label><Input id={id} className="min-w-0" type={typeof primitive === "number" ? "number" : "text"} value={primitive} onChange={event => onChange(typeof primitive === "number" ? Number(event.target.value) : event.target.value)} /></>;
}
