import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { learnerApi } from "@/lib/learner/api";
import { learnerOpportunity } from "@/test/opportunity-fixtures";
import { OpportunitiesView } from "./opportunities-view";

vi.mock("@/lib/learner/api", () => ({ learnerApi: { opportunities: vi.fn() }, LearnerApiError: class extends Error {} }));

describe("OpportunitiesView", () => {
  beforeEach(() => vi.mocked(learnerApi.opportunities).mockResolvedValue([]));

  it("shows structured eligible and ineligible catalog entries", async () => {
    vi.mocked(learnerApi.opportunities).mockResolvedValue([
      learnerOpportunity(),
      learnerOpportunity({ id: "33333333-3333-4333-8333-333333333333", title: "Research project", eligibility: { eligible: false, reasons: ["Complete the foundation course."] } }),
    ]);
    render(<OpportunitiesView />);
    expect(screen.getByRole("status", { name: "Loading opportunities…" })).not.toBeNull();
    expect(await screen.findByText("Learning design intern")).not.toBeNull();
    expect(screen.getByText("Eligible")).not.toBeNull();
    expect(screen.getByText("Requirements to meet")).not.toBeNull();
    expect(screen.getAllByText(/₹15,000–₹20,000/)).toHaveLength(2);
  });

  it("passes employment, workplace, and search filters", async () => {
    render(<OpportunitiesView />);
    await screen.findByText("No opportunities match");
    fireEvent.change(screen.getByLabelText("Search opportunities"), { target: { value: "design" } });
    fireEvent.change(screen.getByLabelText("Employment type"), { target: { value: "INTERNSHIP" } });
    fireEvent.change(screen.getByLabelText("Workplace mode"), { target: { value: "REMOTE" } });
    await waitFor(() => expect(learnerApi.opportunities).toHaveBeenLastCalledWith({ search: "design", employment_type: "INTERNSHIP", workplace_mode: "REMOTE" }));
  });

  it("shows an actionable error state", async () => {
    vi.mocked(learnerApi.opportunities).mockRejectedValueOnce(new Error("offline"));
    render(<OpportunitiesView />);
    expect(await screen.findByText("Opportunities could not be loaded.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();
  });
});
