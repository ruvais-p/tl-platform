import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { learnerApi } from "@/lib/learner/api";
import { learnerApplication } from "@/test/opportunity-fixtures";
import { ApplicationsView } from "./applications-view";

vi.mock("@/lib/learner/api", () => ({ learnerApi: { applications: vi.fn(), withdrawApplication: vi.fn(), applicationResume: vi.fn() }, LearnerApiError: class extends Error {} }));

describe("ApplicationsView", () => {
  beforeEach(() => {
    vi.mocked(learnerApi.applications).mockResolvedValue([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("isolates and links the learner's application history", async () => {
    vi.mocked(learnerApi.applications).mockResolvedValue([learnerApplication()]);
    render(<ApplicationsView />);
    expect(await screen.findByText("Learning design intern")).not.toBeNull();
    expect(screen.getByRole("button", { name: /View role/ }).getAttribute("href")).toBe("/learn/opportunities/11111111-1111-4111-8111-111111111111");
  });

  it("withdraws active applications but offers no mutation for terminal states", async () => {
    const active = learnerApplication({ has_resume: false });
    vi.mocked(learnerApi.applications).mockResolvedValue([active]);
    vi.mocked(learnerApi.withdrawApplication).mockResolvedValue({ ...active, status: "WITHDRAWN", status_label: "Withdrawn", can_withdraw: false });
    const { rerender } = render(<ApplicationsView />);
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(learnerApi.withdrawApplication).toHaveBeenCalledWith(active.id));
    expect(await screen.findByText("Withdrawn")).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull());
    rerender(<></>);
  });
});
