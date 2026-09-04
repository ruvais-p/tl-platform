import type { Metadata } from "next";
import { LearnerCourseDetail } from "@/components/learner/learner-course-detail";

export const metadata: Metadata = { title: "Course" };

export default async function LearnerCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <LearnerCourseDetail courseId={courseId} />;
}
