"use client";

import { FormEvent, useRef, useState } from "react";
import { Save, Send, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActivityCompletionEditor, ChapterCompletionEditor } from "@/components/completion-rule-editor";
import { StructuredJsonEditor } from "@/components/structured-json-editor";
import { ApiError, curriculumApi } from "@/lib/curriculum/api";
import { resourceEndpoint, type SelectedResource } from "@/lib/curriculum/tree";
import { isJsonObject, type JsonObject } from "@/lib/structured-json";
import type { Activity, Chapter, Course, CourseVersion, Selection, Status, Subtopic } from "@/lib/curriculum/types";

const statuses: Status[] = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"];
const activityTypes = ["CONCEPT_VIDEO", "EXPERIMENT", "CONCEPT_OVERVIEW", "OBSERVE_LEARN_PRACTICE", "HOMEWORK", "INTERACTIVE_WORKSHOP", "SIMULATION", "READING", "PDF", "INTERACTIVE", "ASSIGNMENT", "PROJECT", "LIVE_CLASS", "FLASHCARD"];

export function CurriculumInspector({ course, selection, resource, canPublish, onDirty, onSaved, onDeleted, onError }: { course: Course; selection: Selection; resource: SelectedResource; canPublish: boolean; onDirty: (value: boolean) => void; onSaved: () => void; onDeleted: () => void; onError: (value: string) => void }) {
  const activity = selection.kind === "activity" ? resource as Activity : null;
  const initialRule = "completion_rule" in resource && isJsonObject(resource.completion_rule) ? resource.completion_rule as JsonObject : {};
  const [completionRule, setCompletionRule] = useState<JsonObject>(initialRule);
  const [content, setContent] = useState<JsonObject>(activity && isJsonObject(activity.content_record?.content) ? activity.content_record.content as JsonObject : {});
  const [activityType, setActivityType] = useState(activity?.activity_type || "");
  const [completionValid, setCompletionValid] = useState(true);
  const [contentValid, setContentValid] = useState(true);
  const [localError, setLocalError] = useState("");
  const [partialFailure, setPartialFailure] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function changed() { onDirty(true); setLocalError(""); }
  function updateRule(next: JsonObject) { setCompletionRule(next); changed(); }
  function updateContent(next: JsonObject) { setContent(next); changed(); }

  function buildPayload(form: HTMLFormElement) {
    const fields = new FormData(form);
    const data: Record<string, unknown> = { status: fields.get("status"), name: fields.get("name") || undefined, title: fields.get("title") || undefined, description: fields.get("description") || "" };
    if (selection.kind === "version") data.version_number = Number(fields.get("version_number"));
    else { data.estimated_minutes = Number(fields.get("estimated_minutes")); data.is_required = fields.get("is_required") === "on"; }
    if (selection.kind === "chapter") { data.slug = fields.get("slug"); data.chapter_number = Number(fields.get("chapter_number")); data.completion_rule = completionRule; }
    if (selection.kind === "subtopic") { data.slug = fields.get("slug"); data.learning_objectives = String(fields.get("learning_objectives") || "").split("\n").map(value => value.trim()).filter(Boolean); }
    if (selection.kind === "activity") { data.activity_type = activityType; data.completion_rule = completionRule; }
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    return { data, contentType: String(fields.get("content_type") || "application/json").trim() };
  }

  function validate() {
    if (!completionValid || !contentValid) { setLocalError("Apply or reset the unfinished Advanced JSON changes before saving."); return false; }
    if (activity && !formRef.current?.querySelector<HTMLInputElement>('[name="content_type"]')?.value.trim()) { setLocalError("Content type is required."); return false; }
    setLocalError(""); return true;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!validate()) return;
    const { data, contentType } = buildPayload(event.currentTarget); setSaving(true); setPartialFailure(false);
    try {
      await curriculumApi.update(resourceEndpoint[selection.kind], selection.id, data);
      if (activity) {
        try { await curriculumApi.saveContent(activity.id, activity.content_record, contentType, content); }
        catch (error) { setPartialFailure(true); setLocalError(`Activity fields were saved, but content was not. ${error instanceof ApiError ? error.message : "Retry the content save."}`); onDirty(true); return; }
      }
      onSaved();
    } catch (error) { onError(error instanceof ApiError ? error.message : "Could not save changes."); }
    finally { setSaving(false); }
  }

  async function retryContent() {
    if (!activity || !formRef.current || !validate()) return;
    const { contentType } = buildPayload(formRef.current); setSaving(true);
    try { await curriculumApi.saveContent(activity.id, activity.content_record, contentType, content); setPartialFailure(false); setLocalError(""); onSaved(); }
    catch (error) { setLocalError(error instanceof ApiError ? error.message : "Content could not be saved."); }
    finally { setSaving(false); }
  }

  async function remove() { if (!confirm(`Delete this ${selection.kind}? This cannot be undone.`)) return; try { await curriculumApi.remove(resourceEndpoint[selection.kind], selection.id); onDeleted(); } catch (error) { onError(error instanceof ApiError ? error.message : "Could not delete this item."); } }
  async function publish() { if (!confirm("Publish this course version? Students may gain access to it.")) return; try { await curriculumApi.publish(course.id, resource.id); onSaved(); } catch (error) { onError(error instanceof ApiError ? error.message : "Publication was blocked."); } }

  return <form ref={formRef} onSubmit={save} onChange={changed} className="mx-auto max-w-4xl space-y-6 pb-28 lg:pb-6">
    <div className="flex min-w-0 items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">{selection.kind}</p><h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">{"name" in resource ? resource.name : resource.title}</h2><p className="mt-1 break-all text-xs text-muted-foreground">ID {resource.id}</p></div><Badge variant="outline">{resource.status}</Badge></div>
    {localError && <Alert variant="destructive" role="alert"><AlertDescription>{localError}{partialFailure && <Button type="button" size="sm" variant="outline" className="mt-3 flex" onClick={retryContent} disabled={saving}>Retry content save</Button>}</AlertDescription></Alert>}
    <div className="grid min-w-0 gap-5 border-y border-border/80 bg-white py-6 md:grid-cols-2">
      {selection.kind === "version" ? <Field label="Version name" name="name" defaultValue={(resource as CourseVersion).name} required /> : <Field label="Title" name="title" defaultValue={(resource as Chapter | Subtopic | Activity).title} required />}
      <div className="space-y-2"><Label htmlFor="status">Status</Label><select id="status" name="status" defaultValue={resource.status} className="h-9 w-full rounded-lg border px-3 text-sm">{statuses.map(status => <option key={status}>{status}</option>)}</select></div>
      {selection.kind === "version" ? <Field label="Version number" name="version_number" type="number" defaultValue={(resource as CourseVersion).version_number} /> : <><div className="space-y-2 md:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" defaultValue={(resource as Chapter | Subtopic | Activity).description} /></div><Field label="Estimated minutes" name="estimated_minutes" type="number" min={0} defaultValue={(resource as Chapter | Subtopic | Activity).estimated_minutes} /><label className="flex min-h-10 items-center gap-2 self-end text-sm"><input name="is_required" type="checkbox" defaultChecked={(resource as Chapter | Subtopic | Activity).is_required} />Required</label></>}
      {selection.kind === "chapter" && <><Field label="Slug" name="slug" defaultValue={(resource as Chapter).slug} /><Field label="Chapter number" name="chapter_number" type="number" defaultValue={(resource as Chapter).chapter_number} /><ChapterCompletionEditor value={completionRule} onChange={updateRule} onValidityChange={valid => { setCompletionValid(valid); if (!valid) changed(); }} /></>}
      {selection.kind === "subtopic" && <><Field label="Slug" name="slug" defaultValue={(resource as Subtopic).slug} /><div className="space-y-2 md:col-span-2"><Label htmlFor="learning_objectives">Learning objectives, one per line</Label><Textarea id="learning_objectives" name="learning_objectives" defaultValue={(resource as Subtopic).learning_objectives.join("\n")} /></div></>}
      {activity && <><div className="space-y-2"><Label htmlFor="activity_type">Activity type</Label><select id="activity_type" name="activity_type" value={activityType} className="h-9 w-full rounded-lg border px-3 text-sm" onChange={event => { setActivityType(event.target.value); changed(); }}>{activityTypes.map(type => <option key={type}>{type}</option>)}</select></div><ActivityCompletionEditor activityType={activityType} value={completionRule} onChange={updateRule} onValidityChange={valid => { setCompletionValid(valid); if (!valid) changed(); }} /><Field label="Content type" name="content_type" defaultValue={activity.content_record?.content_type || "application/json"} required /><div className="md:col-span-2"><StructuredJsonEditor id="activity-content" label="Structured activity content" description="Build nested learner content without writing JSON. Dedicated video, experiment, and practice records are managed separately." value={content} onChange={updateContent} onValidityChange={valid => { setContentValid(valid); if (!valid) changed(); }} /></div></>}
    </div>
    <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col-reverse gap-2 border-t bg-white/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:justify-end lg:static lg:flex-row lg:justify-between lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <Button type="button" variant="destructive" className="min-h-11 sm:min-h-8" onClick={remove}><Trash2 />Delete</Button>
      <div className="flex flex-col-reverse gap-2 sm:flex-row"><Button type="button" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => { if (!confirm("Discard unsaved changes?")) return; onDirty(false); onSaved(); }}>Cancel</Button>{selection.kind === "version" && canPublish && resource.status !== "PUBLISHED" && <Button type="button" variant="outline" className="min-h-11 sm:min-h-8" onClick={publish}><Send />Publish</Button>}<Button type="submit" className="min-h-11 bg-emerald-800 hover:bg-emerald-900 sm:min-h-8" disabled={saving}><Save />{saving ? "Saving…" : "Save changes"}</Button></div>
    </div>
    <p className="sr-only" aria-live="polite">Editing {selection.kind}</p>
  </form>;
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) { return <div className="min-w-0 space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} {...props} /></div>; }
