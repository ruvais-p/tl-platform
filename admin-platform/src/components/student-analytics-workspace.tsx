"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Award, BookOpen, CheckCircle2, ChevronRight, Clock3, RefreshCw, Target } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/curriculum/api";
import { peopleApi } from "@/lib/people/api";
import type { CourseAnalytics, StudentAnalytics } from "@/lib/people/types";

const displayStatus = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const number = (value: number | string) => Number(value || 0);
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not recorded";
const duration = (seconds: number) => seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.round(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h ${Math.round(seconds % 3600 / 60)}m`;

function ProgressBar({ value, label }: { value: number | string; label?: string }) {
  const percent = Math.min(100, Math.max(0, number(value)));
  return <div className="min-w-0"><div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{label || "Completion"}</span><span className="font-semibold tabular-nums">{percent.toFixed(0)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-700 transition-[width] duration-500" style={{ width: `${percent}%` }} /></div></div>;
}

function CourseDetail({ course }: { course: CourseAnalytics }) {
  return <details className="group border-b" open={course.status === "IN_PROGRESS"}>
    <summary className="grid cursor-pointer list-none gap-4 py-6 md:grid-cols-[minmax(0,1fr)_180px_110px_20px] md:items-center">
      <div><p className="text-xs text-muted-foreground">{course.program_name} · {course.version_name}</p><h3 className="mt-1 font-semibold">{course.course_name}</h3><p className="mt-1 text-xs text-muted-foreground">Enrolled {date(course.enrolled_at)}</p></div>
      <ProgressBar value={course.progress_percentage} />
      <Badge variant="outline" className="w-fit">{displayStatus(course.status)}</Badge>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
    </summary>
    <div className="pb-7">
      <div className="grid gap-4 border-y bg-white px-4 py-4 text-xs sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-muted-foreground">Chapters</p><p className="mt-1 font-semibold">{course.completed_chapters} / {course.total_chapters}</p></div><div><p className="text-muted-foreground">Average score</p><p className="mt-1 font-semibold">{number(course.average_score).toFixed(1)}%</p></div><div><p className="text-muted-foreground">Last activity</p><p className="mt-1 font-semibold">{date(course.last_activity_at)}</p></div><div><p className="text-muted-foreground">Enrollment status</p><p className="mt-1 font-semibold">{displayStatus(course.enrollment_status)}</p></div></div>
      <div className="mt-5 space-y-3">{course.chapters.map((chapter) => <details key={chapter.id} className="rounded-lg border bg-white px-4"><summary className="grid cursor-pointer list-none gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_160px_100px] sm:items-center"><div><p className="text-xs text-muted-foreground">Chapter {chapter.chapter_number}</p><p className="mt-1 text-sm font-semibold">{chapter.title}</p></div><ProgressBar value={chapter.progress_percentage} /><span className="text-xs text-muted-foreground">{chapter.completed_subtopics}/{chapter.total_subtopics} topics</span></summary>
        <div className="border-t pb-4">{chapter.subtopics.map((subtopic) => <div key={subtopic.id} className="border-b py-4 last:border-0"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_100px] sm:items-center"><p className="text-sm font-medium">{subtopic.title}</p><ProgressBar value={subtopic.progress_percentage} /><span className="text-xs text-muted-foreground">{subtopic.completed_activities}/{subtopic.total_required_activities} activities</span></div><div className="mt-3 ml-3 divide-y border-l pl-4">{subtopic.activities.map((activity) => <div key={activity.id} className="grid gap-2 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_90px_100px_90px]"><div><p className="font-medium">{activity.title}</p><p className="mt-1 text-muted-foreground">{displayStatus(activity.activity_type)}{activity.is_required ? " · Required" : ""}</p></div><span>{number(activity.progress_percentage).toFixed(0)}% complete</span><span>{duration(activity.time_spent_seconds)}</span><span>{activity.attempt_count} attempt{activity.attempt_count === 1 ? "" : "s"}</span></div>)}</div></div>)}
          {chapter.assessments.length > 0 && <div className="mt-3 border-t pt-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Assessment attempts</p><div className="mt-2 divide-y">{chapter.assessments.map((attempt) => <div key={attempt.id} className="grid gap-2 py-3 text-xs sm:grid-cols-[1fr_80px_100px_80px]"><span>{attempt.title} · Attempt {attempt.attempt_number}</span><span>{attempt.percentage === null ? "Pending" : `${number(attempt.percentage).toFixed(0)}%`}</span><span>{displayStatus(attempt.status)}</span><span>{attempt.passed === null ? "—" : attempt.passed ? "Passed" : "Not passed"}</span></div>)}</div></div>}
        </div>
      </details>)}</div>
    </div>
  </details>;
}

export function StudentAnalyticsWorkspace({ studentId }: { studentId: string }) {
  const [data, setData] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData(await peopleApi.studentAnalytics(studentId)); } catch (requestError) { setError(requestError instanceof ApiError ? requestError.message : "Could not load student performance."); } finally { setLoading(false); } }, [studentId]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <main className="grid min-h-[70vh] place-items-center text-sm text-muted-foreground" role="status">Loading student performance…</main>;
  if (!data) return <main className="mx-auto max-w-7xl p-5 md:p-9"><Alert variant="destructive"><AlertDescription>{error || "Student not found."}</AlertDescription></Alert><Button variant="outline" className="mt-4" onClick={load}><RefreshCw />Retry</Button></main>;
  const { student, summary } = data;
  return <main className="mx-auto max-w-7xl p-5 md:p-9">
    <Button asChild variant="ghost" className="-ml-2 mb-5"><Link href="/people"><ArrowLeft />People</Link></Button>
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-full bg-emerald-800 text-lg font-semibold text-white">{student.first_name[0]}{student.last_name[0]}</span><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">Student performance</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.035em]">{student.display_name}</h1><p className="mt-1 text-sm text-muted-foreground">{student.email} · {student.is_active ? "Active account" : "Inactive account"}</p></div></div><Badge variant="outline">Joined {date(student.date_joined)}</Badge></header>
    {error && <Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}
    <section aria-label="Performance summary" className="mt-8 grid border-y sm:grid-cols-3 lg:grid-cols-6">{[
      [BookOpen, "Assigned", summary.assigned_courses], [CheckCircle2, "Completed", summary.completed_courses], [Target, "Avg. completion", `${number(summary.average_completion).toFixed(0)}%`], [Target, "Avg. score", `${number(summary.average_score).toFixed(1)}%`], [Clock3, "Time spent", duration(summary.time_spent_seconds)], [Award, "Points / badges", `${summary.total_points} / ${summary.badges_earned}`],
    ].map(([Icon, label, value], index) => { const SummaryIcon = Icon as typeof BookOpen; return <div key={String(label)} className={`py-5 sm:px-4 ${index ? "border-t sm:border-l sm:border-t-0" : ""}`}><SummaryIcon className="size-4 text-emerald-700" /><p className="mt-3 text-xs text-muted-foreground">{String(label)}</p><p className="mt-1 text-xl font-semibold tabular-nums">{String(value)}</p></div>; })}</section>
    <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_290px]">
      <section><div><h2 className="text-lg font-semibold">Course performance</h2><p className="mt-1 text-xs text-muted-foreground">Completion, scores, activity time, and attempts for every enrollment.</p></div>{data.courses.length ? <div className="mt-4 border-t">{data.courses.map((course) => <CourseDetail key={course.enrollment_id} course={course} />)}</div> : <div className="mt-5 grid min-h-52 place-items-center border-y text-center"><div><BookOpen className="mx-auto size-8 text-emerald-700" /><p className="mt-3 font-medium">No assigned courses</p><p className="mt-1 text-xs text-muted-foreground">Course progress will appear after enrollment.</p></div></div>}</section>
      <aside className="space-y-8"><section className="border-t pt-5"><h2 className="text-sm font-semibold">Student groups</h2><div className="mt-3 space-y-3">{data.groups.length ? data.groups.map((group) => <div key={group.id}><p className="text-sm font-medium">{group.name}</p><p className="mt-1 text-xs text-muted-foreground">{group.grade || "No grade"} · {group.academic_year}</p><p className="mt-1 text-xs text-muted-foreground">Teacher: {group.teacher || "Unassigned"}</p></div>) : <p className="text-xs text-muted-foreground">No student group membership.</p>}</div></section>
        <section className="border-t pt-5"><h2 className="text-sm font-semibold">Assignment history</h2><div className="mt-3 space-y-4">{data.assignments.length ? data.assignments.map((assignment) => <div key={assignment.id}><p className="text-sm font-medium">{assignment.course_name}</p><p className="mt-1 text-xs text-muted-foreground">Via {assignment.source} · {displayStatus(assignment.status)}</p><p className="mt-1 text-xs text-muted-foreground">Due {assignment.due_date ? date(assignment.due_date) : "date not set"}</p></div>) : <p className="text-xs text-muted-foreground">No assignment records.</p>}</div></section>
        <section className="border-t pt-5"><h2 className="text-sm font-semibold">Badges earned</h2><div className="mt-3 flex flex-wrap gap-2">{data.badges.length ? data.badges.map((badge) => <Badge key={`${badge.code}-${badge.earned_at}`} variant="outline"><Award />{badge.label}</Badge>) : <p className="text-xs text-muted-foreground">No badges earned yet.</p>}</div></section>
      </aside>
    </div>
  </main>;
}
