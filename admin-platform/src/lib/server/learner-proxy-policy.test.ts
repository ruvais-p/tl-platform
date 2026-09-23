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
    expect(isAllowedLearnerRequest("GET", `courses/${id}/support-conversation`)).toBe(true);
    expect(isAllowedLearnerRequest("POST", `courses/${id}/support-conversation`)).toBe(true);
    expect(isAllowedLearnerRequest("GET", `course-support/conversations/${id}/messages`)).toBe(true);
    expect(isAllowedLearnerRequest("POST", `course-support/conversations/${id}/read`)).toBe(true);
    expect(isAllowedLearnerRequest("POST", "course-support/socket-ticket")).toBe(true);
  });

  it("does not expose curriculum mutations or arbitrary backend paths", () => {
    expect(isAllowedLearnerRequest("PATCH", `courses/${id}`)).toBe(false);
    expect(isAllowedLearnerRequest("POST", "courses")).toBe(false);
    expect(isAllowedLearnerRequest("GET", `courses/${id}/chat`)).toBe(false);
    expect(isAllowedLearnerRequest("GET", "students")).toBe(false);
    expect(isAllowedLearnerRequest("GET", "../../admin")).toBe(false);
  });

  it("allows only the required opportunity and application methods", () => {
    expect(isAllowedLearnerRequest("GET", "career/opportunities")).toBe(true);
    expect(isAllowedLearnerRequest("GET", `career/opportunities/${id}`)).toBe(true);
    expect(isAllowedLearnerRequest("POST", `career/opportunities/${id}/applications`)).toBe(true);
    expect(isAllowedLearnerRequest("GET", "career/applications/me")).toBe(true);
    expect(isAllowedLearnerRequest("POST", `career/applications/${id}/withdraw`)).toBe(true);
    expect(isAllowedLearnerRequest("GET", `career/applications/${id}/resume`)).toBe(true);

    expect(isAllowedLearnerRequest("PATCH", `career/opportunities/${id}`)).toBe(false);
    expect(isAllowedLearnerRequest("POST", `career/applications/${id}/resume`)).toBe(false);
    expect(isAllowedLearnerRequest("GET", "career/opportunities/------------------------------------")).toBe(false);
  });
});
