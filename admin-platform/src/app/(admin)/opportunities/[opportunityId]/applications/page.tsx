import { ApplicantReview } from "@/components/opportunities/applicant-review";

export default async function OpportunityApplicationsPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId } = await params;
  return <ApplicantReview opportunityId={opportunityId} />;
}
