import { CourseChatbot } from "@/components/learner/course-chatbot";
import { CourseSupportChat } from "@/components/learner/course-support-chat";

export default async function LearnerCourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <>{children}<CourseSupportChat courseId={courseId} /><CourseChatbot courseId={courseId} /></>;
}
