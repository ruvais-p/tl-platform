import { describe, expect, it } from "vitest";
import { courseActivities, derivedCourseProgress, initials, nextActivity, publishedVersion } from "./course";
import type { Course } from "./types";

const course: Course = {
  id: "course",
  program: "program",
  program_name: "Mathematics",
  name: "Applied mathematics",
  code: "applied-math",
  description: "",
  status: "PUBLISHED",
  display_order: 1,
  versions: [{
    id: "version",
    course: "course",
    version_number: 1,
    name: "Current",
    status: "PUBLISHED",
    published_at: null,
    chapters: [{
      id: "chapter",
      course_version: "version",
      title: "Chapter",
      slug: "chapter",
      description: "",
      chapter_number: 1,
      estimated_minutes: 20,
      is_required: true,
      status: "PUBLISHED",
      display_order: 1,
      completion_rule: {},
      subtopics: [{
        id: "subtopic",
        chapter: "chapter",
        title: "Topic",
        slug: "topic",
        description: "",
        learning_objectives: [],
        estimated_minutes: 20,
        display_order: 1,
        is_required: true,
        status: "PUBLISHED",
        activities: [
          { id: "a1", subtopic: "subtopic", activity_type: "READING", title: "Read", description: "", display_order: 1, is_required: true, estimated_minutes: 10, completion_rule: {}, status: "PUBLISHED", content: {}, content_record: null, experiment: null },
          { id: "a2", subtopic: "subtopic", activity_type: "EXPERIMENT", title: "Try", description: "", display_order: 2, is_required: true, estimated_minutes: 10, completion_rule: {}, status: "PUBLISHED", content: {}, content_record: null, experiment: null },
        ],
      }],
    }],
  }],
};

describe("learner course helpers", () => {
  it("uses the published curriculum and preserves its ordering", () => {
    expect(publishedVersion(course)?.id).toBe("version");
    expect(courseActivities(course).map(({ activity }) => activity.id)).toEqual(["a1", "a2"]);
  });

  it("derives completion and finds the next admin-authored activity", () => {
    const progress = [{ activity: "a1", status: "COMPLETED", progress_percentage: "100" }] as never[];
    expect(derivedCourseProgress(course, progress)).toBe(50);
    expect(nextActivity(course, progress)?.activity.id).toBe("a2");
  });

  it("creates compact learner initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
  });
});
