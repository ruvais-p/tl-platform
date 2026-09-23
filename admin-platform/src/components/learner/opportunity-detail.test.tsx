import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { learnerApi } from "@/lib/learner/api";
import { learnerApplication, learnerOpportunity } from "@/test/opportunity-fixtures";
import { OpportunityDetail, validatedExternalApplicationUrl } from "./opportunity-detail";

vi.mock("@/components/learner/learner-auth-provider", () => ({ useLearnerAuth: () => ({ user: { display_name: "Asha Rao", email: "asha@example.com" } }) }));
vi.mock("@/lib/learner/api", () => ({
  learnerApi: { opportunity: vi.fn(), applications: vi.fn(), apply: vi.fn() },
  LearnerApiError: class LearnerApiError extends Error { constructor(public status: number, public body: Record<string, unknown>) { super(String(body.detail || "Request failed")); } },
}));

describe("OpportunityDetail", () => {
  beforeEach(() => {
    vi.mocked(learnerApi.opportunity).mockResolvedValue(learnerOpportunity());
    vi.mocked(learnerApi.applications).mockResolvedValue([]);
    vi.mocked(learnerApi.apply).mockResolvedValue(learnerApplication());
  });

  it("renders complete structured detail and validates an internal application", async () => {
    render(<OpportunityDetail opportunityId="11111111-1111-4111-8111-111111111111" />);
    expect(await screen.findByRole("heading", { name: "Learning design intern" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "What you will do" })).not.toBeNull();
    expect(screen.getByDisplayValue("Asha Rao")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(screen.getByText("Enter a contact phone number.")).not.toBeNull();
    fireEvent.change(screen.getByLabelText(/Contact phone/), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/Cover note/), { target: { value: "I would love to help." } });
    const resume = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/Resume/), { target: { files: [resume] } });
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    await waitFor(() => expect(learnerApi.apply).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ contact_phone: "9876543210", resume })));
    expect(await screen.findByText("Application received")).not.toBeNull();
  });

  it("shows existing state for a closed opportunity instead of permitting another application", async () => {
    vi.mocked(learnerApi.opportunity).mockResolvedValue(learnerOpportunity({ is_open: false }));
    vi.mocked(learnerApi.applications).mockResolvedValue([learnerApplication({ status: "UNDER_REVIEW", status_label: "Under review" })]);
    render(<OpportunityDetail opportunityId="11111111-1111-4111-8111-111111111111" />);
    expect(await screen.findByText("Application received")).not.toBeNull();
    expect(screen.getByText("Under review")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Submit application" })).toBeNull();
  });

  it("only exposes verified HTTPS external handoffs", async () => {
    expect(validatedExternalApplicationUrl("http://unsafe.example")).toBe("");
    expect(validatedExternalApplicationUrl("javascript:alert(1)")).toBe("");
    expect(validatedExternalApplicationUrl("https://jobs.example/apply")).toBe("https://jobs.example/apply");
    vi.mocked(learnerApi.opportunity).mockResolvedValue(learnerOpportunity({ application_mode: "EXTERNAL", application_url: "https://jobs.example/apply", cover_note_required: false, resume_required: false }));
    render(<OpportunityDetail opportunityId="11111111-1111-4111-8111-111111111111" />);
    const link = await screen.findByRole("button", { name: /Continue to company website/ });
    expect(link.getAttribute("href")).toBe("https://jobs.example/apply");
    expect(screen.getByText(/will not create or track/)).not.toBeNull();
  });
});
