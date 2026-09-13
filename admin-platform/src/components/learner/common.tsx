import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FlaskConical,
  Layers3,
  Play,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { activityLabel, courseActivities } from "@/lib/learner/course";
import type { Activity, Course } from "@/lib/learner/types";
import { cn } from "@/lib/utils";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <p className="text-sm font-medium text-brand-strong">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function ProgressBar({
  value,
  className,
  label = "Course progress",
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const bounded = Math.max(0, Math.min(100, Math.round(value)));
  return <Progress value={bounded} aria-label={label} className={cn("w-full", className)} />;
}

export function CourseCard({ course, progress }: { course: Course; progress: number }) {
  const activities = courseActivities(course);
  const minutes = activities.reduce((sum, { activity }) => sum + activity.estimated_minutes, 0);
  const boundedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <Card size="sm" className="h-full">
      <CardHeader className="gap-2">
        <CardTitle className="line-clamp-2 min-h-10 text-base">{course.name}</CardTitle>
        <CardDescription className="line-clamp-1 text-xs font-medium">{course.program_name}</CardDescription>
        <CardAction>
          <span className="grid size-8 place-items-center rounded-lg bg-secondary text-secondary-foreground" aria-hidden="true">
            <BookOpen className="size-4" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Layers3 className="size-3.5" aria-hidden="true" />
            {activities.length} {activities.length === 1 ? "activity" : "activities"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {minutes ? `${minutes} min` : "Self-paced"}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">Course progress</span>
            <span className="font-medium tabular-nums text-foreground">{boundedProgress}%</span>
          </div>
          <ProgressBar value={boundedProgress} label={`${course.name} progress`} />
        </div>
        <Button asChild variant="secondary" className="w-full justify-between">
          <Link href={`/learn/courses/${course.id}`}>
            {boundedProgress > 0 ? "Continue course" : "Start course"}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function activityIcon(activity: Activity, className = "") {
  const type = activity.activity_type;
  const Icon = type.includes("VIDEO")
    ? Play
    : type.includes("EXPERIMENT") || type.includes("SIMULATION") || type.includes("INTERACTIVE")
      ? FlaskConical
      : type.includes("OVERVIEW") || type.includes("READING") || type.includes("PDF")
        ? BookOpen
        : Layers3;
  return <Icon className={cn("size-4", className)} aria-hidden="true" />;
}

export function ActivityPill({ activity }: { activity: Activity }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {activityIcon(activity, "size-3")}
      {activityLabel(activity.activity_type)}
    </span>
  );
}

export function LoadingState({ label = "Loading your learning space…" }: { label?: string }) {
  return (
    <div className="flex min-h-[420px] flex-col gap-5 py-8" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-full max-w-sm" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-52 lg:col-span-2" />
        <Skeleton className="h-52" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="hidden h-56 lg:block" />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="grid min-h-[380px] place-items-center">
      <Alert variant="destructive" className="max-w-lg">
        <CircleAlert />
        <AlertTitle>We couldn’t load this yet</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        {onRetry && (
          <div className="col-start-2 mt-3">
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw data-icon="inline-start" />
              Try again
            </Button>
          </div>
        )}
      </Alert>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <Empty className="min-h-64 border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon"><CheckCircle2 /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
