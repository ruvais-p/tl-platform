import type { Metadata } from "next";
import { LearnerActivityView } from "@/components/learner/learner-activity-view";

export const metadata: Metadata = { title: "Learning activity" };

export default async function LearnerActivityPage({ params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = await params;
  return <LearnerActivityView courseId={courseId} activityId={activityId} />;
}
