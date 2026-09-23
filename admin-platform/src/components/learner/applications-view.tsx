"use client";

import Link from "next/link";
import { ArrowRight, Download, History, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ApplicationStatusBadge, CompanyLogo } from "@/components/opportunities/opportunity-presentation";
import { Button } from "@/components/ui/button";
import { learnerApi, LearnerApiError } from "@/lib/learner/api";
import type { LearnerApplication } from "@/lib/learner/types";
import { EmptyState, ErrorState, LoadingState, PageHeading } from "./common";

export function ApplicationsView() {
  const [items, setItems] = useState<LearnerApplication[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setError("");
    try { setItems(await learnerApi.applications()); }
    catch (caught) { setError(caught instanceof LearnerApiError ? caught.message : "Applications could not be loaded."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function withdraw(application: LearnerApplication) {
    if (!window.confirm(`Withdraw your application for ${application.opportunity_title}?`)) return;
    setBusy(application.id);
    setError("");
    try {
      const updated = await learnerApi.withdrawApplication(application.id);
      setItems((current) => current?.map((item) => item.id === updated.id ? updated : item) || null);
    } catch (caught) { setError(caught instanceof LearnerApiError ? caught.message : "The application could not be withdrawn."); }
    finally { setBusy(""); }
  }

  async function downloadResume(application: LearnerApplication) {
    setBusy(application.id);
    try {
      const blob = await learnerApi.applicationResume(application.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${application.opportunity_title}-resume`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) { setError(caught instanceof LearnerApiError ? caught.message : "Your resume could not be downloaded."); }
    finally { setBusy(""); }
  }

  if (!items && !error) return <LoadingState label="Loading applications…" />;
  if (error && !items) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!items) return null;

  return (
    <div className="flex flex-col gap-7">
      <PageHeading eyebrow="Your progress" title="My applications" description="See every opportunity you applied to through Tella and follow its current status." action={<Button render={<Link href="/learn/opportunities" />} nativeButton={false} variant="outline">Find opportunities</Button>} />
      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {!items.length ? <EmptyState title="No applications yet" description="Applications submitted through Tella will appear here. External employer applications are not tracked." action={<Button render={<Link href="/learn/opportunities" />} nativeButton={false}>Browse opportunities</Button>} /> : (
        <div className="divide-y border-y">
          {items.map((application) => (
            <article key={application.id} className="grid gap-4 py-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-2">
              <CompanyLogo companyName={application.company_name} />
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-brand-strong">{application.company_name}</p><ApplicationStatusBadge status={application.status} /></div><h2 className="mt-1 text-lg font-semibold">{application.opportunity_title}</h2><p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><History className="size-3.5" />Submitted {new Date(application.submitted_at).toLocaleDateString()} · Updated {new Date(application.updated_at).toLocaleDateString()}</p></div>
              <div className="flex flex-wrap gap-2 sm:justify-end"><Button render={<Link href={`/learn/opportunities/${application.opportunity_id}`} />} nativeButton={false} variant="ghost">View role<ArrowRight data-icon="inline-end" /></Button>{application.has_resume && <Button variant="outline" disabled={busy === application.id} onClick={() => void downloadResume(application)} aria-label={`Download resume for ${application.opportunity_title}`}><Download /></Button>}{application.can_withdraw && <Button variant="outline" disabled={busy === application.id} onClick={() => void withdraw(application)}><Undo2 data-icon="inline-start" />Withdraw</Button>}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
