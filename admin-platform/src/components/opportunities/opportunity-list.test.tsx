import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpportunityList } from "./opportunity-list";
import { staffOpportunityApi } from "@/lib/opportunities/staff-api";

const auth = vi.hoisted(() => ({ permissions: ["progress.view_careeropportunity", "progress.add_careeropportunity"] }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ user: { permissions: auth.permissions }, loading: false }) }));
vi.mock("@/lib/opportunities/staff-api", () => ({ staffOpportunityApi: { list: vi.fn() } }));

describe("OpportunityList", () => {
  beforeEach(() => { auth.permissions = ["progress.view_careeropportunity", "progress.add_careeropportunity"]; vi.mocked(staffOpportunityApi.list).mockResolvedValue([]); });

  it("passes combined filters to the API", async () => {
    render(<OpportunityList />);
    await waitFor(() => expect(staffOpportunityApi.list).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Employment type"), { target: { value: "INTERNSHIP" } });
    fireEvent.change(screen.getByLabelText("Workplace mode"), { target: { value: "REMOTE" } });
    await waitFor(() => expect(staffOpportunityApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ employment_type: "INTERNSHIP", workplace_mode: "REMOTE" })));
  });

  it("denies users without the view permission", () => {
    auth.permissions = [];
    render(<OpportunityList />);
    expect(screen.getByText("Access denied")).not.toBeNull();
    expect(staffOpportunityApi.list).not.toHaveBeenCalled();
  });
});
