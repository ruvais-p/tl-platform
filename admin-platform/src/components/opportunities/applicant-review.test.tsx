import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { staffOpportunityApi } from "@/lib/opportunities/staff-api";
import type { StaffApplication } from "@/lib/opportunities/types";
import { ApplicantReview } from "./applicant-review";

vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ user: { permissions: ["progress.view_opportunityapplication", "progress.review_opportunityapplication"] }, loading: false }) }));
vi.mock("@/lib/opportunities/staff-api", () => ({ staffOpportunityApi: { applications: vi.fn(), transition: vi.fn(), reviewNote: vi.fn(), resume: vi.fn() } }));

const application = { id: "application-1", opportunity: "opportunity-1", opportunity_id: "opportunity-1", opportunity_title: "Role", company_name: "Tella", applicant: "learner-1", applicant_name: "Asha Rao", applicant_email: "asha@example.com", contact_phone: "12345", cover_note: "Private cover note", created_at: "2026-01-01", submitted_at: "2026-01-01", updated_at: "2026-01-01", status: "REJECTED", status_label: "Rejected", can_withdraw: false, has_resume: true, review_notes: "Private staff note", reviewed_by_email: "reviewer@example.com", reviewed_at: "2026-01-02" } as StaffApplication;

describe("ApplicantReview", () => {
  beforeEach(() => vi.mocked(staffOpportunityApi.applications).mockResolvedValue([application]));

  it("shows reviewer-only detail and terminal-state guidance", async () => {
    render(<ApplicantReview opportunityId="opportunity-1" />);
    await waitFor(() => expect(screen.getByText("Private cover note")).not.toBeNull());
    expect(screen.getByDisplayValue("Private staff note")).not.toBeNull();
    expect(screen.getByText("This application is terminal and cannot be changed.")).not.toBeNull();
  });

  it("renders a responsive empty state", async () => {
    vi.mocked(staffOpportunityApi.applications).mockResolvedValue([]);
    render(<ApplicantReview opportunityId="opportunity-1" />);
    await waitFor(() => expect(screen.getByText("No applicants match")).not.toBeNull());
  });
});
