"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, BriefcaseBusiness, CheckCircle2, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LearnerApiError, learnerApi } from "@/lib/learner/api";
import { courseActivities, derivedCourseProgress, isComplete, nextActivity } from "@/lib/learner/course";
import type { ActivityProgress, CareerOpportunity, Course, Gamification } from "@/lib/learner/types";
import { CourseCard, EmptyState, ErrorState, LoadingState, PageHeading, ProgressBar } from "./common";
import { useLearnerAuth } from "./learner-auth-provider";

type DashboardData = {
  courses: Course[];
  activityProgress: ActivityProgress[];
  gamification: Gamification;
  opportunities: CareerOpportunity[];
};

const emptyGamification: Gamification = { total_points: 0, events: [], badges: [] };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function LearnerDashboard() {
  const { user } = useLearnerAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const courses = await learnerApi.courses();
      const [activityProgress, gamification, opportunities] = await Promise.all([
        learnerApi.activityProgress().catch(() => []),
        learnerApi.gamification().catch(() => emptyGamification),
        learnerApi.opportunities().catch(() => []),
      ]);
      setData({ courses, activityProgress, gamification, opportunities });
    } catch (caught) {
      setError(caught instanceof LearnerApiError ? caught.message : "The learner API could not be reached.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const continueTarget = (() => {
    if (!data) return null;
    const locations = data.courses.flatMap((course) => courseActivities(course).map((location) => ({ course, ...location })));
    const recent = [...data.activityProgress].sort((a, b) => new Date(b.last_accessed_at || b.updated_at).getTime() - new Date(a.last_accessed_at || a.updated_at).getTime());
    const current = recent.map((row) => locations.find(({ activity }) => activity.id === row.activity)).find(Boolean);
    if (current) {
      const next = isComplete(data.activityProgress.find((row) => row.activity === current.activity.id)) ? nextActivity(current.course, data.activityProgress) : current;
      if (next) return { course: current.course, ...next };
    }
    for (const course of data.courses) {
      const next = nextActivity(course, data.activityProgress);
      if (next) return { course, ...next };
    }
    return null;
  })();

  if (!data && !error) return <LoadingState label="Preparing your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const firstName = user?.display_name.split(" ")[0] || "Learner";
  const required = data.courses.flatMap(courseActivities).filter(({ activity }) => activity.is_required);
  const completed = required.filter(({ activity }) => isComplete(data.activityProgress.find((row) => row.activity === activity.id))).length;
  const overall = required.length ? Math.round((completed / required.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-9">
      <PageHeading
        eyebrow={`${greeting()}, ${firstName}`}
        title="Pick up where you left off."
        description="Your assigned courses, progress, and next activity are kept together here."
        action={
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            <span className="tabular-nums">{completed}</span> completed
          </span>
        }
      />

      {!data.courses.length ? (
        <EmptyState title="Your courses will appear here" description="Ask your university administrator to assign a published course to your account." />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,.75fr)]" aria-label="Continue learning">
            <Card>
              <CardHeader>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-brand-strong">
                  <BookOpen className="size-4" aria-hidden="true" />
                  Continue learning
                </p>
                {continueTarget ? (
                  <>
                    <CardTitle className="max-w-3xl text-2xl sm:text-3xl">{continueTarget.activity.title}</CardTitle>
                    <CardDescription>{continueTarget.course.name}</CardDescription>
                  </>
                ) : (
                  <>
                    <CardTitle className="text-2xl">You’re all caught up</CardTitle>
                    <CardDescription>Every required activity currently assigned to you is complete.</CardDescription>
                  </>
                )}
              </CardHeader>
              {continueTarget && (
                <>
                  <CardContent className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2"><BookOpen className="size-4" />{continueTarget.chapterTitle}</span>
                    <span className="inline-flex items-center gap-2"><Clock3 className="size-4" />{continueTarget.activity.estimated_minutes ? `${continueTarget.activity.estimated_minutes} min` : "Self-paced"}</span>
                  </CardContent>
                  <CardFooter>
                    <Button asChild size="lg">
                      <Link href={`/learn/courses/${continueTarget.course.id}/activities/${continueTarget.activity.id}`}>
                        Resume activity
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </CardFooter>
                </>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Learning progress</CardTitle>
                <CardDescription>Required activities across your courses.</CardDescription>
                <CardAction><span className="text-3xl font-semibold tracking-tight tabular-nums">{overall}%</span></CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <ProgressBar value={overall} label="Overall learning progress" />
                <div className="grid grid-cols-3 gap-3">
                  <div><p className="text-lg font-semibold tabular-nums">{data.courses.length}</p><p className="text-xs text-muted-foreground">Courses</p></div>
                  <div><p className="text-lg font-semibold tabular-nums">{data.gamification.total_points}</p><p className="text-xs text-muted-foreground">Points</p></div>
                  <div><p className="text-lg font-semibold tabular-nums">{data.gamification.badges.length}</p><p className="text-xs text-muted-foreground">Badges</p></div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="flex flex-col gap-4" aria-labelledby="courses-heading">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 id="courses-heading" className="text-xl font-semibold tracking-tight">Your courses</h2>
                <p className="text-sm text-muted-foreground">Continue an active course or start a new one.</p>
              </div>
              <Button asChild variant="ghost">
                <Link href="/learn/courses">View all<ArrowRight data-icon="inline-end" /></Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.courses.slice(0, 3).map((course) => <CourseCard key={course.id} course={course} progress={derivedCourseProgress(course, data.activityProgress)} />)}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2" aria-label="Achievements and opportunities">
            <Card>
              <CardHeader>
                <CardTitle>Recent achievements</CardTitle>
                <CardDescription>Milestones earned through completed work.</CardDescription>
                <CardAction><Award className="size-5 text-muted-foreground" aria-hidden="true" /></CardAction>
              </CardHeader>
              <CardContent>
                {data.gamification.badges.length ? (
                  <div className="flex flex-col">
                    {data.gamification.badges.slice(0, 4).map((badge, index) => (
                      <div key={badge.id}>
                        {index > 0 && <Separator />}
                        <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                          <span className="grid size-8 place-items-center rounded-lg bg-secondary text-secondary-foreground"><Award className="size-4" /></span>
                          <div className="min-w-0"><p className="truncate text-sm font-medium">{badge.label}</p><p className="text-xs text-muted-foreground">Badge earned</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">Complete activities to begin collecting achievements.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Opportunities</CardTitle>
                <CardDescription>Published by your institution.</CardDescription>
                <CardAction><BriefcaseBusiness className="size-5 text-muted-foreground" aria-hidden="true" /></CardAction>
              </CardHeader>
              <CardContent>
                {data.opportunities[0] ? (
                  <div className="flex flex-col gap-2">
                    <h3 className="font-medium">{data.opportunities[0].title}</h3>
                    <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{data.opportunities[0].summary}</p>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">New internships, projects, and further-learning opportunities will appear here.</p>
                )}
              </CardContent>
              <CardFooter>
                <Button asChild variant="ghost">
                  <Link href="/learn/opportunities">Browse opportunities<ArrowRight data-icon="inline-end" /></Link>
                </Button>
              </CardFooter>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
