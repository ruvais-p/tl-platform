import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { learnerOpportunity } from "@/test/opportunity-fixtures";
import { DashboardOpportunitySummary } from "./learner-dashboard";

describe("DashboardOpportunitySummary", () => {
  it("links an available structured opportunity through its platform detail", () => {
    render(<DashboardOpportunitySummary opportunity={learnerOpportunity()} />);
    expect(screen.getByText("Northstar Labs · Remote · India")).not.toBeNull();
    expect(screen.getByRole("button", { name: /View opportunity/ }).getAttribute("href")).toBe("/learn/opportunities/11111111-1111-4111-8111-111111111111");
  });

  it("links an empty summary to the catalog", () => {
    render(<DashboardOpportunitySummary />);
    expect(screen.getByText(/will appear here/)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Browse opportunities/ }).getAttribute("href")).toBe("/learn/opportunities");
  });
});
