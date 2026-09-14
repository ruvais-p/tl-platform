"use client";

import Link from "next/link";
import { ArrowLeft, Download, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ApplicationStatusBadge } from "./opportunity-presentation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/curriculum/api";
import { staffOpportunityApi } from "@/lib/opportunities/staff-api";
import type { ApplicationStatus, StaffApplication } from "@/lib/opportunities/types";

const terminal = new Set<ApplicationStatus>(["ACCEPTED", "REJECTED", "WITHDRAWN"]);
const transitions: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  SUBMITTED: ["UNDER_REVIEW", "SHORTLISTED", "ACCEPTED", "REJECTED"],
  UNDER_REVIEW: ["SHORTLISTED", "ACCEPTED", "REJECTED"],
  SHORTLISTED: ["UNDER_REVIEW", "ACCEPTED", "REJECTED"],
};

export function ApplicantReview({ opportunityId }: { opportunityId: string }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<StaffApplication[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canView = Boolean(user?.permissions.includes("progress.view_opportunityapplication"));
  const canReview = Boolean(user?.permissions.includes("progress.review_opportunityapplication"));
  const selected = items?.find((item) => item.id === selectedId) ?? items?.[0] ?? null;

  const load = useCallback(async () => {
    if (!canView) return;
    setError("");
    try { const next = await staffOpportunityApi.applications({ opportunity: opportunityId, status: status || undefined, search }); setItems(next); if (next.length && !next.some((item) => item.id === selectedId)) setSelectedId(next[0].id); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Applicants could not be loaded."); }
  }, [canView, opportunityId, search, selectedId, status]);
  useEffect(() => { void load(); }, [load]);

  const updateSelected = (application: StaffApplication) => setItems((current) => current?.map((item) => item.id === application.id ? application : item) ?? []);
  const transition = async (nextStatus: ApplicationStatus) => {
    if (!selected) return; setBusy(true); setError("");
    try { updateSelected(await staffOpportunityApi.transition(selected.id, nextStatus)); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Status could not be updated."); }
    finally { setBusy(false); }
  };
  const saveNote = async () => {
    if (!selected) return; setBusy(true);
    try { updateSelected(await staffOpportunityApi.reviewNote(selected.id, selected.review_notes)); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Review note could not be saved."); }
    finally { setBusy(false); }
  };
  const downloadResume = async () => {
    if (!selected) return;
    try { const blob = await staffOpportunityApi.resume(selected.id); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${selected.applicant_name}-resume`; anchor.click(); URL.revokeObjectURL(url); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Resume could not be downloaded."); }
  };

  if (authLoading) return <main className="mx-auto max-w-7xl p-5 md:p-9" role="status"><Skeleton className="h-96" /></main>;
  if (!canView) return <main className="mx-auto max-w-7xl p-5 md:p-9"><Alert variant="destructive"><AlertTitle>Access denied</AlertTitle><AlertDescription>Application review permission is required.</AlertDescription></Alert></main>;

  return <main className="mx-auto flex max-w-7xl flex-col gap-6 p-5 md:p-9">
    <header><Button render={<Link href={`/opportunities/${opportunityId}`} />} nativeButton={false} variant="ghost" size="sm" className="-ml-3"><ArrowLeft data-icon="inline-start" />Opportunity</Button><h1 className="mt-3 text-3xl font-semibold tracking-tight">Applicant review</h1><p className="mt-2 text-sm text-muted-foreground">Search submitted contact snapshots, add private notes, and move active candidates through review.</p></header>
    <section aria-label="Applicant filters" className="grid gap-3 border-y py-4 sm:grid-cols-[1fr_13rem]"><label className="relative"><span className="sr-only">Search applicants</span><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search name, email, or phone" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label><span className="sr-only">Application status</span><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus | "")}><option value="">All statuses</option>{["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label></section>
    {error && <Alert variant="destructive"><AlertTitle>Review action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {items === null ? <div role="status"><Skeleton className="h-96" /><span className="sr-only">Loading applicants</span></div> : items.length === 0 ? <div className="py-16 text-center"><h2 className="text-lg font-semibold">No applicants match</h2><p className="mt-2 text-sm text-muted-foreground">Try another search or status.</p></div> : <div className="grid min-h-[34rem] overflow-hidden rounded-xl border lg:grid-cols-[22rem_1fr]">
      <div className="divide-y border-b lg:border-b-0 lg:border-r">{items.map((application) => <button type="button" key={application.id} onClick={() => setSelectedId(application.id)} className={`w-full p-4 text-left transition-colors hover:bg-muted/50 ${selected?.id === application.id ? "bg-muted" : ""}`}><div className="flex items-start justify-between gap-2"><span className="font-medium">{application.applicant_name}</span><ApplicationStatusBadge status={application.status} /></div><p className="mt-1 truncate text-sm text-muted-foreground">{application.applicant_email}</p><p className="mt-2 text-xs text-muted-foreground">Submitted {new Date(application.submitted_at).toLocaleDateString()}</p></button>)}</div>
      {selected && <article className="space-y-7 p-5 md:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><h2 className="text-xl font-semibold">{selected.applicant_name}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.applicant_email} · {selected.contact_phone}</p></div><ApplicationStatusBadge status={selected.status} /></div><section><h3 className="text-sm font-semibold">Cover note</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selected.cover_note || "No cover note provided."}</p></section>{selected.has_resume && <Button variant="outline" onClick={() => void downloadResume()}><Download data-icon="inline-start" />Download private resume</Button>}<section><label className="text-sm font-semibold">Private review notes<Textarea className="mt-2 min-h-28" value={selected.review_notes} disabled={!canReview || busy} onChange={(event) => updateSelected({ ...selected, review_notes: event.target.value })} /></label>{canReview && <Button className="mt-2" variant="outline" size="sm" disabled={busy} onClick={() => void saveNote()}>Save note</Button>}</section><section className="border-t pt-5"><h3 className="text-sm font-semibold">Next status</h3>{terminal.has(selected.status) ? <p className="mt-2 text-sm text-muted-foreground">This application is terminal and cannot be changed.</p> : canReview ? <div className="mt-3 flex flex-wrap gap-2">{transitions[selected.status]?.map((next) => <Button key={next} variant={next === "REJECTED" ? "destructive" : "outline"} size="sm" disabled={busy} onClick={() => void transition(next)}>{next.replaceAll("_", " ")}</Button>)}</div> : <p className="mt-2 text-sm text-muted-foreground">You have view-only access.</p>}</section></article>}
    </div>}
  </main>;
}
