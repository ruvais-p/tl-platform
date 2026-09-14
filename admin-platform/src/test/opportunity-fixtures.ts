import type { LearnerApplication, LearnerOpportunity } from "@/lib/opportunities/types";

export function learnerOpportunity(overrides: Partial<LearnerOpportunity> = {}): LearnerOpportunity {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Learning design intern",
    company_name: "Northstar Labs",
    company_website: "https://northstar.example",
    company_logo_url: "",
    summary: "Help build learning experiences for students.",
    description_markdown: "## What you will do\n\nBuild **thoughtful** learning experiences.",
    employment_type: "INTERNSHIP",
    employment_type_label: "Internship",
    workplace_mode: "REMOTE",
    workplace_mode_label: "Remote",
    physical_location: "",
    remote_region: "India",
    openings: 2,
    compensation_disclosure: "PAID",
    compensation_currency: "INR",
    compensation_min: "15000",
    compensation_max: "20000",
    compensation_pay_period: "MONTH",
    start_date: "2026-10-01",
    duration: "3 months",
    application_deadline: "2026-10-15T12:00:00Z",
    application_mode: "INTERNAL",
    application_url: "",
    cover_note_required: true,
    resume_required: true,
    is_featured: true,
    is_open: true,
    eligibility: { eligible: true, reasons: [] },
    ...overrides,
  };
}

export function learnerApplication(overrides: Partial<LearnerApplication> = {}): LearnerApplication {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    opportunity_id: "11111111-1111-4111-8111-111111111111",
    opportunity_title: "Learning design intern",
    company_name: "Northstar Labs",
    submitted_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-02T10:00:00Z",
    status: "SUBMITTED",
    status_label: "Submitted",
    can_withdraw: true,
    has_resume: true,
    ...overrides,
  };
}
