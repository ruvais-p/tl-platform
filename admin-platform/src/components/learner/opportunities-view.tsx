"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CompanyLogo, OpportunityBadge, employmentLabels, formatCompensation, formatOpportunityLocation, workplaceLabels } from "@/components/opportunities/opportunity-presentation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { learnerApi, LearnerApiError } from "@/lib/learner/api";
import type { CareerOpportunity } from "@/lib/learner/types";
import type { EmploymentType, WorkplaceMode } from "@/lib/opportunities/types";
import { EmptyState, ErrorState, LoadingState, PageHeading } from "./common";

export function OpportunitiesView() {
  const [items, setItems] = useState<CareerOpportunity[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("");
  const [workplaceMode, setWorkplaceMode] = useState<WorkplaceMode | "">("");
  const load = useCallback(async () => {
    setError("");
    try { setItems(await learnerApi.opportunities({ search, employment_type: employmentType || undefined, workplace_mode: workplaceMode || undefined })); }
    catch (caught) { setError(caught instanceof LearnerApiError ? caught.message : "Opportunities could not be loaded."); }
  }, [employmentType, search, workplaceMode]);
  useEffect(() => { void load(); }, [load]);

  if (!items && !error) return <LoadingState label="Loading opportunities…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!items) return null;

  return <div className="flex flex-col gap-7">
    <PageHeading eyebrow="Beyond the curriculum" title="Opportunities" description="Explore roles selected for your learning community and see what you need before applying." action={<Button render={<Link href="/learn/applications" />} nativeButton={false} variant="outline">My applications</Button>} />
    <section aria-label="Opportunity filters" className="grid gap-3 rounded-2xl bg-muted/65 p-3 sm:grid-cols-[1fr_12rem_12rem]">
      <label className="relative"><span className="sr-only">Search opportunities</span><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="bg-background pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roles or companies" /></label>
      <label><span className="sr-only">Employment type</span><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={employmentType} onChange={(event) => setEmploymentType(event.target.value as EmploymentType | "")}><option value="">All employment</option>{Object.entries(employmentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label><span className="sr-only">Workplace mode</span><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={workplaceMode} onChange={(event) => setWorkplaceMode(event.target.value as WorkplaceMode | "")}><option value="">All workplaces</option>{Object.entries(workplaceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </section>
    {items.length === 0 ? <EmptyState title="No opportunities match" description="Try clearing your search and filters, or check again when new roles are published." action={<Button variant="outline" onClick={() => { setSearch(""); setEmploymentType(""); setWorkplaceMode(""); }}>Clear filters</Button>} /> : <div className="divide-y border-y">
      {items.map((item) => <article key={item.id} className="group grid gap-4 py-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-2">
        <CompanyLogo companyName={item.company_name} src={item.company_logo_url} className="size-14" />
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-brand-strong">{item.company_name}</p>{item.is_featured && <OpportunityBadge tone="warning">Featured</OpportunityBadge>}<OpportunityBadge tone={item.eligibility.eligible ? "success" : "neutral"}>{item.eligibility.eligible ? "Eligible" : "Requirements to meet"}</OpportunityBadge></div><h2 className="mt-1 text-xl font-semibold tracking-tight">{item.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.summary}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>{employmentLabels[item.employment_type]} · {workplaceLabels[item.workplace_mode]}</span><span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{formatOpportunityLocation(item.workplace_mode, item.physical_location, item.remote_region)}</span><span>{formatCompensation({ disclosure: item.compensation_disclosure, currency: item.compensation_currency, minimum: item.compensation_min, maximum: item.compensation_max, payPeriod: item.compensation_pay_period })}</span>{item.application_deadline && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />Apply by {new Date(item.application_deadline).toLocaleDateString()}</span>}</div></div>
        <Button render={<Link href={`/learn/opportunities/${item.id}`} />} nativeButton={false} variant="ghost">View details<ArrowRight data-icon="inline-end" /></Button>
      </article>)}
    </div>}
  </div>;
}
