import { CourseChatbot } from "@/components/learner/course-chatbot";

export default async function LearnerCourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <>{children}<CourseChatbot courseId={courseId} /></>;
}
