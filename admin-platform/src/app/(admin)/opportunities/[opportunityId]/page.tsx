import { OpportunityEditor } from "@/components/opportunities/opportunity-editor";

export default async function EditOpportunityPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId } = await params;
  return <OpportunityEditor opportunityId={opportunityId} />;
}
