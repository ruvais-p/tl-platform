import type { Metadata } from "next";
import { LearningCheckView } from "@/components/learner/learning-check-view";

export const metadata: Metadata = { title: "Learning check" };

export default async function LearningCheckPage({ params }: { params: Promise<{ courseId: string; checkId: string }> }) {
  const { courseId, checkId } = await params;
  return <LearningCheckView courseId={courseId} checkId={checkId} />;
}
