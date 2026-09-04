"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { learnerApi, LearnerApiError } from "@/lib/learner/api";
import { derivedCourseProgress } from "@/lib/learner/course";
import type { ActivityProgress, Course } from "@/lib/learner/types";
import { CourseCard, EmptyState, ErrorState, LoadingState, PageHeading } from "./common";

export function LearnerCourseLibrary() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [progress, setProgress] = useState<ActivityProgress[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [courseRows, progressRows] = await Promise.all([learnerApi.courses(), learnerApi.activityProgress().catch(() => [])]);
      setCourses(courseRows);
      setProgress(progressRows);
    } catch (caught) {
      setError(caught instanceof LearnerApiError ? caught.message : "The learner API could not be reached.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return courses ?? [];
    return (courses ?? []).filter((course) => [course.name, course.description, course.program_name].some((value) => value.toLowerCase().includes(normalized)));
  }, [courses, query]);

  if (!courses && !error) return <LoadingState label="Loading your courses…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!courses) return null;

  return (
    <div className="flex flex-col gap-7">
      <PageHeading
        eyebrow="My learning"
        title="Courses"
        description="All published courses assigned to you by your institution."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="h-10 w-full sm:w-96">
          <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses" aria-label="Search your courses" />
          <InputGroupAddon align="inline-start"><Search /></InputGroupAddon>
        </InputGroup>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium tabular-nums text-foreground">{filtered.length}</span> of <span className="font-medium tabular-nums text-foreground">{courses.length}</span>
          </p>
          <span className="text-xs font-medium text-muted-foreground">
            Published curriculum
          </span>
        </div>
      </div>

      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((course) => <CourseCard key={course.id} course={course} progress={derivedCourseProgress(course, progress)} />)}
        </div>
      ) : (
        <EmptyState
          title={courses.length ? "No matching courses" : "No courses assigned yet"}
          description={courses.length ? "Try a different course or programme name." : "Published courses assigned by your university will appear here automatically."}
        />
      )}
    </div>
  );
}
