"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Building2, GraduationCap, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { learnerApi, LearnerApiError } from "@/lib/learner/api";
import type { CareerOpportunity } from "@/lib/learner/types";
import { EmptyState, ErrorState, LoadingState, PageHeading } from "./common";

function opportunityIcon(kind: string) {
  return kind.toLowerCase().includes("intern") ? GraduationCap : kind.toLowerCase().includes("job") ? BriefcaseBusiness : Building2;
}

export function OpportunitiesView() {
  const [items, setItems] = useState<CareerOpportunity[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try { setItems(await learnerApi.opportunities()); }
    catch (caught) { setError(caught instanceof LearnerApiError ? caught.message : "Opportunities could not be loaded."); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (!items && !error) return <LoadingState label="Loading opportunities…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!items) return null;

  return (
    <div className="flex flex-col gap-7">
      <PageHeading
        eyebrow="Beyond the curriculum"
        title="Opportunities"
        description="Internships, projects, and further-learning opportunities published by your institution."
        action={
          <span className="text-sm text-muted-foreground">
            <span className="tabular-nums">{items.length}</span> available
          </span>
        }
      />
      {items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = opportunityIcon(item.kind);
            return (
              <Card key={item.id}>
                <CardHeader>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {item.kind}
                  </p>
                  <CardTitle>{item.title}</CardTitle>
                  {item.summary && <CardDescription className="line-clamp-4 leading-6">{item.summary}</CardDescription>}
                  <CardAction><Icon className="size-5 text-muted-foreground" aria-hidden="true" /></CardAction>
                </CardHeader>
                <CardFooter>
                  {item.url ? (
                    <Button asChild variant="ghost">
                      <a href={item.url} target="_blank" rel="noreferrer">View opportunity<ArrowUpRight data-icon="inline-end" /></a>
                    </Button>
                  ) : (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5" />Details from your institution</p>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No opportunities published yet" description="New internships, projects, or career opportunities will appear here when your institution publishes them." />
      )}
    </div>
  );
}
