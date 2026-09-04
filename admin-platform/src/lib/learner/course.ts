import type { Activity, ActivityProgress, Course, CourseVersion } from "./types";

export type ActivityLocation = {
  activity: Activity;
  chapterId: string;
  chapterTitle: string;
  subtopicId: string;
  subtopicTitle: string;
};

export function publishedVersion(course: Course): CourseVersion | null {
  return course.published_version
    ?? course.versions.find((version) => version.status === "PUBLISHED")
    ?? course.versions[0]
    ?? null;
}

export function courseActivities(course: Course): ActivityLocation[] {
  const version = publishedVersion(course);
  if (!version) return [];
  return version.chapters.flatMap((chapter) =>
    chapter.subtopics.flatMap((subtopic) =>
      subtopic.activities.map((activity) => ({
        activity,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        subtopicId: subtopic.id,
        subtopicTitle: subtopic.title,
      })),
    ),
  );
}

export function isComplete(progress?: ActivityProgress | null) {
  return Boolean(progress && (progress.status.toUpperCase() === "COMPLETED" || Number(progress.progress_percentage) >= 100));
}

export function activityProgressMap(rows: ActivityProgress[]) {
  return new Map(rows.map((row) => [row.activity, row]));
}

export function derivedCourseProgress(course: Course, rows: ActivityProgress[]) {
  const required = courseActivities(course).filter(({ activity }) => activity.is_required);
  if (!required.length) return 0;
  const byActivity = activityProgressMap(rows);
  const completed = required.filter(({ activity }) => isComplete(byActivity.get(activity.id))).length;
  return Math.round((completed / required.length) * 100);
}

export function nextActivity(course: Course, rows: ActivityProgress[]) {
  const activities = courseActivities(course);
  const byActivity = activityProgressMap(rows);
  return activities.find(({ activity }) => !isComplete(byActivity.get(activity.id))) ?? activities.at(-1) ?? null;
}

export function activityLabel(type: string) {
  return type.toLowerCase().split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "L";
}
