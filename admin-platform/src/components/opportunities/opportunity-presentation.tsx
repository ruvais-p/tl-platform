"use client";

import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus, CompensationDisclosure, EmploymentType, OpportunityLifecycle, PayPeriod, WorkplaceMode } from "@/lib/opportunities/types";
import { cn } from "@/lib/utils";

export const employmentLabels: Record<EmploymentType, string> = {
  INTERNSHIP: "Internship",
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  APPRENTICESHIP: "Apprenticeship",
  PROJECT: "Project",
};
export const workplaceLabels: Record<WorkplaceMode, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  IN_OFFICE: "In office",
};
export const lifecycleLabels: Record<OpportunityLifecycle, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};
export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  SHORTLISTED: "Shortlisted",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const payPeriodLabels: Record<PayPeriod, string> = {
  HOUR: "hour",
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
  PROJECT: "project",
};

export function companyInitials(companyName: string) {
  const initials = companyName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
  return initials.toUpperCase() || "OP";
}

export function formatOpportunityLocation(mode: WorkplaceMode, physicalLocation: string, remoteRegion: string) {
  if (mode === "REMOTE") return remoteRegion ? `Remote · ${remoteRegion}` : "Remote";
  return physicalLocation || workplaceLabels[mode];
}

export function formatCompensation({ disclosure, currency, minimum, maximum, payPeriod }: {
  disclosure: CompensationDisclosure;
  currency: string;
  minimum: string | number | null;
  maximum: string | number | null;
  payPeriod: PayPeriod | "";
}) {
  if (disclosure === "NOT_DISCLOSED") return "Compensation not disclosed";
  if (disclosure === "UNPAID") return "Unpaid";
  const format = (value: string | number) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: currency || "INR", maximumFractionDigits: 0,
  }).format(Number(value));
  let amount = "Paid";
  if (minimum != null && maximum != null) amount = Number(minimum) === Number(maximum) ? format(minimum) : `${format(minimum)}–${format(maximum)}`;
  else if (minimum != null) amount = `From ${format(minimum)}`;
  else if (maximum != null) amount = `Up to ${format(maximum)}`;
  return payPeriod && amount !== "Paid" ? `${amount} / ${payPeriodLabels[payPeriod]}` : amount;
}

export function CompanyLogo({ companyName, src, className }: { companyName: string; src?: string | null; className?: string }) {
  return (
    <span className={cn("relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-sm font-semibold text-primary", className)} aria-label={`${companyName} logo`}>
      {companyInitials(companyName)}
      {/* Employer logos may come from arbitrary validated media origins, so a native image preserves the initials fallback without remote-host configuration. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="absolute inset-0 size-full bg-background object-cover" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
    </span>
  );
}

export function OpportunityBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <Badge variant={tone === "danger" ? "destructive" : tone === "neutral" ? "outline" : "secondary"} className={cn(tone === "success" && "bg-success/12 text-success", tone === "warning" && "bg-warning/20 text-warning-foreground")}>{children}</Badge>;
}

export function LifecycleBadge({ status }: { status: OpportunityLifecycle }) {
  return <OpportunityBadge tone={status === "PUBLISHED" ? "success" : status === "ARCHIVED" ? "neutral" : status === "CLOSED" ? "danger" : "warning"}>{lifecycleLabels[status]}</OpportunityBadge>;
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const tone = status === "ACCEPTED" ? "success" : status === "REJECTED" ? "danger" : status === "WITHDRAWN" ? "neutral" : status === "SHORTLISTED" ? "warning" : "neutral";
  return <OpportunityBadge tone={tone}>{applicationStatusLabels[status]}</OpportunityBadge>;
}
