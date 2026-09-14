import { describe, expect, it } from "vitest";
import { auth0LoginUrl, parsePortal, safeContinuation } from "./continuation";

describe("Auth0 continuation validation", () => {
  it("keeps valid destinations within the requested workspace", () => {
    expect(safeContinuation("staff", "/opportunities/42?tab=review#candidate")).toBe("/opportunities/42?tab=review#candidate");
    expect(safeContinuation("learner", "/learn/courses/42?unit=3")).toBe("/learn/courses/42?unit=3");
  });

  it.each([
    "https://attacker.example/path",
    "//attacker.example/path",
    "/\\attacker.example/path",
    "/%E0%A4%A",
  ])("rejects unsafe destination %s", (candidate) => {
    expect(safeContinuation("staff", candidate)).toBe("/dashboard");
    expect(safeContinuation("learner", candidate)).toBe("/learn");
  });

  it("rejects cross-workspace and login-loop destinations", () => {
    expect(safeContinuation("staff", "/learn/courses/42")).toBe("/dashboard");
    expect(safeContinuation("learner", "/dashboard")).toBe("/learn");
    expect(safeContinuation("learner", "/learn/login?next=/learn/private")).toBe("/learn");
  });

  it("accepts only known portal identifiers", () => {
    expect(parsePortal("staff")).toBe("staff");
    expect(parsePortal("learner")).toBe("learner");
    expect(parsePortal("admin")).toBeNull();
  });

  it("places only a validated portal and destination in the Auth0 return path", () => {
    const url = new URL(auth0LoginUrl("staff", "https://attacker.example"), "https://platform.test");
    expect(url.pathname).toBe("/auth/login");
    expect(url.searchParams.get("returnTo")).toBe("/auth/complete?portal=staff&next=%2Fdashboard");
    expect(url.href).not.toContain("attacker.example");
  });
});
