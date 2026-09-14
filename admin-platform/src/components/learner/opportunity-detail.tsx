"use client";

import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { OpportunityMarkdown } from "@/components/opportunities/opportunity-markdown";
import { ApplicationStatusBadge, CompanyLogo, OpportunityBadge, employmentLabels, formatCompensation, formatOpportunityLocation, workplaceLabels } from "@/components/opportunities/opportunity-presentation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { learnerApi, LearnerApiError } from "@/lib/learner/api";
import type { CareerOpportunity, LearnerApplication } from "@/lib/learner/types";
import { ErrorState, LoadingState } from "./common";
import { useLearnerAuth } from "./learner-auth-provider";

const MAX_RESUME_SIZE = 5 * 1024 * 1024;
const RESUME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function validatedExternalApplicationUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function applicationError(error: unknown) {
  if (!(error instanceof LearnerApiError)) return "Your application could not be submitted. Please try again.";
  const reasons = Array.isArray(error.body.reasons) ? error.body.reasons.map(String) : [];
  return reasons.length ? `${error.message} ${reasons.join(" ")}` : error.message;
}

function ApplicationAction({ opportunity, existing }: { opportunity: CareerOpportunity; existing?: LearnerApplication }) {
  const { user } = useLearnerAuth();
  const [phone, setPhone] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [resume, setResume] = useState<File | undefined>();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [application, setApplication] = useState(existing);

  useEffect(() => setApplication(existing), [existing]);

  if (application) {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertTitle className="flex flex-wrap items-center gap-2">Application received <ApplicationStatusBadge status={application.status} /></AlertTitle>
        <AlertDescription>
          Submitted {new Date(application.submitted_at).toLocaleDateString()}. Track updates from <Link href="/learn/applications">My applications</Link>.
        </AlertDescription>
      </Alert>
    );
  }

  if (!opportunity.is_open) {
    return <Alert><CalendarDays /><AlertTitle>Applications are closed</AlertTitle><AlertDescription>This opportunity remains available for your records, but it is no longer accepting applications.</AlertDescription></Alert>;
  }

  if (!opportunity.eligibility.eligible) {
    return (
      <Alert>
        <ShieldCheck />
        <AlertTitle>Requirements to meet</AlertTitle>
        <AlertDescription><ul className="mt-2 list-disc space-y-1 pl-5">{opportunity.eligibility.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></AlertDescription>
      </Alert>
    );
  }

  if (opportunity.application_mode === "EXTERNAL") {
    const destination = validatedExternalApplicationUrl(opportunity.application_url);
    return destination ? (
      <div className="space-y-3">
        <Button render={<a href={destination} target="_blank" rel="noreferrer noopener" />} nativeButton={false} size="lg">
          Continue to company website<ExternalLink data-icon="inline-end" />
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">You’ll finish this application on the employer’s secure website. Tella will not create or track an application status.</p>
      </div>
    ) : <Alert variant="destructive"><ExternalLink /><AlertTitle>Application link unavailable</AlertTitle><AlertDescription>The employer’s secure application destination could not be verified.</AlertDescription></Alert>;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!phone.trim()) { setError("Enter a contact phone number."); return; }
    if (opportunity.cover_note_required && !coverNote.trim()) { setError("Add a cover note before submitting."); return; }
    if (opportunity.resume_required && !resume) { setError("Choose a resume before submitting."); return; }
    if (resume && (resume.size > MAX_RESUME_SIZE || !RESUME_TYPES.has(resume.type))) { setError("Resume must be a PDF, DOC, or DOCX file no larger than 5 MB."); return; }
    setSubmitting(true);
    setProgress(resume ? 35 : 65);
    try {
      const created = await learnerApi.apply(opportunity.id, { contact_phone: phone.trim(), cover_note: coverNote.trim(), resume });
      setProgress(100);
      setApplication(created);
    } catch (caught) {
      setProgress(0);
      setError(applicationError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Apply through Tella</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your account identity is included with this application.</p>
      </div>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor="applicant-name">Name</FieldLabel><Input id="applicant-name" value={user?.display_name || ""} readOnly disabled /></Field>
          <Field><FieldLabel htmlFor="applicant-email">Email</FieldLabel><Input id="applicant-email" value={user?.email || ""} readOnly disabled /></Field>
        </div>
        <Field data-invalid={Boolean(error && !phone.trim())}>
          <FieldLabel htmlFor="contact-phone">Contact phone <span aria-hidden="true">*</span></FieldLabel>
          <Input id="contact-phone" type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} aria-invalid={Boolean(error && !phone.trim())} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cover-note">Cover note {opportunity.cover_note_required ? <span aria-hidden="true">*</span> : <span className="font-normal text-muted-foreground">(optional)</span>}</FieldLabel>
          <Textarea id="cover-note" required={opportunity.cover_note_required} rows={6} value={coverNote} onChange={(event) => setCoverNote(event.target.value)} placeholder="Share why this opportunity interests you." />
        </Field>
        <Field>
          <FieldLabel htmlFor="resume">Resume {opportunity.resume_required ? <span aria-hidden="true">*</span> : <span className="font-normal text-muted-foreground">(optional)</span>}</FieldLabel>
          <Input id="resume" type="file" required={opportunity.resume_required} accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setResume(event.target.files?.[0])} />
          <FieldDescription>PDF, DOC, or DOCX · up to 5 MB. Stored privately for authorized reviewers.</FieldDescription>
        </Field>
      </FieldGroup>
      {error && <FieldError>{error}</FieldError>}
      {submitting && <div role="status" className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>{resume ? "Uploading resume and submitting…" : "Submitting application…"}</span><span>{progress}%</span></div><Progress value={progress} aria-label="Application upload progress" /></div>}
      <Button type="submit" size="lg" disabled={submitting}>{submitting ? "Submitting…" : "Submit application"}</Button>
    </form>
  );
}

export function OpportunityDetail({ opportunityId }: { opportunityId: string }) {
  const [opportunity, setOpportunity] = useState<CareerOpportunity | null>(null);
  const [applications, setApplications] = useState<LearnerApplication[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const [detail, history] = await Promise.all([learnerApi.opportunity(opportunityId), learnerApi.applications()]);
      setOpportunity(detail);
      setApplications(history);
    } catch (caught) {
      if (caught instanceof LearnerApiError && caught.status === 404) setError("This opportunity is unavailable or is not shared with your learning community.");
      else setError(caught instanceof LearnerApiError ? caught.message : "This opportunity could not be loaded.");
    }
  }, [opportunityId]);
  useEffect(() => { void load(); }, [load]);
  const existing = useMemo(() => applications.find((item) => item.opportunity_id === opportunityId), [applications, opportunityId]);

  if (!opportunity && !error) return <LoadingState label="Loading opportunity…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!opportunity) return null;

  const compensation = formatCompensation({ disclosure: opportunity.compensation_disclosure, currency: opportunity.compensation_currency, minimum: opportunity.compensation_min, maximum: opportunity.compensation_max, payPeriod: opportunity.compensation_pay_period });
  const facts = [
    ["Location", formatOpportunityLocation(opportunity.workplace_mode, opportunity.physical_location, opportunity.remote_region)],
    ["Compensation", compensation],
    ["Openings", opportunity.openings == null ? "Not specified" : String(opportunity.openings)],
    ["Start date", opportunity.start_date ? new Date(opportunity.start_date).toLocaleDateString() : "To be agreed"],
    ["Duration", opportunity.duration || "Not specified"],
    ["Deadline", opportunity.application_deadline ? new Date(opportunity.application_deadline).toLocaleString() : "No fixed deadline"],
  ];

  return (
    <div className="flex flex-col gap-8">
      <Button render={<Link href="/learn/opportunities" />} nativeButton={false} variant="ghost" className="w-fit"><ArrowLeft data-icon="inline-start" />Back to opportunities</Button>
      <header className="grid gap-5 border-b pb-8 sm:grid-cols-[auto_1fr]">
        <CompanyLogo companyName={opportunity.company_name} src={opportunity.company_logo_url} className="size-16" />
        <div><div className="flex flex-wrap gap-2"><OpportunityBadge>{employmentLabels[opportunity.employment_type]}</OpportunityBadge><OpportunityBadge>{workplaceLabels[opportunity.workplace_mode]}</OpportunityBadge>{opportunity.is_featured && <OpportunityBadge tone="warning">Featured</OpportunityBadge>}<OpportunityBadge tone={opportunity.is_open ? "success" : "danger"}>{opportunity.is_open ? "Open" : "Closed"}</OpportunityBadge></div><p className="mt-4 font-medium text-brand-strong">{opportunity.company_name}</p><h1 className="mt-1 max-w-4xl text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{opportunity.title}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">{opportunity.summary}</p></div>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="min-w-0 space-y-8">
          <section><h2 className="mb-4 text-xl font-semibold tracking-tight">About the opportunity</h2><OpportunityMarkdown className="max-w-none text-sm leading-7 text-muted-foreground" >{opportunity.description_markdown}</OpportunityMarkdown></section>
          <section><h2 className="mb-4 text-xl font-semibold tracking-tight">Role details</h2><dl className="grid border-y sm:grid-cols-2">{facts.map(([label, value]) => <div key={label} className="border-b py-4 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 sm:px-4 sm:first:pl-0"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl></section>
          {opportunity.company_website && <p className="text-sm text-muted-foreground"><BriefcaseBusiness className="mr-2 inline size-4" />Learn more at <a href={opportunity.company_website} target="_blank" rel="noreferrer noopener" className="font-medium text-foreground underline underline-offset-4">{opportunity.company_name}</a>.</p>}
        </main>
        <aside className="lg:sticky lg:top-24">
          <Card><CardHeader><CardTitle>Your next step</CardTitle><CardDescription>{opportunity.application_mode === "INTERNAL" ? "Submit securely without leaving Tella." : "Continue on the employer’s website."}</CardDescription></CardHeader><CardContent><ApplicationAction opportunity={opportunity} existing={existing} /></CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
