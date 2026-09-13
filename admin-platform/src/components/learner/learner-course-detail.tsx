"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, ChevronDown, Clock3, Layers3, PlayCircle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LearnerApiError, learnerApi } from "@/lib/learner/api";
import { activityProgressMap, courseActivities, derivedCourseProgress, isComplete, nextActivity, publishedVersion } from "@/lib/learner/course";
import type { ActivityProgress, Course, LearningCheck } from "@/lib/learner/types";
import { cn } from "@/lib/utils";
import { ActivityPill, EmptyState, ErrorState, LoadingState, ProgressBar, activityIcon } from "./common";

export function LearnerCourseDetail({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<ActivityProgress[]>([]);
  const [checks, setChecks] = useState<LearningCheck[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [courseRow, progressRows, checkRows] = await Promise.all([
        learnerApi.course(courseId),
        learnerApi.activityProgress(courseId).catch(() => []),
        learnerApi.learningChecks().catch(() => []),
      ]);
      setCourse(courseRow);
      setProgress(progressRows);
      setChecks(checkRows);
    } catch (caught) {
      setError(caught instanceof LearnerApiError ? caught.message : "This course could not be loaded.");
    }
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);
  const progressByActivity = useMemo(() => activityProgressMap(progress), [progress]);

  if (!course && !error) return <LoadingState label="Opening your course…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!course) return null;

  const version = publishedVersion(course);
  const activities = courseActivities(course);
  const percent = derivedCourseProgress(course, progress);
  const upcoming = nextActivity(course, progress);
  const totalMinutes = activities.reduce((sum, { activity }) => sum + activity.estimated_minutes, 0);
  const completeCount = activities.filter(({ activity }) => isComplete(progressByActivity.get(activity.id))).length;

  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" className="self-start">
        <Link href="/learn/courses"><ArrowLeft data-icon="inline-start" />Back to courses</Link>
      </Button>

      <Card>
        <CardHeader>
          <p className="mb-2 text-sm font-medium text-brand-strong">
            {course.program_name}
          </p>
          <CardTitle className="max-w-4xl text-3xl sm:text-4xl">{course.name}</CardTitle>
          {course.description && <CardDescription className="max-w-3xl text-sm leading-6">{course.description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2"><Layers3 className="size-4" />{version?.chapters.length || 0} chapters</span>
          <span className="inline-flex items-center gap-2"><BookOpenCheck className="size-4" />{activities.length} activities</span>
          <span className="inline-flex items-center gap-2"><Clock3 className="size-4" />{totalMinutes ? `${totalMinutes} min` : "Self-paced"}</span>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-w-0 flex-col gap-4" aria-labelledby="course-content-heading">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="course-content-heading" className="text-xl font-semibold tracking-tight">Course content</h2>
              <p className="text-sm text-muted-foreground">Work through each chapter in order or revisit completed material.</p>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{percent}% complete</span>
          </div>

          {version?.chapters.length ? (
            <div className="flex flex-col gap-3">
              {version.chapters.map((chapter, chapterIndex) => {
                const chapterActivities = chapter.subtopics.flatMap((subtopic) => subtopic.activities);
                const chapterComplete = chapterActivities.filter((activity) => isComplete(progressByActivity.get(activity.id))).length;
                const chapterFinished = chapterComplete === chapterActivities.length && chapterActivities.length > 0;
                const check = checks.find((item) => item.chapter === chapter.id);
                return (
                  <details key={chapter.id} open={chapterIndex === 0} className="group overflow-hidden rounded-xl border bg-card shadow-xs">
                    <summary className="learner-pressable flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5 [&::-webkit-details-marker]:hidden">
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold tabular-nums", chapterFinished ? "bg-success/10 text-success" : "bg-secondary text-secondary-foreground")}>
                        {chapterFinished ? <Check className="size-4" /> : String(chapterIndex + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-muted-foreground">Chapter {chapter.chapter_number}</span>
                        <span className="mt-0.5 block truncate font-medium">{chapter.title}</span>
                      </span>
                      <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">{chapterComplete}/{chapterActivities.length}</span>
                      <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <Separator />
                    <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
                      {chapter.description && <p className="text-sm leading-6 text-muted-foreground">{chapter.description}</p>}
                      {chapter.subtopics.map((subtopic) => (
                        <div key={subtopic.id} className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 px-1">
                            <Target className="size-3.5 text-muted-foreground" />
                            <h3 className="text-xs font-medium text-muted-foreground">{subtopic.title}</h3>
                          </div>
                          <div className="flex flex-col gap-1">
                            {subtopic.activities.map((activity) => {
                              const row = progressByActivity.get(activity.id);
                              const complete = isComplete(row);
                              const started = row && Number(row.progress_percentage) > 0;
                              return (
                                <Link
                                  key={activity.id}
                                  href={`/learn/courses/${course.id}/activities/${activity.id}`}
                                  className="learner-pressable group/activity flex min-h-14 items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-muted/65 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                                >
                                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", complete ? "bg-success/10 text-success" : started ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                                    {complete ? <Check className="size-4" /> : activityIcon(activity)}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">{activity.title}</span>
                                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{activity.estimated_minutes ? `${activity.estimated_minutes} min` : "Self-paced"}</span>
                                      {activity.is_required && <span>Required</span>}
                                    </span>
                                  </span>
                                  <span className="hidden sm:block"><ActivityPill activity={activity} /></span>
                                  <ArrowRight className="hidden size-4 text-muted-foreground transition-transform duration-150 group-hover/activity:translate-x-0.5 sm:block" />
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {check && (
                        <Link href={`/learn/courses/${course.id}/checks/${check.id}`} className="learner-pressable flex min-h-14 items-center gap-3 rounded-lg border bg-background px-3 py-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"><BookOpenCheck className="size-4" /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{check.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{check.questions.length} questions · {check.passing_score}% to pass</span></span>
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </Link>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Course content is being prepared" description="Published chapters and activities will appear here when your institution adds them." />
          )}
        </section>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Your progress</CardTitle>
              <CardDescription>{completeCount} of {activities.length} activities finished</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{percent}%</p>
              <ProgressBar value={percent} />
            </CardContent>
            {upcoming && (
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/learn/courses/${course.id}/activities/${upcoming.activity.id}`}>
                    <PlayCircle data-icon="inline-start" />
                    {percent ? "Continue learning" : "Start course"}
                  </Link>
                </Button>
              </CardFooter>
            )}
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Progress sync</CardTitle>
              <CardDescription>Your activity state is saved online and stays current across supported devices.</CardDescription>
            </CardHeader>
          </Card>
        </aside>
      </div>
    </div>
  );
}
