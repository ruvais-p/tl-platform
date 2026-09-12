"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Cloud, CloudOff, Clock3, ListTree, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { LearnerApiError, learnerApi } from "@/lib/learner/api";
import { activityProgressMap, courseActivities, isComplete, publishedVersion } from "@/lib/learner/course";
import type { ActivityProgress, Course, MediaAsset, Video } from "@/lib/learner/types";
import { cn } from "@/lib/utils";
import { ActivityPill, EmptyState, ErrorState, LoadingState, ProgressBar, activityIcon } from "./common";
import { ContentRenderer, VideoRenderer } from "./content-renderer";
import { ExperimentRenderer } from "./experiment-renderer";

type ActivityData = {
  course: Course;
  progressRows: ActivityProgress[];
  videos: Video[];
  media: MediaAsset[];
};

function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        online ? "text-success" : "text-destructive",
      )}
    >
      {online ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5" />}
      {online ? "Progress sync online" : "Reconnect to save"}
    </span>
  );
}

function OutlineContent({ data, activityId }: { data: ActivityData; activityId: string }) {
  const version = publishedVersion(data.course);
  const byActivity = activityProgressMap(data.progressRows);
  return (
    <div className="flex flex-col gap-5">
      {version?.chapters.map((chapter) => (
        <div key={chapter.id} className="flex flex-col gap-2">
          <p className="px-2 text-xs font-medium text-muted-foreground">Chapter {chapter.chapter_number} · {chapter.title}</p>
          {chapter.subtopics.map((subtopic) => (
            <div key={subtopic.id} className="flex flex-col gap-1">
              <p className="px-2 py-1 text-xs text-muted-foreground">{subtopic.title}</p>
              {subtopic.activities.map((activity) => {
                const active = activity.id === activityId;
                const complete = isComplete(byActivity.get(activity.id));
                return (
                  <Link
                    key={activity.id}
                    href={`/learn/courses/${data.course.id}/activities/${activity.id}`}
                    className={cn(
                      "learner-pressable flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                    aria-current={active ? "step" : undefined}
                  >
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", complete ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                      {complete ? <Check className="size-3" /> : activityIcon(activity, "size-3")}
                    </span>
                    <span className="line-clamp-2">{activity.title}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CourseOutline({ data, activityId, mobile = false, alwaysCollapsible = false }: { data: ActivityData; activityId: string; mobile?: boolean; alwaysCollapsible?: boolean }) {
  if (mobile) {
    return (
      <details className={cn("group rounded-xl border bg-card", !alwaysCollapsible && "lg:hidden")}>
        <summary className="learner-pressable flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <ListTree className="size-4 text-muted-foreground" />
          Course outline
          <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <Separator />
        <div className="max-h-[55vh] overflow-y-auto p-3"><OutlineContent data={data} activityId={activityId} /></div>
      </details>
    );
  }
  return (
    <Card className="sticky top-24 hidden max-h-[calc(100vh-7rem)] self-start overflow-y-auto lg:flex">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ListTree className="size-4 text-muted-foreground" />Course outline</CardTitle>
      </CardHeader>
      <CardContent><OutlineContent data={data} activityId={activityId} /></CardContent>
    </Card>
  );
}

export function LearnerActivityView({ courseId, activityId }: { courseId: string; activityId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ActivityData | null>(null);
  const [currentProgress, setCurrentProgress] = useState<ActivityProgress | null>(null);
  const [activityState, setActivityState] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const startedActivity = useRef<string | null>(null);
  const openedAt = useRef(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const [course, progressRows, videos, media] = await Promise.all([
        learnerApi.course(courseId),
        learnerApi.activityProgress(courseId).catch(() => []),
        learnerApi.videos().catch(() => []),
        learnerApi.mediaAssets().catch(() => []),
      ]);
      const row = progressRows.find((item) => item.activity === activityId) ?? null;
      setData({ course, progressRows, videos, media });
      setCurrentProgress(row);
      setActivityState({ ...(row?.extra || {}), ...(row?.metadata || {}) });
      setDirty(false);
      openedAt.current = Date.now();
    } catch (caught) {
      setError(caught instanceof LearnerApiError ? caught.message : "This learning activity could not be loaded.");
    }
  }, [activityId, courseId]);

  useEffect(() => { void load(); }, [load]);

  const locations = useMemo(() => data ? courseActivities(data.course) : [], [data]);
  const index = locations.findIndex(({ activity }) => activity.id === activityId);
  const location = index >= 0 ? locations[index] : null;
  const previous = index > 0 ? locations[index - 1] : null;
  const next = index >= 0 && index < locations.length - 1 ? locations[index + 1] : null;
  const activity = location?.activity;

  useEffect(() => {
    if (!activity || currentProgress || startedActivity.current === activity.id) return;
    startedActivity.current = activity.id;
    learnerApi.startActivity(activity.id).then((row) => {
      setCurrentProgress(row);
      setData((current) => current ? { ...current, progressRows: [...current.progressRows.filter((item) => item.activity !== row.activity), row] } : current);
    }).catch((caught) => setActionError(caught instanceof LearnerApiError ? caught.message : "Progress tracking could not be started."));
  }, [activity, currentProgress]);

  function elapsedSeconds() {
    return Math.max(0, Math.round((Date.now() - openedAt.current) / 1000));
  }

  const updateProgress = useCallback((row: ActivityProgress) => {
    setCurrentProgress(row);
    setData((current) => current ? { ...current, progressRows: [...current.progressRows.filter((item) => item.activity !== row.activity), row] } : current);
  }, []);

  async function saveState() {
    if (!activity) return;
    setSaving(true); setActionError("");
    try {
      const row = await learnerApi.saveActivity(activity.id, { progress_percentage: Number(currentProgress?.progress_percentage || 0), time_spent_seconds: elapsedSeconds(), metadata: activityState });
      updateProgress(row); setDirty(false);
    } catch (caught) { setActionError(caught instanceof LearnerApiError ? caught.message : "Your progress could not be saved."); }
    finally { setSaving(false); }
  }

  const complete = useCallback(async (moveNext = false) => {
    if (!activity) return;
    setSaving(true); setActionError("");
    try {
      const row = await learnerApi.completeActivity(activity.id, { time_spent_seconds: elapsedSeconds(), metadata: activityState });
      updateProgress(row); setDirty(false);
      if (moveNext && next) router.push(`/learn/courses/${courseId}/activities/${next.activity.id}`);
    } catch (caught) { setActionError(caught instanceof LearnerApiError ? caught.message : "Completion could not be saved."); }
    finally { setSaving(false); }
  }, [activity, activityState, courseId, next, router, updateProgress]);

  const trackedProgress = useCallback(async (percentage: number, state: Record<string, unknown>, completeTracked: boolean) => {
    if (!activity) return;
    const experimentState = {
      ...activityState,
      experiment: {
        schema_version: activity.experiment?.configuration.schema_version,
        renderer: activity.experiment?.configuration.renderer,
        state,
      },
    };
    setActivityState(experimentState);
    try {
      const row = completeTracked
        ? await learnerApi.completeActivity(activity.id, { time_spent_seconds: elapsedSeconds(), metadata: experimentState })
        : await learnerApi.saveActivity(activity.id, { progress_percentage: percentage, time_spent_seconds: elapsedSeconds(), metadata: experimentState });
      updateProgress(row);
    } catch { setActionError("Interactive progress is waiting to sync. Check your connection."); }
  }, [activity, activityState, updateProgress]);

  if (!data && !error) return <LoadingState label="Loading this activity…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data || !activity || !location) return <ErrorState message="This activity is not part of the published course assigned to you." />;

  const video = data.videos.find((item) => item.activity === activity.id);
  const media = video ? data.media.find((item) => item.id === video.media_asset) : undefined;
  const percent = Number(currentProgress?.progress_percentage || 0);
  const completed = isComplete(currentProgress);
  const hasExperimentSurface = Boolean(activity.experiment) || ["EXPERIMENT", "SIMULATION", "INTERACTIVE_WORKSHOP"].includes(activity.activity_type);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost"><Link href={`/learn/courses/${courseId}`}><ArrowLeft data-icon="inline-start" />Back to course</Link></Button>
        <ConnectionStatus />
      </div>
      <CourseOutline data={data} activityId={activityId} mobile alwaysCollapsible={hasExperimentSurface} />
      <div className={cn("grid gap-4", !hasExperimentSurface && "lg:grid-cols-[260px_minmax(0,1fr)]")}>
        {!hasExperimentSurface && <CourseOutline data={data} activityId={activityId} />}
        <Card className={cn("min-w-0", hasExperimentSurface && "overflow-visible")}>
          <CardHeader>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <ActivityPill activity={activity} />
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{activity.estimated_minutes ? `${activity.estimated_minutes} min` : "Self-paced"}</span>
            </div>
            <p className="text-xs font-medium text-brand-strong">{location.chapterTitle} · {location.subtopicTitle}</p>
            <CardTitle className="max-w-4xl text-2xl sm:text-3xl">{activity.title}</CardTitle>
            {activity.description && <CardDescription className="max-w-3xl leading-6">{activity.description}</CardDescription>}
            <div className="flex items-center gap-3 pt-3"><ProgressBar value={percent} className="flex-1" label="Activity progress" /><span className="w-10 text-right text-xs font-medium tabular-nums text-muted-foreground">{Math.round(percent)}%</span></div>
          </CardHeader>

          <CardContent className="flex flex-col gap-8">
            {video && <VideoRenderer video={video} media={media} onEnded={() => void complete(false)} />}
            <ContentRenderer content={activity.content} />
            {hasExperimentSurface && (
              <section aria-labelledby="experiment-heading" className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-brand-strong">Hands-on activity</p>
                  <h2 id="experiment-heading" className="text-xl font-semibold tracking-tight">Try it yourself</h2>
                  {activity.experiment?.instructions && <p className="text-sm leading-6 text-muted-foreground">{activity.experiment.instructions}</p>}
                </div>
                <ExperimentRenderer activity={activity} state={activityState} onStateChange={(nextState) => { setActivityState(nextState); setDirty(true); }} onTrackedProgress={(value, state, done) => void trackedProgress(value, state, done)} />
              </section>
            )}
            {!video && !hasExperimentSurface && (!activity.content || !Object.keys(activity.content).length) && <EmptyState title="Lesson material is being prepared" description="The administrator has not added material to this published activity yet." />}
            {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}
          </CardContent>

          <CardFooter className="flex-col gap-3 sm:flex-row sm:justify-between">
            <div>{previous ? <Button asChild variant="ghost"><Link href={`/learn/courses/${courseId}/activities/${previous.activity.id}`}><ArrowLeft data-icon="inline-start" />Previous</Link></Button> : null}</div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {hasExperimentSurface && dirty && !completed && (
                <Button variant="outline" onClick={() => void saveState()} disabled={saving}>
                  {saving ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                  {saving ? "Saving…" : "Save progress"}
                </Button>
              )}
              {completed ? (
                next ? (
                  <Button asChild><Link href={`/learn/courses/${courseId}/activities/${next.activity.id}`}>Next activity<ArrowRight data-icon="inline-end" /></Link></Button>
                ) : (
                  <Button asChild><Link href={`/learn/courses/${courseId}`}>Course overview<CheckCircle2 data-icon="inline-end" /></Link></Button>
                )
              ) : (
                <Button onClick={() => void complete(Boolean(next))} disabled={saving}>
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  {saving ? "Saving…" : next ? "Complete & continue" : "Mark complete"}
                  {!saving ? next ? <ArrowRight data-icon="inline-end" /> : <Check data-icon="inline-end" /> : null}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
