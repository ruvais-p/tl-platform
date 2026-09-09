import { describe, expect, it } from "vitest";
import { isAllowedProxyRequest } from "./proxy-policy";

const id = "123e4567-e89b-12d3-a456-426614174000";

describe("proxy allowlist", () => {
  it("allows curriculum CRUD and actions", () => {
    expect(isAllowedProxyRequest("GET", "courses")).toBe(true);
    expect(isAllowedProxyRequest("PATCH", `activities/${id}`)).toBe(true);
    expect(isAllowedProxyRequest("POST", "experiments")).toBe(true);
    expect(isAllowedProxyRequest("PATCH", `experiments/${id}`)).toBe(true);
    expect(isAllowedProxyRequest("POST", `courses/${id}/publish`)).toBe(true);
    expect(isAllowedProxyRequest("POST", `subtopics/${id}/reorder_activities`)).toBe(true);
  });

  it("allows only intended chatbot configuration operations", () => {
    expect(isAllowedProxyRequest("GET", "course-chatbot-configs")).toBe(true);
    expect(isAllowedProxyRequest("POST", "course-chatbot-configs")).toBe(true);
    expect(isAllowedProxyRequest("PATCH", `course-chatbot-configs/${id}`)).toBe(true);
    expect(isAllowedProxyRequest("DELETE", `course-chatbot-configs/${id}`)).toBe(false);
  });

  it("rejects arbitrary and mismatched routes", () => {
    expect(isAllowedProxyRequest("GET", "auth/me")).toBe(false);
    expect(isAllowedProxyRequest("POST", `courses/${id}`)).toBe(false);
    expect(isAllowedProxyRequest("GET", "../../admin")).toBe(false);
  });
});
