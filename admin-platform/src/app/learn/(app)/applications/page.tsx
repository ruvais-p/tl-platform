import type { Metadata } from "next";
import { ApplicationsView } from "@/components/learner/applications-view";

export const metadata: Metadata = { title: "My applications" };

export default function ApplicationsPage() {
  return <ApplicationsView />;
}
