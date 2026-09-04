import type { Metadata } from "next";
import { LearnerCourseLibrary } from "@/components/learner/learner-course-library";

export const metadata: Metadata = { title: "My learning" };

export default function LearnerCoursesPage() {
  return <LearnerCourseLibrary />;
}
