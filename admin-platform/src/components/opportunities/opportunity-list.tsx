"use client";

import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { CompanyLogo, LifecycleBadge, employmentLabels, formatOpportunityLocation, workplaceLabels } from "./opportunity-presentation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/curriculum/api";
import { staffOpportunityApi } from "@/lib/opportunities/staff-api";
import type { EmploymentType, OpportunityLifecycle, StaffOpportunity, WorkplaceMode } from "@/lib/opportunities/types";

export function OpportunityList() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<StaffOpportunity[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("");
  const [workplaceMode, setWorkplaceMode] = useState<WorkplaceMode | "">("");
  const [lifecycle, setLifecycle] = useState<OpportunityLifecycle | "">("");
  const canView = Boolean(user?.permissions.includes("progress.view_careeropportunity"));
  const canCreate = Boolean(user?.permissions.includes("progress.add_careeropportunity"));

  const load = useCallback(async () => {
    if (!canView) return;
    setError("");
    try {
      setItems(await staffOpportunityApi.list({ search, employment_type: employmentType, workplace_mode: workplaceMode, lifecycle_status: lifecycle }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Opportunities could not be loaded.");
    }
  }, [canView, employmentType, lifecycle, search, workplaceMode]);

  useEffect(() => { void load(); }, [load]);

  if (authLoading) return <main className="mx-auto max-w-7xl space-y-4 p-5 md:p-9" role="status"><Skeleton className="h-12 w-72" /><Skeleton className="h-80" /></main>;
  if (!canView) return <main className="mx-auto max-w-7xl p-5 md:p-9"><Alert variant="destructive"><AlertTitle>Access denied</AlertTitle><AlertDescription>You do not have permission to view opportunity administration.</AlertDescription></Alert></main>;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-7 p-5 md:p-9">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Career operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Opportunities</h1><p className="mt-2 text-sm text-muted-foreground">Create structured roles, control publication, and review applicants.</p></div>
        {canCreate && <Button render={<Link href="/opportunities/new" />} nativeButton={false}><Plus data-icon="inline-start" />New opportunity</Button>}
      </header>

      <section aria-label="Opportunity filters" className="grid gap-3 border-y py-4 md:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(9rem,auto))]">
        <label className="relative"><span className="sr-only">Search opportunities</span><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, company, summary" className="pl-9" /></label>
        <label><span className="sr-only">Employment type</span><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={employmentType} onChange={(event) => setEmploymentType(event.target.value as EmploymentType | "")}><option value="">All employment</option>{Object.entries(employmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className="sr-only">Workplace mode</span><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={workplaceMode} onChange={(event) => setWorkplaceMode(event.target.value as WorkplaceMode | "")}><option value="">All workplaces</option>{Object.entries(workplaceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className="sr-only">Lifecycle status</span><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={lifecycle} onChange={(event) => setLifecycle(event.target.value as OpportunityLifecycle | "")}><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="CLOSED">Closed</option><option value="ARCHIVED">Archived</option></select></label>
      </section>

      {error ? <Alert variant="destructive"><AlertTitle>Could not load opportunities</AlertTitle><AlertDescription className="flex items-center justify-between gap-3">{error}<Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></AlertDescription></Alert> : items === null ? <div className="space-y-3" role="status"><Skeleton className="h-24" /><Skeleton className="h-24" /><span className="sr-only">Loading opportunities</span></div> : items.length === 0 ? <div className="py-16 text-center"><h2 className="text-lg font-semibold">No opportunities match</h2><p className="mt-2 text-sm text-muted-foreground">Clear the filters or create a new draft.</p><Button className="mt-5" variant="outline" onClick={() => { setSearch(""); setEmploymentType(""); setWorkplaceMode(""); setLifecycle(""); }}>Clear filters</Button></div> : (
        <div className="divide-y border-y">
          {items.map((item) => <article key={item.id} className="grid gap-4 py-5 transition-colors hover:bg-muted/30 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-3">
            <CompanyLogo companyName={item.company_name} />
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.title}</h2><LifecycleBadge status={item.lifecycle_status} />{item.is_open && <span className="text-xs font-medium text-success">Open</span>}</div><p className="mt-1 text-sm text-muted-foreground">{item.company_name} · {employmentLabels[item.employment_type]} · {workplaceLabels[item.workplace_mode]}</p><p className="mt-1 text-xs text-muted-foreground">{formatOpportunityLocation(item.workplace_mode, item.physical_location, item.remote_region)}{item.application_deadline ? ` · Deadline ${new Date(item.application_deadline).toLocaleDateString()}` : " · No deadline"}</p></div>
            <div className="flex flex-wrap gap-2"><Button render={<Link href={`/opportunities/${item.id}`} />} nativeButton={false} variant="outline" size="sm">Edit</Button><Button render={<Link href={`/opportunities/${item.id}/applications`} />} nativeButton={false} variant="ghost" size="sm"><Users data-icon="inline-start" />Applicants</Button></div>
          </article>)}
        </div>
      )}
    </main>
  );
}
