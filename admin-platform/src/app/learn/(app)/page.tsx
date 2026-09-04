import type { Metadata } from "next";
import { LearnerDashboard } from "@/components/learner/learner-dashboard";

export const metadata: Metadata = { title: "Learning dashboard" };

export default function LearnerDashboardPage() {
  return <LearnerDashboard />;
}
