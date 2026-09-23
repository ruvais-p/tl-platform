import { describe, expect, it } from "vitest";

import { isAllowedStaffProxyRequest } from "./staff-proxy-policy";

const id = "123e4567-e89b-12d3-a456-426614174000";

describe("staff proxy allowlist", () => {
  it("allows management resources and guarded account routes", () => {
    expect(isAllowedStaffProxyRequest("GET", "media-assets")).toBe(true);
    expect(isAllowedStaffProxyRequest("POST", "learning-check-questions")).toBe(
      true,
    );
    expect(isAllowedStaffProxyRequest("PATCH", `student-groups/${id}`)).toBe(
      true,
    );
    expect(isAllowedStaffProxyRequest("POST", "auth/users")).toBe(true);
    expect(
      isAllowedStaffProxyRequest("PATCH", "auth/groups/3/permissions"),
    ).toBe(true);
    expect(isAllowedStaffProxyRequest("GET", "auth/staff-summary")).toBe(true);
    expect(isAllowedStaffProxyRequest("GET", "assessment-attempts")).toBe(
      true,
    );
    expect(isAllowedStaffProxyRequest("GET", "course-support/conversations")).toBe(true);
    expect(isAllowedStaffProxyRequest("GET", `course-support/conversations/${id}/messages`)).toBe(true);
    expect(isAllowedStaffProxyRequest("POST", `course-support/conversations/${id}/read`)).toBe(true);
    expect(isAllowedStaffProxyRequest("POST", `course-support/conversations/${id}/close`)).toBe(true);
    expect(isAllowedStaffProxyRequest("POST", "course-support/socket-ticket")).toBe(true);
    expect(isAllowedStaffProxyRequest("POST", "career-opportunities")).toBe(
      true,
    );
  });

  it("keeps read-only and sensitive routes constrained", () => {
    expect(isAllowedStaffProxyRequest("POST", "students")).toBe(false);
    expect(isAllowedStaffProxyRequest("DELETE", `media-assets/${id}`)).toBe(
      false,
    );
    expect(isAllowedStaffProxyRequest("DELETE", `auth/users/${id}`)).toBe(
      false,
    );
    expect(isAllowedStaffProxyRequest("PATCH", "auth/permissions")).toBe(false);
    expect(isAllowedStaffProxyRequest("POST", "assessment-attempts")).toBe(
      false,
    );
    expect(isAllowedStaffProxyRequest("GET", "../../admin")).toBe(false);
    expect(
      isAllowedStaffProxyRequest("GET", "media-assets/------------------------------------"),
    ).toBe(false);
  });

  it("allows only the required opportunity review actions", () => {
    expect(isAllowedStaffProxyRequest("POST", `career-opportunities/${id}/publish`)).toBe(true);
    expect(isAllowedStaffProxyRequest("POST", `career-opportunities/${id}/close`)).toBe(true);
    expect(isAllowedStaffProxyRequest("POST", `career-opportunities/${id}/archive`)).toBe(true);
    expect(isAllowedStaffProxyRequest("GET", "opportunity-applications")).toBe(true);
    expect(isAllowedStaffProxyRequest("GET", `opportunity-applications/${id}`)).toBe(true);
    expect(isAllowedStaffProxyRequest("POST", `opportunity-applications/${id}/transition`)).toBe(true);
    expect(isAllowedStaffProxyRequest("PATCH", `opportunity-applications/${id}/review_note`)).toBe(true);
    expect(isAllowedStaffProxyRequest("GET", `opportunity-applications/${id}/resume`)).toBe(true);

    expect(isAllowedStaffProxyRequest("DELETE", `opportunity-applications/${id}`)).toBe(false);
    expect(isAllowedStaffProxyRequest("POST", `opportunity-applications/${id}/resume`)).toBe(false);
  });
});
