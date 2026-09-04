import { afterEach, describe, expect, it, vi } from "vitest";
import { peopleApi } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("people client", () => {
  it("uses secured people routes for listing, creating, and updating", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => Response.json(JSON.parse(String(init?.body || "[]"))));
    vi.stubGlobal("fetch", fetchMock);
    await peopleApi.people();
    await peopleApi.roles();
    await peopleApi.create({ email: "student@example.com", first_name: "New", last_name: "Student", is_active: true, role_names: ["STUDENT"], password: "Temporary123!" });
    await peopleApi.update("person-id", { role_names: ["TEACHER"] });
    await peopleApi.studentAnalytics("student-id");
    expect(fetchMock.mock.calls.map((call) => [call[0], call[1]?.method || "GET"])).toEqual([
      ["/api/staff/auth/users", "GET"], ["/api/staff/auth/groups", "GET"],
      ["/api/staff/auth/users", "POST"], ["/api/staff/auth/users/person-id", "PATCH"],
      ["/api/people/students/student-id/analytics", "GET"],
    ]);
  });
});
