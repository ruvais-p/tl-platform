import { describe, expect, it } from "vitest";
import { isAllowedLearnerRequest } from "./learner-proxy-policy";

const id = "123e4567-e89b-12d3-a456-426614174000";

describe("learner proxy allowlist", () => {
  it("allows only the learner read and progress surface", () => {
    expect(isAllowedLearnerRequest("GET", "courses")).toBe(true);
    expect(isAllowedLearnerRequest("GET", `courses/${id}`)).toBe(true);
    expect(isAllowedLearnerRequest("GET", "me/activity-progress")).toBe(true);
    expect(isAllowedLearnerRequest("POST", `activities/${id}/complete`)).toBe(true);
    expect(isAllowedLearnerRequest("POST", `learning-checks/${id}/submit`)).toBe(true);
    expect(isAllowedLearnerRequest("POST", `courses/${id}/chat`)).toBe(true);
  });

  it("does not expose curriculum mutations or arbitrary backend paths", () => {
    expect(isAllowedLearnerRequest("PATCH", `courses/${id}`)).toBe(false);
    expect(isAllowedLearnerRequest("POST", "courses")).toBe(false);
    expect(isAllowedLearnerRequest("GET", `courses/${id}/chat`)).toBe(false);
    expect(isAllowedLearnerRequest("GET", "students")).toBe(false);
    expect(isAllowedLearnerRequest("GET", "../../admin")).toBe(false);
  });
});
