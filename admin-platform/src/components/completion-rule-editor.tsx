"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StructuredJsonEditor } from "@/components/structured-json-editor";
import { setObjectKeys, type JsonObject } from "@/lib/structured-json";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-10 items-center gap-3 text-sm"><input className="size-4 accent-emerald-800" type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />{label}</label>;
}

export function ChapterCompletionEditor({ value, onChange, onValidityChange }: { value: JsonObject; onChange: (value: JsonObject) => void; onValidityChange?: (valid: boolean) => void }) {
  const update = (key: string, next: boolean | number) => onChange(setObjectKeys(value, { [key]: next }));
  const requiresCheck = value.learning_check_required === true;
  return <div className="md:col-span-2">
    <div className="border-t border-border/70 pt-5">
      <h3 className="text-sm font-semibold">Completion requirements</h3>
      <p className="mt-1 text-xs text-muted-foreground">Choose what learners must finish before this chapter is complete.</p>
      <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
        <Toggle label="Complete required subtopics" checked={value.required_subtopics !== false} onChange={next => update("required_subtopics", next)} />
        <Toggle label="Complete case study" checked={value.case_study_required === true} onChange={next => update("case_study_required", next)} />
        <Toggle label="Pass learning check" checked={requiresCheck} onChange={next => update("learning_check_required", next)} />
        {requiresCheck && <div className="space-y-1 py-1"><Label htmlFor="learning-check-pass">Minimum score (%)</Label><Input id="learning-check-pass" type="number" min={0} max={100} value={typeof value.learning_check_pass_percentage === "number" ? value.learning_check_pass_percentage : 70} onChange={event => update("learning_check_pass_percentage", Number(event.target.value))} /></div>}
      </div>
    </div>
    <StructuredJsonEditor id="chapter-completion" label="Additional completion data" description="Advanced and unrecognized rule fields remain available here." value={value} onChange={onChange} onValidityChange={onValidityChange} />
  </div>;
}

export function ActivityCompletionEditor({ activityType, value, onChange, onValidityChange }: { activityType: string; value: JsonObject; onChange: (value: JsonObject) => void; onValidityChange?: (valid: boolean) => void }) {
  const update = (key: string, next: boolean | number) => onChange(setObjectKeys(value, { [key]: next }));
  const video = activityType === "CONCEPT_VIDEO";
  return <div className="md:col-span-2">
    <div className="border-t border-border/70 pt-5">
      <h3 className="text-sm font-semibold">Completion requirement</h3>
      <div className="mt-3 max-w-md">
        {video ? <div className="space-y-2"><Label htmlFor="watch-percentage">Required watch percentage</Label><Input id="watch-percentage" type="number" min={0} max={100} value={typeof value.watch_percentage === "number" ? value.watch_percentage : 90} onChange={event => update("watch_percentage", Number(event.target.value))} /></div> : <Toggle label="Mark complete when finished" checked={value.complete !== false} onChange={next => update("complete", next)} />}
      </div>
    </div>
    <StructuredJsonEditor id="activity-completion" label="Additional completion data" description="Changing activity type does not remove existing custom rule fields." value={value} onChange={onChange} onValidityChange={onValidityChange} />
  </div>;
}
