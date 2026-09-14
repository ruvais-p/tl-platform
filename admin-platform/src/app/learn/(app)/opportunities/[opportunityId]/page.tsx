import type { Metadata } from "next";
import { OpportunityDetail } from "@/components/learner/opportunity-detail";

export const metadata: Metadata = { title: "Opportunity" };

export default async function OpportunityDetailPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId } = await params;
  return <OpportunityDetail opportunityId={opportunityId} />;
}
