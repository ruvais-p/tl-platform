"use client";

import Link from "next/link";
import { Archive, ArrowLeft, Save, Send, StopCircle } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { EligibilityRuleEditor, type RuleRelations } from "./eligibility-rule-editor";
import { OpportunityMarkdown } from "./opportunity-markdown";
import { CompanyLogo, LifecycleBadge, employmentLabels, formatCompensation, formatOpportunityLocation, workplaceLabels } from "./opportunity-presentation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/curriculum/api";
import type { MediaAsset, UUID } from "@/lib/learner/types";
import { staffOpportunityApi } from "@/lib/opportunities/staff-api";
import type { CompensationDisclosure, OpportunityInput, PayPeriod, StaffOpportunity } from "@/lib/opportunities/types";
import { staffApi } from "@/lib/staff/api";

type RelationRecord = { id: string; name?: string; title?: string; status?: string; mime_type?: string };

export const emptyOpportunity: OpportunityInput = {
  title: "", company_name: "", company_website: "", company_logo: null,
  summary: "", description_markdown: "", employment_type: "INTERNSHIP", workplace_mode: "REMOTE",
  physical_location: "", remote_region: "", openings: null, compensation_disclosure: "NOT_DISCLOSED",
  compensation_currency: "", compensation_min: null, compensation_max: null, compensation_pay_period: "",
  start_date: null, duration: "", application_deadline: null, application_mode: "INTERNAL", application_url: "",
  cover_note_required: false, resume_required: false, is_featured: false,
  audience_scope: "ALL_LEARNERS", audience_groups: [], eligibility_rules: { version: 1, match: "ALL", conditions: [] },
};

export function validateOpportunityInput(value: OpportunityInput, forPublication = false) {
  const errors: Record<string, string> = {};
  if (!value.title.trim()) errors.title = "Add a title.";
  if (forPublication) {
    if (!value.company_name.trim()) errors.company_name = "Add a company name.";
    if (!value.summary.trim()) errors.summary = "Add a short summary.";
    if (!value.description_markdown.trim()) errors.description_markdown = "Add the full description.";
    if (value.workplace_mode === "REMOTE" && !value.remote_region.trim()) errors.remote_region = "State the applicant region.";
    if (value.workplace_mode !== "REMOTE" && !value.physical_location.trim()) errors.physical_location = "Add the physical location.";
    if (value.application_mode === "EXTERNAL" && !value.application_url.startsWith("https://")) errors.application_url = "Use a complete HTTPS URL.";
    if (value.compensation_disclosure === "PAID" && (!value.compensation_currency || !value.compensation_pay_period || (value.compensation_min == null && value.compensation_max == null))) errors.compensation_disclosure = "Add an amount, currency, and pay period.";
  }
  if (value.compensation_min != null && value.compensation_max != null && Number(value.compensation_max) < Number(value.compensation_min)) errors.compensation_max = "Maximum cannot be lower than minimum.";
  if (value.audience_scope === "SELECTED_GROUPS" && value.audience_groups.length === 0) errors.audience_groups = "Select at least one audience group.";
  return errors;
}

export function toInput(opportunity: StaffOpportunity): OpportunityInput {
  const omitted = new Set(["id", "is_open", "created_at", "updated_at", "employment_type_label", "workplace_mode_label", "lifecycle_status"]);
  return Object.fromEntries(Object.entries(opportunity).filter(([key]) => !omitted.has(key))) as OpportunityInput;
}

function FieldError({ value }: { value?: string }) { return value ? <p className="mt-1 text-xs text-destructive" role="alert">{value}</p> : null; }

export function OpportunityEditor({ opportunityId }: { opportunityId?: UUID }) {
  const { user, loading: authLoading } = useAuth();
  const [value, setValue] = useState<OpportunityInput>(emptyOpportunity);
  const [saved, setSaved] = useState<StaffOpportunity | null>(null);
  const [relations, setRelations] = useState<RuleRelations>({ groups: [], courses: [], learningChecks: [] });
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(Boolean(opportunityId));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const canAdd = Boolean(user?.permissions.includes("progress.add_careeropportunity"));
  const canChange = Boolean(user?.permissions.includes("progress.change_careeropportunity"));
  const allowed = opportunityId ? canChange : canAdd;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [groups, courses, checks, assets, opportunity] = await Promise.all([
        staffApi.list<RelationRecord>("student-groups"), staffApi.list<RelationRecord>("courses"),
        staffApi.list<RelationRecord>("learning-checks"), staffApi.list<MediaAsset>("media-assets"),
        opportunityId ? staffOpportunityApi.get(opportunityId) : Promise.resolve(null),
      ]);
      setRelations({ groups: groups.map((item) => ({ id: String(item.id), name: item.name ?? "Group" })), courses: courses.map((item) => ({ id: String(item.id), name: item.name ?? "Course" })), learningChecks: checks.map((item) => ({ id: String(item.id), title: item.title ?? "Learning check" })) });
      setMedia(assets.filter((asset) => asset.status === "READY" && asset.mime_type.startsWith("image/")));
      if (opportunity) { setSaved(opportunity); setValue(toInput(opportunity)); }
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The editor could not be loaded."); }
    finally { setLoading(false); }
  }, [opportunityId]);
  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  const set = <K extends keyof OpportunityInput>(key: K, next: OpportunityInput[K]) => setValue((current) => ({ ...current, [key]: next }));
  const mapServerErrors = (caught: unknown) => {
    if (!(caught instanceof ApiError)) return {};
    return Object.fromEntries(Object.entries(caught.body).filter(([, detail]) => Array.isArray(detail)).map(([key, detail]) => [key, String((detail as unknown[])[0])]));
  };
  const save = async (event?: FormEvent) => {
    event?.preventDefault(); setNotice(""); setError("");
    const errors = validateOpportunityInput(value);
    setFieldErrors(errors); if (Object.keys(errors).length) return null;
    setSaving(true);
    try {
      const result = saved ? await staffOpportunityApi.update(saved.id, value) : await staffOpportunityApi.create(value);
      setSaved(result); setValue(toInput(result)); setNotice("Draft saved."); return result;
    } catch (caught) { setFieldErrors(mapServerErrors(caught)); setError(caught instanceof ApiError ? caught.message : "The draft could not be saved."); return null; }
    finally { setSaving(false); }
  };
  const transition = async (action: "publish" | "close" | "archive") => {
    let current = saved;
    if (action === "publish") {
      const errors = validateOpportunityInput(value, true); setFieldErrors(errors);
      if (Object.keys(errors).length) { setError("Resolve the highlighted fields before publication."); return; }
      current = await save(); if (!current) return;
    }
    if (!current || !window.confirm(`${action[0].toUpperCase()}${action.slice(1)} this opportunity?`)) return;
    setSaving(true); setError("");
    try { const result = await staffOpportunityApi.lifecycle(current.id, action); setSaved(result); setValue(toInput(result)); setNotice(`Opportunity ${action === "publish" ? "published" : `${action}d`}.`); }
    catch (caught) { setFieldErrors(mapServerErrors(caught)); setError(caught instanceof ApiError ? caught.message : `The opportunity could not be ${action}d.`); }
    finally { setSaving(false); }
  };

  if (authLoading || loading) return <main className="mx-auto max-w-6xl p-5 md:p-9" role="status">Loading opportunity editor…</main>;
  if (!allowed) return <main className="mx-auto max-w-6xl p-5 md:p-9"><Alert variant="destructive"><AlertTitle>Access denied</AlertTitle><AlertDescription>You do not have permission to {opportunityId ? "edit" : "create"} opportunities.</AlertDescription></Alert></main>;

  return <main className="mx-auto flex max-w-6xl flex-col gap-7 p-5 md:p-9">
    <header className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end"><div><Button render={<Link href="/opportunities" />} nativeButton={false} variant="ghost" size="sm" className="-ml-3"><ArrowLeft data-icon="inline-start" />Opportunities</Button><div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{saved ? saved.title : "New opportunity"}</h1>{saved && <LifecycleBadge status={saved.lifecycle_status} />}</div><p className="mt-2 text-sm text-muted-foreground">Save an incomplete draft, then preview and publish when every required detail is ready.</p></div><div className="flex flex-wrap gap-2"><Button type="submit" form="opportunity-form" disabled={saving}><Save data-icon="inline-start" />{saving ? "Saving…" : "Save draft"}</Button>{saved?.lifecycle_status !== "PUBLISHED" && <Button type="button" onClick={() => void transition("publish")} disabled={saving}><Send data-icon="inline-start" />Publish</Button>}{saved?.lifecycle_status === "PUBLISHED" && <Button variant="outline" onClick={() => void transition("close")}><StopCircle data-icon="inline-start" />Close</Button>}{saved?.lifecycle_status !== "ARCHIVED" && <Button variant="ghost" onClick={() => void transition("archive")}><Archive data-icon="inline-start" />Archive</Button>}</div></header>
    {notice && <Alert><AlertDescription>{notice}</AlertDescription></Alert>}{error && <Alert variant="destructive"><AlertTitle>Action needed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    <form id="opportunity-form" onSubmit={(event) => void save(event)} className="space-y-10">
      <EditorSection title="Employer" description="The identity learners see first."><div className="grid gap-4 sm:grid-cols-2"><TextField label="Company name" value={value.company_name} onChange={(next) => set("company_name", next)} error={fieldErrors.company_name} /><TextField label="Company website" type="url" value={value.company_website} onChange={(next) => set("company_website", next)} /><label className="text-sm font-medium sm:col-span-2">Company logo<select className="mt-1 block h-9 w-full rounded-md border bg-background px-3" value={value.company_logo ?? ""} onChange={(event) => set("company_logo", event.target.value || null)}><option value="">Use initials fallback</option>{media.map((asset) => <option key={asset.id} value={asset.id}>{asset.file_name}</option>)}</select></label></div></EditorSection>
      <EditorSection title="Basics" description="Title, summary, employment, and full Markdown description."><div className="grid gap-4 sm:grid-cols-2"><TextField label="Opportunity title" value={value.title} onChange={(next) => set("title", next)} error={fieldErrors.title} /><TextField label="Openings" type="number" value={value.openings ?? ""} onChange={(next) => set("openings", next ? Number(next) : null)} /><SelectField label="Employment type" value={value.employment_type} options={employmentLabels} onChange={(next) => set("employment_type", next as OpportunityInput["employment_type"])} /><SelectField label="Workplace mode" value={value.workplace_mode} options={workplaceLabels} onChange={(next) => set("workplace_mode", next as OpportunityInput["workplace_mode"])} /><label className="text-sm font-medium sm:col-span-2">Short summary<Textarea className="mt-1" value={value.summary} onChange={(event) => set("summary", event.target.value)} /><FieldError value={fieldErrors.summary} /></label><label className="text-sm font-medium sm:col-span-2">Markdown description<Textarea className="mt-1 min-h-52 font-mono text-sm" value={value.description_markdown} onChange={(event) => set("description_markdown", event.target.value)} /><FieldError value={fieldErrors.description_markdown} /></label></div></EditorSection>
      <EditorSection title="Preview" description="This is the same restricted renderer learners see."><div className="rounded-2xl border bg-muted/20 p-6"><div className="flex items-center gap-3"><CompanyLogo companyName={value.company_name} /><div><h3 className="font-semibold">{value.title || "Untitled opportunity"}</h3><p className="text-sm text-muted-foreground">{value.company_name || "Company name"}</p></div></div><OpportunityMarkdown className="mt-6 space-y-3 leading-7">{value.description_markdown || "_Add a description to preview it._"}</OpportunityMarkdown></div></EditorSection>
      <EditorSection title="Location & compensation" description="Conditional details used in cards and filters."><div className="grid gap-4 sm:grid-cols-2"><TextField label="Physical location" value={value.physical_location} onChange={(next) => set("physical_location", next)} error={fieldErrors.physical_location} /><TextField label="Remote applicant region" value={value.remote_region} onChange={(next) => set("remote_region", next)} error={fieldErrors.remote_region} /><SelectField label="Compensation" value={value.compensation_disclosure} options={{ NOT_DISCLOSED: "Not disclosed", PAID: "Paid", UNPAID: "Unpaid" }} onChange={(next) => set("compensation_disclosure", next as CompensationDisclosure)} error={fieldErrors.compensation_disclosure} />{value.compensation_disclosure === "PAID" && <><TextField label="ISO currency" value={value.compensation_currency} onChange={(next) => set("compensation_currency", next.toUpperCase())} /><TextField label="Minimum" type="number" value={value.compensation_min ?? ""} onChange={(next) => set("compensation_min", next || null)} /><TextField label="Maximum" type="number" value={value.compensation_max ?? ""} onChange={(next) => set("compensation_max", next || null)} error={fieldErrors.compensation_max} /><SelectField label="Pay period" value={value.compensation_pay_period} options={{ HOUR: "Per hour", DAY: "Per day", WEEK: "Per week", MONTH: "Per month", YEAR: "Per year", PROJECT: "Per project" }} includeBlank onChange={(next) => set("compensation_pay_period", next as PayPeriod | "")} /></>}</div><p className="mt-3 text-sm text-muted-foreground">Preview: {formatOpportunityLocation(value.workplace_mode, value.physical_location, value.remote_region)} · {formatCompensation({ disclosure: value.compensation_disclosure, currency: value.compensation_currency, minimum: value.compensation_min, maximum: value.compensation_max, payPeriod: value.compensation_pay_period })}</p></EditorSection>
      <EditorSection title="Schedule & application" description="Dates and the learner handoff or internal form."><div className="grid gap-4 sm:grid-cols-2"><TextField label="Start date" type="date" value={value.start_date ?? ""} onChange={(next) => set("start_date", next || null)} /><TextField label="Duration" value={value.duration} onChange={(next) => set("duration", next)} /><TextField label="Application deadline" type="datetime-local" value={value.application_deadline?.slice(0, 16) ?? ""} onChange={(next) => set("application_deadline", next ? new Date(next).toISOString() : null)} /><SelectField label="Application mode" value={value.application_mode} options={{ INTERNAL: "Internal application", EXTERNAL: "External website" }} onChange={(next) => set("application_mode", next as OpportunityInput["application_mode"])} />{value.application_mode === "EXTERNAL" && <TextField label="HTTPS application URL" type="url" value={value.application_url} onChange={(next) => set("application_url", next)} error={fieldErrors.application_url} />}<label className="flex items-center gap-2 text-sm"><Checkbox checked={value.cover_note_required} onCheckedChange={(checked) => set("cover_note_required", checked === true)} />Require cover note</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={value.resume_required} onCheckedChange={(checked) => set("resume_required", checked === true)} />Require resume</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={value.is_featured} onCheckedChange={(checked) => set("is_featured", checked === true)} />Featured opportunity</label></div></EditorSection>
      <EditorSection title="Audience" description="Visibility is separate from eligibility."><SelectField label="Audience" value={value.audience_scope} options={{ ALL_LEARNERS: "All learners", SELECTED_GROUPS: "Selected groups" }} onChange={(next) => set("audience_scope", next as OpportunityInput["audience_scope"])} />{value.audience_scope === "SELECTED_GROUPS" && <div className="mt-3 grid gap-2 sm:grid-cols-2">{relations.groups.map((group) => <label key={group.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><Checkbox checked={value.audience_groups.includes(group.id)} onCheckedChange={(checked) => set("audience_groups", checked ? [...value.audience_groups, group.id] : value.audience_groups.filter((id) => id !== group.id))} />{group.name}</label>)}</div>}<FieldError value={fieldErrors.audience_groups} /></EditorSection>
      <EligibilityRuleEditor value={value.eligibility_rules} onChange={(next) => set("eligibility_rules", next)} relations={relations} error={fieldErrors.eligibility_rules} />
    </form>
  </main>;
}

function EditorSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="grid gap-5 border-t pt-7 md:grid-cols-[13rem_1fr]"><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><div>{children}</div></section>; }
function TextField({ label, value, onChange, type = "text", error }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; error?: string }) { return <label className="text-sm font-medium">{label}<Input aria-invalid={Boolean(error)} className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} /><FieldError value={error} /></label>; }
function SelectField({ label, value, options, onChange, includeBlank = false, error }: { label: string; value: string; options: Record<string, string>; onChange: (value: string) => void; includeBlank?: boolean; error?: string }) { return <label className="text-sm font-medium">{label}<select aria-invalid={Boolean(error)} className="mt-1 block h-9 w-full rounded-md border bg-background px-3" value={value} onChange={(event) => onChange(event.target.value)}>{includeBlank && <option value="">Select</option>}{Object.entries(options).map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select><FieldError value={error} /></label>; }
