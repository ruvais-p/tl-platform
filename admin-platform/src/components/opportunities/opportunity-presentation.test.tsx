import { describe, expect, it } from "vitest";

import type { ApplicationStatus, EmploymentType, OpportunityLifecycle, WorkplaceMode } from "@/lib/opportunities/types";
import { applicationStatusLabels, companyInitials, employmentLabels, formatCompensation, formatOpportunityLocation, lifecycleLabels, workplaceLabels } from "./opportunity-presentation";

describe("opportunity presentation", () => {
  it("labels every controlled enum", () => {
    expect(Object.keys(employmentLabels).sort()).toEqual((["INTERNSHIP", "FULL_TIME", "PART_TIME", "CONTRACT", "APPRENTICESHIP", "PROJECT"] satisfies EmploymentType[]).sort());
    expect(Object.keys(workplaceLabels).sort()).toEqual((["REMOTE", "HYBRID", "IN_OFFICE"] satisfies WorkplaceMode[]).sort());
    expect(Object.keys(lifecycleLabels).sort()).toEqual((["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"] satisfies OpportunityLifecycle[]).sort());
    expect(Object.keys(applicationStatusLabels).sort()).toEqual((["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN"] satisfies ApplicationStatus[]).sort());
  });

  it("formats paid, unpaid, undisclosed, range, and optional amounts", () => {
    expect(formatCompensation({ disclosure: "NOT_DISCLOSED", currency: "", minimum: null, maximum: null, payPeriod: "" })).toBe("Compensation not disclosed");
    expect(formatCompensation({ disclosure: "UNPAID", currency: "", minimum: null, maximum: null, payPeriod: "" })).toBe("Unpaid");
    expect(formatCompensation({ disclosure: "PAID", currency: "INR", minimum: "20000", maximum: "30000", payPeriod: "MONTH" })).toContain("/ month");
    expect(formatCompensation({ disclosure: "PAID", currency: "INR", minimum: null, maximum: null, payPeriod: "" })).toBe("Paid");
  });

  it("formats locations and deterministic company fallbacks", () => {
    expect(formatOpportunityLocation("REMOTE", "", "India")).toBe("Remote · India");
    expect(formatOpportunityLocation("HYBRID", "Mumbai", "")).toBe("Mumbai");
    expect(formatOpportunityLocation("IN_OFFICE", "", "")).toBe("In office");
    expect(companyInitials("Tella Learning Labs")).toBe("TL");
    expect(companyInitials("")).toBe("OP");
  });
});
