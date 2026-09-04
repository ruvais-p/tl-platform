import { describe, expect, it } from "vitest";
import { isAllowedPeopleProxyRequest } from "./people-proxy-policy";

describe("people proxy policy", () => {
  it("allows only the supported user-management operations", () => {
    const id = "8c93b495-4e5d-47d2-9841-bc5e3f47c2cd";
    expect(isAllowedPeopleProxyRequest("GET", "users")).toBe(true);
    expect(isAllowedPeopleProxyRequest("POST", "users")).toBe(true);
    expect(isAllowedPeopleProxyRequest("GET", "users/roles")).toBe(true);
    expect(isAllowedPeopleProxyRequest("PATCH", `users/${id}`)).toBe(true);
    expect(isAllowedPeopleProxyRequest("GET", `students/${id}/analytics`)).toBe(true);
    expect(isAllowedPeopleProxyRequest("DELETE", `users/${id}`)).toBe(false);
    expect(isAllowedPeopleProxyRequest("POST", "users/roles")).toBe(false);
  });
});
