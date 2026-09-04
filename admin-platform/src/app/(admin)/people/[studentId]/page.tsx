import { StudentAnalyticsWorkspace } from "@/components/student-analytics-workspace";

export default async function StudentAnalyticsPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <StudentAnalyticsWorkspace studentId={studentId} />;
}
