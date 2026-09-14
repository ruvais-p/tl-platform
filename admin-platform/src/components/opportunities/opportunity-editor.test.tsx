import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StaffOpportunity } from "@/lib/opportunities/types";
import { EligibilityRuleEditor } from "./eligibility-rule-editor";
import { emptyOpportunity, toInput, validateOpportunityInput } from "./opportunity-editor";

describe("opportunity editor contracts", () => {
  it("allows an incomplete titled draft but blocks invalid publication combinations", () => {
    expect(validateOpportunityInput({ ...emptyOpportunity, title: "Early draft" })).toEqual({});
    const errors = validateOpportunityInput({ ...emptyOpportunity, title: "Hybrid role", workplace_mode: "HYBRID" }, true);
    expect(errors.company_name).toBeTruthy();
    expect(errors.physical_location).toBeTruthy();
    expect(errors.description_markdown).toBeTruthy();
    expect(validateOpportunityInput({ ...emptyOpportunity, title: "Range", compensation_min: "100", compensation_max: "10" }).compensation_max).toBeTruthy();
  });

  it("hydrates recognized rule/version data without loss", () => {
    const input = toInput({
      ...emptyOpportunity,
      id: "opportunity-1",
      is_open: false,
      lifecycle_status: "DRAFT",
      employment_type_label: "Internship",
      workplace_mode_label: "Remote",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      eligibility_rules: { version: 1, match: "ANY", conditions: [{ fact: "GROUP_GRADE", operator: "IN", values: ["11", "12"] }] },
    } as StaffOpportunity);
    expect(input.eligibility_rules).toEqual({ version: 1, match: "ANY", conditions: [{ fact: "GROUP_GRADE", operator: "IN", values: ["11", "12"] }] });
  });

  it("offers all rule types and supports add/change/remove with keyboard controls", () => {
    const onChange = vi.fn();
    const { rerender } = render(<EligibilityRuleEditor value={{ version: 1, match: "ALL", conditions: [] }} onChange={onChange} relations={{ groups: [{ id: "group-1", name: "Grade 11" }], courses: [], learningChecks: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Add condition" }));
    const added = onChange.mock.calls[0][0];
    expect(added.conditions).toHaveLength(1);
    rerender(<EligibilityRuleEditor value={added} onChange={onChange} relations={{ groups: [{ id: "group-1", name: "Grade 11" }], courses: [], learningChecks: [] }} />);
    const fact = screen.getByLabelText("Condition 1 fact") as HTMLSelectElement;
    expect(fact.options).toHaveLength(6);
    fireEvent.change(fact, { target: { value: "GROUP_GRADE" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ conditions: [expect.objectContaining({ fact: "GROUP_GRADE" })] }));
    fireEvent.click(screen.getByRole("button", { name: "Remove condition 1" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ conditions: [] }));
  });
});
